import type { Metadata } from "next";
import { AlertTriangle, Flame, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, NativeSelect } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/logo";
import { DemoTimer } from "./demo-timer";

// Hidden page to check the look of the design system. Not linked anywhere.
export const metadata: Metadata = { title: "Design system", robots: { index: false } };

const SWATCHES = [
  { name: "Forest", token: "primary", hex: "#404E3B", className: "bg-primary text-primary-foreground" },
  { name: "Sage", token: "accent", hex: "#7B9669", className: "bg-accent text-accent-foreground" },
  { name: "Slate", token: "secondary", hex: "#6C8480", className: "bg-secondary text-secondary-foreground" },
  { name: "Mist", token: "surface", hex: "#BAC8B1", className: "bg-surface text-surface-foreground" },
  { name: "Pebble", token: "border", hex: "#E6E6E6", className: "bg-border text-primary" },
  { name: "Paper", token: "background", hex: "#FAFAF7", className: "bg-background text-foreground border" },
  { name: "Ink", token: "foreground", hex: "#1F2A1C", className: "bg-foreground text-background" },
  { name: "Error", token: "destructive", hex: "#B3261E", className: "bg-destructive text-destructive-foreground" },
  { name: "Warning", token: "warning", hex: "#B7791F", className: "bg-warning text-warning-foreground" },
];

export default function DesignPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-2">
        <Logo />
        <h1 className="text-3xl">Design system</h1>
        <p className="text-muted-foreground">Jade pebble morning · Inter · light mode</p>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl">Colours</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {SWATCHES.map((s) => (
            <div key={s.name} className={`flex h-24 flex-col justify-end rounded-card p-3 ${s.className}`}>
              <span className="font-semibold">{s.name}</span>
              <span className="text-sm opacity-90">
                {s.token} · {s.hex}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl">Buttons</h2>
        <div className="flex flex-wrap gap-3">
          <Button>
            <Play aria-hidden />
            Start practice
          </Button>
          <Button variant="secondary">
            <RotateCcw aria-hidden />
            Replay question
          </Button>
          <Button variant="outline">Part 1 + Part 3</Button>
          <Button variant="ghost">Skip</Button>
          <Button variant="destructive">Delete account</Button>
          <Button disabled>Disabled</Button>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Today</CardTitle>
            <CardDescription>A day counts at 15 minutes of practice.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <Flame className="size-5" aria-hidden />
              </span>
              <span className="font-semibold">9 / 15 min today</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-border">
              <div className="h-full w-3/5 rounded-full bg-accent" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge>Part 1</Badge>
              <Badge variant="accent">Streak 6 days</Badge>
              <Badge variant="outline">Mock 12</Badge>
              <Badge variant="destructive">Permission denied</Badge>
            </div>
            <p className="flex items-start gap-2 rounded-button border border-warning/50 bg-warning/10 px-3 py-2 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
              Your recordings are only on this device. Download what you want to keep.
            </p>
          </CardContent>
          <CardFooter>
            <Button className="w-full">Continue</Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Form</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="d-name">Full name</Label>
              <Input id="d-name" placeholder="e.g. Aziza Karimova" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="d-group">Lesson group</Label>
              <NativeSelect id="d-group" defaultValue="">
                <option value="" disabled>
                  Choose your group
                </option>
                <option>IELTS Morning A</option>
              </NativeSelect>
            </div>
            <p className="text-sm text-muted-foreground">Uzbek letters: oʻ gʻ Oʻ Gʻ sh ch ng</p>
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl">Practice screen</h2>
        <Card>
          <CardContent className="flex flex-col items-center gap-6 py-10 text-center">
            <div className="flex items-center gap-3">
              <Badge variant="outline">Part 2</Badge>
              <span className="flex items-center gap-2 text-sm font-semibold text-destructive">
                <span className="size-3 animate-pulse rounded-full bg-destructive" aria-hidden /> Recording
              </span>
            </div>
            <p className="max-w-xl text-2xl font-semibold text-primary sm:text-3xl">Describe a place where you want to go to relax</p>
            <DemoTimer />
            <Button size="lg">Next question</Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
