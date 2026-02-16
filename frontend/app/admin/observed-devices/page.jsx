"use client";

import { useEffect, useState, useCallback } from "react";
import Button from "@/components/ui/Button";
import { getAdminToken } from "@/lib/adminAuth";
import { getApiBase } from "@/lib/api";
import { getFeatureApiBase } from "@/lib/featureApi";

export default function ObservedDevicesPage() {
  const [devices, setDevices] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const pageSize = 50;

  // Ban modal state
  const [banModal, setBanModal] = useState(null); // { fingerprintHash }
  const [banForm, setBanForm] = useState({
    reason: "",
    isPermanent: true,
    expiresAt: "",
  });
  const [banLoading, setBanLoading] = useState(false);

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = getAdminToken();
      if (!token) {
        setDevices([]);
        setError("Sesi admin berakhir. Silakan login ulang.");
        return;
      }

      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search) params.set("search", search);

      const res = await fetch(
        `${getApiBase()}/admin/observed-devices?${params}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.ok) {
        let msg = `Gagal memuat observed devices (${res.status})`;
        try {
          const body = await res.json();
          if (body?.code) msg = `${body.code}: ${body.message}`;
          else if (body?.error?.message) msg = body.error.message;
          else if (body?.message) msg = body.message;
        } catch {}
        throw new Error(msg);
      }

      const data = await res.json();
      setDevices(data.devices || []);
      setTotal(data.total || 0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const openBanModal = (device) => {
    setBanModal({ fingerprintHash: device.fingerprint_hash });
    setBanForm({ reason: "", isPermanent: true, expiresAt: "" });
  };

  const handleBan = async (e) => {
    e.preventDefault();
    setBanLoading(true);
    try {
      const token = getAdminToken();
      if (!token) throw new Error("Sesi admin berakhir. Silakan login ulang.");

      const body = {
        deviceFingerprint: banModal.fingerprintHash,
        reason: banForm.reason,
        isPermanent: banForm.isPermanent,
      };
      if (!banForm.isPermanent && banForm.expiresAt) {
        body.expiresAt = new Date(banForm.expiresAt).toISOString();
      }

      const res = await fetch(
        `${getFeatureApiBase()}/api/v1/admin/moderation/device-bans`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }
      );

      if (!res.ok) {
        let msg = `Gagal membuat device ban (${res.status})`;
        try {
          const resBody = await res.json();
          if (resBody?.error?.message) msg = resBody.error.message;
          else if (resBody?.error)
            msg = typeof resBody.error === "string" ? resBody.error : msg;
          else if (resBody?.message) msg = resBody.message;
        } catch {}
        throw new Error(msg);
      }

      setBanModal(null);
      fetchDevices();
    } catch (e) {
      alert(e.message);
    } finally {
      setBanLoading(false);
    }
  };

  const formatDateTime = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("id-ID");
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">
          Observed Devices
        </h1>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by fingerprint hash or user ID..."
          className="flex-1 max-w-md px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm"
        />
        <Button type="submit" size="sm">
          Search
        </Button>
        {search && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setSearchInput("");
              setSearch("");
              setPage(1);
            }}
          >
            Clear
          </Button>
        )}
      </form>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : devices.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          Tidak ada observed devices
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    Fingerprint Hash
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    Accounts
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    Last Seen
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    IP
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    User Agent
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    Users
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {devices.map((device) => (
                  <tr
                    key={device.fingerprint_hash}
                    className="border-b border-border hover:bg-muted/50"
                  >
                    <td className="py-3 px-4 font-mono text-xs max-w-48 truncate">
                      {device.fingerprint_hash}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-xs">
                        {device.account_count}
                      </span>
                      {device.blocked && (
                        <span className="ml-2 inline-flex items-center rounded-full border border-destructive/20 bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                          Blocked
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">
                      {formatDateTime(device.last_seen_at)}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs">
                      {device.ip_address || "-"}
                    </td>
                    <td
                      className="py-3 px-4 text-xs max-w-40 truncate"
                      title={device.user_agent}
                    >
                      {device.user_agent || "-"}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      {device.user_ids.length > 0
                        ? device.user_ids.join(", ")
                        : "-"}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => openBanModal(device)}
                      >
                        Ban Device
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
            <span>
              Total: {total} devices
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </Button>
              <span>
                Page {page} / {totalPages}
              </span>
              <Button
                size="sm"
                variant="secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Ban Modal */}
      {banModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-lg max-w-md w-full">
            <div className="p-6 border-b border-border">
              <h2 className="text-xl font-semibold text-foreground">
                Ban Device
              </h2>
            </div>

            <form onSubmit={handleBan} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Fingerprint Hash
                </label>
                <input
                  type="text"
                  value={banModal.fingerprintHash}
                  disabled
                  className="w-full px-3 py-2 rounded-lg border border-border bg-muted text-muted-foreground font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Reason *
                </label>
                <textarea
                  value={banForm.reason}
                  onChange={(e) =>
                    setBanForm({ ...banForm, reason: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                  rows={3}
                  required
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="banIsPermanent"
                  checked={banForm.isPermanent}
                  onChange={(e) =>
                    setBanForm({ ...banForm, isPermanent: e.target.checked })
                  }
                  className="rounded border-border"
                />
                <label
                  htmlFor="banIsPermanent"
                  className="text-sm text-foreground"
                >
                  Permanent Ban
                </label>
              </div>

              {!banForm.isPermanent && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Expires At
                  </label>
                  <input
                    type="datetime-local"
                    value={banForm.expiresAt}
                    onChange={(e) =>
                      setBanForm({ ...banForm, expiresAt: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setBanModal(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="danger" disabled={banLoading}>
                  {banLoading ? "Banning..." : "Ban Device"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
