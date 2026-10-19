import { Wallet } from "ethers";

const BOT_CHAIN_ID = 677;
const BOT_CHAIN_NAME = "BOT Chain";

interface EvmWallet {
	walletAddress: string;
	secretKey: string;
	chainId: number;
	chainName: string;
}

export default function createBotChainWallet(): EvmWallet {
	const wallet = Wallet.createRandom();

	return {
		walletAddress: wallet.address,
		secretKey: wallet.privateKey,
		chainId: BOT_CHAIN_ID,
		chainName: BOT_CHAIN_NAME,
	};
}