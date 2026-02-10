'use client';

import { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';
import { TagPill } from './TagPill';
import { TagIcon } from './TagIcons';

/**
 * GitHub-style Tag Selector Component
 * Multi-select dropdown untuk memilih tags pada Validation Case
 */
export default function TagSelector({ 
  selectedTags = [], 
  onTagsChange,
  availableTags = [],
  disabled = false,
  maxTags = 5,
  placeholder = "Add tags...",
  className = "",
  enableSearch = true,
  singlePerGroup = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter tags based on search query
  const filteredTags = availableTags.filter(tag => {
    const query = enableSearch ? searchQuery : "";
    const matchesSearch = tag.name.toLowerCase().includes(query.toLowerCase()) ||
                         tag.slug.toLowerCase().includes(query.toLowerCase());
    const notSelected = !selectedTags.find(t => t.slug === tag.slug);
    return matchesSearch && notSelected;
  });

  function getTagGroup(tagSlug) {
    const slug = String(tagSlug || "").toLowerCase();
    if (slug.startsWith("artifact-")) return "artifact";
    if (slug.startsWith("stage-")) return "stage";
    if (slug.startsWith("domain-")) return "domain";
    if (slug.startsWith("evidence-")) return "evidence";
    return "other";
  }

  const groupedTags = (() => {
    const groups = { artifact: [], stage: [], domain: [], evidence: [], other: [] };
    for (const tag of filteredTags) {
      const key = getTagGroup(tag.slug);
      groups[key].push(tag);
    }
    return groups;
  })();

  // Toggle tag selection
  const toggleTag = (tag) => {
    if (disabled) return;
    if (selectedTags.find(t => t.slug === tag.slug)) {
      // Remove tag
      onTagsChange(selectedTags.filter(t => t.slug !== tag.slug));
    } else {
      // Add / replace tag
      let base = selectedTags;
      if (singlePerGroup) {
        const groupKey = getTagGroup(tag.slug);
        if (groupKey !== "other") {
          base = selectedTags.filter((t) => getTagGroup(t.slug) !== groupKey);
        }
      }
      if (base.length >= maxTags) return;
      onTagsChange([...base, tag]);
    }
    if (enableSearch) {
      setSearchQuery('');
    } else {
      setIsOpen(false);
    }
  };

  // Remove tag
  const removeTag = (tagSlug) => {
    if (disabled) return;
    onTagsChange(selectedTags.filter(t => t.slug !== tagSlug));
  };

  return (
    <div className={clsx("relative", className)} ref={dropdownRef}>
      {/* Selected tags display */}
      <div className="flex flex-wrap gap-2 mb-2">
        {selectedTags.map((tag) => (
          <TagPill
            key={tag.slug}
            tag={tag}
            size="sm"
            onRemove={disabled ? null : removeTag}
          />
        ))}
      </div>

      {/* Input field */}
      <div className="relative">
        {enableSearch ? (
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder={selectedTags.length >= maxTags ? `Maks ${maxTags} tags` : placeholder}
            disabled={disabled || selectedTags.length >= maxTags}
            className={clsx(
              "w-full px-3 py-2 text-sm border rounded-[var(--radius)]",
              "bg-card border-border",
              "text-foreground placeholder:text-muted-foreground",
              "focus:border-primary focus:ring-1 focus:ring-ring",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "transition-colors"
            )}
          />
        ) : (
          <button
            ref={inputRef}
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            disabled={disabled || selectedTags.length >= maxTags}
            className={clsx(
              "w-full px-3 py-2 text-left text-sm border rounded-[var(--radius)]",
              "bg-card border-border",
              "text-foreground placeholder:text-muted-foreground",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "transition-colors"
            )}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
          >
            <span className={clsx(
              selectedTags.length >= maxTags ? "text-muted-foreground" : "text-muted-foreground"
            )}>
              {selectedTags.length >= maxTags ? `Maks ${maxTags} tags` : placeholder}
            </span>
          </button>
        )}
        
        {/* Dropdown indicator */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg 
            width="12" 
            height="12" 
            viewBox="0 0 12 12" 
            fill="none"
            className="text-muted-foreground"
          >
            <path 
              d="M3 4.5L6 7.5L9 4.5" 
              stroke="currentColor" 
              strokeWidth="1.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      {/* Dropdown menu */}
      {isOpen && filteredTags.length > 0 && (
        <div className={clsx(
          "absolute z-50 w-full mt-1 py-1 rounded-[var(--radius)] shadow-lg border",
          "bg-card border-border",
          "max-h-60 overflow-y-auto"
        )}>
          {[
            { key: "artifact", label: "Artifact" },
            { key: "stage", label: "Stage" },
            { key: "domain", label: "Domain" },
            { key: "evidence", label: "Validation" },
            { key: "other", label: "Other" },
          ].map((group) => {
            const items = groupedTags[group.key] || [];
            if (items.length === 0) return null;
            return (
              <div key={group.key} className="py-1">
                <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </div>
                {items.map((tag) => (
                  <button
                    key={tag.slug}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    disabled={disabled}
                    className={clsx(
                      "w-full px-3 py-2 text-left text-sm flex items-start gap-2",
                      "hover:bg-accent transition-colors",
                      disabled && "opacity-60 cursor-not-allowed"
                    )}
                  >
                    <span className="mt-0.5 text-muted-foreground">
                      <TagIcon name={tag.icon || "tag"} className="h-4 w-4" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground">
                        {tag.name}
                      </div>
                      {tag.description && (
                        <div className="text-xs text-muted-foreground line-clamp-2">
                          {tag.description}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state when searching */}
      {isOpen && (enableSearch ? searchQuery : true) && filteredTags.length === 0 && (
        <div className={clsx(
          "absolute z-50 w-full mt-1 py-3 px-3 rounded-[var(--radius)] shadow-lg border",
          "bg-card border-border",
          "text-sm text-muted-foreground text-center"
        )}>
          Tags tidak ditemukan
        </div>
      )}

      {/* Helper text */}
      <p className="mt-1.5 text-xs text-muted-foreground">
        Pilih hingga {maxTags} tags. Ideal: 1 artifact + 1 domain + opsional stage/validation.
        {selectedTags.length > 0 && ` (${selectedTags.length}/${maxTags} dipilih)`}
      </p>
    </div>
  );
}
