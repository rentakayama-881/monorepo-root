"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getApiBase } from "@/lib/api";
import { getAdminToken } from "@/lib/adminAuth";

const DEFAULT_QUERY = "i18n=en-US";
const DEFAULT_FORM = "tag_id=10";

function parseKeyValueLines(raw) {
  const out = {};
  const lines = String(raw || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    if (!key) continue;
    out[key] = val;
  }
  return out;
}

export default function AdminLZTIntegrationPage() {
  const [config, setConfig] = useState(null);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const [method, setMethod] = useState("POST");
  const [path, setPath] = useState("/123456789/tag/add");
  const [contentType, setContentType] = useState("form");
  const [queryInput, setQueryInput] = useState(DEFAULT_QUERY);
  const [formInput, setFormInput] = useState(DEFAULT_FORM);
  const [jsonInput, setJsonInput] = useState("{\n  \"tag_id\": 10\n}");

  const apiBase = useMemo(() => getApiBase(), []);

  const loadConfig = useCallback(async () => {
    setLoadingConfig(true);
    setError("");
    try {
      const token = getAdminToken();
      if (!token) throw new Error("Sesi admin berakhir. Silakan login ulang.");

      const res = await fetch(`${apiBase}/admin/integrations/lzt/config`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal mengambil konfigurasi LZT.");
      setConfig(data);
    } catch (err) {
      setError(err?.message || "Gagal mengambil konfigurasi LZT.");
    } finally {
      setLoadingConfig(false);
    }
  }, [apiBase]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setResult(null);

    try {
      const token = getAdminToken();
      if (!token) throw new Error("Sesi admin berakhir. Silakan login ulang.");

      const query = parseKeyValueLines(queryInput);
      const payload = {
        method,
        path,
        query,
        content_type: contentType,
      };

      if (contentType === "form") {
        payload.form_body = parseKeyValueLines(formInput);
      } else {
        try {
          payload.json_body = jsonInput.trim() ? JSON.parse(jsonInput) : {};
        } catch {
          throw new Error("JSON body tidak valid.");
        }
      }

      const res = await fetch(`${apiBase}/admin/integrations/lzt/request`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Request ke LZT gagal.");
      }
      setResult(data);
    } catch (err) {
      setError(err?.message || "Request ke LZT gagal.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">LZT Integration</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Panel uji koneksi API LZT dari backend. Token tetap aman di server.
        </p>
      </div>

      <section className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Backend Configuration</h2>
          <button
            type="button"
            onClick={loadConfig}
            disabled={loadingConfig}
            className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted/50 disabled:opacity-60"
          >
            {loadingConfig ? "Loading..." : "Refresh"}
          </button>
        </div>

        {config ? (
          <div className="grid gap-2 text-sm">
            <div>Enabled: <span className="font-medium">{String(config.enabled)}</span></div>
            <div>Token Configured: <span className="font-medium">{String(config.token_configured)}</span></div>
            <div>Base URL: <span className="font-mono text-xs">{config.base_url}</span></div>
            <div>Timeout: <span className="font-medium">{config.timeout_seconds}s</span></div>
            <div>Min Interval: <span className="font-medium">{config.min_interval_millis}ms</span></div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Belum ada data konfigurasi.</p>
        )}
      </section>

      <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-card p-4 space-y-4">
        <h2 className="text-sm font-semibold">Send Request</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="text-sm space-y-1">
            <span className="text-muted-foreground">Method</span>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2"
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
            </select>
          </label>

          <label className="text-sm space-y-1">
            <span className="text-muted-foreground">Content Type</span>
            <select
              value={contentType}
              onChange={(e) => setContentType(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2"
            >
              <option value="form">form</option>
              <option value="json">json</option>
            </select>
          </label>

          <label className="text-sm space-y-1">
            <span className="text-muted-foreground">Path</span>
            <input
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="/123456789/tag/add"
              className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs"
            />
          </label>
        </div>

        <label className="text-sm space-y-1 block">
          <span className="text-muted-foreground">Query (format `key=value`, satu baris satu key)</span>
          <textarea
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs"
          />
        </label>

        {contentType === "form" ? (
          <label className="text-sm space-y-1 block">
            <span className="text-muted-foreground">Form Body (format `key=value`, satu baris satu key)</span>
            <textarea
              value={formInput}
              onChange={(e) => setFormInput(e.target.value)}
              rows={4}
              className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs"
            />
          </label>
        ) : (
          <label className="text-sm space-y-1 block">
            <span className="text-muted-foreground">JSON Body</span>
            <textarea
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              rows={6}
              className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs"
            />
          </label>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {submitting ? "Sending..." : "Send to LZT"}
        </button>
      </form>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {result ? (
        <section className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h2 className="text-sm font-semibold">Response</h2>
          <div className="text-sm">
            Upstream status: <span className="font-semibold">{result.upstream_status}</span>
          </div>
          <pre className="max-h-[420px] overflow-auto rounded-md border border-border bg-background p-3 text-xs">
            {JSON.stringify(result.json ?? result.raw ?? result, null, 2)}
          </pre>
        </section>
      ) : null}
    </div>
  );
}
