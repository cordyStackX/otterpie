"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Fetch_to } from "@/utilities";
import { getWalletNetworkConfig, isBotChainNetwork, walletNetworkLabel } from "@/utilities/network";
import routes from "@/routes/jwt.json";
import QRCode from "qrcode";

type IconProps = { className?: string };

const iconProps = {
  xmlns: "http://www.w3.org/2000/svg",
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const DashboardIcon = ({ className }: IconProps) => (
  <svg {...iconProps} className={className}>
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </svg>
);

const BalanceIcon = ({ className }: IconProps) => (
  <svg {...iconProps} className={className}>
    <rect x="3" y="6" width="18" height="13" rx="2" />
    <path d="M3 10h18" />
    <path d="M16 15h2" />
  </svg>
);

const CategoriesIcon = ({ className }: IconProps) => (
  <svg {...iconProps} className={className}>
    <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" />
    <circle cx="7.5" cy="7.5" r="1" />
  </svg>
);

const FriendsIcon = ({ className }: IconProps) => (
  <svg {...iconProps} className={className}>
    <circle cx="9" cy="8" r="3" />
    <path d="M3.5 20v-1.5A4.5 4.5 0 0 1 8 14h2a4.5 4.5 0 0 1 4.5 4.5V20" />
    <path d="M16 5.2a3 3 0 0 1 0 5.6M17 14h.5a4 4 0 0 1 4 4v2" />
  </svg>
);

const TransactionsIcon = ({ className }: IconProps) => (
  <svg {...iconProps} className={className}>
    <path d="M7 4 3 8l4 4" />
    <path d="M3 8h14" />
    <path d="m17 12 4 4-4 4" />
    <path d="M21 16H7" />
  </svg>
);

const BridgeIcon = ({ className }: IconProps) => (
  <svg {...iconProps} className={className}>
    <path d="M4 7h11a3 3 0 0 1 0 6h-2" />
    <path d="m9 4-3 3 3 3" />
    <path d="M20 17H9a3 3 0 0 1 0-6h2" />
    <path d="m15 14 3 3-3 3" />
  </svg>
);

const PaiflowIcon = ({ className }: IconProps) => (
  <svg {...iconProps} className={className}>
    <circle cx="5" cy="6" r="2" />
    <circle cx="19" cy="6" r="2" />
    <circle cx="12" cy="18" r="2" />
    <path d="M7 6h10M6.5 7.5l4.3 8M17.5 7.5l-4.3 8" />
  </svg>
);

const SettingsIcon = ({ className }: IconProps) => (
  <svg {...iconProps} className={className}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
  </svg>
);

const LogoutIcon = ({ className }: IconProps) => (
  <svg {...iconProps} className={className}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="m16 17 5-5-5-5" />
    <path d="M21 12H9" />
  </svg>
);

const MenuIcon = () => (
  <svg {...iconProps} width={22} height={22}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

const CloseIcon = () => (
  <svg {...iconProps} width={22} height={22}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

const navItems = [
  { href: "/user", label: "Dashboard", icon: DashboardIcon },
  { href: "/user/balance", label: "Balance", icon: BalanceIcon },
  { href: "/user/bridge", label: "Bridge", icon: BridgeIcon },
  { href: "/user/add-category", label: "Categories", icon: CategoriesIcon },
  { href: "/user/friends", label: "Friends", icon: FriendsIcon },
  { href: "/user/transactions", label: "Transactions", icon: TransactionsIcon },
  { href: "/user/setting", label: "Settings", icon: SettingsIcon },
];
type SidebarProps = {
  userName?: string;
  userEmail?: string;
  wallet_address?: string;
  network?: string;
  sessionLoading?: boolean;
  onLogout?: () => void;
};

export default function Sidebar({
  userName = "Your account",
  userEmail,
  wallet_address,
  network,
  sessionLoading = false,
  onLogout,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isStellarNetwork = getWalletNetworkConfig(network)?.family === "stellar";
  const [isOpen, setIsOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [walletQrCode, setWalletQrCode] = useState("");
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Close the mobile menu on navigation
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Close the mobile menu with Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  // Confirm dialog: focus Cancel on open, close with Escape
  useEffect(() => {
    if (!isConfirmOpen) return;
    cancelRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsConfirmOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isConfirmOpen]);

  useEffect(() => {
    let cancelled = false;
    setWalletQrCode("");
    if (!wallet_address) {
      return;
    }

    const qrPayload = isBotChainNetwork(network)
      ? `ethereum:${wallet_address}@677`
      : wallet_address;

    QRCode.toDataURL(qrPayload, {
      width: 320,
      margin: 2,
      errorCorrectionLevel: "M",
    }).then((url) => {
      if (!cancelled) setWalletQrCode(url);
    }).catch(() => {
      if (!cancelled) setWalletQrCode("");
    });

    return () => {
      cancelled = true;
    };
  }, [wallet_address, network]);

  const handleConfirmLogout = async() => {
    setIsConfirmOpen(false);
    const response = await Fetch_to("GET", routes.deauth);
    if (response.success) {
      router.replace("/auth/login");
    }
    onLogout?.();
  };

  const isActive = (href: string) =>
    href === "/user"
      ? pathname === "/user"
      : pathname === href || pathname.startsWith(`${href}/`);

  const initial = userName.trim().charAt(0).toUpperCase() || "U";
  const accountExplorer = wallet_address
    ? isStellarNetwork
      ? {
          href: `https://stellar.expert/explorer/${network === "stellar_testnet" ? "testnet" : "public"}/account/${encodeURIComponent(wallet_address)}`,
          label: "View on Stellar Expert",
        }
      : isBotChainNetwork(network)
        ? {
            href: `https://scan.botchain.ai/address/${encodeURIComponent(wallet_address)}`,
            label: "View on BOT Chain Explorer",
          }
        : null
    : null;

  const handleCopyAddress = async () => {
    if (!wallet_address) return;
    try {
      await navigator.clipboard.writeText(wallet_address);
      setCopiedAddress(true);
      window.setTimeout(() => setCopiedAddress(false), 1800);
    } catch {
      setCopiedAddress(false);
    }
  };

  const handleDownloadQrCode = async () => {
    if (!walletQrCode) return;

    const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new window.Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    });

    try {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) return;

      canvas.width = 1080;
      canvas.height = 1350;

      const brandColors = getComputedStyle(document.documentElement);
      const primaryColor = brandColors.getPropertyValue("--primary-hex").trim() || "#0077b6";
      const secondaryColor = brandColors.getPropertyValue("--secondary-hex").trim() || "#90e0ef";

      // Keep the page bright for QR scanning and use Otterpie's blue palette for the frame.
      const background = context.createLinearGradient(0, 0, 1080, 1350);
      background.addColorStop(0, "#ffffff");
      background.addColorStop(1, "#f3fbfd");
      context.fillStyle = background;
      context.fillRect(0, 0, canvas.width, canvas.height);

      context.save();
      context.globalAlpha = 0.18;
      context.fillStyle = secondaryColor;
      context.beginPath();
      context.arc(75, 210, 210, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = primaryColor;
      context.beginPath();
      context.arc(1025, 1120, 245, 0, Math.PI * 2);
      context.fill();
      context.restore();

      const otterSources = [
        "/icons/otters/otter-personal.svg",
        "/icons/otters/otter-supplier.svg",
        "/icons/otters/otter-rent.svg",
        "/icons/otters/otter-savings.svg",
        "/icons/otters/otter-default.svg",
      ];
      const otters = await Promise.all(otterSources.map((src) => loadImage(src).catch(() => null)));
      context.save();
      context.globalAlpha = 0.13;
      const otterPositions = [
        [54, 105, 118], [890, 88, 126], [35, 425, 110], [935, 505, 106],
        [32, 870, 120], [918, 980, 122], [160, 1160, 100], [815, 1190, 110],
      ];
      otterPositions.forEach(([x, y, size], index) => {
        const otter = otters[index % otters.length];
        if (otter) context.drawImage(otter, x, y, size, size);
      });
      context.restore();

      // Centered brand header.
      const logo = await loadImage("/logo.svg").catch(() => null);
      if (logo) context.drawImage(logo, 476, 76, 128, 128);
      context.fillStyle = primaryColor;
      context.font = "700 54px system-ui, sans-serif";
      const brandLabel = "Otterpie";
      context.textAlign = "left";
      context.fillStyle = primaryColor;
      context.font = "700 54px system-ui, sans-serif";
      const brandWidth = context.measureText(brandLabel).width;
      context.fillText(brandLabel, (canvas.width - brandWidth) / 2, 272);

      // The QR sits on a quiet white panel with generous scan margin.
      context.fillStyle = "rgba(255,255,255,0.94)";
      context.beginPath();
      context.roundRect(176, 366, 728, 728, 38);
      context.fill();
      context.strokeStyle = secondaryColor;
      context.lineWidth = 3;
      context.stroke();

      const qrImage = await loadImage(walletQrCode);
      context.imageSmoothingEnabled = false;
      context.drawImage(qrImage, 220, 410, 640, 640);
      context.imageSmoothingEnabled = true;

      context.textAlign = "center";
      context.fillStyle = primaryColor;
      context.font = "650 32px system-ui, sans-serif";
      context.fillText("Scan to deposit", 540, 1170);
      context.fillStyle = primaryColor;
      context.font = "400 23px system-ui, sans-serif";
      context.fillText(isBotChainNetwork(network) ? `${walletNetworkLabel(network)} · EVM wallet` : "Stellar wallet", 540, 1212);

      const imageBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!imageBlob) return;

      const imageUrl = URL.createObjectURL(imageBlob);
      const link = document.createElement("a");
      link.href = imageUrl;
      link.download = "otterpie-deposit-qr.png";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(imageUrl), 1000);
    } catch {
      // Keep the download button quiet if the browser cannot render the branded card.
    }
  };

  if (sessionLoading) {
    return (
      <aside aria-label="Loading navigation" aria-busy="true" className="fixed inset-x-0 top-0 z-40 flex flex-col border-b border-foreground/10 bg-background md:inset-y-0 md:right-auto md:h-dvh md:w-60 md:border-b-0 md:border-r">
        <div className="flex h-16 items-center justify-between px-4 md:px-5">
          <div className="flex items-center gap-2">
            <Image src="/logo.svg" alt="" width={32} height={32} priority />
            <span className="text-lg font-semibold tracking-tight text-primary">Otterpie<span className="text-secondary">.</span></span>
          </div>
          <span aria-hidden="true" className="h-10 w-10 animate-pulse rounded-md bg-foreground/[0.06] md:hidden" />
        </div>
        <nav className="hidden flex-1 flex-col gap-2 border-t border-foreground/10 px-3 py-4 md:flex">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} aria-hidden="true" className="flex h-9 items-center gap-3 rounded-md px-3">
              <span className="h-[18px] w-[18px] animate-pulse rounded bg-foreground/10" />
              <span className={`h-3 animate-pulse rounded bg-foreground/10 ${index === 0 ? "w-20" : index === 1 ? "w-14" : "w-24"}`} />
            </div>
          ))}
          <div className="mt-3 border-t border-foreground/10 px-3 pt-4">
            <div aria-hidden="true" className="mb-2 h-3 w-14 animate-pulse rounded bg-foreground/10" />
            <div className="flex h-9 items-center gap-3 px-3">
              <span className="h-[18px] w-[18px] animate-pulse rounded bg-foreground/10" />
              <span className="h-3 w-16 animate-pulse rounded bg-foreground/10" />
            </div>
          </div>
        </nav>
        <div aria-hidden="true" className="hidden border-t border-foreground/10 p-3 md:block">
          <div className="flex items-center gap-3 px-2 py-2">
            <span className="h-9 w-9 animate-pulse rounded-full bg-foreground/10" />
            <span className="space-y-2"><span className="block h-3 w-24 animate-pulse rounded bg-foreground/10" /><span className="block h-3 w-32 animate-pulse rounded bg-foreground/[0.07]" /></span>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-foreground/20 backdrop-blur-[2px] md:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside className="fixed inset-x-0 top-0 z-40 flex flex-col border-b border-foreground/10 bg-background md:inset-y-0 md:right-auto md:h-dvh md:w-60 md:border-b-0 md:border-r">
        {/* Header */}
        <div className="flex h-16 items-center justify-between px-4 md:px-5">
          <Link
            href="/user"
            className="flex items-center gap-2 rounded-md text-lg font-semibold tracking-tight text-primary outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <Image src="/logo.svg" alt="" width={32} height={32} priority />
            Otterpie<span className="text-secondary">.</span>
          </Link>

          <button
            type="button"
            onClick={() => setIsOpen((open) => !open)}
            aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={isOpen}
            aria-controls="otterpie-navigation"
            className="flex h-10 w-10 items-center justify-center rounded-md text-foreground/70 outline-none transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40 md:hidden"
          >
            {isOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>

        {/* Navigation */}
        <nav
          id="otterpie-navigation"
          aria-label="Main"
          className={`${
            isOpen ? "flex" : "hidden"
          } flex-1 flex-col gap-0.5 border-t border-foreground/10 px-3 py-3 md:flex`}
        >
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);

            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40 ${
                  active
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-foreground/60 hover:bg-foreground/5 hover:text-foreground"
                }`}
              >
                {/* Active indicator */}
                <span
                  aria-hidden="true"
                  className={`absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary transition-opacity ${
                    active ? "opacity-100" : "opacity-0"
                  }`}
                />
                <Icon
                  className={
                    active
                      ? "text-primary"
                      : "text-foreground/40 transition-colors group-hover:text-foreground/70"
                  }
                />
                <span>{label}</span>
              </Link>
            );
          })}
          {isStellarNetwork ? (
            <div className="mt-4 border-t border-foreground/10 px-3 pt-4">
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/35">Features</p>
              <Link
                href="/user/paiflow"
                aria-current={isActive("/user/paiflow") ? "page" : undefined}
                className={`group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40 ${
                  isActive("/user/paiflow")
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-foreground/60 hover:bg-foreground/5 hover:text-foreground"
                }`}
              >
                <span aria-hidden="true" className={`absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary ${isActive("/user/paiflow") ? "opacity-100" : "opacity-0"}`} />
                <PaiflowIcon className={isActive("/user/paiflow") ? "text-primary" : "text-foreground/40 transition-colors group-hover:text-foreground/70"} />
                <span>Paiflow</span>
              </Link>
            </div>
          ) : null}
        </nav>

        {/* Account */}
        <div
          className={`${
            isOpen ? "block" : "hidden"
          } border-t border-foreground/10 p-3 md:block`}
        >
          <button
            type="button"
            onClick={() => setIsProfileOpen(true)}
            aria-label="View profile details"
            className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left outline-none transition-colors hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <div
              aria-hidden="true"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary"
            >
              {initial}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {userName}
              </p>
              {userEmail && (
                <p className="truncate text-xs text-foreground/50">
                  {userEmail}
                </p>
              )}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setIsConfirmOpen(true)}
            className="mt-1 flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-foreground/60 outline-none transition-colors hover:bg-red-500/10 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-red-500/40"
          >
            <LogoutIcon />
            Log out
          </button>
        </div>
            </aside>

      {/* Profile details */}
      {isProfileOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/30 p-3 backdrop-blur-[2px] sm:items-center sm:p-4"
          onClick={() => setIsProfileOpen(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-title"
            onClick={(event) => event.stopPropagation()}
            className="my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-5xl overflow-y-auto rounded-2xl border border-foreground/10 bg-background p-4 text-foreground shadow-xl sm:max-h-[calc(100dvh-2rem)] sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
                  {initial}
                </span>
                <div>
                  <h2 id="profile-title" className="text-lg font-semibold">Profile details</h2>
                  <p className="mt-0.5 text-sm text-foreground/50">Your account information</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsProfileOpen(false)}
                aria-label="Close profile details"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground/50 hover:bg-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="mt-6 space-y-5">
              <section aria-label="Account profile" className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4 sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <span aria-hidden="true" className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-2xl font-semibold text-primary sm:h-24 sm:w-24 sm:text-4xl">
                    {initial}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground/45">Username</p>
                    <p className="mt-1 break-words text-base font-semibold">{userName}</p>
                    <p className="mt-2 text-xs font-medium text-foreground/45">Email</p>
                    <p className="mt-1 break-all text-sm text-foreground/75">{userEmail || "Not available"}</p>
                  </div>
                  <div className="flex w-full flex-col gap-2 sm:ml-auto sm:w-auto sm:shrink-0 sm:flex-row sm:flex-wrap sm:justify-end">
                    <button
                      type="button"
                      onClick={handleDownloadQrCode}
                      disabled={!walletQrCode}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-foreground/15 px-4 py-2.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-40 sm:whitespace-nowrap"
                    >
                      <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                        <path d="M10 3v9m0 0 3.5-3.5M10 12 6.5 8.5M4 14v2h12v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Download QR code
                    </button>
                    <Link
                      href="/user/setting"
                      onClick={() => setIsProfileOpen(false)}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-foreground/15 px-4 py-2.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:whitespace-nowrap"
                    >
                      <SettingsIcon />
                      Edit profile
                    </Link>
                  </div>
                </div>
              </section>

              <section aria-label="Wallet address and deposit QR code" className="rounded-xl border border-foreground/10 p-4 sm:p-5">
                <p className="text-xs font-medium text-foreground/45">Wallet address</p>
                <p className="mt-1 break-all font-mono text-xs leading-relaxed text-foreground/80">
                  {wallet_address || "Not available"}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyAddress}
                    disabled={!wallet_address}
                    className="inline-flex items-center gap-2 rounded-md border border-foreground/15 px-3 py-1.5 text-xs font-medium text-foreground/75 transition-colors hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {copiedAddress ? (
                      <>
                        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4 text-emerald-600">
                          <path d="m4 10 4 4 8-8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Copied
                      </>
                    ) : (
                      <>
                        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                          <rect x="7" y="7" width="9" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
                          <path d="M13 7V4.5A1.5 1.5 0 0 0 11.5 3h-7A1.5 1.5 0 0 0 3 4.5v8A1.5 1.5 0 0 0 4.5 14H7" stroke="currentColor" strokeWidth="1.4" />
                        </svg>
                        Copy address
                      </>
                    )}
                  </button>
                  {accountExplorer && (
                    <a
                      href={accountExplorer.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border border-foreground/15 px-3 py-1.5 text-xs font-medium text-foreground/75 transition-colors hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      {accountExplorer.label}
                      <span aria-hidden="true">↗</span>
                    </a>
                  )}
                </div>

                <div className="mt-5 border-t border-foreground/10 pt-5 text-center">
                  <p className="text-sm font-semibold">Scan to deposit to this wallet</p>
                  <p className="mt-1 text-xs text-foreground/50">
                    {isBotChainNetwork(network)
                      ? `EVM wallet · ${walletNetworkLabel(network)} · Chain ID 677`
                      : isStellarNetwork
                        ? `Non-EVM wallet · ${walletNetworkLabel(network ?? "stellar")}`
                        : "Scan with a wallet that supports this network."}
                  </p>
                  {walletQrCode ? (
                    <Image
                      src={walletQrCode}
                      alt="QR code containing this wallet address"
                      width={288}
                      height={288}
                      unoptimized
                      className="mx-auto mt-4 h-48 w-48 rounded-lg bg-white p-2 sm:h-60 sm:w-60"
                    />
                  ) : (
                    <div className="mx-auto mt-4 flex h-48 w-48 items-center justify-center rounded-lg border border-dashed border-foreground/15 text-xs text-foreground/45 sm:h-60 sm:w-60">
                      {wallet_address ? "Preparing QR code…" : "Wallet address unavailable"}
                    </div>
                  )}
                  <div className="mx-auto mt-4 max-w-2xl rounded-lg bg-foreground/[0.03] p-4 text-left">
                    {isBotChainNetwork(network) ? (
                      <>
                        <h3 className="text-xs font-semibold">Using an EVM wallet</h3>
                        <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-foreground/60">
                          <li>Select BOT Chain Mainnet (Chain ID 677) in MetaMask or another EVM wallet.</li>
                          <li>Scan this QR from the wallet&apos;s send screen. If it doesn&apos;t recognize the QR, copy the address above and select BOT Chain Mainnet manually.</li>
                          <li>Check the recipient and enter the amount. Keep some BOT in the wallet for network fees.</li>
                        </ol>
                      </>
                    ) : isStellarNetwork ? (
                      <>
                        <h3 className="text-xs font-semibold">Using a non-EVM Stellar wallet</h3>
                        <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-foreground/60">
                          <li>Open Freighter or another wallet that supports Stellar.</li>
                          <li>Choose Send or Payment, then scan the QR or paste the Stellar address above.</li>
                          <li>Check the recipient, select the asset, and enter the amount before confirming.</li>
                        </ol>
                      </>
                    ) : (
                      <p className="text-xs leading-relaxed text-foreground/60">
                        Choose a wallet that supports this account&apos;s network, then verify the recipient and network before sending.
                      </p>
                    )}
                  </div>
                </div>
              </section>
            </div>
          </section>
        </div>
      )}

      {/* Logout confirmation */}
      {isConfirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4 backdrop-blur-[2px]"
          onClick={() => setIsConfirmOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-title"
            aria-describedby="logout-description"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-xl border border-foreground/10 bg-background p-5 shadow-xl"
          >
            <h2
              id="logout-title"
              className="text-base font-semibold text-foreground"
            >
              Log out of Otterpie?
            </h2>
            <p
              id="logout-description"
              className="mt-1.5 text-sm text-foreground/60"
            >
              You&apos;ll need to sign in again to access your account.
            </p>

            <div className="mt-5 flex justify-end gap-2">
              <button
                ref={cancelRef}
                type="button"
                onClick={() => setIsConfirmOpen(false)}
                className="rounded-md px-3 py-2 text-sm text-foreground/70 outline-none transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmLogout}
                className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white outline-none transition-colors hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-500/40"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
