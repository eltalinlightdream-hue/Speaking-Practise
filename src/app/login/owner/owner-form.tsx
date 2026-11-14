"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendOwnerLink, type OwnerLoginState } from "./actions";

export function OwnerForm({ labels }: { labels: { email: string; submit: string; sent: string; invalid: string; error: string } }) {
  const [state, formAction, pending] = useActionState<OwnerLoginState, FormData>(sendOwnerLink, {});

  if (state.status === "sent") {
    return (
      <p role="status" className="rounded-button border border-surface bg-surface/40 px-3 py-2 text-base text-foreground">
        {labels.sent}
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {(state.status === "invalid" || state.status === "error") && (
        <p role="alert" className="rounded-button border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.status === "invalid" ? labels.invalid : labels.error}
        </p>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="owner-email">{labels.email}</Label>
        <Input id="owner-email" name="email" type="email" autoComplete="email" required inputMode="email" />
      </div>
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {labels.submit}
      </Button>
    </form>
  );
}
