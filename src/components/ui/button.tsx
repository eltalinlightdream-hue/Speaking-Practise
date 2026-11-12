import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-button text-base font-semibold transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:bg-border disabled:text-muted-foreground [&_svg]:size-5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // One main button per screen.
        default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
        // Mist surface with Forest text (5.1:1).
        secondary: "bg-surface text-surface-foreground hover:bg-surface/80",
        outline: "border border-input bg-card text-primary hover:bg-muted",
        ghost: "text-primary hover:bg-muted",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        link: "text-primary underline underline-offset-4 hover:no-underline",
      },
      size: {
        // 44px minimum tap target.
        default: "min-h-11 px-5 py-2",
        lg: "min-h-12 px-6 py-3 text-lg",
        sm: "min-h-11 px-3 text-sm",
        icon: "size-11",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
