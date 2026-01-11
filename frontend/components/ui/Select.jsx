"use client";

import React, { useState, useRef, useEffect, useId } from "react";
import PropTypes from "prop-types";
import clsx from "clsx";

/**
 * Enhanced select component with search, multi-select, and premium features
 * - label: string (optional, tampil di atas select)
 * - error: string (optional, tampil di bawah select)
 * - options: array of { value, label, group } atau array of strings
 * - placeholder: string (optional, option pertama yang disabled)
 * - searchable: boolean (enable search/filter)
 * - multiSelect: boolean (enable multi-select)
 * - loading: boolean (show loading state)
 * - emptyMessage: string (message when no options)
 * - children: ReactNode (optional, untuk custom options - only for non-searchable, non-multiselect)
 * - ...rest: props lain (value, onChange, dsb)
 */
export default function Select({
  label = "",
  error = "",
  hint = "",
  options = [],
  placeholder = "",
  searchable = false,
  multiSelect = false,
  loading = false,
  emptyMessage = "No options available",
  className = "",
  children,
  required = false,
  success = false,
  value: controlledValue,
  onChange,
  renderOption,
  id: propId,
  ...rest
}) {
  const generatedId = useId();
  const selectId = propId || generatedId;
  const errorId = `${selectId}-error`;
  const hintId = `${selectId}-hint`;
  
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedValues, setSelectedValues] = useState(
    multiSelect ? (controlledValue || []) : controlledValue || ""
  );
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Normalize options to { value, label, group } format
  const normalizedOptions = options.map((opt) =>
    typeof opt === "string" ? { value: opt, label: opt } : opt
  );

  // Group options if they have group property
  const groupedOptions = normalizedOptions.reduce((acc, opt) => {
    const group = opt.group || "_default";
    if (!acc[group]) acc[group] = [];
    acc[group].push(opt);
    return acc;
  }, {});

  // Filter options based on search query
  const filteredOptions = searchQuery
    ? normalizedOptions.filter((opt) =>
        opt.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : normalizedOptions;

  // Use children if provided and not searchable/multiselect
  const hasChildren = React.Children.count(children) > 0;
  const useNativeSelect = hasChildren && !searchable && !multiSelect;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        setSearchQuery("");
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, searchable]);

  const handleSelect = (optionValue) => {
    if (multiSelect) {
      const newValues = selectedValues.includes(optionValue)
        ? selectedValues.filter((v) => v !== optionValue)
        : [...selectedValues, optionValue];
      setSelectedValues(newValues);
      // Create a more complete synthetic event
      onChange?.({
        target: { value: newValues, name: rest.name || "" },
        currentTarget: { value: newValues, name: rest.name || "" },
        type: "change",
      });
    } else {
      setSelectedValues(optionValue);
      onChange?.({
        target: { value: optionValue, name: rest.name || "" },
        currentTarget: { value: optionValue, name: rest.name || "" },
        type: "change",
      });
      setIsOpen(false);
      setSearchQuery("");
    }
  };

  const handleRemoveTag = (optionValue, e) => {
    e.stopPropagation();
    const newValues = selectedValues.filter((v) => v !== optionValue);
    setSelectedValues(newValues);
    onChange?.({
      target: { value: newValues, name: rest.name || "" },
      currentTarget: { value: newValues, name: rest.name || "" },
      type: "change",
    });
  };

  const getDisplayText = () => {
    if (multiSelect) {
      return selectedValues.length > 0
        ? `${selectedValues.length} selected`
        : placeholder || "Select options...";
    }
    const selected = normalizedOptions.find((opt) => opt.value === selectedValues);
    return selected ? selected.label : placeholder || "Select option...";
  };

  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(" ") || undefined;

  // Native select for simple cases
  if (useNativeSelect) {
    const selectStyles = clsx(
      "w-full rounded-lg border bg-card px-3 py-2 text-sm text-foreground transition-all duration-200",
      "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring appearance-none cursor-pointer",
      error ? "border-destructive" : "border-border",
      className
    );

    return (
      <div className="mb-3">
        {label && (
          <label htmlFor={selectId} className="mb-1 block text-sm font-medium text-foreground">
            {label}
            {required && <span className="text-destructive ml-1" aria-hidden="true">*</span>}
          </label>
        )}
        <div className="relative">
          <select
            id={selectId}
            className={selectStyles}
            aria-invalid={!!error}
            aria-describedby={describedBy}
            aria-required={required || undefined}
            {...rest}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {children}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
            <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        {hint && !error && (
          <p id={hintId} className="mt-1 text-xs text-muted-foreground">
            {hint}
          </p>
        )}
        {error && <div className="mt-1 text-xs text-destructive">{error}</div>}
      </div>
    );
  }

  // Custom select with search and multi-select
  const triggerStyles = clsx(
    "w-full rounded-lg border bg-card px-3 py-2 text-sm text-foreground transition-all duration-200",
    "flex items-center justify-between gap-2 cursor-pointer",
    error
      ? "border-destructive focus-visible:outline-destructive"
      : success
      ? "border-success focus-visible:outline-success"
      : "border-border",
    !error && !success && "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary",
    isOpen && "ring-2 ring-ring",
    className
  );

  return (
    <div className="mb-3" ref={containerRef}>
      {label && (
        <label className="mb-1 block text-sm font-medium text-foreground">
          {label}
          {required && <span className="text-destructive ml-1" aria-hidden="true">*</span>}
        </label>
      )}

      <div className="relative">
        <button
          type="button"
          className={triggerStyles}
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        >
          <div className="flex-1 text-left flex flex-wrap gap-1">
            {multiSelect && selectedValues.length > 0 ? (
              selectedValues.slice(0, 3).map((val) => {
                const opt = normalizedOptions.find((o) => o.value === val);
                return (
                  <span
                    key={val}
                    className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-0.5 rounded text-xs"
                  >
                    {opt?.label || val}
                    <button
                      onClick={(e) => handleRemoveTag(val, e)}
                      className="hover:text-foreground"
                      aria-label={`Remove ${opt?.label || val}`}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                );
              })
            ) : (
              <span className={!selectedValues || (multiSelect && selectedValues.length === 0) ? "text-muted-foreground" : ""}>
                {getDisplayText()}
              </span>
            )}
            {multiSelect && selectedValues.length > 3 && (
              <span className="text-xs text-muted-foreground">+{selectedValues.length - 3} more</span>
            )}
          </div>
          <svg
            className={clsx(
              "h-4 w-4 text-muted-foreground transition-transform shrink-0",
              isOpen && "rotate-180"
            )}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg animate-scale-in origin-top max-h-64 overflow-hidden">
            {searchable && (
              <div className="p-2 border-b border-border">
                <input
                  ref={searchInputRef}
                  type="text"
                  className="w-full px-3 py-1.5 text-sm bg-card border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}

            <div className="overflow-y-auto max-h-48 custom-scrollbar p-1">
              {loading ? (
                <div className="px-3 py-2 text-sm text-muted-foreground text-center">
                  Loading...
                </div>
              ) : filteredOptions.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted-foreground text-center">
                  {emptyMessage}
                </div>
              ) : (
                Object.entries(groupedOptions).map(([group, opts]) => {
                  const groupFiltered = opts.filter(
                    (opt) => !searchQuery || filteredOptions.includes(opt)
                  );
                  if (groupFiltered.length === 0) return null;

                  return (
                    <div key={group}>
                      {group !== "_default" && (
                        <div className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase">
                          {group}
                        </div>
                      )}
                      {groupFiltered.map((opt) => {
                        const isSelected = multiSelect
                          ? selectedValues.includes(opt.value)
                          : selectedValues === opt.value;

                        return (
                          <button
                            key={opt.value}
                            type="button"
                            className={clsx(
                              "w-full px-3 py-2 text-left text-sm rounded transition-colors flex items-center justify-between gap-2",
                              "hover:bg-accent hover:text-accent-foreground",
                              isSelected && "bg-accent/50 font-medium"
                            )}
                            onClick={() => handleSelect(opt.value)}
                          >
                            <span className="flex-1">
                              {renderOption ? renderOption(opt) : opt.label}
                            </span>
                            {isSelected && (
                              <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {hint && !error && (
        <p id={hintId} className="mt-1 text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && <div className="mt-1 text-xs text-destructive animate-fade-in">{error}</div>}
    </div>
  );
}

Select.propTypes = {
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
