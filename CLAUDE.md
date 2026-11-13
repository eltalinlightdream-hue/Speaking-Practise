@AGENTS.md

# Speaking Easy with Practise

A free web platform for daily IELTS and CEFR speaking practice. Most users are
students in Uzbekistan, mostly on phones. Mobile-first, simple, fast.

## Working rules

- Work in small steps and explain what you did in simple language. The owner is learning.
- Run `npm run lint` and `npm run build` before saying something is done.
- Never commit secrets. Keys live in `.env.local` (git-ignored); `.env.example` lists the names.
- Commit and push after each working part.
- Ask before anything that costs money. Stay on free tiers.
- Database changes go in `supabase/migrations/*.sql` (one file per change), applied in order.
- Check new screens at 375px wide and on desktop (Playwright screenshots) before calling them done.

## Tech

- Next.js 16 (App Router) + TypeScript + Tailwind CSS v4. Read `node_modules/next/dist/docs/` before using an API you are not sure about.
  - `src/proxy.ts` replaces the old `middleware.ts`.
  - `cacheComponents` is OFF on purpose (almost every page is per-user).
- UI components in shadcn/ui format in `src/components/ui` (written by hand; `components.json` is set up so `npx shadcn add` works on a normal machine).
- Supabase (Postgres, Auth, Row Level Security). Project ref: `qmkbitspxiocrxalcmvt` (region eu-central-1).
- next-intl for Uzbek (Latin, default) and English. No locale in the URL: the `NEXT_LOCALE` cookie decides, and it is saved to `profiles.language` when signed in. All UI text is in `messages/uz.json` and `messages/en.json`.
- Hosting on Vercel, deployed from GitHub.

## Design: "Jade pebble morning"

Tokens are defined once in `src/app/globals.css`. Never put raw hex codes in components.

| Token | Colour | Use |
|---|---|---|
| primary | Forest #404E3B | main buttons, top bar, headings, links, focus ring (white text on it) |
| accent | Sage #7B9669 | streak, progress bars, timer ring, success (dark text #1F2A1C on it, never small white text) |
| secondary | Slate #6C8480 | muted icons, large helper text, input borders |
| surface | Mist #BAC8B1 | selected cards, chips, counted calendar days (Forest text on it) |
| border | Pebble #E6E6E6 | borders, dividers, disabled states |
| background / card / foreground | Paper #FAFAF7 / #FFFFFF / Ink #1F2A1C | page, cards, body text |
| destructive | #B3261E | errors, delete, red recording dot only |
| warning | #B7791F | "recordings only on this device" reminders |

Inter font (covers oʻ and gʻ), body 16px. Cards 12px radius, buttons 10px. Tap targets at least 44px.
One main button per screen. Text contrast at least 4.5:1. Visible focus outline. Never show meaning
by colour alone. Light mode only in v1. The hidden `/design` page shows every component.

## Roles

- `student` (default), `admin`, `owner`.
- The owner's email is stored in `private.app_config` (key `owner_email`), NOT in git.
  The `on_auth_user_created` trigger gives that email the owner role when the account is created.
- Database functions enforce the rules (the UI only hides buttons):
  `admin_set_kept`, `owner_set_role` (owner only, cannot assign/remove owner),
  `admin_delete_user` (admins delete students; only the owner deletes admins; nobody deletes the owner),
  `delete_my_account`.
- Students can update only `full_name`, `lesson_group_id`, `language` on their own profile (column privileges).

## Exam content (decided with the owner)

- Source: `content/ielts/mock-sets.json`, parsed from the SPEAKING-1..40 PDFs by
  `scripts/content/parse_speaking_pdfs.py` (raw text kept in `content/ielts/raw/`). Typo fixes are listed in the JSON.
- **Each file is one IELTS mock set**: one Part 1 topic with its questions, one Part 2 cue card, one Part 3 topic
  with its questions. Run the mock exactly as the set is. Part 1 topics may repeat between mocks.
- Sets 20–25 have no Part 2 cue card: **do not include them as mock tests** (34 active mocks).
  Their Part 1 and Part 3 questions **are still used in General Training**.
