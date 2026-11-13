import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold", {
  variants: {
    variant: {
      surface: "bg-surface text-surface-foreground",
      accent: "bg-accent text-accent-foreground",
      outline: "border border-border bg-card text-primary",
      warning: "bg-warning/10 text-foreground border border-warning/50",
      destructive: "bg-destructive/10 text-destructive border border-destructive/30",
    },
  },
  defaultVariants: { variant: "surface" },
});

function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
