import type { Metadata } from "next";
import LegalDocument, { type LegalSection } from "@/components/legal/LegalDocument";

export const metadata: Metadata = {
  title: "Terms of Service | Otterpie",
  description: "Terms for using Otterpie's wallet and payment-splitting service.",
};

const sections: LegalSection[] = [
  {
    title: "Using Otterpie",
    paragraphs: [
      "Otterpie provides account, wallet, transaction-viewing, and payment-allocation tools. These terms apply when you access or use the service. If you do not agree, do not use Otterpie.",
      "You are responsible for providing accurate account details, keeping your password and devices secure, and all activity made through your account. Contact the service operator promptly if you believe your account has been accessed without permission.",
      "Otterpie is in early alpha. Features may be incomplete, change without notice, be temporarily unavailable, or display delayed or inaccurate information. Use only amounts you can afford to lose, and verify transaction details independently before approving a mainnet transaction.",
      "Trade, AI Trade, NFT Market, and P2P pages marked under development are informational placeholders and do not currently provide trading, automated trading, NFT marketplace, or peer-to-peer trading services.",
    ],
  },
  {
    title: "Wallets and custody",
    paragraphs: [
      "Otterpie creates a blockchain wallet for the network you select. The wallet’s private key is stored in encrypted form on the service’s server. The server can decrypt that key to support wallet functions and transfers you request. This means the wallet is not self-custodial while used through Otterpie; the service operator has technical access to the key.",
      "You are responsible for protecting your wallet credentials and for safely storing any private key you choose to reveal or export. Never share a private key with anyone you do not trust. Otterpie cannot recover assets sent to an incorrect address or on an incorrect network.",
      "For Stellar accounts, Settings can switch the selected ledger between Stellar Mainnet and Stellar Testnet using the same wallet address and key. The networks have separate balances and transaction histories. Testnet funds, including Friendbot XLM and Test USDC, are for testing and have no intended real-world value. Check the selected network before signing.",
    ],
  },
  {
    title: "External wallets and WalletConnect",
    paragraphs: [
      "Supported bridge routes can connect an external EVM wallet using WalletConnect or a Tron wallet using TronLink. Connecting a wallet shares the public address and connection or network information needed for the flow. A connection alone does not submit a transaction; you must review and approve transaction requests in your wallet.",
      "WalletConnect, TronLink, and the wallet providers are independent services with their own terms, privacy practices, and availability. Otterpie does not receive the private keys for wallets connected through these providers. Review the network, token, amount, destination, and transaction details in your wallet before signing.",
    ],
  },
  {
    title: "Swaps and bridge transfers",
    paragraphs: [
      "The alpha supports BOT, PIE, and USDT swaps on BOT Chain, subject to available liquidity, contract behavior, and the quote shown in the app. Prices can move between quote and execution. Slippage, price impact, token behavior, low liquidity, or contract and network issues may cause a transaction to execute at a different result or fail; a failed transaction may still consume network fees.",
      "The USDT bridge currently supports transfers between BOT Chain and Ethereum, BNB Smart Chain, and Tron. Stellar accounts can bridge USDT0 outbound to Ethereum and Arbitrum One through LayerZero; inbound transfers to Stellar are not currently available in Otterpie. Bridge transfers depend on the relevant contracts, validators, destination network, and third-party wallet providers; delivery can be delayed or fail, and Otterpie cannot guarantee a completion time or recover assets sent to an incorrect destination.",
      "Stellar Testnet has no bridge support. Stellar Mainnet's configured USDT0 bridge route is separate from the BOT Chain USDT routes. Only use a route shown as available in the app, and check the source network, destination, token, amount, and fees before signing.",
      "Bridge fees and minimums depend on direction and the live bridge rules. The current BOT Chain bridge documentation describes an outbound fee and a minimum transfer amount; the app may show a live quote that changes. Source-network gas or resource fees may also apply. Review the quote and official bridge details before confirming.",
    ],
  },
  {
    title: "Friends and Paiflow",
    paragraphs: [
      "Friends lets you add confirmed Otterpie accounts by email, view their public wallet address, and send supported assets when the recipient wallet is on a compatible network. You are responsible for confirming that the account, address, asset, network, and amount are correct. A blockchain payment is independent of the friend-list relationship and cannot be reversed by removing a friend.",
      "Paiflow integration is currently limited to Stellar Testnet USDC deposit flows with Execute support. When you add a flow, you provide its deployment ID and a single-deployment Paiflow API token. Otterpie stores those credentials encrypted and uses them to request an execution after you confirm the payment with your account password. The server signs with your stored Stellar wallet. The flow's recipients and distribution rules are configured in Paiflow; Otterpie does not let you edit those recipients. Check the deployment, recipient rules, amount, and transaction status in Paiflow and the network explorer. Testnet transactions do not represent real-value payments.",
    ],
  },
  {
    title: "Blockchain transactions and network fees",
    paragraphs: [
      "Blockchain transfers are generally public and irreversible after confirmation. Before submitting a transfer, verify the destination address, network, token, and amount. You authorize Otterpie to submit a transfer when you complete the confirmation flow in the app.",
      "Transactions depend on third-party blockchain networks and providers. Network availability, fees, confirmation times, and protocol rules can change. Network fees are separate from Otterpie and are paid according to the network’s rules. Otterpie cannot reverse, cancel, or guarantee the outcome of a confirmed transaction.",
      "Displayed balances and transaction information may be delayed or incomplete while a network or provider is unavailable. They are informational and do not replace checking the relevant blockchain explorer or wallet.",
    ],
  },
  {
    title: "Acceptable use",
    paragraphs: ["Use Otterpie only in a lawful manner and do not interfere with the service or other users."],
    bullets: [
      "Do not attempt to access another person’s account, wallet, or data.",
      "Do not use the service to facilitate fraud, theft, sanctions evasion, or other unlawful activity.",
      "Do not probe, disrupt, overload, or bypass the service’s security controls.",
    ],
  },
  {
    title: "Availability and changes",
    paragraphs: [
      "Otterpie may change, suspend, or discontinue features to maintain or protect the service. We do not promise uninterrupted access or a particular transaction result. We will update this page when these terms change; continued use after an update means the updated terms apply, to the extent permitted by law.",
    ],
  },
  {
    title: "No financial or legal advice",
    paragraphs: [
      "Otterpie provides software tools, not financial, investment, tax, or legal advice. You are responsible for deciding whether to use a network or make a transaction and for understanding the risks and rules that apply to you.",
    ],
  },
  {
    title: "Your legal rights",
    paragraphs: [
      "The service is provided subject to rights and protections that cannot be excluded under applicable law. Nothing in these terms removes those rights. If any part of these terms cannot be enforced, the remaining parts continue to apply to the extent permitted by law.",
    ],
  },
];

export default function TermsPage() {
  return (
    <LegalDocument
      title="Terms of Service"
      summary="Please read these terms before using Otterpie to manage a wallet or submit a blockchain transaction."
      updated="October 25, 2026"
      sections={sections}
      otherPage={{ href: "/privacy", label: "Privacy Policy" }}
    />
  );
}
