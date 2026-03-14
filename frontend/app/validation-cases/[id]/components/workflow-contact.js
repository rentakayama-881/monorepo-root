import { useMemo, useState } from "react";
import { fetchJsonAuth } from "@/lib/api";
import {
  resolveTelegramContactHref,
  formatTelegramContactLabel,
} from "./validationCaseDetailUtils";

/**
 * Sub-hook: Contact / Telegram reveal workflow.
 */
export function useWorkflowContact({ id, isAuthed, router }) {
  const [contactTelegram, setContactTelegram] = useState("");
  const [contactMsg, setContactMsg] = useState("");
  const [contactLoading, setContactLoading] = useState(false);

  const contactTelegramHref = useMemo(
    () => resolveTelegramContactHref(contactTelegram),
    [contactTelegram]
  );
  const contactTelegramLabel = useMemo(
    () => formatTelegramContactLabel(contactTelegram),
    [contactTelegram]
  );

  async function revealContact() {
    if (!isAuthed) {
      router.push("/login");
      return;
    }
    setContactMsg("");
    setContactLoading(true);
    try {
      const data = await fetchJsonAuth(
        `/api/validation-cases/${encodeURIComponent(String(id))}/contact`,
        { method: "GET" }
      );
      const telegram = String(data?.telegram || "").trim();
      if (!telegram) {
        setContactMsg("Kontak tidak tersedia.");
        return;
      }
      setContactTelegram(telegram);
      if (/^tg:\/\/user\?id=/i.test(telegram)) {
        setContactMsg(
          "Akun Telegram pemilik belum memiliki username publik. Gunakan tombol untuk membuka Telegram app."
        );
      } else {
        setContactMsg("Kontak dibuka secara privat dan dicatat pada Case Log.");
      }
    } catch (e) {
      setContactMsg(e?.message || "Gagal membuka kontak");
    } finally {
      setContactLoading(false);
    }
  }

  return {
    contactTelegram,
    contactMsg,
    contactLoading,
    contactTelegramHref,
    contactTelegramLabel,
    revealContact,
  };
}
