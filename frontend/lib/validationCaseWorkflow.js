export const WORKFLOW_FAMILY_WORKSPACE = "evidence_validation_workspace";
export const LEGACY_PROTOCOL_REPO = "repo_validation_v2";
export const LEGACY_PROTOCOL_V1 = "workflow_v1";

function normalizeValue(raw) {
  return String(raw || "").trim().toLowerCase();
}

export function resolveValidationCaseWorkflow(meta) {
  const family = normalizeValue(meta?.workflow_family);
  if (family === WORKFLOW_FAMILY_WORKSPACE) {
    return WORKFLOW_FAMILY_WORKSPACE;
  }

  const protocolMode = normalizeValue(meta?.protocol_mode);
  if (protocolMode === LEGACY_PROTOCOL_REPO) {
    return WORKFLOW_FAMILY_WORKSPACE;
  }
  if (protocolMode === LEGACY_PROTOCOL_V1) {
    return LEGACY_PROTOCOL_V1;
  }

  // Default to legacy workflow for historical records with no explicit marker.
  return LEGACY_PROTOCOL_V1;
}

export function isWorkspaceValidationCase(meta) {
  return resolveValidationCaseWorkflow(meta) === WORKFLOW_FAMILY_WORKSPACE;
}

export function getWorkspaceDisplayName(meta) {
  const custom = String(meta?.workflow_name || "").trim();
  return custom || "Evidence Validation Workspace";
}
