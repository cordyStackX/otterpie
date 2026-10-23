import { NextRequest, NextResponse } from "next/server";
import { Contract, JsonRpcProvider, formatEther, formatUnits, isAddress } from "ethers"; // ethers v6
import { Security } from "@/firewall";
import { BOT_CHAIN_PIE_TOKEN_ADDRESS, getBotChainPieBalance, supabaseServer } from "@/lib";
import walletNetworks from "@/config/json_conf/wallet_networks.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // always read a fresh balance

const botChainConfig = walletNetworks.bot_chain;
const BOT_CHAIN_ID = botChainConfig.bridge.chainId;
const USDT_ADDRESS = botChainConfig.bridge.usdtToken;
const ERC20_ABI = botChainConfig.balanceConfig.erc20Abi;
const BOT_CHAIN_RPC_URL = process.env.BOT_CHAIN_RPC_URL || botChainConfig.bridge.rpcUrl;

// staticNetwork skips the extra "which chain are you?" call on every request
const provider = new JsonRpcProvider(BOT_CHAIN_RPC_URL, BOT_CHAIN_ID, {
  staticNetwork: true,
});
const BOT_CHAIN_EXPLORER_ORIGIN = new URL(
  process.env.BOT_CHAIN_EXPLORER_API_URL || botChainConfig.explorer.apiUrl,
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

async function getUsdtBalance(address: string): Promise<string> {
  const usdt = new Contract(USDT_ADDRESS, ERC20_ABI, provider);
  const [balance, decimals] = await Promise.all([
    usdt.getFunction("balanceOf").staticCall(address) as Promise<bigint>,
    usdt.getFunction("decimals").staticCall() as Promise<bigint>,
  ]);
  return formatUnits(balance, Number(decimals));
}

export async function POST(params: NextRequest) {
  const auth = await Security(params);
  if (auth?.error) {
    if (auth.error instanceof NextResponse) return auth.error;
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const email = "email" in auth && typeof auth.email === "string" ? auth.email : "";
  if (!email) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  // Reading a balance only needs the PUBLIC address, so the private key is
  // never selected, decrypted or held in memory here.
  const { data, error } = await supabaseServer
    .from("tbl_wallet")
    .select("wallet_address, token_balance")
    .eq("email", email)
    .in("network", ["bot_chain", "otterpie_bot_chain"])
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
      { asset: "PIE", issuer: null, contract: BOT_CHAIN_PIE_TOKEN_ADDRESS, balance: await getPieBalance(address) },
      { asset: "USDT", issuer: null, contract: USDT_ADDRESS, balance: await getUsdtBalance(address) },
    ];

    const savedTokens = Array.isArray(data?.token_balance) ? data.token_balance : [];
    const customTokens = savedTokens.filter((token: unknown) => token && typeof token === "object" &&
      (token as { type?: unknown }).type === "evm" && isAddress((token as { address?: string }).address ?? ""));
    const importedResults = await Promise.allSettled(customTokens.map(async (token: { address: string; symbol?: string; decimals?: number }) => {
      const contract = new Contract(token.address, ERC20_ABI, provider);
      const [rawBalance, decimals] = await Promise.all([
        contract.getFunction("balanceOf").staticCall(address) as Promise<bigint>,
        contract.getFunction("decimals").staticCall() as Promise<bigint>,
      ]);
      return {
        asset: typeof token.symbol === "string" ? token.symbol : "ERC-20",
        issuer: null,
        balance: formatUnits(rawBalance, Number(decimals)),
        decimals: Number(decimals),
        contract: token.address,
        custom: true,
      };
    }));
    const importedBalances = importedResults.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);

    // Same shape as the Stellar route so the dashboard can treat both alike
    return NextResponse.json({
      success: true,
      funded: [...balances, ...importedBalances].some((item) => Number(item.balance) > 0),
      address,
      balances: [...balances, ...importedBalances],
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: "Could not reach BOT Chain" }, { status: 502 });
  }
}
