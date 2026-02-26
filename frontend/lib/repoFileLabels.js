const REPO_FILE_KIND_LABELS = {
  task_input: "Task Input",
  case_readme: "Case README",
  validator_output: "Validator Output",
  sensitive_context: "Sensitive Context",
};

const REPO_FILE_VISIBILITY_LABELS = {
  public: "Public",
  assigned_validators: "Assigned Validators",
};

function humanizeSlug(value) {
  const raw = String(value || "").trim();
  if (!raw) return "-";
  return raw
    .split(/[_-]+/g)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1).toLowerCase())
    .join(" ");
}

export function formatRepoFileKindLabel(kind) {
  const key = String(kind || "").trim().toLowerCase();
  if (!key) return "-";
  return REPO_FILE_KIND_LABELS[key] || humanizeSlug(key);
}

export function formatRepoFileVisibilityLabel(visibility) {
  const key = String(visibility || "").trim().toLowerCase();
  if (!key) return "-";
  return REPO_FILE_VISIBILITY_LABELS[key] || humanizeSlug(key);
}
