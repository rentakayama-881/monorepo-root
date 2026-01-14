const DEFAULT_ALERT = {
  variant: "error",
  title: "Terjadi kesalahan",
};

const ALERT_BY_CODE = {
  AUTH005: {
    variant: "error",
    title: "Token tidak valid",
    message: "Token tidak valid atau sudah kedaluwarsa. Silakan login kembali.",
  },
  AUTH009: {
    variant: "warning",
    title: "Akun terkunci",
    message: "Akun Anda terkunci karena aktivitas mencurigakan.",
  },
  AUTH012: {
    variant: "warning",
    title: "Akun dikunci sementara",
    message: "Terlalu banyak percobaan login gagal. Silakan coba lagi nanti.",
  },
  AUTH013: {
    variant: "warning",
    title: "Percobaan dibatasi",
    message: "Mohon tunggu sebelum mencoba login kembali.",
  },
  AUTH014: {
    variant: "warning",
    title: "Verifikasi dibatasi",
    message: "Terlalu banyak percobaan verifikasi. Coba lagi nanti.",
  },
  RATE001: {
    variant: "warning",
    title: "Terlalu banyak permintaan",
    message: "Mohon tunggu sebentar sebelum mencoba lagi.",
  },
  RATE002: {
    variant: "warning",
    title: "Batas permintaan tercapai",
    message: "Mohon tunggu sebentar sebelum mencoba lagi.",
  },
};

function extractErrorInfo(error) {
  if (!error) return {};
  if (typeof error === "string") {
    return { message: error };
  }
  return {
    message: error.message,
    code: error.code,
    details: error.details || error.data?.details,
  };
}

export function mapApiErrorToAlert(error) {
  const { code, message, details } = extractErrorInfo(error);
  const mapped = code && ALERT_BY_CODE[code] ? { ...ALERT_BY_CODE[code] } : { ...DEFAULT_ALERT };
  const fallbackMessage = message || mapped.message || "Terjadi kesalahan. Silakan coba lagi.";
  const baseMessage = mapped.message || fallbackMessage;
  const combinedMessage = details && details !== baseMessage ? `${baseMessage} ${details}` : baseMessage;

  return {
    variant: mapped.variant || DEFAULT_ALERT.variant,
    title: mapped.title || DEFAULT_ALERT.title,
    message: combinedMessage,
  };
}
