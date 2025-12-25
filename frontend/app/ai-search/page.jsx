"use client";

import { useState } from "react";
import { getApiBase } from "@/lib/api";

export default function AISearchPage() {
  const API_BASE =
    getApiBase();

  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState([]);
  const [error, setError] = useState("");

  async function handleAsk(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setAnswer("");
    setSources([]);

    try {
      const url = new URL("/api/rag/answer", API_BASE);
      url.searchParams.set("q", q);

      const res = await fetch(url.toString(), {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setAnswer(data.answer || "");
      setSources(Array.isArray(data.sources) ? data.sources : []);
    } catch (err) {
      setError(err.message || "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold mb-4 text-[rgb(var(--fg))]">Cari Jawaban (RAG)</h1>

      <form onSubmit={handleAsk} className="flex gap-2 mb-4">
        <input
          className="flex-1 border border-[rgb(var(--border))] bg-[rgb(var(--surface))] rounded-lg px-3 py-2 outline-none text-[rgb(var(--fg))] placeholder:text-[rgb(var(--muted))] focus:border-[rgb(var(--brand))]"
          placeholder="Tulis pertanyaan…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          type="submit"
          disabled={!q || loading}
          className="rounded-lg px-4 py-2 border border-[rgb(var(--border))] bg-[rgb(var(--surface))] text-[rgb(var(--fg))] disabled:opacity-50 hover:bg-[rgb(var(--surface-2))]"
        >
          {loading ? "Memproses…" : "Tanya"}
        </button>
      </form>

      {error && (
        <div className="mb-4 text-sm text-red-600 border border-red-200 rounded-md p-3">
          {error}
        </div>
      )}

      {answer && (
        <div className="mb-6">
          <h2 className="font-medium mb-2 text-[rgb(var(--fg))]">Jawaban</h2>
          <div className="whitespace-pre-wrap border border-[rgb(var(--border))] bg-[rgb(var(--surface))] rounded-lg p-3 text-sm text-[rgb(var(--fg))]">
            {answer}
          </div>
        </div>
      )}

      {sources?.length > 0 && (
        <div>
          <h3 className="font-medium mb-2 text-[rgb(var(--fg))]">Sumber (chunk):</h3>
          <ul className="space-y-2">
            {sources.map((s, i) => (
              <li key={i} className="border border-[rgb(var(--border))] bg-[rgb(var(--surface))] rounded-lg p-3 text-sm">
                <div className="text-xs mb-1 text-[rgb(var(--muted))]">
                  thread_id: {s.thread_id}
                </div>
                <div className="line-clamp-5 whitespace-pre-wrap text-[rgb(var(--fg))]">
                  {s.content}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
