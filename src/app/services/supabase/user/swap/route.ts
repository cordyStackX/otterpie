import { NextRequest, NextResponse } from "next/server";
import {
	Contract,
	JsonRpcProvider,
	Wallet,
	formatUnits,
	isAddress,
	parseEther,
	parseUnits,
} from "ethers";
import bcrypt from "bcrypt";
import { supabaseServer } from "@/lib";
import { decryptText, rateLimit, Security } from "@/firewall";
import { BOT_CHAIN_PIE_TOKEN_ADDRESS } from "@/lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHAIN_ID = 677;
const ROUTER_ADDRESS = "0x1414eD29FdFD322c3c0a830330ed982E2D629e76";
const WBOT_ADDRESS = "0xD5452816194a3784dBa983426cCe7c122F4abd30";
const PIE_BOT_PAIR_ADDRESS = "0xa7a7796b5ec5ea2fdec1f94a3e71fa027f7cf45b";
const provider = new JsonRpcProvider(
	process.env.BOT_CHAIN_RPC_URL || "https://rpc.botchain.ai",
	CHAIN_ID,
	{ staticNetwork: true },
);

const routerAbi = [
	"function getAmountsOut(uint amountIn, address[] memory path) view returns (uint[] memory amounts)",
	"function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) payable returns (uint[] memory amounts)",
	"function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) returns (uint[] memory amounts)",
];
const tokenAbi = [
	"function balanceOf(address account) view returns (uint256)",
	"function decimals() view returns (uint8)",
	"function allowance(address owner, address spender) view returns (uint256)",
	"function approve(address spender, uint256 amount) returns (bool)",
];
const pairAbi = [
	"function token0() view returns (address)",
	"function token1() view returns (address)",
	"function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
];

type SwapDirection = "PIE_TO_BOT" | "BOT_TO_PIE";

function getSwapPath(direction: SwapDirection): string[] {
	return direction === "PIE_TO_BOT"
		? [BOT_CHAIN_PIE_TOKEN_ADDRESS, WBOT_ADDRESS]
		: [WBOT_ADDRESS, BOT_CHAIN_PIE_TOKEN_ADDRESS];
}

function parseSwapRequest(value: unknown): { direction: SwapDirection; amount: string; slippage: number } | null {
	if (!value || typeof value !== "object") return null;
	const body = value as Record<string, unknown>;
	if (body.direction !== "PIE_TO_BOT" && body.direction !== "BOT_TO_PIE") return null;
	if (typeof body.amount !== "string" || !/^\d+(?:\.\d{1,18})?$/.test(body.amount.trim())) return null;
	const slippage = typeof body.slippage === "number" ? body.slippage : 1;
	if (!Number.isFinite(slippage) || slippage < 0.1 || slippage > 5) return null;
	return { direction: body.direction, amount: body.amount.trim(), slippage };
}

async function getAmounts(direction: SwapDirection, amountText: string) {
	const pie = new Contract(BOT_CHAIN_PIE_TOKEN_ADDRESS, tokenAbi, provider);
	const decimals = Number(await pie.getFunction("decimals").staticCall());
	if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) throw new Error("PIE token decimals are invalid.");
	const amountIn = direction === "PIE_TO_BOT" ? parseUnits(amountText, decimals) : parseEther(amountText);
	if (amountIn <= BigInt(0)) throw new Error("Enter an amount greater than zero.");
	const router = new Contract(ROUTER_ADDRESS, routerAbi, provider);
	const amounts = await router.getFunction("getAmountsOut").staticCall(amountIn, getSwapPath(direction)) as bigint[];
	if (amounts.length < 2 || amounts[amounts.length - 1] <= BigInt(0)) {
		throw new Error("The PIE/BOT pool has no usable quote for this amount.");
	}
	return {
		amountIn,
		amountOut: amounts[amounts.length - 1],
		inputDecimals: direction === "PIE_TO_BOT" ? decimals : 18,
		outputDecimals: direction === "PIE_TO_BOT" ? 18 : decimals,
	};
}

