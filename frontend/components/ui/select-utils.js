import PropTypes from "prop-types";

/**
 * Normalize options to { value, label, group } format
 */
export function normalizeOptions(options) {
  return options.map((opt) => (typeof opt === "string" ? { value: opt, label: opt } : opt));
}

/**
 * Group options by their group property
 */
export function groupOptions(normalizedOptions) {
  return normalizedOptions.reduce((acc, opt) => {
    const group = opt.group || "_default";
    if (!acc[group]) acc[group] = [];
    acc[group].push(opt);
    return acc;
  }, {});
}

/**
 * Filter options based on search query
 */
export function filterOptions(normalizedOptions, searchQuery) {
  if (!searchQuery) return normalizedOptions;
  return normalizedOptions.filter((opt) =>
    opt.label.toLowerCase().includes(searchQuery.toLowerCase())
  );
}

/**
 * Get display text for current selection
 */
export function getDisplayText(normalizedOptions, selectedValues, multiSelect, placeholder) {
  if (multiSelect) {
    return selectedValues.length > 0
      ? `${selectedValues.length} selected`
      : placeholder || "Select options...";
  }
  const selected = normalizedOptions.find((opt) => opt.value === selectedValues);
  return selected ? selected.label : placeholder || "Select option...";
}

export const selectPropTypes = {
  label: PropTypes.string,
  error: PropTypes.string,
  hint: PropTypes.string,
  options: PropTypes.arrayOf(
    PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.shape({
        value: PropTypes.string.isRequired,
        label: PropTypes.string.isRequired,
        group: PropTypes.string,
      }),
    ])
  ),
  placeholder: PropTypes.string,
  searchable: PropTypes.bool,
  multiSelect: PropTypes.bool,
  loading: PropTypes.bool,
  emptyMessage: PropTypes.string,
  className: PropTypes.string,
  children: PropTypes.node,
  required: PropTypes.bool,
  success: PropTypes.bool,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.array]),
  onChange: PropTypes.func,
  renderOption: PropTypes.func,
  id: PropTypes.string,
};
