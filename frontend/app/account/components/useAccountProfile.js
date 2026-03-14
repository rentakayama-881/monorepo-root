import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchWithAuth } from "@/lib/tokenRefresh";
import { normalizeAccountPayload, normalizeTelegramAuth } from "./accountUtils";

export function useAccountProfile({ apiBase, setError, setOk }) {
  const [username, setUsername] = useState("");
  const [form, setForm] = useState({ full_name: "", bio: "", pronouns: "", company: "" });
  const [socials, setSocials] = useState([{ label: "", url: "" }]);
  const [telegramAuth, setTelegramAuth] = useState(() =>
    normalizeTelegramAuth({ connected: false })
  );

  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaveMessage, setProfileSaveMessage] = useState("");
  const [savedProfileSignature, setSavedProfileSignature] = useState(
    JSON.stringify(normalizeAccountPayload({}, []))
  );

  const profilePayload = useMemo(() => normalizeAccountPayload(form, socials), [form, socials]);
  const profilePayloadSignature = useMemo(() => JSON.stringify(profilePayload), [profilePayload]);
  const profileDirty = profilePayloadSignature !== savedProfileSignature;

  useEffect(() => {
    if (profileDirty) {
      setProfileSaveMessage("");
    }
  }, [profileDirty]);

  const populate = useCallback((data) => {
    setUsername(data.username || "");

    const nextForm = {
      full_name: data.full_name || "",
      bio: data.bio || "",
      pronouns: data.pronouns || "",
      company: data.company || "",
    };

    const socialAccounts = Array.isArray(data.social_accounts) ? data.social_accounts : [];
    const normalized = normalizeAccountPayload(nextForm, socialAccounts);

    setForm(nextForm);
    setSocials(
      normalized.social_accounts.length ? normalized.social_accounts : [{ label: "", url: "" }]
    );
    setTelegramAuth(normalizeTelegramAuth(data.telegram_auth));
    setSavedProfileSignature(JSON.stringify(normalized));
    setProfileSaveMessage("");
  }, []);

  const updateSocial = useCallback((index, key, value) => {
    setSocials((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [key]: value };
      return copy;
    });
  }, []);

  const addSocial = useCallback(() => {
    setSocials((prev) => [...prev, { label: "", url: "" }]);
  }, []);

  const removeSocial = useCallback((index) => {
    setSocials((prev) => prev.filter((_, idx) => idx !== index));
  }, []);

  async function saveAccount(event) {
    event.preventDefault();
    if (!profileDirty || profileSaving) return;

    setError("");
    setOk("");
    setProfileSaveMessage("");
    setProfileSaving(true);

    try {
      const response = await fetchWithAuth(`${apiBase}/account`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profilePayload),
      });

      if (!response.ok) {
        throw new Error((await response.text()) || "Gagal menyimpan akun");
      }

      setSavedProfileSignature(profilePayloadSignature);
      setProfileSaveMessage("Perubahan profil disimpan.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setProfileSaving(false);
    }
  }

  return {
    username,
    form,
    setForm,
    socials,
    telegramAuth,
    setTelegramAuth,
    profileDirty,
    profileSaving,
    profileSaveMessage,
    updateSocial,
    addSocial,
    removeSocial,
    saveAccount,
    populate,
  };
}
