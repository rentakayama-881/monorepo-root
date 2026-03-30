"use client";

import React, { useState, useRef, useEffect, useId, useCallback, memo, forwardRef } from "react";
import { cn } from "@/lib/utils";
import {
  normalizeOptions,
  groupOptions,
  filterOptions,
  getDisplayText,
  selectPropTypes,
} from "./selectUtils";
import { NativeSelect, SelectDropdownMenu } from "./selectComponents";

/**
 * Enhanced select component with search, multi-select, and premium features
 */
const Select = memo(
  forwardRef(function Select(
    {
      label = "",
      error = "",
      hint = "",
      options = [],
      placeholder = "",
      searchable = false,
      multiSelect = false,
      loading = false,
      emptyMessage = "Tidak ada opsi tersedia",
      className = "",
      children,
      required = false,
      success = false,
      value: controlledValue,
      onChange,
      renderOption,
      id: propId,
      ...rest
    },
    ref
  ) {
    const generatedId = useId();
    const selectId = propId || generatedId;
    const errorId = `${selectId}-error`;
    const hintId = `${selectId}-hint`;

    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedValues, setSelectedValues] = useState(
      multiSelect ? controlledValue || [] : controlledValue || ""
    );
    const containerRef = useRef(null);
    const mergedRef = useCallback(
      (node) => {
        containerRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      },
      [ref]
    );
    const searchInputRef = useRef(null);

    const normalizedOpts = normalizeOptions(options);
    const groupedOpts = groupOptions(normalizedOpts);
    const filteredOpts = filterOptions(normalizedOpts, searchQuery);

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

    const displayText = getDisplayText(normalizedOpts, selectedValues, multiSelect, placeholder);
    const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(" ") || undefined;

    // Native select for simple cases
    if (useNativeSelect) {
      return (
        <NativeSelect
          selectId={selectId}
          label={label}
          required={required}
          className={className}
          value={controlledValue}
          onChange={onChange}
          error={error}
          describedBy={describedBy}
          placeholder={placeholder}
          hint={hint}
          hintId={hintId}
          {...rest}
        >
          {children}
        </NativeSelect>
      );
    }

    // Custom select with search and multi-select
    const triggerStyles = cn(
      "w-full rounded-lg border bg-card px-3 py-2 text-sm text-foreground transition-all duration-200",
      "flex items-center justify-between gap-2 cursor-pointer",
      error
        ? "border-destructive focus-visible:outline-destructive"
        : success
          ? "border-success focus-visible:outline-success"
          : "border-border",
      !error &&
        !success &&
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary",
      isOpen && "ring-2 ring-ring",
      className
    );

    return (
      <div className="mb-3" ref={mergedRef}>
        {label && (
          <label className="mb-1 block text-sm font-medium text-foreground">
            {label}
            {required && (
              <span className="text-destructive ml-1" aria-hidden="true">
                *
              </span>
            )}
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
                  const opt = normalizedOpts.find((o) => o.value === val);
                  return (
                    <span
                      key={val}
                      className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-0.5 rounded text-xs"
                    >
                      {opt?.label || val}
                      <button
                        onClick={(e) => handleRemoveTag(val, e)}
                        className="hover:text-foreground"
                        aria-label={`Hapus ${opt?.label || val}`}
                      >
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </span>
                  );
                })
              ) : (
                <span
                  className={
                    !selectedValues || (multiSelect && selectedValues.length === 0)
                      ? "text-muted-foreground"
                      : ""
                  }
                >
                  {displayText}
                </span>
              )}
              {multiSelect && selectedValues.length > 3 && (
                <span className="text-xs text-muted-foreground">
                  +{selectedValues.length - 3} lagi
                </span>
              )}
            </div>
            <svg
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform shrink-0",
                isOpen && "rotate-180"
              )}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {isOpen && (
            <SelectDropdownMenu
              searchable={searchable}
              searchInputRef={searchInputRef}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              loading={loading}
              emptyMessage={emptyMessage}
              filteredOpts={filteredOpts}
              groupedOpts={groupedOpts}
              multiSelect={multiSelect}
              selectedValues={selectedValues}
              onSelect={handleSelect}
              renderOption={renderOption}
            />
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
  })
);

Select.propTypes = selectPropTypes;

export default Select;
