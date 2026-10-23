import { NextRequest, NextResponse } from "next/server";
import { Contract, JsonRpcProvider, isAddress } from "ethers";
import { StrKey } from "@stellar/stellar-sdk";
import { Security } from "@/firewall";
import { supabaseServer } from "@/lib";
import walletNetworks from "@/config/json_conf/wallet_networks.json";
import tokenAddressConfig from "@/config/json_conf/token_address.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const botChainConfig = walletNetworks.bot_chain;
const botChainPie = tokenAddressConfig.tokens.find((token) => token.walletNetwork === "bot_chain");
if (!botChainPie?.token_address) throw new Error("Missing BOT Chain PIE token configuration.");
const BOT_CHAIN_PIE_TOKEN_ADDRESS = botChainPie.token_address;
const provider = new JsonRpcProvider(
  process.env.BOT_CHAIN_RPC_URL || botChainConfig.bridge.rpcUrl,
  botChainConfig.bridge.chainId,
  { staticNetwork: true },
);
const metadataAbi = botChainConfig.manageTokens.metadataAbi;
type ManagedToken =
  | { type: "evm"; address: string; symbol: string; decimals: number }
  | { type: "stellar"; code: string; issuer: string };

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function POST(request: NextRequest) {
  const auth = await Security(request);
  if (!auth || auth.error) return errorResponse("Unauthorized", 401);
  const email = "email" in auth && typeof auth.email === "string" ? auth.email : "";
  if (!email) return errorResponse("Unauthorized", 401);

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object") return errorResponse("Invalid request.");
    body = parsed as Record<string, unknown>;
  } catch {
    return errorResponse("Invalid request.");
  }

  const network = body.network;
  if (network !== "bot_chain" && network !== "otterpie_bot_chain" && network !== "stellar") {
    return errorResponse("Unsupported wallet network.");
  }
  const { data: wallet, error: walletError } = await supabaseServer.from("tbl_wallet")
    .select("token_balance")
    .eq("email", email)
    .eq("network", network)
    .maybeSingle();
  if (walletError) return errorResponse("Could not load this wallet's tokens.", 500);
  if (!wallet) return errorResponse("Wallet not found.", 404);

  const tokens: ManagedToken[] = Array.isArray(wallet.token_balance)
    ? wallet.token_balance.filter((token: unknown): token is ManagedToken => Boolean(token && typeof token === "object"))
    : [];
  if (body.action === "list") return NextResponse.json({ success: true, tokens });

  if (body.action === "add") {
    let token: ManagedToken;
    if (network === "stellar") {
      const code = typeof body.code === "string" ? body.code.trim() : "";
      const issuer = typeof body.issuer === "string" ? body.issuer.trim() : "";
      if (!/^[a-zA-Z0-9]{1,12}$/.test(code) || !StrKey.isValidEd25519PublicKey(issuer)) {
        return errorResponse("Enter a Stellar asset code and valid issuer public key.");
      }
      token = { type: "stellar", code, issuer };
    } else {
      const address = typeof body.address === "string" ? body.address.trim() : "";
      if (!isAddress(address)) return errorResponse("Enter a valid ERC-20 contract address.");
      if ([BOT_CHAIN_PIE_TOKEN_ADDRESS, botChainConfig.bridge.usdtToken].some((known) => known.toLowerCase() === address.toLowerCase())) {
        return errorResponse("That token is already included in your default wallet assets.");
      }
      try {
        const contract = new Contract(address, metadataAbi, provider);
        const [symbol, decimals] = await Promise.all([
          contract.getFunction("symbol").staticCall() as Promise<string>,
          contract.getFunction("decimals").staticCall() as Promise<bigint>,
        ]);
        if (!symbol || !Number.isInteger(Number(decimals)) || Number(decimals) < 0 || Number(decimals) > 36) {
          return errorResponse("That contract did not return valid ERC-20 token details.");
        }
        token = { type: "evm", address: address.toLowerCase(), symbol: symbol.slice(0, 32), decimals: Number(decimals) };
      } catch {
        return errorResponse("Could not read ERC-20 details on BOT Chain.");
      }
    }

    const duplicate = tokens.some((saved) => saved.type === token.type && (
      token.type === "evm" && saved.type === "evm"
        ? saved.address.toLowerCase() === token.address.toLowerCase()
        : token.type === "stellar" && saved.type === "stellar" && saved.code === token.code && saved.issuer === token.issuer
    ));
    if (duplicate) return errorResponse("This token is already in your wallet list.");
    if (tokens.length >= 50) return errorResponse("You can manage up to 50 custom tokens per wallet.");
    tokens.push(token);
  } else if (body.action === "remove") {
    const key = typeof body.key === "string" ? body.key : "";
    const remaining = tokens.filter((token) => token.type === "evm"
      ? `evm:${token.address.toLowerCase()}` !== key
      : `stellar:${token.code}:${token.issuer}` !== key);
    if (remaining.length === tokens.length) return errorResponse("Token not found.", 404);
    tokens.splice(0, tokens.length, ...remaining);
  } else if (body.action === "removeMany") {
    const keys = Array.isArray(body.keys) ? body.keys.filter((key): key is string => typeof key === "string") : [];
    if (keys.length === 0) return errorResponse("Select at least one token to remove.");
    const keysToRemove = new Set(keys);
    const remaining = tokens.filter((token) => !keysToRemove.has(token.type === "evm"
      ? `evm:${token.address.toLowerCase()}`
      : `stellar:${token.code}:${token.issuer}`));
    if (remaining.length === tokens.length) return errorResponse("None of the selected tokens were found.", 404);
    tokens.splice(0, tokens.length, ...remaining);
  } else {
    return errorResponse("Choose a supported token action.");
  }

  const { data: updatedWallets, error: updateError } = await supabaseServer.from("tbl_wallet")
    .update({ token_balance: tokens })
    .eq("email", email)
    .eq("network", network)
    .select("network");
  if (updateError) {
    console.error("Could not save managed wallet tokens:", {
      code: updateError.code,
      message: updateError.message,
      details: updateError.details,
      hint: updateError.hint,
    });
    return errorResponse("Could not save your wallet tokens. Check the server log for the database error.", 500);
  }
  if (!updatedWallets?.length) {
    console.error("Managed token update matched no wallet row.", { network });
    return errorResponse("Could not find the matching wallet to save these tokens.", 404);
  }
  return NextResponse.json({ success: true, tokens });
}
