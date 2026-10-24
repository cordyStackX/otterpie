import { NextRequest, NextResponse } from "next/server";
import { Keypair, StrKey, Transaction, TransactionBuilder } from "@stellar/stellar-sdk";
import { Paiflow, PaiflowApiError, signPrepared } from "@paiflow/sdk";
import bcrypt from "bcrypt";
import { decryptText, rateLimit, Security } from "@/firewall";
import { supabaseServer } from "@/lib";
import walletNetworks from "@/config/json_conf/wallet_networks.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAIFLOW_ORIGIN = "https://beta.app.paiflow.xyz";
const DEPLOYMENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function fail(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

function parseAmount(value: unknown): { display: string; stroops: string } | null {
  if (typeof value !== "string" || !/^\d+(?:\.\d{1,7})?$/.test(value.trim())) return null;
  const display = value.trim();
  const [whole, fraction = ""] = display.split(".");
  const stroops = (BigInt(whole) * BigInt(10_000_000) + BigInt(fraction.padEnd(7, "0"))).toString();
  if (BigInt(stroops) <= BigInt(0)) return null;
  return { display, stroops };
}

export async function POST(request: NextRequest) {
  const auth = await Security(request);
  if (!auth || auth.error) return fail("Unauthorized", 401);
  if (!("network" in auth) || auth.network !== "stellar_testnet") {
    return fail("Paiflow payments are available on Stellar Testnet only.", 400);
  }
  const email = "email" in auth && typeof auth.email === "string" ? auth.email : "";
  if (!email) return fail("Unauthorized", 401);

  const rate = rateLimit(request, { windowMs: 60_000, max: 3, keyPrefix: "Stellar_paiflow_pay" });
  if (!rate.allowed) return fail("Too many payment attempts. Wait a minute and try again.", 429);

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object") return fail("Invalid request body.");
    body = parsed as Record<string, unknown>;
  } catch {
    return fail("Invalid request body.");
  }

  const amount = parseAmount(body.amount);
  if (!amount) return fail("Enter a USDC amount greater than zero, up to 7 decimal places.");
  if (typeof body.password !== "string" || !body.password) return fail("Confirm the payment with your account password.");
  const apiToken = process.env.PAIFLOW_API_TOKEN;
  if (!apiToken) return fail("Paiflow payment is not configured. Set the server-only PAIFLOW_API_TOKEN for this deployment.", 503);

  const [{ data: account, error: accountError }, { data: wallet, error: walletError }] = await Promise.all([
    supabaseServer.from("tbl_auth").select("password, paiflow_address").eq("email", email).maybeSingle(),
    supabaseServer.from("tbl_wallet").select("wallet_address, secret_key").eq("email", email).eq("network", "stellar").maybeSingle(),
  ]);
  if (accountError || walletError) {
    console.error("Paiflow payment account lookup failed.");
    return fail("Could not load your wallet details.", 500);
  }
  if (!account?.password || !wallet?.wallet_address || !wallet.secret_key) return fail("Stellar wallet not found.", 404);
  if (!DEPLOYMENT_ID.test(account.paiflow_address ?? "")) {
    return fail("Link a Paiflow deployment ID before paying.");
  }
  if (!(await bcrypt.compare(body.password, account.password))) return fail("Password confirmation failed.", 401);
  if (!StrKey.isValidEd25519PublicKey(wallet.wallet_address)) return fail("Stored Stellar address is invalid.", 500);

  const config = walletNetworks.stellar_testnet.swapConfig;
  const paiflow = new Paiflow({ baseUrl: PAIFLOW_ORIGIN, token: apiToken });
  const deployment = paiflow.deployment(account.paiflow_address);

  try {
    const { data: capabilities } = await deployment.capabilities.get();
    const inputAsset = capabilities.inputAsset;
    const isConfiguredUsdc = inputAsset?.kind === "known" && inputAsset.symbol === "USDC" ||
      inputAsset?.kind === "custom" && inputAsset.code === "USDC" &&
      inputAsset.issuer === walletNetworks.stellar_testnet.tokens.USDC.classicAsset.issuer;
    if (capabilities.network !== "testnet" || capabilities.triggerType !== "deposit" ||
      capabilities.operations.execute.status !== "supported" || !isConfiguredUsdc) {
      return fail("Link a confirmed Stellar Testnet On Receive deployment configured for the supported USDC asset and Execute.");
    }

    const prepared = await deployment.execute.prepare({ from: wallet.wallet_address, amount: amount.stroops });
    if (prepared.data.network !== "testnet" || prepared.data.networkPassphrase !== config.networkPassphrase) {
      return fail("Paiflow returned an invalid or non-Testnet payment transaction.", 502);
    }

    const signer = Keypair.fromSecret(decryptText(wallet.secret_key, process.env.WALLET_BANK_KEY || ""));
    if (signer.publicKey() !== wallet.wallet_address) return fail("Wallet key does not match the stored Stellar wallet.", 500);
    const signed = await signPrepared(prepared, async ({ xdr, networkPassphrase, walletAddress }) => {
      if (networkPassphrase !== config.networkPassphrase || walletAddress !== wallet.wallet_address) {
        throw new Error("Prepared transaction wallet or network mismatch.");
      }
      const transaction = TransactionBuilder.fromXdr(xdr, networkPassphrase);
      if (!(transaction instanceof Transaction) || transaction.source !== wallet.wallet_address) {
        throw new Error("Prepared transaction does not match the Stellar wallet.");
      }
      transaction.sign(signer);
      return { signedXdr: transaction.toXDR() };
    }, { walletAddress: wallet.wallet_address, expectedNetwork: "testnet" });

    const { data: submission } = await deployment.execute.submit(signed.submission, {
      ...signed.submissionOptions,
      wait: false,
    });
    if (submission?.status === "FAILED") {
      return fail(submission.error?.message || "The Paiflow payment failed on Testnet.", 400);
    }
    if (submission.status !== "SUCCESS" && submission.status !== "PENDING") {
      return fail("Paiflow returned an unknown payment status. Check the transaction before retrying.", 502);
    }

    return NextResponse.json({
      success: true,
      amount: amount.display,
      status: submission.status,
      txHash: submission.txHash,
      explorerUrl: `https://stellar.expert/explorer/testnet/tx/${encodeURIComponent(submission.txHash)}`,
    });
  } catch (error) {
    if (error instanceof PaiflowApiError) {
      console.error("Paiflow API request failed:", error.status, error.code, error.metadata.requestId ?? "no request id");
      const status = error.status >= 500 ? 502 : error.status;
      return fail(status === 502 ? "Paiflow could not complete the request. Check the payment status before retrying." : error.message, status);
    }
    console.error("Paiflow Testnet payment failed.");
    return fail("Could not prepare or submit the Paiflow Testnet payment.", 502);
  }
}
