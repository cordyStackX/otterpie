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
    ],
  },
  {
    title: "Wallets and custody",
    paragraphs: [
      "Otterpie creates a blockchain wallet for the network you select. The wallet’s private key is stored in encrypted form on the service’s server. The server can decrypt that key to support wallet functions and transfers you request. This means the wallet is not self-custodial while used through Otterpie; the service operator has technical access to the key.",
      "You are responsible for protecting your wallet credentials and for safely storing any private key you choose to reveal or export. Never share a private key with anyone you do not trust. Otterpie cannot recover assets sent to an incorrect address or on an incorrect network.",
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
      updated="October 21, 2026"
      sections={sections}
      otherPage={{ href: "/privacy", label: "Privacy Policy" }}
    />
  );
}
