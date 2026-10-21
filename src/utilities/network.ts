export const isBotChainNetwork = (
	network: string | null | undefined,
): network is "bot_chain" | "otterpie_bot_chain" =>
	network === "bot_chain" || network === "otterpie_bot_chain";

export const walletNetworkLabel = (network: string): string => {
	if (network === "otterpie_bot_chain") return "Otterpie BOT Chain";
	if (network === "bot_chain") return "BOT Chain Mainnet";
	return network.replaceAll("_", " ");
};
