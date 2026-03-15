import Link from "next/link";
import {
  Send,
  ClipboardList,
  ShieldAlert,
  Landmark,
  User,
  ShoppingBag,
  FileCheck2,
  ChevronRight,
} from "lucide-react";

const walletLinks = [
  { href: "/account/wallet/send", label: "Send Funds", Icon: Send },
  { href: "/account/wallet/transactions", label: "Transactions", Icon: ClipboardList },
  { href: "/account/wallet/disputes", label: "Dispute Center", Icon: ShieldAlert },
  { href: "/account/wallet/withdraw", label: "Withdraw", Icon: Landmark },
];

const accountLinks = [
  { href: "/account", label: "Account", Icon: User },
  { href: "/account/my-purchases", label: "My Purchase", Icon: ShoppingBag },
  { href: "/account/validation-cases", label: "My Validation Cases", Icon: FileCheck2 },
];

function MenuItemLink({ href, label, Icon, isActive }) {
  const itemClassName = isActive
    ? "group flex items-center justify-between rounded-lg border border-foreground/20 bg-accent px-3 py-2 transition-colors"
    : "group flex items-center justify-between rounded-lg border border-border/70 bg-background/60 px-3 py-2 transition-colors hover:border-border hover:bg-accent/60";

  const iconClassName = isActive
    ? "h-4 w-4 shrink-0 text-foreground"
    : "h-4 w-4 shrink-0 text-muted-foreground";

  const labelClassName = isActive
    ? "flex min-w-0 items-center gap-2.5 text-sm font-semibold text-foreground"
    : "flex min-w-0 items-center gap-2.5 text-sm font-medium text-foreground";

  return (
    <Link
      href={href}
      className={itemClassName}
      aria-current={isActive ? "page" : undefined}
      title={label}
    >
      <span className={labelClassName}>
        <Icon className={iconClassName} strokeWidth={1.9} />
        <span className="truncate">{label}</span>
      </span>
      <ChevronRight
        className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
        strokeWidth={1.9}
      />
    </Link>
  );
}

export default function ProfileNav({ pathname }) {
  const isLinkActive = (href) => {
    if (!pathname) return false;
    if (href === "/account") return pathname === "/account";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <nav className="mt-3 flex flex-col gap-1.5 text-sm text-foreground">
      {/* Wallet Section */}
      <div className="px-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Wallet
      </div>
      {walletLinks.map((item) => (
        <MenuItemLink
          key={item.href}
          href={item.href}
          label={item.label}
          Icon={item.Icon}
          isActive={isLinkActive(item.href)}
        />
      ))}

      {/* Account Section */}
      <div className="mt-2 px-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Account
      </div>
      {accountLinks.map((item) => (
        <MenuItemLink
          key={item.href}
          href={item.href}
          label={item.label}
          Icon={item.Icon}
          isActive={isLinkActive(item.href)}
        />
      ))}
    </nav>
  );
}
