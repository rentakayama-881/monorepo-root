"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getApiBase } from "@/lib/api";

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
        setBadges(badgeData.badges || []);
      })
      .finally(() => setLoading(false));
  }, [API, username]);

  if (loading) return <div className="text-sm">Loading...</div>;
  if (!profile || profile.error) return <div className="text-red-500">User tidak ditemukan</div>;

  return (
    <section className="max-w-3xl mx-auto px-4 py-12">
      {/* Card utama user */}
      <div className="border rounded-xl bg-white shadow p-8 mb-8 flex flex-col md:flex-row md:items-center gap-6">
        <img
          src={profile.avatar_url || "/avatar-default.png"}
          alt="Avatar"
          width={88}
          height={88}
          className="rounded-full border object-cover bg-neutral-50"
        />
        <div>
          <div className="text-2xl font-bold text-neutral-900">{profile.full_name || "(No Name)"}</div>
          <div className="text-base text-neutral-600 font-mono">@{profile.username}</div>
          {profile.bio && <p className="mt-3 text-neutral-700 text-base">{profile.bio}</p>}
        </div>
      </div>

      {/* Detail */}
      <div className="mb-8 grid grid-cols-1 gap-7 md:grid-cols-2">
        {profile.pronouns && (
          <div className="rounded-lg border border-neutral-200 bg-white p-6">
            <div className="text-sm font-medium text-neutral-600 mb-2">Pronouns</div>
            <div className="text-base">{profile.pronouns}</div>
          </div>
        )}
        {profile.company && (
          <div className="rounded-lg border border-neutral-200 bg-white p-6">
            <div className="text-sm font-medium text-neutral-600 mb-2">Company</div>
            <div className="text-base">{profile.company}</div>
          </div>
        )}
        {profile.telegram && (
          <div className="rounded-lg border border-neutral-200 bg-white p-6">
            <div className="text-sm font-medium text-neutral-600 mb-2">Contact Telegram</div>
            <a
              href={`https://t.me/${profile.telegram.replace(/^@/, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-base font-medium text-neutral-900 underline"
            >
              {profile.telegram}
            </a>
          </div>
        )}
        {Array.isArray(profile.social_accounts) && profile.social_accounts.length > 0 && (
          <div className="rounded-lg border border-neutral-200 bg-white p-6">
            <div className="text-sm font-medium text-neutral-600 mb-2">Social Accounts</div>
            <ul className="space-y-1">
              {profile.social_accounts.map((s, i) => (
                <li key={i} className="text-base">
                  <span className="font-semibold">{s.label}:</span>{" "}
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="font-medium text-neutral-900 underline">{s.url}</a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Badges */}
      {badges.length > 0 && (
        <div className="mb-8 rounded-lg border border-neutral-200 bg-white p-6">
          <div className="mb-2 text-sm font-medium text-neutral-600">Badges</div>
          <div className="flex flex-wrap gap-3">
            {badges.map(b => (
              <div key={b.id} className="rounded border border-emerald-100 bg-emerald-50 px-4 py-2 text-emerald-700 font-medium">
                <div>{b.platform}</div>
                <div className="text-xs text-emerald-800">{b.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigasi */}
      <div className="mt-5 flex gap-4">
        <Link href="/threads" className="inline-flex items-center rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-100">
          ← Kembali ke Threads
        </Link>
      </div>
    </section>
  );
}
