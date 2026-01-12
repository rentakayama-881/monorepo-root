"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getApiBase } from "@/lib/api";
import Avatar from "@/components/ui/Avatar";
import { Badge, BadgeChip } from "@/components/ui/Badge";
import ThreadCard from "@/components/ui/ThreadCard";

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
        {(profile.company || profile.telegram) && (
          <div className="flex flex-wrap gap-4 text-sm">
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
