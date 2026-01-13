"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getApiBase } from "@/lib/api";
import Avatar from "@/components/ui/Avatar";
import { Badge, BadgeChip } from "@/components/ui/Badge";
import ThreadCard from "@/components/ui/ThreadCard";

const SOCIAL_ICONS = {
  instagram: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M7 3h10a4 4 0 014 4v10a4 4 0 01-4 4H7a4 4 0 01-4-4V7a4 4 0 014-4zm0 2a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2H7zm5 3.25A4.75 4.75 0 1112 17.75 4.75 4.75 0 0112 8.25zm0 2a2.75 2.75 0 102.75 2.75A2.75 2.75 0 0012 10.25zm5.5-3.5a.75.75 0 11-.75.75.75.75 0 01.75-.75z" />
    </svg>
  ),
  github: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.475 2 2 6.586 2 12.253c0 4.53 2.865 8.37 6.84 9.725.5.095.68-.222.68-.494 0-.245-.008-.892-.012-1.75-2.782.626-3.369-1.374-3.369-1.374-.454-1.175-1.11-1.488-1.11-1.488-.909-.636.069-.623.069-.623 1.005.072 1.534 1.056 1.534 1.056.893 1.56 2.342 1.11 2.913.848.092-.67.35-1.11.636-1.365-2.22-.262-4.555-1.135-4.555-5.05 0-1.115.39-2.025 1.03-2.738-.104-.264-.447-1.327.097-2.764 0 0 .84-.275 2.75 1.045A9.35 9.35 0 0112 6.65c.85.004 1.706.118 2.505.344 1.91-1.32 2.748-1.045 2.748-1.045.546 1.437.203 2.5.1 2.764.64.713 1.028 1.623 1.028 2.738 0 3.927-2.339 4.785-4.566 5.04.36.318.68.94.68 1.895 0 1.367-.012 2.47-.012 2.807 0 .275.18.595.688.494C19.138 20.62 22 16.783 22 12.253 22 6.586 17.523 2 12 2z" />
    </svg>
  ),
  linkedin: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M4.98 3.5C4.98 4.88 3.87 6 2.5 6S0 4.88 0 3.5 1.11 1 2.48 1 4.98 2.12 4.98 3.5zM.5 8.5h4v13h-4zM8.5 8.5h3.8v1.8h.1c.53-1 1.83-2.1 3.77-2.1 4.03 0 4.78 2.7 4.78 6.2V21.5h-4v-6.3c0-1.5-.03-3.4-2.1-3.4-2.1 0-2.42 1.7-2.42 3.3v6.4h-4z" />
    </svg>
  ),
  x: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2H21l-6.52 7.451L22 22h-6.758l-5.29-7.014L3.8 22H1l7.013-8.02L2 2h6.758l4.786 6.343L18.244 2zm-1.186 18h1.52L7.012 4H5.438l11.62 16z" />
    </svg>
  ),
  twitter: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19.944 7.925c.013.174.013.349.013.523 0 5.326-4.055 11.468-11.468 11.468-2.282 0-4.406-.663-6.19-1.804.316.037.62.05.948.05 1.886 0 3.622-.646 5.007-1.73a4.043 4.043 0 01-3.773-2.799c.25.037.5.062.76.062.362 0 .725-.05 1.063-.137a4.037 4.037 0 01-3.235-3.96v-.05c.538.3 1.162.487 1.823.512a4.034 4.034 0 01-1.798-3.36c0-.75.2-1.435.55-2.035a11.468 11.468 0 008.312 4.219 4.558 4.558 0 01-.1-.925 4.037 4.037 0 014.03-4.03c1.162 0 2.208.487 2.943 1.26a7.985 7.985 0 002.56-.987 4.023 4.023 0 01-1.773 2.222 8.092 8.092 0 002.32-.625 8.681 8.681 0 01-2.01 2.085z" />
    </svg>
  ),
  link: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6.75h3.75a3 3 0 013 3v3.75a3 3 0 01-3 3H13.5m-3-9H6.75a3 3 0 00-3 3v3.75a3 3 0 003 3H10.5m-4.5-4.5h12" />
    </svg>
  ),
};

