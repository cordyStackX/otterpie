import { Horizon } from "@stellar/stellar-sdk";
import { NextRequest, NextResponse } from "next/server";
import { Security } from "@/firewall";
import walletNetworks from "@/config/json_conf/wallet_networks.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await Security(request);
  if (!auth || auth.error) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const network = "network" in auth ? auth.network : undefined;
  if (network !== "stellar" && network !== "stellar_testnet") {
    return NextResponse.json({ success: false, error: "This account is not using a Stellar network." }, { status: 400 });
  }

  let hash: unknown;
  try {
    hash = (await request.json())?.hash;
  } catch {
    return NextResponse.json({ success: false, error: "Enter a valid Stellar transaction hash." }, { status: 400 });
  }
  if (typeof hash !== "string" || !/^[a-fA-F0-9]{64}$/.test(hash)) {
    return NextResponse.json({ success: false, error: "Enter a valid Stellar transaction hash." }, { status: 400 });
  }

  const horizonUrl = network === "stellar_testnet"
    ? walletNetworks.stellar_testnet.swapConfig.horizonUrl
    : process.env.STELLAR_HORIZON_URL || walletNetworks.stellar.swapConfig.horizonUrl;

  try {
    const transaction = await new Horizon.Server(horizonUrl).transactions().transaction(hash).call();
    return NextResponse.json({
      success: true,
      transaction: {
        hash: transaction.hash,
        successful: transaction.successful,
        ledger: transaction.ledger,
        createdAt: transaction.created_at,
        feeCharged: transaction.fee_charged,
        sourceAccount: transaction.source_account,
        operationCount: transaction.operation_count,
        memo: transaction.memo,
      },
    });
  } catch (error) {
    const status = (error as { response?: { status?: number } })?.response?.status;
    if (status === 404) {
      return NextResponse.json({ success: false, error: "Transaction is not indexed by Horizon yet." }, { status: 404 });
    }
    console.error("Could not fetch Stellar transaction:", error);
    return NextResponse.json({ success: false, error: "Could not fetch the Stellar transaction." }, { status: 502 });
  }
}
