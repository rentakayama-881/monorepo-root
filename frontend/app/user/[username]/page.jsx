"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getApiBase } from "@/lib/api";
import Avatar from "@/components/ui/Avatar";
import { Badge, BadgeChip, BadgeList } from "@/components/ui/Badge";

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

  if (loading) return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="text-sm text-[rgb(var(--muted))]">Loading profile...</div>
    </div>
  );
  
  if (!profile || profile.error) return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="text-[rgb(var(--error))]">User not found</div>
    </div>
  );

  const hasMeta = profile.pronouns || profile.company || profile.telegram;
  const hasSocials = Array.isArray(profile.social_accounts) && profile.social_accounts.length > 0;
  const displayName = profile.full_name || profile.username || "";

  return (
    <section className="max-w-6xl mx-auto px-4 py-8">
      {/* GitHub-style two-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6">
        {/* Left sidebar - Avatar & Info */}
        <aside className="flex flex-col gap-4">
          {/* Large avatar */}
          <Avatar 
            src={profile.avatar_url} 
            name={displayName} 
            size="2xl"
            className="w-full h-auto rounded-full"
          />
          
          {/* Name & Username */}
          <div>
            <h1 className="text-2xl font-semibold text-[rgb(var(--fg))] break-words">
              {profile.full_name || profile.username || "(No Name)"}
            </h1>
            <div className="text-xl text-[rgb(var(--muted))] font-light">
              {profile.username}
            </div>
          </div>
          
          {/* Bio */}
          {profile.bio && (
            <p className="text-base text-[rgb(var(--fg))] leading-relaxed">
              {profile.bio}
            </p>
          )}
          
          {/* Meta info - stacked */}
          {hasMeta && (
            <div className="flex flex-col gap-2 text-sm text-[rgb(var(--fg))]">
              {profile.company && (
                <div className="inline-flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0 text-[rgb(var(--muted))]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
                  </svg>
                  <span>{profile.company}</span>
                </div>
              )}
              {profile.pronouns && (
                <div className="inline-flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0 text-[rgb(var(--muted))]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                  <span>{profile.pronouns}</span>
                </div>
              )}
              {profile.telegram && (
                <a
                  href={`https://t.me/${profile.telegram.replace(/^@/, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 hover:text-[rgb(var(--brand))] transition-colors"
                >
                  <svg className="w-4 h-4 flex-shrink-0 text-[rgb(var(--muted))]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                  </svg>
                  <span>{profile.telegram}</span>
                </a>
              )}
            </div>
          )}
          
          {/* Social accounts - stacked */}
          {hasSocials && (
            <div className="flex flex-col gap-2 text-sm pt-2 border-t border-[rgb(var(--border))]">
              {profile.social_accounts.map((s, i) => (
                <a
                  key={i}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-[rgb(var(--fg))] hover:text-[rgb(var(--brand))] transition-colors truncate"
                >
                  <svg className="w-4 h-4 flex-shrink-0 text-[rgb(var(--muted))]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                  </svg>
                  <span className="truncate">{s.label || s.url}</span>
                </a>
              ))}
            </div>
          )}
          
          {/* Badges */}
          {badges.length > 0 && (
            <div className="pt-4 border-t border-[rgb(var(--border))]">
              <h2 className="text-base font-semibold text-[rgb(var(--fg))] mb-3">Badges</h2>
              <div className="flex flex-col gap-2">
                {badges.map(b => (
                  <div key={b.id} className="flex items-center gap-2">
                    <Badge badge={b} size="sm" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
        
        {/* Right content - Tabs & Content */}
        <main className="min-w-0">
          {/* Tabs - GitHub style */}
          <nav className="border-b border-[rgb(var(--border))] mb-6">
            <div className="flex gap-4">
              <button className="px-4 py-3 text-sm font-medium border-b-2 border-[rgb(var(--brand))] text-[rgb(var(--fg))]">
                Overview
              </button>
              <button className="px-4 py-3 text-sm text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))] border-b-2 border-transparent hover:border-[rgb(var(--border))] transition-colors">
                Threads
              </button>
              <button className="px-4 py-3 text-sm text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))] border-b-2 border-transparent hover:border-[rgb(var(--border))] transition-colors">
                Replies
              </button>
            </div>
          </nav>
          
          {/* Content area */}
          <div className="space-y-4">
            <div className="rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-6 text-center">
              <p className="text-sm text-[rgb(var(--muted))]">
                User activity will be displayed here
              </p>
            </div>
          </div>
        </main>
      </div>

      {/* Back navigation */}
      <div className="pt-8 mt-8 border-t border-[rgb(var(--border))]">
        <Link 
          href="/" 
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
