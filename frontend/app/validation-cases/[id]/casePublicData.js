import { isWorkspaceValidationCase } from "@/lib/validationCaseWorkflow";
import logger from "@/lib/logger";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.aivalid.id").replace(
  /\/+$/,
  ""
);

export function unwrapValidationCase(data) {
  return data?.validation_case || data || null;
}

export function resolveValidationCaseSkeletonVariant(data) {
  const validationCase = unwrapValidationCase(data);
  if (!validationCase) return "generic";
  return isWorkspaceValidationCase(validationCase?.meta) ? "workspace" : "standard";
}

export function resolveValidationCaseIdFromPathname(pathname) {
  const match = String(pathname || "").match(/^\/validation-cases\/([^/?#]+)/);
  if (!match?.[1]) return "";
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export async function fetchCasePublic(id) {
  if (!id) return null;
  try {
    const res = await fetch(
      `${API_BASE}/api/v1/validation-cases/${encodeURIComponent(String(id))}/public`,
      {
        next: { revalidate: 10 },
      }
    );
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    logger.warn("[casePublicData] fetchCasePublic failed for id=%s: %s", id, err?.message || err);
    return null;
  }
}
