import { NextRequest, NextResponse } from "next/server";
import { Horizon, StrKey } from "@stellar/stellar-sdk";
import { Security } from "@/firewall";
import { supabaseServer } from "@/lib";
import walletNetworks from "@/config/json_conf/wallet_networks.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // always read a fresh balance

type StellarBalance = { asset: string; issuer: string | null; balance: string; custom?: boolean; trustline?: boolean };
type ManagedStellarToken = { type: "stellar"; code: string; issuer: string };

function isManagedStellarToken(token: unknown): token is ManagedStellarToken {
  if (!token || typeof token !== "object") return false;
  const item = token as { type?: unknown; code?: unknown; issuer?: unknown };
  return item.type === "stellar" && typeof item.code === "string" && typeof item.issuer === "string";
}

export async function POST(params: NextRequest) {
  const auth = await Security(params);
  if (auth?.error) {
    if (auth.error instanceof NextResponse) return auth.error;
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const email = "email" in auth && typeof auth.email === "string" ? auth.email : "";
  if (!email) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const isTestnet = "network" in auth && auth.network === "stellar_testnet";
  const networkConfig = isTestnet ? walletNetworks.stellar_testnet : walletNetworks.stellar;
  const server = new Horizon.Server(isTestnet
    ? networkConfig.swapConfig.horizonUrl
    : (process.env.STELLAR_HORIZON_URL || networkConfig.swapConfig.horizonUrl));

  // Reading a balance only needs the PUBLIC address, so the secret key is
  // never selected, decrypted or held in memory here.
  const { data, error } = await supabaseServer
    .from("tbl_wallet")
    .select("wallet_address, token_balance")
    .eq("email", email)
    .eq("network", "stellar")
    .maybeSingle();

  if (error) {
    console.error("Supabase Query Error: ", error);
    return NextResponse.json({ success: false, error: "Something went wrong" }, { status: 500 });
  }

  const address = data?.wallet_address;
  if (!address) {
    return NextResponse.json({ success: false, error: "Wallet not found" }, { status: 404 });
  }

  if (!StrKey.isValidEd25519PublicKey(address)) {
    console.error("Stored Stellar address is invalid");
    return NextResponse.json({ success: false, error: "Server misconfigured" }, { status: 500 });
  }

  try {
    const account = await server.loadAccount(address);

    const balances: StellarBalance[] = account.balances.flatMap((b): StellarBalance[] => {
      switch (b.asset_type) {
        case "native":
          return [{ asset: "XLM", issuer: null, balance: b.balance }];
        case "liquidity_pool_shares":
          return [{ asset: `pool:${b.liquidity_pool_id}`, issuer: null, balance: b.balance }];
        case "credit_alphanum4":
        case "credit_alphanum12":
          return [{ asset: b.asset_code, issuer: b.asset_issuer, balance: b.balance }];
        default:
          return [];
      }
    });
    const configuredToken = isTestnet ? walletNetworks.stellar_testnet.tokens.USDC : walletNetworks.stellar.tokens.USDT0;
    const asset = configuredToken.classicAsset;
    const hasConfiguredTrustline = balances.some((item) => item.asset === asset.code && item.issuer === asset.issuer);

    const savedTokens: unknown[] = !isTestnet && Array.isArray(data?.token_balance) ? data.token_balance : [];
    const importedBalances: StellarBalance[] = savedTokens
      .filter(isManagedStellarToken)
      .map((token) => {
        const existing = balances.find((item) => item.asset === token.code && item.issuer === token.issuer);
        return existing ?? { asset: token.code, issuer: token.issuer, balance: "0", custom: true };
      });
    for (const imported of importedBalances) {
      if (!balances.some((item) => item.asset === imported.asset && item.issuer === imported.issuer)) balances.push(imported);
    }

    if (!hasConfiguredTrustline) {
      const placeholder = balances.find((item) => item.asset === asset.code && item.issuer === asset.issuer);
      if (placeholder) placeholder.trustline = false;
      else balances.push({ asset: asset.code, issuer: asset.issuer, balance: "0", trustline: false });
    }
    const managed = new Set(savedTokens.filter(isManagedStellarToken).map((token) => `${token.code}:${token.issuer}`));
    const visibleBalances = balances.filter((item) => item.asset === "XLM" ||
      (item.asset === asset.code && item.issuer === asset.issuer) ||
      (item.issuer !== null && managed.has(`${item.asset}:${item.issuer}`)));

    return NextResponse.json({ success: true, funded: true, address, balances: visibleBalances });
  } catch (e) {
    // Horizon returns 404 for an address that was never funded on this network
    if ((e as { response?: { status?: number } })?.response?.status === 404) {
      return NextResponse.json({ success: true, funded: false, address, balances: [] });
    }

    console.error(e);
    return NextResponse.json({ success: false, error: "Could not reach the Stellar network" }, { status: 502 });
  }
}
