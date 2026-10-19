"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fetch_to } from "@/utilities";
import routes from "@/routes/jwt.json";

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

const CategoriesIcon = ({ className }: IconProps) => (
  <svg {...iconProps} className={className}>
    <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" />
    <circle cx="7.5" cy="7.5" r="1" />
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
  { href: "/user/add-category", label: "Categories", icon: CategoriesIcon },
  { href: "/user/transactions", label: "Transactions", icon: TransactionsIcon },
  { href: "/user/setting", label: "Settings", icon: SettingsIcon },
];
type SidebarProps = {
  userName?: string;
  userEmail?: string;
  onLogout?: () => void;
};

export default function Sidebar({
  userName = "Your account",
  userEmail,
  onLogout,
}: SidebarProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
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

  const handleConfirmLogout = async() => {
    setIsConfirmOpen(false);
    const response = await Fetch_to("GET", routes.deauth);
    if (response.success) {
      window.location.reload();
    }
    onLogout?.();
  };

  const isActive = (href: string) =>
    href === "/user"
      ? pathname === "/user"
      : pathname === href || pathname.startsWith(`${href}/`);

  const initial = userName.trim().charAt(0).toUpperCase() || "U";

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
            Otterpie
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
        </nav>

        {/* Account */}
        <div
          className={`${
            isOpen ? "block" : "hidden"
          } border-t border-foreground/10 p-3 md:block`}
        >
          <div className="flex items-center gap-3 px-2 py-2">
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
          </div>

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