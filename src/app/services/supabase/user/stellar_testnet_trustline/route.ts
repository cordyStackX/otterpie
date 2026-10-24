import { Asset, Horizon, Keypair, Operation, StrKey, TransactionBuilder } from "@stellar/stellar-sdk";
import bcrypt from "bcrypt";
import { decryptText, rateLimit, Security } from "@/firewall";
import { supabaseServer } from "@/lib";
import walletNetworks from "@/config/json_conf/wallet_networks.json";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const testnet = walletNetworks.stellar_testnet;
const usdc = testnet.tokens.USDC.classicAsset;
const server = new Horizon.Server(testnet.swapConfig.horizonUrl);

function responseError(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

export async function POST(request: NextRequest) {
  const auth = await Security(request);
  if (!auth || auth.error) return responseError("Unauthorized", 401);
  const email = "email" in auth && typeof auth.email === "string" ? auth.email : "";
  if (!email) return responseError("Unauthorized", 401);
  if (!("network" in auth) || auth.network !== "stellar_testnet") {
    return responseError("Switch to Stellar Testnet before creating its USDC trustline.", 400);
  }

  const limit = rateLimit(request, { windowMs: 60_000, max: 3, keyPrefix: "Stellar_Testnet_USDC_trustline" });
  if (!limit.allowed) return responseError("Too many trustline requests. Please wait and try again.", 429);

  let password: unknown;
  try { password = (await request.json())?.password; }
  catch { return responseError("Confirm trustline setup with your account password."); }
  if (typeof password !== "string" || !password) {
    return responseError("Confirm trustline setup with your account password.");
  }

  const { data: authAccount, error: authError } = await supabaseServer
    .from("tbl_auth")
    .select("password")
    .eq("email", email)
    .maybeSingle();
  if (authError || !authAccount?.password) return responseError("Could not verify your account password.", 500);
  if (!(await bcrypt.compare(password, authAccount.password))) return responseError("Password confirmation failed.", 401);

  const { data: wallet, error: walletError } = await supabaseServer
    .from("tbl_wallet")
    .select("wallet_address, secret_key")
    .eq("email", email)
    .eq("network", "stellar")
    .maybeSingle();
  if (walletError) {
    console.error("Could not load Stellar wallet for Testnet trustline:", walletError);
    return responseError("Could not load your Stellar wallet.", 500);
  }
  if (!wallet?.wallet_address || !wallet.secret_key || !StrKey.isValidEd25519PublicKey(wallet.wallet_address)) {
    return responseError("Your Stellar wallet could not be loaded.", 404);
  }

  try {
    const account = await server.loadAccount(wallet.wallet_address);
    const hasTrustline = account.balances.some((balance) =>
      (balance.asset_type === "credit_alphanum4" || balance.asset_type === "credit_alphanum12") &&
      balance.asset_code === usdc.code && balance.asset_issuer === usdc.issuer,
    );
    if (hasTrustline) {
      return NextResponse.json({ success: true, trustline: true, message: "USDC Testnet trustline already exists." });
    }

    const signer = Keypair.fromSecret(decryptText(wallet.secret_key, process.env.WALLET_BANK_KEY || ""));
    if (signer.publicKey() !== wallet.wallet_address) {
      return responseError("Wallet key does not match the stored Stellar wallet.", 500);
    }

    const transaction = new TransactionBuilder(account, {
      fee: String(await server.fetchBaseFee()),
      networkPassphrase: testnet.swapConfig.networkPassphrase,
    })
      .addOperation(Operation.changeTrust({ asset: new Asset(usdc.code, usdc.issuer) }))
      .setTimeout(30)
      .build();
    transaction.sign(signer);
    const submitted = await server.submitTransaction(transaction);

    return NextResponse.json({
      success: true,
      trustline: true,
      txHash: submitted.hash,
      message: "USDC trustline created on Stellar Testnet.",
    });
  } catch (error) {
    console.error("Stellar Testnet USDC trustline setup failed:", error);
    if ((error as { response?: { status?: number } })?.response?.status === 404) {
      return responseError("Fund your Stellar Testnet account with Friendbot before creating a trustline.", 400);
    }
    return responseError("Could not create the Testnet USDC trustline. Make sure your account has enough test XLM for the reserve and transaction fee.", 502);
  }
}
