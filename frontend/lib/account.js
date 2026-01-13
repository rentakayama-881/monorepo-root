export function normalizeSocialAccounts(rawSocials) {
  if (Array.isArray(rawSocials)) {
    return rawSocials;
  }

  if (rawSocials && typeof rawSocials === "object") {
    return Object.entries(rawSocials).map(([label, url]) => ({ label, url }));
  }

  return [];
}

export function buildSocialAccountsPayload(socials) {
  return socials.reduce((acc, entry) => {
    const label = (entry.label || "").trim();
    const url = (entry.url || "").trim();
    if (label && url) {
      acc[label] = url;
    }
    return acc;
  }, {});
}
