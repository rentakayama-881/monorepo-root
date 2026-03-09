"use client";

import {
  Check as LucideCheck,
  Shield as LucideShield,
  Lock as LucideLock,
  User as LucideUser,
  Database as LucideDatabase,
  Globe as LucideGlobe,
  Cookie as LucideCookie,
  FileText as LucideFileText,
  Mail as LucideMail,
  Info as LucideInfo,
  AlertTriangle as LucideAlertTriangle,
  X as LucideX,
  Scale as LucideScale,
  Heart as LucideHeart,
  ChevronRight as LucideChevronRight,
  Clock as LucideClock,
  CreditCard as LucideCreditCard,
  Server as LucideServer,
  Eye as LucideEye,
  Pencil as LucidePencil,
  Trash2 as LucideTrash2,
  Download as LucideDownload,
  Settings as LucideSettings,
  Users as LucideUsers,
  MessageCircle as LucideMessageCircle,
  CircleHelp as LucideCircleHelp,
  Target as LucideTarget,
  Zap as LucideZap,
  Award as LucideAward,
} from "lucide-react";

function wrapIcon(Icon) {
  return function WrappedIcon({ className = "h-4 w-4" }) {
    return <Icon className={className} />;
  };
}

export const CheckIcon = wrapIcon(LucideCheck);
export const ShieldIcon = wrapIcon(LucideShield);
export const LockIcon = wrapIcon(LucideLock);
export const UserIcon = wrapIcon(LucideUser);
export const DatabaseIcon = wrapIcon(LucideDatabase);
export const GlobeIcon = wrapIcon(LucideGlobe);
export const CookieIcon = wrapIcon(LucideCookie);
export const DocumentIcon = wrapIcon(LucideFileText);
export const MailIcon = wrapIcon(LucideMail);
export const InfoIcon = wrapIcon(LucideInfo);
export const WarningIcon = wrapIcon(LucideAlertTriangle);
export const XIcon = wrapIcon(LucideX);
export const ScaleIcon = wrapIcon(LucideScale);
export const HeartIcon = wrapIcon(LucideHeart);
export const ChevronRightIcon = wrapIcon(LucideChevronRight);
export const ClockIcon = wrapIcon(LucideClock);
export const CreditCardIcon = wrapIcon(LucideCreditCard);
export const ServerIcon = wrapIcon(LucideServer);
export const EyeIcon = wrapIcon(LucideEye);
export const EditIcon = wrapIcon(LucidePencil);
export const TrashIcon = wrapIcon(LucideTrash2);
export const DownloadIcon = wrapIcon(LucideDownload);
export const SettingsIcon = wrapIcon(LucideSettings);
export const UsersIcon = wrapIcon(LucideUsers);
export const MessageCircleIcon = wrapIcon(LucideMessageCircle);
export const HelpCircleIcon = wrapIcon(LucideCircleHelp);
export const FileTextIcon = wrapIcon(LucideFileText);
export const TargetIcon = wrapIcon(LucideTarget);
export const ZapIcon = wrapIcon(LucideZap);
export const AwardIcon = wrapIcon(LucideAward);

/**
 * Styled List Item Component - Replaces bullet points with beautiful icons
 */
export function ListItem({
  children,
  icon: Icon = ChevronRightIcon,
  iconColor = "text-primary",
  className = "",
}) {
  return (
    <li className={`flex items-start gap-3 ${className}`}>
      <span className={`mt-0.5 shrink-0 ${iconColor}`}>
        <Icon className="h-4 w-4" />
      </span>
      <span>{children}</span>
    </li>
  );
}

/**
 * Section Header Component with Icon
 */
export function SectionHeader({ number, title, icon: Icon }) {
  return (
    <h2 className="mb-4 flex items-center gap-3 text-lg font-semibold text-foreground">
      {Icon && (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
      )}
      <span>
        {number && `${number}. `}
        {title}
      </span>
    </h2>
  );
}

/**
 * Card Section Component
 */
export function CardSection({ children, className = "" }) {
  return (
    <section
      className={`mb-6 rounded-lg border border-border bg-card p-4 transition-all hover:border-primary/20 ${className}`}
    >
      {children}
    </section>
  );
}

/**
 * Page Skeleton Loading Component
 */
export function PageSkeleton() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 border-b border-border pb-6">
        <div className="h-8 w-64 animate-pulse rounded-lg bg-muted/50" />
        <div className="mt-2 h-4 w-40 animate-pulse rounded-lg bg-muted/50" />
      </div>
      <div className="space-y-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-4">
            <div className="mb-4 flex items-center gap-3">
              <div className="h-8 w-8 animate-pulse rounded-lg bg-muted/50" />
              <div className="h-6 w-48 animate-pulse rounded-lg bg-muted/50" />
            </div>
            <div className="space-y-3">
              <div className="h-4 w-full animate-pulse rounded bg-muted/50" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-muted/50" />
              <div className="h-4 w-4/6 animate-pulse rounded bg-muted/50" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
