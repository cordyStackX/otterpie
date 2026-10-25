import BotChainFeature from "./BotChainFeature";

export default function Trade() {
  return (
    <BotChainFeature
      title="Trade"
      description="BOT Chain trading tools are being prepared for Otterpie."
      details={["Review token prices and available trading routes.", "Swap supported BOT Chain assets from your Otterpie wallet.", "Review transaction details before confirming."]}
      actionLabel="Open Balance"
      actionHref="/user/balance"
    />
  );
}
