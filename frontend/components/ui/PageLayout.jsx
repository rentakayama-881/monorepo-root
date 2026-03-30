"use client";

import { memo } from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const layoutVariants = cva("mx-auto w-full px-4 sm:px-6 lg:px-8", {
  variants: {
    maxWidth: {
      default: "max-w-6xl",
      wide: "max-w-7xl",
      narrow: "max-w-3xl",
      form: "max-w-md",
    },
    padding: {
      default: "py-8 sm:py-12",
      compact: "py-6 sm:py-8",
      none: "",
    },
  },
  defaultVariants: {
    maxWidth: "default",
    padding: "default",
  },
});

const PageLayout = memo(function PageLayout({
  maxWidth = "default",
  padding = "default",
  as: Component = "main",
  className = "",
  children,
  ...rest
}) {
  return (
    <Component className={cn(layoutVariants({ maxWidth, padding }), className)} {...rest}>
      {children}
    </Component>
  );
});

export default PageLayout;
export { layoutVariants };