- **General Training (IELTS)**: the student picks Part 1 only, Part 2 only, Part 3 only, or Part 1 + Part 3.
  Questions come from the pools built from all sets. Replay allowed.
- **Mock Test**: never repeat a set until all active sets are done, then a new cycle starts. No replay.
  Default timers (one config file): Part 1 ~45 s per question; Part 2 60 s prep then up to 120 s; Part 3 ~60 s per question.
- CEFR: format added later. Parts, topics, questions and timers are data, not code. Placeholder content until then.
- The owner will send more question sets later.

## Content data model (Step 2)

- `topics(exam, part, title)` is unique. Part 2 cue cards keep `cue_bullets` and `cue_explain` on the topic
  (no question rows). Part 3 topics point at their cue card with `related_topic_id`.
- Disable instead of delete (`active = false`) for topics, questions and mock sets.
- JSON format `speaking-easy-content/v2`: `public.export_content()` and `public.import_content(payload, dry_run)`
  (database functions, run as the caller so RLS applies; dry run rolls back and returns counts).
  Admin UI: `/admin/import-export`; download route: `/admin/export`.
- `supabase/seed_content.sql` is generated by `scripts/content/build_seed_sql.py` from `content/ielts/mock-sets.json`.
- Exam structure and timers: `src/config/exams.ts`. Browser voice helper: `src/lib/speech.ts`.

## Audio, recording, progress

- Questions read aloud with browser speech synthesis (English voice) and shown as text. Optional `audio_url`
  per question: play it if set, otherwise use the browser voice.
- Before each session: audio only, video with audio, or no recording, with a microphone/camera check.
- Recordings are NEVER uploaded. IndexedDB on the device (latest 10 or a size cap), download button, reminder to download.
- Practice time: time inside an active session. Save progress about every 30 seconds so time counts even if the
  phone locks or the tab closes; "completed" (for mock rotation) only when the session finishes.
- A day counts at 900 seconds (15 minutes) total, Asia/Tashkent time, every day of the week. A missed day resets the streak.

## Practice engine (Step 3)

- Plan builder: `src/app/(app)/practice/actions.ts` (Part 1: a few questions from several random topics;
  Part 2: one random cue card; Part 3: one discussion topic, linked to the cue card when there is one).
- `src/components/practice/session-runner.tsx` takes a `SessionPlan` (`src/lib/practice/types.ts`):
  `allowReplay` and `autoAdvance` switch between General Training and Mock behaviour.
- Active time counts only while the page is visible. Progress is POSTed to `/api/practice/progress`.
- `day_tashkent` = Tashkent day the session started (a session crossing midnight counts for its start day).
- iPhone: `unlockSpeech()` runs inside the Start tap; recorder falls back to MP4.

## Mock tests, streak, progress (Step 4)

- `mock_history`: one row per mock set finished TO THE END, per cycle. Written only inside
  `practice_session_progress(id, seconds, finished, completed)`: `finished` closes the session (also
  "End session" halfway), `completed` = reached the end. Only completed mocks count for the rotation.
- Rotation: `src/lib/practice/mock-rotation.ts` (pure, tested). The mock page shows the next set;
  `startMockTest` starts exactly that set after checking it is still open in this cycle.
- A mock runs exactly as stored: the set's Part 1 topic with all its active questions, its cue card,
  its Part 3 topic. Part 1 topics shared by two sets share one question list (see Geography, Maps).
- Streak: `src/lib/practice/streak.ts` is the ONE place for the rules (home + progress use `summarise`).
  Current streak ends today, or yesterday while today is not yet counted.
- Pages: `/practice/[exam]/mock`, `/progress` (streaks, today bar, month calendar, last 20 sessions),
  `/recordings` (IndexedDB list: play, download, delete), `/settings` (name + group, language, log out,
  delete account with a checkbox confirmation).
