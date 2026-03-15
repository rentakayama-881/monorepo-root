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
  { href: "/account/wallet/transactions", label: "Transaksi", Icon: ClipboardList },
  { href: "/account/wallet/disputes", label: "Dispute", Icon: ShieldAlert },
  { href: "/account/wallet/withdraw", label: "Withdraw", Icon: Landmark },
];

const accountLinks = [
  { href: "/account", label: "Akun", Icon: User },
  { href: "/account/my-purchases", label: "Pembelian", Icon: ShoppingBag },
  { href: "/account/validation-cases", label: "Validasi Case", Icon: FileCheck2 },
];

function TreeMenuItem({ href, label, Icon, isActive }) {
  return (
    <div className="tree-node">
      <Link
        href={href}
        className={`rainbow-card-glass flex items-center gap-2 px-2.5 py-1.5 transition-colors ${
          isActive ? "ring-1 ring-foreground/20" : ""
        }`}
        aria-current={isActive ? "page" : undefined}
        title={label}
      >
        <Icon
          className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-foreground" : "text-muted-foreground"}`}
          strokeWidth={1.9}
        />
        <span
          className={`truncate text-xs ${
            isActive ? "font-semibold text-foreground" : "font-medium text-foreground"
          }`}
        >
          {label}
        </span>
      </Link>
    </div>
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
    <>
      {links.map((item, idx) => (
        <TreeMenuItem
          key={item.href}
          href={item.href}
          label={item.label}
          Icon={item.Icon}
          isActive={isLinkActive(item.href)}
        />
      ))}
    </>
  );
}
