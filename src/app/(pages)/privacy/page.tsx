import type { Metadata } from "next";
import LegalDocument, { type LegalSection } from "@/components/legal/LegalDocument";

export const metadata: Metadata = {
  title: "Privacy Policy | Otterpie",
  description: "How Otterpie handles account, wallet, and service data.",
};

const sections: LegalSection[] = [
  {
    title: "Information we handle",
    paragraphs: ["Depending on how you use Otterpie, the service processes:"],
    bullets: [
      "Account details: store name, username, email address, and a password hash. The app does not need to store your account password in readable form.",
      "Wallet details: selected network, public wallet address, and the wallet private key, which is encrypted before it is stored. The server can decrypt the key to provide wallet features and submit transfers you request.",
      "Category settings: category names, icons, colors, allocation percentages, and goals.",
      "Transaction and balance information associated with your wallet addresses, retrieved from blockchain networks or their service providers.",
      "Service and device information such as request and security data, and analytics information collected through Google Analytics.",
    ],
  },
  {
    title: "How we use information",
    paragraphs: ["We use information to operate and improve Otterpie, including to:"],
    bullets: [
      "Create and secure accounts, verify email addresses, and provide password-reset links.",
      "Display wallet balances, transaction history, category allocations, and profile details.",
      "Submit a transfer after you request and confirm it in the app.",
      "Protect the service, investigate errors or misuse, and understand general site usage through analytics.",
      "Send service emails related to account confirmation and password resets.",
    ],
  },
  {
    title: "Wallets and public blockchains",
    paragraphs: [
      "Wallet addresses and confirmed blockchain transactions are public by design. Anyone may be able to view transactions associated with an address using public network tools. Blockchain records are maintained by the network, not by Otterpie, and we cannot remove or change a confirmed record.",
      "Wallet keys are encrypted in the database, but the Otterpie server can decrypt them to provide wallet features. Treat this as a service-operated wallet, not a self-custody wallet. Do not reveal a key unless you understand that anyone who obtains it may control the wallet.",
    ],
  },
  {
    title: "Service providers and sharing",
    paragraphs: [
      "We use service providers to run Otterpie. The current app connects to Supabase for account and wallet data, Google Analytics for site usage measurement, email delivery services for account messages, and blockchain network or RPC providers to read data and submit transactions. Those providers process information needed for their services under their own terms and privacy practices.",
      "We do not sell personal information. Information may also be disclosed when required by law, to protect users or the service, or as part of a transfer of the service or its assets, subject to applicable law.",
      "These providers may process information in countries other than yours. The exact server locations depend on the deployment and provider configuration.",
    ],
  },
  {
    title: "Cookies and analytics",
    paragraphs: [
      "Otterpie uses an HttpOnly session cookie to keep you signed in. The current session cookie is configured to expire after seven days. Google Analytics may use cookies or similar technologies to measure visits and site usage. You can manage or block cookies through your browser, though blocking the session cookie may prevent sign-in from working.",
    ],
  },
  {
    title: "Retention and account requests",
    paragraphs: [
      "We keep account and service information while it is needed to operate Otterpie, protect the service, meet legal obligations, and resolve disputes. The app does not currently provide a self-service account deletion control. To ask about access, correction, or deletion, contact the service operator through the official project page. Some records may need to be retained where the law allows or requires it, and public blockchain records cannot be erased by Otterpie.",
    ],
  },
  {
    title: "Your privacy choices",
    paragraphs: [
      "Depending on your location and applicable law, you may have rights to request information about, access, correct, object to, or request deletion or portability of personal data. You may also have the right to complain to your data protection authority. Requests can be made through the service operator’s official project page; we may need to verify your identity before responding.",
    ],
  },
  {
    title: "Security and changes to this policy",
    paragraphs: [
      "We use safeguards intended to protect account and wallet information, including password hashing, access controls, and encryption of stored wallet keys. No online service or storage method can be guaranteed completely secure.",
      "We may update this policy as Otterpie changes. The date at the top shows when this page was last updated. Material changes should be communicated through the service where appropriate.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Privacy Policy"
      summary="This page explains what information Otterpie handles, why it is used, and the choices you may have."
      updated="October 21, 2026"
      sections={sections}
      otherPage={{ href: "/terms", label: "Terms of Service" }}
    />
  );
}
