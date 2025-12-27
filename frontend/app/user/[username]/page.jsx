"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getApiBase } from "@/lib/api";
import { resolveAvatarSrc } from "@/lib/avatar";
import { Badge, BadgeChip } from "@/components/ui/Badge";

export default function UserProfilePage() {
  const { username } = useParams();
  const [profile, setProfile] = useState(null);
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);

  const API = getApiBase();

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`${API}/api/user/${username}`).then(r => r.json()),
      fetch(`${API}/api/user/${username}/badges`).then(r => r.json()),
    ])
      .then(([user, badgeData]) => {
        setProfile(user);
        setBadges(user.badges || badgeData.badges || []);
      })
      .finally(() => setLoading(false));
  }, [API, username]);

  if (loading) return <div className="text-sm text-[rgb(var(--muted))]">Loading...</div>;
  if (!profile || profile.error) return <div className="text-[rgb(var(--error))]">User tidak ditemukan</div>;

  const hasMeta = profile.pronouns || profile.company || profile.telegram;
  const hasSocials = Array.isArray(profile.social_accounts) && profile.social_accounts.length > 0;

  return (
    <section className="max-w-4xl mx-auto px-4 py-8">
      {/* GitHub-style compact profile header */}
      <div className="flex items-start gap-4 mb-6">
        {/* Avatar */}
        <img
          src={resolveAvatarSrc(profile.avatar_url)}
          alt="Avatar"
          width={80}
          height={80}
          className="w-20 h-20 rounded-full border border-[rgb(var(--border))] object-cover bg-[rgb(var(--surface-2))] flex-shrink-0"
        />
        
        {/* Info */}
        <div className="flex-1 min-w-0">
          {/* Name & Badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold text-[rgb(var(--fg))] truncate">
              {profile.full_name || profile.username || "(No Name)"}
            </h1>
            {profile.primary_badge && <Badge badge={profile.primary_badge} size="sm" />}
          </div>
          
          {/* Username */}
          <div className="text-sm text-[rgb(var(--muted))] font-mono">
            @{profile.username}
          </div>
          
          {/* Bio */}
          {profile.bio && (
            <p className="mt-2 text-sm text-[rgb(var(--fg))] leading-relaxed">
              {profile.bio}
            </p>
          )}
          
          {/* Meta info inline - GitHub style */}
          {hasMeta && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[rgb(var(--muted))]">
              {profile.pronouns && (
                <span className="inline-flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                  {profile.pronouns}
                </span>
              )}
              {profile.company && (
                <span className="inline-flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
                  </svg>
                  {profile.company}
                </span>
              )}
              {profile.telegram && (
                <a
                  href={`https://t.me/${profile.telegram.replace(/^@/, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:text-[rgb(var(--brand))] transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                  </svg>
                  {profile.telegram}
                </a>
              )}
            </div>
          )}
          
          {/* Social accounts inline */}
          {hasSocials && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              {profile.social_accounts.map((s, i) => (
                <a
                  key={i}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[rgb(var(--muted))] hover:text-[rgb(var(--brand))] transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                  </svg>
                  {s.label || s.url}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Badges section - compact inline */}
      {badges.length > 0 && (
        <div className="py-4 border-t border-[rgb(var(--border))]">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium uppercase tracking-wide text-[rgb(var(--muted))]">Badges</span>
            <div className="flex flex-wrap gap-2">
              {badges.map(b => (
                <BadgeChip key={b.id} badge={b} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Back navigation */}
      <div className="pt-4 border-t border-[rgb(var(--border))]">
        <Link 
          href="/threads" 
          className="inline-flex items-center gap-1 text-sm text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Kembali ke Threads
        </Link>
      </div>
    </section>
  );
}
