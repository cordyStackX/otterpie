import walletNetworks from "@/config/json_conf/wallet_networks.json";

export type WalletNetworkConfig = (typeof walletNetworks)[keyof typeof walletNetworks];

export const getWalletNetworkConfig = (
	network: string | null | undefined,
): WalletNetworkConfig | undefined => {
	if (!network) return undefined;
	return Object.values(walletNetworks).find((config) => config.aliases.includes(network));
};

export const isBotChainNetwork = (
	network: string | null | undefined,
): network is "bot_chain" | "otterpie_bot_chain" =>
	getWalletNetworkConfig(network)?.family === "bot_chain";

export const walletNetworkLabel = (network: string): string => {
	const config = getWalletNetworkConfig(network);
	const labels = config?.labels as Record<string, string> | undefined;
	return labels?.[network] ?? network.replaceAll("_", " ");
};

export const walletAssetLabel = (network: string, asset: string): string => {
	const labels = getWalletNetworkConfig(network)?.assetLabels as Record<string, string> | undefined;
	return labels?.[asset] ?? asset;
};
