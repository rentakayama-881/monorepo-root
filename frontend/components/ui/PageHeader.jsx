"use client";

import { memo } from "react";
import PropTypes from "prop-types";
import { cn } from "@/lib/utils";
import Breadcrumb from "@/components/ui/Breadcrumb";

/**
 * PageHeader — Consistent page header with title, description, breadcrumb, and actions slot.
 *
 * @example
 * <PageHeader
 *   title="Account Settings"
 *   description="Kelola pengaturan akun dan preferensi Anda"
 *   breadcrumbs={[{ label: "Home", href: "/" }, { label: "Account" }]}
 *   actions={<Button>Save</Button>}
 * />
 */
function PageHeader({ title, description, breadcrumbs = [], actions, className, ...props }) {
  return (
    <header className={cn("mb-8", className)} {...props}>
      {breadcrumbs.length > 0 && <Breadcrumb items={breadcrumbs} className="mb-4" />}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
          {description && (
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>
          )}
        </div>

        {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
      </div>
    </header>
  );
}

PageHeader.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.string,
  breadcrumbs: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      href: PropTypes.string,
    })
  ),
  actions: PropTypes.node,
  className: PropTypes.string,
};

export default memo(PageHeader);
