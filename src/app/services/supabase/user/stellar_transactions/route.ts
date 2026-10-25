import { NextRequest, NextResponse } from "next/server";
import { Horizon, StrKey } from "@stellar/stellar-sdk";
import { Security } from "@/firewall";
import { supabaseServer } from "@/lib";
import walletNetworks from "@/config/json_conf/wallet_networks.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // always read fresh transactions

const HORIZON_PAGE_SIZE = 200; // Horizon's max per page
const MAX_HORIZON_PAGES = 5; // safety cap while finding 10 matching transactions
const TRANSACTION_PAGE_SIZE = 10;

type Incoming = {
  id: string;
  hash: string;
  date: string; // ISO timestamp
  amount: string;
  asset: string; // "XLM" or the asset code
  from: string | null;
  to: string | null;
  direction: "received" | "sent";
  type: string;
  status: "Completed";
  amountIn?: string;
  assetIn?: string;
  amountOut?: string;
  assetOut?: string;
};

export async function POST(params: NextRequest) {
  const auth = await Security(params);
  if (auth?.error) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const email = "email" in auth && typeof auth.email === "string" ? auth.email : "";
  if (!email) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const isTestnet = "network" in auth && auth.network === "stellar_testnet";
  const stellarConfig = walletNetworks.stellar;
  const usdt0 = stellarConfig.tokens.USDT0.classicAsset;
  const testnetUsdc = walletNetworks.stellar_testnet.tokens.USDC.classicAsset;
  const server = new Horizon.Server(isTestnet
    ? walletNetworks.stellar_testnet.swapConfig.horizonUrl
    : (process.env.STELLAR_HORIZON_URL || stellarConfig.swapConfig.horizonUrl));

  let cursor: unknown;
  let requestedAsset: string | null = null;
  let includeAllAssets = false;
  try {
    const body = await params.json();
    cursor = body.cursor;
    requestedAsset = typeof body.asset === "string" && /^[A-Za-z0-9]{1,12}$/.test(body.asset)
      ? body.asset.toUpperCase()
      : null;
    includeAllAssets = body.includeAllAssets === true;
  }
  catch { return NextResponse.json({ success: false, error: "Invalid request body." }, { status: 400 }); }

  // Only the PUBLIC address is needed, so the secret key is never selected.
  const { data, error } = await supabaseServer
    .from("tbl_wallet")
    .select("wallet_address")
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
    const transactions: Incoming[] = [];
    const appendTransaction = (transaction: Incoming) => {
      if (includeAllAssets || !requestedAsset || transaction.asset.toUpperCase() === requestedAsset) {
        transactions.push(transaction);
      }
    };
    let operations = server
      .payments()
      .forAccount(address)
      .order("desc")
      .limit(HORIZON_PAGE_SIZE);

    const validCursor = typeof cursor === "string" && /^[\d-]{1,128}$/.test(cursor) ? cursor : null;
    if (validCursor) operations = operations.cursor(validCursor);
    let page = await operations.call();
    let nextCursor: string | null = validCursor;
    let hasMore = false;

    for (let pageIndex = 0; pageIndex < MAX_HORIZON_PAGES; pageIndex++) {
      for (let recordIndex = 0; recordIndex < page.records.length; recordIndex++) {
        const rec = page.records[recordIndex];
        const r = rec as unknown as Record<string, string>;
        nextCursor = r.paging_token ?? nextCursor;

        // First funding of the account
        if (r.type === "create_account" && r.account === address) {
          appendTransaction({
            id: r.id,
            hash: r.transaction_hash ?? r.id,
            date: r.created_at,
            amount: r.starting_balance,
            asset: "XLM",
            from: r.funder ?? null,
            to: address,
            direction: "received",
            type: r.type,
            status: "Completed",
          });
          if (transactions.length >= TRANSACTION_PAGE_SIZE) {
            hasMore = recordIndex < page.records.length - 1 || page.records.length === HORIZON_PAGE_SIZE;
            break;
          }
          continue;
        }

        // Stellar contract deposits can show up as invoke-host-function
        // payment records, rather than classic payment operations.
        if (r.type === "invoke_host_function" && Array.isArray(r.asset_balance_changes)) {
          const changes = r.asset_balance_changes as Array<Record<string, unknown>>;
          if (isTestnet) {
            const movement = changes.find((change) => {
              if (change.asset_type !== "credit_alphanum4" && change.asset_type !== "credit_alphanum12") return false;
              if (change.asset_code !== testnetUsdc.code || change.asset_issuer !== testnetUsdc.issuer) return false;
              return (change.type === "transfer" && (change.from === address || change.to === address)) ||
                (change.type === "mint" && change.to === address) ||
                (change.type === "burn" && change.from === address);
            });
            if (movement && typeof movement.amount === "string") {
              const direction = movement.to === address || movement.type === "mint" ? "received" : "sent";
              appendTransaction({
                id: r.id,
                hash: r.transaction_hash ?? r.id,
                date: r.created_at,
                amount: movement.amount,
                asset: testnetUsdc.code,
                from: typeof movement.from === "string" ? movement.from : null,
                to: typeof movement.to === "string" ? movement.to : null,
                direction,
                type: "paiflow_deposit",
                status: "Completed",
              });
              if (transactions.length >= TRANSACTION_PAGE_SIZE) {
                hasMore = recordIndex < page.records.length - 1 || page.records.length === HORIZON_PAGE_SIZE;
                break;
              }
            }
            continue;
          }

          // Soroban USDT0 OFT activity is exposed as an invoke-host-function
          // payment record with SAC balance changes. Tag only burns from this
          // wallet, transfers into the configured OFT, and mints to this wallet.
          const bridgeChange = changes.find((change) => {
            if (change.asset_type !== "credit_alphanum4" && change.asset_type !== "credit_alphanum12") return false;
            if (change.asset_code !== usdt0.code || change.asset_issuer !== usdt0.issuer) return false;
            const from = typeof change.from === "string" ? change.from : "";
            const to = typeof change.to === "string" ? change.to : "";
            return (change.type === "burn" && from === address) ||
              (change.type === "transfer" && from === address && to === stellarConfig.tokens.USDT0.oftContract) ||
              (change.type === "mint" && to === address);
          });

          if (bridgeChange && typeof bridgeChange.amount === "string") {
            const received = bridgeChange.type === "mint";
            appendTransaction({
              id: r.id,
              hash: r.transaction_hash ?? r.id,
              date: r.created_at,
              amount: bridgeChange.amount,
              asset: usdt0.code,
              from: typeof bridgeChange.from === "string" ? bridgeChange.from : null,
              to: typeof bridgeChange.to === "string" ? bridgeChange.to : null,
              direction: received ? "received" : "sent",
              type: "bridge_transfer",
              status: "Completed",
            });
            if (transactions.length >= TRANSACTION_PAGE_SIZE) {
              hasMore = recordIndex < page.records.length - 1 || page.records.length === HORIZON_PAGE_SIZE;
              break;
            }
          }
          continue;
        }

        // Payments to or from this wallet (plain payment or path payment).
        const isPayment =
          r.type === "payment" ||
          r.type === "path_payment_strict_send" ||
          r.type === "path_payment_strict_receive";

        if (isPayment && (r.to === address || r.from === address)) {
          const isSelfPathPayment = r.type !== "payment" && r.from === address && r.to === address;
          const sourceAsset = r.source_asset_type === "native" ? "XLM" : r.source_asset_code;
          const destinationAsset = r.asset_type === "native" ? "XLM" : r.asset_code;
          appendTransaction({
            id: r.id,
            hash: r.transaction_hash ?? r.id,
            date: r.created_at,
            amount: r.amount,
            asset: destinationAsset,
            from: r.from ?? null,
            to: r.to ?? null,
            direction: isSelfPathPayment ? "sent" : r.to === address ? "received" : "sent",
            type: isSelfPathPayment ? "swap" : r.type,
            status: "Completed",
            ...(isSelfPathPayment && typeof r.source_amount === "string" && typeof sourceAsset === "string" && typeof destinationAsset === "string"
              ? {
                  amountIn: r.source_amount,
                  assetIn: sourceAsset,
                  amountOut: r.amount,
                  assetOut: destinationAsset,
                }
              : {}),
          });
          if (transactions.length >= TRANSACTION_PAGE_SIZE) {
            hasMore = recordIndex < page.records.length - 1 || page.records.length === HORIZON_PAGE_SIZE;
            break;
          }
        }
      }

      if (transactions.length >= TRANSACTION_PAGE_SIZE) break;

      const last = page.records[page.records.length - 1];
      if (!last || page.records.length < HORIZON_PAGE_SIZE) {
        hasMore = false;
        break;
      }

      page = await page.next();
      hasMore = page.records.length > 0;
    }

    return NextResponse.json({
      success: true,
      funded: true,
      address,
      asset: requestedAsset,
      transactions,
      nextCursor: hasMore ? nextCursor : null,
      hasMore,
    });
  } catch (e) {
    // Horizon returns 404 for an address that was never funded on this network
    if ((e as { response?: { status?: number } })?.response?.status === 404) {
      return NextResponse.json({ success: true, funded: false, address, transactions: [], nextCursor: null, hasMore: false });
    }

    console.error(e);
    return NextResponse.json({ success: false, error: "Could not reach the Stellar network" }, { status: 502 });
  }
}