export async function GET() {
	try {
		const pair = new Contract(PIE_BOT_PAIR_ADDRESS, pairAbi, provider);
		const pie = new Contract(BOT_CHAIN_PIE_TOKEN_ADDRESS, tokenAbi, provider);
		const [token0, token1, reserves, pieDecimalsValue] = await Promise.all([
			pair.getFunction("token0").staticCall() as Promise<string>,
			pair.getFunction("token1").staticCall() as Promise<string>,
			pair.getFunction("getReserves").staticCall() as Promise<[bigint, bigint, bigint]>,
			pie.getFunction("decimals").staticCall() as Promise<bigint>,
		]);
		const pieAddress = BOT_CHAIN_PIE_TOKEN_ADDRESS.toLowerCase();
		const wbotAddress = WBOT_ADDRESS.toLowerCase();
		if (![token0.toLowerCase(), token1.toLowerCase()].includes(pieAddress) ||
			![token0.toLowerCase(), token1.toLowerCase()].includes(wbotAddress)) {
			throw new Error("The configured pool does not contain PIE and wrapped BOT.");
		}
		const reservePie = token0.toLowerCase() === pieAddress ? reserves[0] : reserves[1];
		const reserveWbot = token0.toLowerCase() === wbotAddress ? reserves[0] : reserves[1];
		if (reservePie <= BigInt(0) || reserveWbot <= BigInt(0)) {
			return NextResponse.json({ success: false, error: "Pool rate is not available yet." }, { status: 503 });
		}
		const pieDecimals = Number(pieDecimalsValue);
		const pieReserve = Number(formatUnits(reservePie, pieDecimals));
		const botReserve = Number(formatUnits(reserveWbot, 18));
		if (!Number.isFinite(pieReserve) || !Number.isFinite(botReserve) || pieReserve <= 0 || botReserve <= 0) {
			throw new Error("Pool reserves could not be formatted.");
		}
		return NextResponse.json({
			success: true,
			pair: "PIE/BOT",
			pieToBot: botReserve / pieReserve,
			botToPie: pieReserve / botReserve,
			updatedAt: new Date().toISOString(),
		}, { headers: { "Cache-Control": "no-store, max-age=0" } });
	} catch (error) {
		console.error("Could not read PIE/BOT pool rate:", error);
		return NextResponse.json({ success: false, error: "Could not load the live PIE/BOT pool rate." }, { status: 503 });
	}
}

function getSafeError(error: unknown): string {
	const message = error instanceof Error ? error.message : "Swap failed.";
	if (/insufficient|revert|liquidity|slippage|deadline/i.test(message)) return message.slice(0, 240);
	return "Could not complete the swap. Check your balances and BOT Chain RPC, then try again.";
}

