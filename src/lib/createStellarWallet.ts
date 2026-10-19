import { Keypair } from "@stellar/stellar-sdk";

interface StellarWallet {
	walletAddress: string;
	secretKey: string;
}

export default function createStellarWallet(): StellarWallet {
	const keypair = Keypair.random();

	return {
		walletAddress: keypair.publicKey(),
		secretKey: keypair.secret(),
	};
}
