import Link from "next/link";
import {
  Send,
  ClipboardList,
  ShieldAlert,
  Landmark,
  User,
  ShoppingBag,
  FileCheck2,
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

function MenuItem({ href, label, Icon, isActive }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors ${
        isActive ? "bg-accent font-semibold text-foreground" : "text-foreground hover:bg-accent/60"
      }`}
      aria-current={isActive ? "page" : undefined}
      title={label}
    >
      <Icon
        className={`h-4 w-4 shrink-0 ${isActive ? "text-foreground" : "text-muted-foreground"}`}
        strokeWidth={1.8}
      />
      <span className="truncate">{label}</span>
    </Link>
  );
}

export default function ProfileNav({ pathname, section }) {
  const isLinkActive = (href) => {
    if (!pathname) return false;
    if (href === "/account") return pathname === "/account";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const links = section === "wallet" ? walletLinks : accountLinks;

  return (
    <nav className="flex flex-col gap-0.5">
      {links.map((item) => (
        <MenuItem
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