function normalizeSocialUrl(url) {
  if (!url) return "";
  const rawUrl = typeof url === "string"
    ? url
    : (typeof url === "object" && url?.url)
      ? String(url.url)
      : String(url);
  const trimmed = rawUrl.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return `https://${trimmed}`;
}

function detectSocialType(label, url) {
  const normalizedLabel = (label || "").toLowerCase();
  const normalizedUrl = (url || "").toLowerCase();
  if (normalizedLabel.includes("instagram") || normalizedUrl.includes("instagram.com")) return "instagram";
  if (normalizedLabel === "x" || normalizedUrl.includes("x.com")) return "x";
  if (normalizedLabel.includes("twitter") || normalizedUrl.includes("twitter.com")) return "twitter";
  if (normalizedLabel.includes("github") || normalizedUrl.includes("github.com")) return "github";
  if (normalizedLabel.includes("linkedin") || normalizedUrl.includes("linkedin.com")) return "linkedin";
  return "link";
}

export default function UserProfilePage() {
  const { username } = useParams();
  const [profile, setProfile] = useState(null);
  const [badges, setBadges] = useState([]);
  const [threads, setThreads] = useState([]);
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("threads");
  const [loadingContent, setLoadingContent] = useState(false);

  const API = getApiBase();

  // Load profile and badges
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

  // Load tab content
  useEffect(() => {
    if (!profile) return;
    
    const loadTabContent = async () => {
      setLoadingContent(true);
      try {
        if (activeTab === "threads") {
          const res = await fetch(`${API}/api/user/${username}/threads`);
          if (res.ok) {
            const data = await res.json();
            setThreads(data.threads || []);
          }
        } else if (activeTab === "replies") {
          const res = await fetch(`${API}/api/user/${username}/replies`);
          if (res.ok) {
            const data = await res.json();
            setReplies(data.replies || []);
          }
        }
      } catch (err) {
        console.error("Failed to load content:", err);
      } finally {
        setLoadingContent(false);
      }
    };
    
    loadTabContent();
  }, [API, username, profile, activeTab]);

  if (loading) return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="h-8 w-8 rounded-full border-2 border-muted border-t-primary animate-spin" />
      </div>
    </div>
  );
  
  if (!profile || profile.error) return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="text-center py-12">
        <div className="text-4xl mb-4">👤</div>
        <h2 className="text-xl font-semibold text-foreground mb-2">User Not Found</h2>
        <p className="text-muted-foreground">The user @{username} does not exist or has been removed.</p>
        <Link href="/" className="inline-block mt-4 text-primary hover:underline">
          Return to Home
        </Link>
      </div>
    </div>
  );

  const displayName = profile.full_name || profile.username || "";
  const rawSocialAccounts = profile.social_accounts;
  let socialAccounts = [];
  if (Array.isArray(rawSocialAccounts)) {
    socialAccounts = rawSocialAccounts;
  } else if (rawSocialAccounts && typeof rawSocialAccounts === "object") {
    if (Array.isArray(rawSocialAccounts.items)) {
      socialAccounts = rawSocialAccounts.items;
    } else {
      socialAccounts = Object.entries(rawSocialAccounts).map(([label, url]) => ({ label, url }));
    }
  }
  const normalizedSocials = socialAccounts
    .map((account) => {
      const url = normalizeSocialUrl(account?.url);
      if (!url) return null;
      const label = String(account?.label || "").trim();
      const type = detectSocialType(label, url);
      const fallbackLabel = type === "link" ? "Website" : `${type.charAt(0).toUpperCase()}${type.slice(1)}`;
      const displayLabel = label || fallbackLabel;
      return {
        url,
        type,
        label: displayLabel,
      };
    })
    .filter(Boolean);
  const pronouns = String(profile.pronouns || "").trim();

  return (
    <section className="max-w-4xl mx-auto px-4 py-6">
      {/* Profile Header */}
      <div className="flex flex-col gap-4 mb-8">
        {/* Avatar + Name row */}
        <div className="flex items-start gap-4">
          <Avatar 
            src={profile.avatar_url} 
            name={displayName} 
            size="lg"
            className="h-20 w-20 shrink-0"
          />
          <div className="min-w-0 flex-1 pt-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-foreground">
                {displayName || "(No Name)"}
              </h1>
              {profile.primary_badge && <Badge badge={profile.primary_badge} size="sm" />}
            </div>
            <p className="text-muted-foreground">@{profile.username}</p>
            
            {/* Join date */}
            {profile.created_at && (
              <p className="text-sm text-muted-foreground mt-1">
                Joined {new Date(profile.created_at * 1000).toLocaleDateString('en-US', { 
                  month: 'long', 
                  year: 'numeric' 
                })}
              </p>
            )}
          </div>
        </div>
        
        {/* Bio */}
        {profile.bio && (
          <p className="text-foreground leading-relaxed border-l-2 border-primary/30 pl-4">
            {profile.bio}
          </p>
        )}

        {/* Meta info */}
        {(profile.company || profile.telegram || pronouns || normalizedSocials.length > 0) && (
          <div className="flex flex-wrap gap-4 text-sm">
            {pronouns && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 8.5a3.25 3.25 0 116.5 0 3.25 3.25 0 01-6.5 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 19.5a6 6 0 0112 0" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6.5h3m0 0v-3m0 3l-3-3" />
                </svg>
                <span>{pronouns}</span>
              </div>
            )}
            {profile.company && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
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
                className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                </svg>
                <span>{profile.telegram}</span>
              </a>
            )}
            {normalizedSocials.map((social) => (
              <a
                key={`${social.type}-${social.url}`}
                href={social.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors"
              >
                {SOCIAL_ICONS[social.type] || SOCIAL_ICONS.link}
                <span>{social.label}</span>
              </a>
            ))}
          </div>
        )}
        
        {/* Badges */}
        {badges.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {badges.map(b => (
              <BadgeChip key={b.id} badge={b} />
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <nav className="flex gap-1 border-b border-border mb-6">
        <button 
          onClick={() => setActiveTab("threads")}
          className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
            activeTab === "threads" 
              ? "text-primary" 
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Threads
          {activeTab === "threads" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>
        <button 
          onClick={() => setActiveTab("replies")}
          className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
            activeTab === "replies" 
              ? "text-primary" 
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Replies
          {activeTab === "replies" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>
        <button 
          onClick={() => setActiveTab("badges")}
          className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
            activeTab === "badges" 
              ? "text-primary" 
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Badges
          {activeTab === "badges" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>
      </nav>
      
      {/* Tab Content */}
      <div className="min-h-[200px]">
        {loadingContent ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 rounded-full border-2 border-muted border-t-primary animate-spin" />
          </div>
        ) : (
          <>
            {/* Threads Tab */}
            {activeTab === "threads" && (
              <div className="space-y-4">
                {threads.length > 0 ? (
                  threads.map(thread => (
                    <ThreadCard
                      key={thread.id}
                      thread={thread}
                      showAuthor={false}
                    />
                  ))
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>No threads posted yet</p>
                  </div>
                )}
              </div>
            )}

            {/* Replies Tab */}
            {activeTab === "replies" && (
              <div className="space-y-3">
                {replies.length > 0 ? (
                  replies.map(reply => (
                    <div key={reply.id} className="rounded-lg border border-border bg-card p-4">
                      <p className="text-sm text-foreground line-clamp-3 mb-2">
                        {reply.content}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>in</span>
                        <Link 
                          href={`/thread/${reply.thread_id}`}
                          className="text-primary hover:underline truncate max-w-xs"
                        >
                          {reply.thread_title || "Thread"}
                        </Link>
                        <span>•</span>
                        <span>{new Date(reply.created_at * 1000).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>No replies posted yet</p>
                  </div>
                )}
              </div>
            )}

            {/* Badges Tab */}
            {activeTab === "badges" && (
              <div>
                {badges.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {badges.map(b => (
                      <div key={b.id} className="rounded-lg border border-border bg-card p-4 text-center">
                        <div className="text-3xl mb-2">{b.icon || "🏅"}</div>
                        <div className="font-medium text-foreground text-sm">{b.name}</div>
                        {b.description && (
                          <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {b.description}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>No badges earned yet</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
