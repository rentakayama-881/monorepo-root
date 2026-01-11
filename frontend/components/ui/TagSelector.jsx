'use client';

import { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';

/**
 * GitHub-style Tag Selector Component
 * Multi-select dropdown untuk memilih tags pada thread
 */
export default function TagSelector({ 
  selectedTags = [], 
  onTagsChange,
  availableTags = [],
  maxTags = 5,
  placeholder = "Add tags...",
  className = ""
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
    const matchesSearch = tag.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         tag.slug.toLowerCase().includes(searchQuery.toLowerCase());
    const notSelected = !selectedTags.find(t => t.slug === tag.slug);
    return matchesSearch && notSelected;
  });

  // Toggle tag selection
  const toggleTag = (tag) => {
    if (selectedTags.find(t => t.slug === tag.slug)) {
      // Remove tag
      onTagsChange(selectedTags.filter(t => t.slug !== tag.slug));
    } else if (selectedTags.length < maxTags) {
      // Add tag
      onTagsChange([...selectedTags, tag]);
    }
    setSearchQuery('');
  };

  // Remove tag
  const removeTag = (tagSlug) => {
    onTagsChange(selectedTags.filter(t => t.slug !== tagSlug));
  };

  return (
    <div className={clsx("relative", className)} ref={dropdownRef}>
      {/* Selected tags display */}
      <div className="flex flex-wrap gap-2 mb-2">
        {selectedTags.map((tag) => (
          <div
            key={tag.slug}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors"
            style={{
              backgroundColor: `${tag.color}10`,
              borderColor: `${tag.color}40`,
              color: tag.color
            }}
          >
            {tag.icon && (
              <span className="text-xs">{getIconSVG(tag.icon)}</span>
            )}
            <span>{tag.name}</span>
            <button
              type="button"
              onClick={() => removeTag(tag.slug)}
              className="hover:opacity-70 transition-opacity ml-0.5"
              aria-label={`Remove ${tag.name}`}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <path d="M2.22 2.22a.75.75 0 0 1 1.06 0L6 4.94l2.72-2.72a.75.75 0 1 1 1.06 1.06L7.06 6l2.72 2.72a.75.75 0 1 1-1.06 1.06L6 7.06l-2.72 2.72a.75.75 0 0 1-1.06-1.06L4.94 6 2.22 3.28a.75.75 0 0 1 0-1.06z"/>
              </svg>
            </button>
          </div>
        ))}
      </div>

      {/* Input field */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={selectedTags.length >= maxTags ? `Max ${maxTags} tags` : placeholder}
          disabled={selectedTags.length >= maxTags}
          className={clsx(
            "w-full px-3 py-2 text-sm border rounded-md",
            "bg-[rgb(var(--surface))] border-[rgb(var(--border))]",
            "text-[rgb(var(--fg))] placeholder:text-[rgb(var(--muted))]",
            "focus:border-[rgb(var(--brand))] focus:ring-1 focus:ring-[rgb(var(--brand))]",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "transition-colors"
          )}
        />
        
        {/* Dropdown indicator */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg 
            width="12" 
            height="12" 
            viewBox="0 0 12 12" 
            fill="none"
            className="text-[rgb(var(--muted))]"
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
          "absolute z-50 w-full mt-1 py-1 rounded-md shadow-lg border",
          "bg-[rgb(var(--surface))] border-[rgb(var(--border))]",
          "max-h-60 overflow-y-auto"
        )}>
          {filteredTags.map((tag) => (
            <button
              key={tag.slug}
              type="button"
              onClick={() => toggleTag(tag)}
              className={clsx(
                "w-full px-3 py-2 text-left text-sm flex items-center gap-2",
                "hover:bg-[rgb(var(--surface-2))] transition-colors"
              )}
            >
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: tag.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-[rgb(var(--fg))]">
                  {tag.name}
                </div>
                {tag.description && (
                  <div className="text-xs text-[rgb(var(--muted))] truncate">
                    {tag.description}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Empty state when searching */}
      {isOpen && searchQuery && filteredTags.length === 0 && (
        <div className={clsx(
          "absolute z-50 w-full mt-1 py-3 px-3 rounded-md shadow-lg border",
          "bg-[rgb(var(--surface))] border-[rgb(var(--border))]",
          "text-sm text-[rgb(var(--muted))] text-center"
        )}>
          No tags found
        </div>
      )}

      {/* Helper text */}
      <p className="mt-1.5 text-xs text-[rgb(var(--muted))]">
        Select up to {maxTags} tags to categorize your thread.
        {selectedTags.length > 0 && ` (${selectedTags.length}/${maxTags} selected)`}
      </p>
    </div>
  );
}

// Simple icon helper (could be replaced with actual icon library)
function getIconSVG(iconName) {
  const icons = {
    'briefcase': '💼',
    'tag': '🏷️',
    'search': '🔍',
    'people': '👥',
    'git-merge': '🔀',
    'question': '❓',
    'comment-discussion': '💬',
    'megaphone': '📢',
    'book': '📖',
    'star': '⭐',
  };
  return icons[iconName] || '🏷️';
}
