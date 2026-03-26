import React from "react";
import { cn } from "@/lib/utils";

/**
 * Native HTML select wrapper — used when children are provided and
 * neither searchable nor multiSelect is enabled.
 */
export function NativeSelect({
  selectId,
  label,
  required,
  className,
  value,
  onChange,
  error,
  describedBy,
  placeholder,
  children,
  hint,
  hintId,
  ...rest
}) {
  const selectStyles = cn(
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
          {required && (
            <span className="text-destructive ml-1" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      <div className="relative">
        <select
          id={selectId}
          className={selectStyles}
          value={value}
          onChange={onChange}
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
          <svg
            className="h-4 w-4 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
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

/**
 * Dropdown menu panel shown when the custom select is open.
 */
export function SelectDropdownMenu({
  searchable,
  searchInputRef,
  searchQuery,
  onSearchChange,
  loading,
  emptyMessage,
  filteredOpts,
  groupedOpts,
  multiSelect,
  selectedValues,
  onSelect,
  renderOption,
}) {
  return (
    <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg animate-scale-in origin-top max-h-64 overflow-hidden">
      {searchable && (
        <div className="p-2 border-b border-border">
          <input
            ref={searchInputRef}
            type="text"
            className="w-full px-3 py-1.5 text-sm bg-card border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Cari..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <div className="overflow-y-auto max-h-48 custom-scrollbar p-1">
        {loading ? (
          <div className="px-3 py-2 text-sm text-muted-foreground text-center">Memuat...</div>
        ) : filteredOpts.length === 0 ? (
          <div className="px-3 py-2 text-sm text-muted-foreground text-center">{emptyMessage}</div>
        ) : (
          Object.entries(groupedOpts).map(([group, opts]) => {
            const groupFiltered = opts.filter((opt) => !searchQuery || filteredOpts.includes(opt));
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
                      className={cn(
                        "w-full px-3 py-2 text-left text-sm rounded transition-colors flex items-center justify-between gap-2",
                        "hover:bg-accent hover:text-accent-foreground",
                        isSelected && "bg-accent/50 font-medium"
                      )}
                      onClick={() => onSelect(opt.value)}
                    >
                      <span className="flex-1">{renderOption ? renderOption(opt) : opt.label}</span>
                      {isSelected && (
                        <svg
                          className="w-4 h-4 text-primary"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
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
  );
}