export async function POST(request: NextRequest) {
	const auth = await Security(request);
	if (!auth || auth.error) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
	const email = "email" in auth && typeof auth.email === "string" ? auth.email : "";
	if (!email) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

	const rate = rateLimit(request, { windowMs: 60_000, max: 8, keyPrefix: "BOT_Chain_swap" });
	if (!rate.allowed) {
		return NextResponse.json({ success: false, error: "Too many swap requests. Please wait and try again." }, { status: 429 });
	}

	let body: Record<string, unknown>;
	try {
		const parsedBody: unknown = await request.json();
		if (!parsedBody || typeof parsedBody !== "object") throw new Error("invalid body");
		body = parsedBody as Record<string, unknown>;
	} catch {
		return NextResponse.json({ success: false, error: "Invalid request." }, { status: 400 });
	}

	const swap = parseSwapRequest(body);
	if (!swap) {
		return NextResponse.json({ success: false, error: "Choose a direction, amount, and slippage from 0.1% to 5%." }, { status: 400 });
	}
	if (!isAddress(BOT_CHAIN_PIE_TOKEN_ADDRESS)) {
		return NextResponse.json({ success: false, error: "PIE token address is invalid." }, { status: 500 });
	}

	const walletResult = await supabaseServer
		.from("tbl_wallet")
		.select("wallet_address, network")
		.eq("email", email)
		.in("network", ["bot_chain", "otterpie_bot_chain"])
		.maybeSingle();
	if (walletResult.error) return NextResponse.json({ success: false, error: "Could not load your BOT Chain wallet." }, { status: 500 });
	const walletRecord = walletResult.data;
	if (!walletRecord?.wallet_address || !isAddress(walletRecord.wallet_address)) {
		return NextResponse.json({ success: false, error: "BOT Chain wallet not found." }, { status: 404 });
	}

	try {
		const quote = await getAmounts(swap.direction, swap.amount);
		if (body.action === "quote") {
			return NextResponse.json({
				success: true,
				quote: {
					amountIn: swap.amount,
					amountOut: formatUnits(quote.amountOut, quote.outputDecimals),
					minimumReceived: formatUnits(quote.amountOut * BigInt(Math.floor((100 - swap.slippage) * 100)) / BigInt(10_000), quote.outputDecimals),
					slippage: swap.slippage,
				},
			});
		}
		if (body.action !== "swap") return NextResponse.json({ success: false, error: "Choose quote or swap." }, { status: 400 });

		const password = typeof body.password === "string" ? body.password : "";
		if (!password) return NextResponse.json({ success: false, error: "Confirm the swap with your account password." }, { status: 400 });
		const accountResult = await supabaseServer.from("tbl_auth").select("password").eq("email", email).maybeSingle();
		if (accountResult.error || !accountResult.data?.password) {
			return NextResponse.json({ success: false, error: "Could not verify your password." }, { status: 500 });
		}
		if (!(await bcrypt.compare(password, accountResult.data.password))) {
			return NextResponse.json({ success: false, error: "Password confirmation failed." }, { status: 401 });
		}
		const secretResult = await supabaseServer
			.from("tbl_wallet")
			.select("secret_key")
			.eq("email", email)
			.in("network", ["bot_chain", "otterpie_bot_chain"])
			.maybeSingle();
		if (secretResult.error) return NextResponse.json({ success: false, error: "Could not load your wallet signing key." }, { status: 500 });
		if (!secretResult.data?.secret_key) return NextResponse.json({ success: false, error: "Wallet signing key not found." }, { status: 404 });

		const privateKey = decryptText(secretResult.data.secret_key, process.env.WALLET_BANK_KEY || "");
		const signer = new Wallet(privateKey, provider);
		if (signer.address.toLowerCase() !== walletRecord.wallet_address.toLowerCase()) {
			return NextResponse.json({ success: false, error: "Wallet key does not match the stored wallet." }, { status: 500 });
		}
		const network = await provider.getNetwork();
		if (network.chainId !== BigInt(CHAIN_ID)) {
			return NextResponse.json({ success: false, error: "BOT Chain RPC is connected to the wrong network." }, { status: 503 });
		}

		const pie = new Contract(BOT_CHAIN_PIE_TOKEN_ADDRESS, tokenAbi, signer);
		const router = new Contract(ROUTER_ADDRESS, routerAbi, signer);
		const feeData = await provider.getFeeData();
		const gasPrice = feeData.maxFeePerGas ?? feeData.gasPrice;
		if (!gasPrice) return NextResponse.json({ success: false, error: "Could not estimate BOT Chain fees." }, { status: 503 });
		const feeOptions = feeData.maxFeePerGas
			? { maxFeePerGas: feeData.maxFeePerGas, maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ?? feeData.maxFeePerGas }
			: { gasPrice };
		const minimumOut = quote.amountOut * BigInt(Math.floor((100 - swap.slippage) * 100)) / BigInt(10_000);
		const deadline = Math.floor(Date.now() / 1000) + 120;
		let approvalHash: string | undefined;
		const nativeBalance = await provider.getBalance(signer.address);

		if (swap.direction === "PIE_TO_BOT") {
			const pieBalance = BigInt(await pie.getFunction("balanceOf").staticCall(signer.address));
			if (quote.amountIn > pieBalance) return NextResponse.json({ success: false, error: "Insufficient PIE balance." }, { status: 400 });
			const allowance = BigInt(await pie.getFunction("allowance").staticCall(signer.address, ROUTER_ADDRESS));
			if (allowance < quote.amountIn) {
				const approve = pie.getFunction("approve");
				const approvalGas = await approve.estimateGas(ROUTER_ADDRESS, quote.amountIn);
				const approval = await approve.send(ROUTER_ADDRESS, quote.amountIn, { gasLimit: approvalGas, ...feeOptions });
				approvalHash = approval.hash;
				await approval.wait(1);
			}
		} else {
			if (quote.amountIn > nativeBalance) return NextResponse.json({ success: false, error: "Insufficient BOT balance." }, { status: 400 });
		}

		const path = getSwapPath(swap.direction);
		let tx;
		if (swap.direction === "BOT_TO_PIE") {
			const method = router.getFunction("swapExactETHForTokens");
			const gasLimit = await method.estimateGas(minimumOut, path, signer.address, deadline, { value: quote.amountIn });
			if (quote.amountIn + gasLimit * gasPrice > nativeBalance) {
				return NextResponse.json({ success: false, error: "Keep extra BOT in your wallet to pay the swap network fee." }, { status: 400 });
			}
			tx = await method.send(minimumOut, path, signer.address, deadline, { value: quote.amountIn, gasLimit, ...feeOptions });
		} else {
			const method = router.getFunction("swapExactTokensForETH");
			const gasLimit = await method.estimateGas(quote.amountIn, minimumOut, path, signer.address, deadline);
			if (gasLimit * gasPrice > nativeBalance) {
				return NextResponse.json({ success: false, error: "Your BOT balance is not enough to cover the swap network fee." }, { status: 400 });
			}
			tx = await method.send(quote.amountIn, minimumOut, path, signer.address, deadline, { gasLimit, ...feeOptions });
		}
		const receipt = await tx.wait(1);
		if (!receipt || receipt.status !== 1) throw new Error("Swap transaction failed on-chain.");

		return NextResponse.json({
			success: true,
			txHash: tx.hash,
			approvalHash,
			amountIn: formatUnits(quote.amountIn, quote.inputDecimals),
			minimumReceived: formatUnits(minimumOut, quote.outputDecimals),
			message: "Swap completed on BOT Chain.",
		});
	} catch (error) {
		console.error("BOT Chain swap failed:", error);
		return NextResponse.json({ success: false, error: getSafeError(error) }, { status: 400 });
	}
}
