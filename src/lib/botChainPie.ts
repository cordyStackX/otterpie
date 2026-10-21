import { Contract, formatUnits, isAddress, JsonRpcProvider } from "ethers";
import config from "@/config/json_conf/token_address.json";

export const BOT_CHAIN_PIE_TOKEN_ADDRESS = config.token_address;

const BOT_CHAIN_ID = 677;
const provider = new JsonRpcProvider(
	process.env.BOT_CHAIN_RPC_URL || "https://rpc.botchain.ai",
	BOT_CHAIN_ID,
	{ staticNetwork: true },
);
const pieContract = new Contract(
	BOT_CHAIN_PIE_TOKEN_ADDRESS,
	["function balanceOf(address account) view returns (uint256)"],
	provider,
);

/** Read the PIE token balance held by an existing BOT Chain wallet address. */
export async function getBotChainPieBalance(walletAddress: string): Promise<string> {
	if (!isAddress(walletAddress)) {
		throw new Error("Invalid BOT Chain wallet address.");
	}

	const rawBalance = await pieContract.getFunction("balanceOf").staticCall(walletAddress);
	return formatUnits(rawBalance, 18);
}
