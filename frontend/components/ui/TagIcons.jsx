"use client";

import clsx from "clsx";

function Icon({ children, className, ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={clsx("shrink-0", className)}
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

// Minimal, modern, stroke-based icon set (no emoji, no external deps).
const ICONS = {
  "tag": (props) => (
    <Icon {...props}>
      <path d="M20.59 13.41 11 3.83A2 2 0 0 0 9.59 3H4a1 1 0 0 0-1 1v5.59A2 2 0 0 0 3.83 11l9.58 9.59a2 2 0 0 0 2.83 0l4.35-4.35a2 2 0 0 0 0-2.83Z" />
      <path d="M7.5 7.5h.01" />
    </Icon>
  ),
  "briefcase": (props) => (
    <Icon {...props}>
      <path d="M10 6V5a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v1" />
      <rect x="3" y="6" width="18" height="14" rx="2" />
      <path d="M3 12h18" />
      <path d="M12 12v0" />
    </Icon>
  ),
  "search": (props) => (
    <Icon {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </Icon>
  ),
  "people": (props) => (
    <Icon {...props}>
      <path d="M16 11a4 4 0 1 0-8 0" />
      <path d="M4 21v-1a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v1" />
      <path d="M8 11a4 4 0 0 1 8 0" />
    </Icon>
  ),
  "git-merge": (props) => (
    <Icon {...props}>
      <circle cx="18" cy="18" r="2" />
      <circle cx="6" cy="6" r="2" />
      <circle cx="6" cy="18" r="2" />
      <path d="M8 6h6a4 4 0 0 1 4 4v6" />
      <path d="M6 8v8" />
    </Icon>
  ),
  "question": (props) => (
    <Icon {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.1 9a3 3 0 1 1 5.8 1c0 2-3 2-3 4" />
      <path d="M12 17h.01" />
    </Icon>
  ),
  "comment-discussion": (props) => (
    <Icon {...props}>
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />
      <path d="M8 9h8" />
      <path d="M8 13h6" />
    </Icon>
  ),
  "megaphone": (props) => (
    <Icon {...props}>
      <path d="M3 11v2a2 2 0 0 0 2 2h2l5 4V7L7 11H5a2 2 0 0 0-2 2Z" />
      <path d="M14 10.5 21 8v8l-7-2.5" />
      <path d="M6 15l1 4" />
    </Icon>
  ),
  "star": (props) => (
    <Icon {...props}>
      <path d="M12 2l3 7 7 .6-5.3 4.6 1.7 7L12 18l-6.4 3.8 1.7-7L2 9.6 9 9l3-7Z" />
    </Icon>
  ),
  "payment": (props) => (
    <Icon {...props}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M2 10h20" />
      <path d="M6 14h2" />
    </Icon>
  ),
  "task": (props) => (
    <Icon {...props}>
      <path d="M9 6h10" />
      <path d="M9 12h10" />
      <path d="M9 18h10" />
      <path d="M5 6h.01" />
      <path d="M5 12h.01" />
      <path d="M5 18h.01" />
    </Icon>
  ),
  "jobhunt": (props) => (
    <Icon {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 7v5l3 3" />
    </Icon>
  ),
  "file": (props) => (
    <Icon {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </Icon>
  ),
  "file-text": (props) => (
    <Icon {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8" />
      <path d="M8 17h8" />
      <path d="M8 9h3" />
    </Icon>
  ),
  "diff": (props) => (
    <Icon {...props}>
      <path d="M8 4v16" />
      <path d="M16 4v16" />
      <path d="M5 8h6" />
      <path d="M5 16h6" />
      <path d="M19 12h-6" />
    </Icon>
  ),
  "git-branch": (props) => (
    <Icon {...props}>
      <path d="M6 3v12" />
      <path d="M18 9a3 3 0 0 0-3-3H9" />
      <path d="M15 6a3 3 0 1 0 0 6" />
      <path d="M6 18a3 3 0 1 0 0 3" />
      <path d="M6 15a3 3 0 0 0 3 3h6" />
    </Icon>
  ),
  "rocket": (props) => (
    <Icon {...props}>
      <path d="M5 14c-1 0-2 1-2 2v3h3c1 0 2-1 2-2" />
      <path d="M7 13 17 3c3 3 3 8 0 11l-2 2c-3 3-8 3-11 0l3-3Z" />
      <path d="M9 15l-1 5 5-1" />
      <path d="M15 6h.01" />
    </Icon>
  ),
  "alert-triangle": (props) => (
    <Icon {...props}>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </Icon>
  ),
  "eye": (props) => (
    <Icon {...props}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <path d="M12 12a3 3 0 1 0-3-3 3 3 0 0 0 3 3z" />
    </Icon>
  ),
	  "book": (props) => (
	    <Icon {...props}>
	      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
	      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
	    </Icon>
	  ),
	  "lightbulb": (props) => (
	    <Icon {...props}>
	      <path d="M9 18h6" />
	      <path d="M10 22h4" />
	      <path d="M12 2a7 7 0 0 0-4 12c.6.5 1 1.2 1 2v1h6v-1c0-.8.4-1.5 1-2a7 7 0 0 0-4-12Z" />
	    </Icon>
	  ),
	  "gauge": (props) => (
	    <Icon {...props}>
	      <path d="M20 13a8 8 0 1 1-16 0" />
	      <path d="M12 13l4-4" />
      <path d="M12 21h0" />
    </Icon>
  ),
  "pencil": (props) => (
    <Icon {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </Icon>
  ),
  "loader": (props) => (
    <Icon {...props}>
      <path d="M12 2v4" />
      <path d="M12 18v4" />
      <path d="M4.93 4.93l2.83 2.83" />
      <path d="M16.24 16.24l2.83 2.83" />
      <path d="M2 12h4" />
      <path d="M18 12h4" />
      <path d="M4.93 19.07l2.83-2.83" />
      <path d="M16.24 7.76l2.83-2.83" />
    </Icon>
  ),
  "ban": (props) => (
    <Icon {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="m4.9 4.9 14.2 14.2" />
    </Icon>
  ),
  "check-circle": (props) => (
    <Icon {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M9 12l2 2 4-4" />
    </Icon>
  ),
  "layout": (props) => (
    <Icon {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18" />
      <path d="M9 21V9" />
    </Icon>
  ),
  "server": (props) => (
    <Icon {...props}>
      <rect x="3" y="3" width="18" height="7" rx="2" />
      <rect x="3" y="14" width="18" height="7" rx="2" />
      <path d="M7 7h.01" />
      <path d="M7 18h.01" />
    </Icon>
  ),
  "cog": (props) => (
    <Icon {...props}>
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .33 1.87l.04.04a2 2 0 1 1-2.83 2.83l-.04-.04A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .31 1.7 1.7 0 0 0-.67 1.71V21a2 2 0 1 1-4 0v-.06A1.7 1.7 0 0 0 8.4 19.4a1.7 1.7 0 0 0-1.87.33l-.04.04a2 2 0 1 1-2.83-2.83l.04-.04A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.71-.67H2.83a2 2 0 1 1 0-4h.06A1.7 1.7 0 0 0 4.6 8.4a1.7 1.7 0 0 0-.31-1 1.7 1.7 0 0 0-1.71-.67H2.83a2 2 0 1 1 0-4h.06A1.7 1.7 0 0 0 4.6 4.6a1.7 1.7 0 0 0 1.87.33l.04-.04a2 2 0 1 1 2.83 2.83l-.04.04A1.7 1.7 0 0 0 8.4 4.6a1.7 1.7 0 0 0 1-.31 1.7 1.7 0 0 0 .67-1.71V2.83a2 2 0 1 1 4 0v.06A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.87-.33l.04-.04a2 2 0 1 1 2.83 2.83l-.04.04A1.7 1.7 0 0 0 19.4 9c.15.34.23.71.23 1.08V10a2 2 0 1 1 0 4h-.06A1.7 1.7 0 0 0 19.4 15Z" />
    </Icon>
  ),
  "database": (props) => (
    <Icon {...props}>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5" />
      <path d="M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" />
    </Icon>
  ),
  "shield": (props) => (
    <Icon {...props}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
    </Icon>
  ),
  "key": (props) => (
    <Icon {...props}>
      <path d="M21 2 19 4" />
      <path d="M7.5 14.5a4.5 4.5 0 1 1 3.9-6.7L22 2l-2 2-2-2" />
      <path d="M10 12l-2 2" />
      <path d="M14 10l-2 2" />
    </Icon>
  ),
  "help-circle": (props) => (
    <Icon {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.1 9a3 3 0 1 1 5.8 1c0 2-3 2-3 4" />
      <path d="M12 17h.01" />
    </Icon>
  ),
  "check": (props) => (
    <Icon {...props}>
      <path d="M20 6 9 17l-5-5" />
    </Icon>
  ),
  "repeat": (props) => (
    <Icon {...props}>
      <path d="M17 2l4 4-4 4" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <path d="M7 22l-4-4 4-4" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </Icon>
  ),
  "history": (props) => (
    <Icon {...props}>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 3v6h6" />
      <path d="M12 7v5l4 2" />
    </Icon>
  ),
  "x": (props) => (
    <Icon {...props}>
      <path d="M18 6 6 18" />
      <path d="M6 6l12 12" />
    </Icon>
  ),
};

export function TagIcon({ name, className = "h-3.5 w-3.5" }) {
  const key = String(name || "").trim().toLowerCase();
  const IconComponent = ICONS[key] || ICONS.tag;
  return <IconComponent className={className} />;
}

export default TagIcon;
