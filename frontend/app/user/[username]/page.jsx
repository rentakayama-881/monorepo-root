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
    <section className="container py-6">
      {/* Profile Header - prompts.chat style */}
      <div className="flex flex-col gap-4 mb-8">
        {/* Avatar + Name row */}
        <div className="flex items-center gap-4">
          <Avatar 
            src={profile.avatar_url} 
            name={displayName} 
            size="lg"
            className="h-16 w-16 md:h-20 md:w-20 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl md:text-2xl font-bold truncate text-[rgb(var(--fg))]">
                {profile.full_name || profile.username || "(No Name)"}
              </h1>
              {profile.primary_badge && <Badge badge={profile.primary_badge} size="sm" />}
            </div>
            <p className="text-[rgb(var(--muted))] text-sm flex items-center gap-2 flex-wrap">
              @{profile.username}
            </p>
          </div>
        </div>
        
        {/* Bio */}
        {profile.bio && (
          <p className="text-sm text-[rgb(var(--fg))] leading-relaxed">
            {profile.bio}
          </p>
        )}

        {/* Stats row */}
        <div className="flex flex-wrap gap-4 text-sm">
          {profile.thread_count !== undefined && (
            <div className="flex items-center gap-1.5 text-[rgb(var(--muted))]">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <span>{profile.thread_count} threads</span>
            </div>
          )}
          
          {hasMeta && (
            <>
              {profile.company && (
                <div className="flex items-center gap-1.5 text-[rgb(var(--muted))]">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
                  </svg>
                  <span>{profile.company}</span>
                </div>
              )}
              {profile.telegram && (
                <a
                  href={`https://t.me/${profile.telegram.replace(/^@/, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[rgb(var(--muted))] hover:text-[rgb(var(--brand))] transition-colors"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                  </svg>
                  <span>{profile.telegram}</span>
                </a>
              )}
            </>
          )}

          {profile.created_at && (
            <div className="flex items-center gap-1.5 text-[rgb(var(--muted))]">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
              <span>Joined {new Date(profile.created_at * 1000).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })}</span>
            </div>
          )}
        </div>
        
        {/* Badges row */}
        {badges.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {badges.map(b => (
              <BadgeChip key={b.id} badge={b} />
            ))}
          </div>
        )}
      </div>

      {/* Tabs - prompts.chat style */}
      <nav className="border-b border-[rgb(var(--border))] mb-6">
        <div className="flex gap-4">
          <button className="px-4 py-3 text-sm font-medium border-b-2 border-[rgb(var(--brand))] text-[rgb(var(--fg))]">
            Threads
          </button>
          <button className="px-4 py-3 text-sm text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))] border-b-2 border-transparent hover:border-[rgb(var(--border))] transition-colors">
            Replies
          </button>
          <button className="px-4 py-3 text-sm text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))] border-b-2 border-transparent hover:border-[rgb(var(--border))] transition-colors">
            Likes
          </button>
        </div>
      </nav>
      
      {/* Content area */}
      <div className="space-y-4">
        <div className="rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-6 text-center">
          <p className="text-sm text-[rgb(var(--muted))]">
            User threads will be displayed here
          </p>
        </div>
      </div>
    </section>
  );
}
