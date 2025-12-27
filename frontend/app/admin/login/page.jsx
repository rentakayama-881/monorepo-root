"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { fetchJson } from "@/lib/api";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await fetchJson("/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      // Store admin token separately from user token
      localStorage.setItem("admin_token", data.token);
      localStorage.setItem("admin_info", JSON.stringify(data.admin));

      router.push("/admin");
    } catch (err) {
      setError(err?.message || "Login gagal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 pt-20">
      <div className="w-full max-w-sm">
        <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-6">
          <div className="mb-6 text-center">
            <h1 className="text-xl font-semibold text-[rgb(var(--fg))]">
              Admin Login
            </h1>
            <p className="mt-1 text-sm text-[rgb(var(--muted))]">
              Masuk ke dashboard admin
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-md border border-[rgb(var(--error-border))] bg-[rgb(var(--error-bg))] px-4 py-3 text-sm text-[rgb(var(--error))]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              label="Email"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Input
              type="password"
              label="Password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <Button
              type="submit"
              variant="primary"
              disabled={loading}
              className="w-full"
            >
              {loading ? "Memproses..." : "Login"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