- Dates shown to users go through `src/lib/format-date.ts` (phone browsers lack Uzbek month names).
- Unit tests: `npm test` (Node's built-in runner; tests import with `.ts` extensions).

## Admin, privacy, Telegram (Step 5)

- `admin_daily_totals(from, to)`: per-student daily sums (security invoker + `is_admin()` check).
  Report logic in `src/lib/admin/report.ts` (tested); loaders in `src/lib/admin/queries.ts`.
- Pages: `/admin/reports` (week Mon–Sun Tashkent, group filter, CSV at `/admin/reports/csv`),
  `/admin/students` + `/admin/students/[id]` (shared `ProgressView`, kept mark, owner-only role switch,
  delete via `admin_delete_user`), `/owner` (admins list), `/privacy` (text in messages `privacy.sections`).
- "Kept" = an admin's mark on accounts a teacher has checked and wants to keep (meaning assumed; confirm with owner).
- Telegram login: widget on `/login` only when `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` is set; `/auth/telegram`
  checks the HMAC (`src/lib/telegram-auth.ts`, tested), creates the user with the service role key
  (`telegram-<id>@users.invalid`, profile email set to null) and signs in with a server-made magic-link token.
  Secrets `TELEGRAM_BOT_TOKEN` and `SUPABASE_SERVICE_ROLE_KEY` live only in Vercel. Setup steps: README.
- Manifest + icons (`src/app/manifest.ts`, `public/icons/`), `not-found.tsx`, `error.tsx`.

## Not in version 1

No scoring or feedback. No payments. No server-side recordings. A privacy page is required (Step 5).

## Build progress

- [x] Step 0/1: repo, Next.js app, design system, uz/en, Supabase clients, Google login, first-time setup,
  roles + RLS, role-based navigation. Telegram login waits until the site has a public domain (Step 5 deploy).
- [x] Step 2: topics/questions/mock sets tables + RLS, `question-audio` storage bucket, content loaded
  (34 IELTS mocks, 29 Part 1 topics, 34 cue cards, 40 Part 3 topics, CEFR placeholders), admin pages
  (overview, topics, add questions with voice preview + duplicate check, mock set editor, JSON import/export).
- [x] Step 3: `practice_sessions` (written only through `start_practice_session` / `practice_session_progress`,
  time capped at real elapsed time, max 3 h), General Training (`/practice/[exam]/general`), reusable
  `SessionRunner` (speech, timers, replay, cue card prep, recording, 30 s progress saves + beacon on close),
  device check, recordings in IndexedDB (latest 10 / 300 MB), finish screen with download, real minutes on home.
- [x] Step 4: `mock_history` + Mock Test flow (rotation by cycle, no replay, auto-advance, half-done mocks
  do not count), shared streak function with unit tests, My progress, My recordings, Settings.
- [x] Step 5: admin analytics, privacy, polish, Vercel launch. Migration
  `20261113000200_admin_daily_totals.sql` is applied. `/admin/reports` (+ CSV), `/admin/students`,
  `/admin/students/[id]` and `/owner` were live-tested at 375px and on desktop with temporary accounts
  (created with SQL, signed in with @supabase/ssr, driven with Playwright, deleted afterwards):
  numbers, streaks, group filter, week picker, CSV, kept mark, owner-only role switch and delete
  all behave.

## Live site

- **https://speaking-practise.vercel.app** (Vercel project `speaking-practise`, free plan).
  Every push to `main` deploys by itself. Deployment Protection is OFF, so students can open it.
- Supabase Auth -> URL Configuration: Site URL is the address above; the redirect list also covers
  Vercel preview deployments and `http://localhost:3000` for work on your own computer.
- Google sign-in is on. The Google Cloud OAuth client sends people back to
  `https://qmkbitspxiocrxalcmvt.supabase.co/auth/v1/callback`, and the Google consent screen is
  PUBLISHED (while it is in "Testing" only hand-picked accounts can sign in).
- `private.app_config.owner_email` must match the Google account the owner signs in with, or that
  account arrives as a plain student and nobody can hand out admin rights.

- [ ] Telegram login: the owner creates the bot (@BotFather), then sets `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`,
  `TELEGRAM_BOT_TOKEN` and `SUPABASE_SERVICE_ROLE_KEY` in Vercel and redeploys. Steps: README.
  The code is in place and the button stays hidden until the username variable is set.
