import { NextRequest, NextResponse } from "next/server";
import { JsonRpcProvider, formatEther, formatUnits, isAddress } from "ethers"; // ethers v6
import { Security } from "@/firewall";
import { BOT_CHAIN_PIE_TOKEN_ADDRESS, getBotChainPieBalance, supabaseServer } from "@/lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // always read a fresh balance

const BOT_CHAIN_ID = 677;

// Public BOT Chain mainnet RPC. Optionally override it in .env.local with
// BOT_CHAIN_RPC_URL (server-only, no NEXT_PUBLIC_ prefix) if you get a private
// endpoint or run your own node later.
const BOT_CHAIN_RPC_URL = process.env.BOT_CHAIN_RPC_URL || "https://rpc.botchain.ai";

// staticNetwork skips the extra "which chain are you?" call on every request
const provider = new JsonRpcProvider(BOT_CHAIN_RPC_URL, BOT_CHAIN_ID, {
  staticNetwork: true,
});
const BOT_CHAIN_EXPLORER_ORIGIN = new URL(
  process.env.BOT_CHAIN_EXPLORER_API_URL || "https://scan.botchain.ai/api",
).origin;

async function fetchExplorerJson(path: string) {
  const response = await fetch(new URL(`/api/v2${path}`, BOT_CHAIN_EXPLORER_ORIGIN), {
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`BOT Chain explorer returned ${response.status}`);
  return response.json() as Promise<Record<string, unknown>>;
}

async function getNativeBalance(address: string): Promise<string> {
  try {
    return formatEther(await provider.getBalance(address));
  } catch (rpcError) {
    console.warn("BOT Chain RPC balance read failed; trying the explorer", rpcError);
    const body = await fetchExplorerJson(`/addresses/${address}`);
    const coinBalance = body.coin_balance;
    return typeof coinBalance === "string" ? formatEther(BigInt(coinBalance)) : "0";
  }
}

async function getPieBalance(address: string): Promise<string> {
  try {
    return await getBotChainPieBalance(address);
  } catch (rpcError) {
    console.warn("PIE RPC balance read failed; trying the explorer", rpcError);
    const body = await fetchExplorerJson(`/addresses/${address}/token-balances`);
    const tokenBalances = Array.isArray(body) ? body : [];
    const tokenBalance = tokenBalances.find((entry) => {
      if (!entry || typeof entry !== "object") return false;
      const token = (entry as { token?: { address_hash?: string; address?: string } }).token;
      return (token?.address_hash ?? token?.address)?.toLowerCase() === BOT_CHAIN_PIE_TOKEN_ADDRESS.toLowerCase();
    }) as { value?: string; token?: { decimals?: string | number | null } } | undefined;
    if (!tokenBalance?.value) return "0";
    return formatUnits(BigInt(tokenBalance.value), Number(tokenBalance.token?.decimals ?? 18));
  }
}

export async function POST(params: NextRequest) {
  const auth = await Security(params);
  if (auth?.error) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { email } = await params.json();

  // Reading a balance only needs the PUBLIC address, so the private key is
  // never selected, decrypted or held in memory here.
  const { data, error } = await supabaseServer
    .from("tbl_wallet")
    .select("wallet_address")
    .eq("email", email)
    // TODO: if this table holds both networks, filter by your network/chain column too
    // .eq("network", "bot_chain")
    .maybeSingle();

  if (error) {
    console.error("Supabase Query Error: ", error);
    return NextResponse.json({ success: false, error: "Something went wrong" }, { status: 500 });
  }

  const address = data?.wallet_address;
  if (!address) {
    return NextResponse.json({ success: false, error: "Wallet not found" }, { status: 404 });
  }

  if (!isAddress(address)) {
    console.error("Stored BOT Chain address is invalid");
    return NextResponse.json({ success: false, error: "Server misconfigured" }, { status: 500 });
  }

  try {
    const balance = await getNativeBalance(address);
    const balances = [
      { asset: "BOT", issuer: null, balance },
      { asset: "PIE", issuer: null, balance: await getPieBalance(address) },
    ];

    // Same shape as the Stellar route so the dashboard can treat both alike
    return NextResponse.json({
      success: true,
      funded: balances.some((item) => Number(item.balance) > 0),
      address,
      balances,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: "Could not reach BOT Chain" }, { status: 502 });
  }
}
