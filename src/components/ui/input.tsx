import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex min-h-11 w-full rounded-button border border-input bg-card px-3 py-2 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:cursor-not-allowed disabled:bg-muted aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}

function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      className={cn(
        "flex min-h-11 w-full appearance-none rounded-button border border-input bg-card bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2220%22 height=%2220%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23404e3b%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:20px] bg-[right_12px_center] bg-no-repeat px-3 py-2 pr-10 text-base text-foreground focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-ring",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-28 w-full rounded-button border border-input bg-card px-3 py-2 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:cursor-not-allowed disabled:bg-muted",
        className,
      )}
      {...props}
    />
  );
}

export { Input, NativeSelect, Textarea };
