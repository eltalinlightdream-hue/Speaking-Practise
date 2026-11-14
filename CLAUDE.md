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
- Telegram login (through the bot; Telegram's login widget was dropped because its confirmation messages
  often never arrive): `/login` → POST `/auth/telegram/start` makes a row in `telegram_login_requests`
  (code for `t.me/<bot>?start=<code>`, hash of a secret kept in the httpOnly `tg_login` cookie, 10 min) →
  the bot webhook `/auth/telegram/webhook` (secret header = HMAC of the bot token) answers `/start <code>`
  with a Confirm button and marks the row confirmed with the Telegram user → the page polls
  `/auth/telegram/poll`, which deletes the confirmed row and signs in (`signInTelegramUser` in
  `src/lib/telegram-bot.ts`: `telegram-<id>@users.invalid`, profile email null, server-made magic-link token).
  Helpers + tests: `src/lib/telegram-auth.ts`. Webhook is set from `/owner` ("Connect bot").
  Secrets `TELEGRAM_BOT_TOKEN` and `SUPABASE_SERVICE_ROLE_KEY` live only in Vercel. Setup steps: README.
- Required channels (Telegram-only login): students must join the channels in `src/config/telegram-channels.ts`.
  The webhook checks on Confirm with `getChatMember` (`src/lib/telegram-channels.ts`, tested); missing → the bot
  shows Join buttons + "Check again" (same Confirm data). Admins/owner skip it. Hojiakbar's channel is commented
  out until the bot is admin there (owner's request); owner_telegram_id is set in the database. A channel the bot cannot check
  (bot not admin there) is skipped and logged, never blocks. Check happens only at login (owner's choice).
- `public.telegram_login_info(tg_id)` and `public.is_owner_email(email)` (service role only, migration
  `20261114000400`): the owner's Telegram id (`private.app_config` key `owner_telegram_id`) signs in to the
  owner's email account. Owner-only email magic link at `/login/owner` (unlinked). Supabase `disable_signup` is
  ON (set via the Management API) so email/Google cannot create accounts that skip the channel check.
- Google button hidden unless `NEXT_PUBLIC_GOOGLE_LOGIN=on` (code kept). `/login/*` share `src/app/login/layout.tsx`.
- Manifest + icons (`src/app/manifest.ts`, `public/icons/`), `not-found.tsx`, `error.tsx`.

## Added after Step 5

- General Training question count: 3, 5, 8, 10 or ∞ (count `0` = unlimited: the whole pool, the student taps Finish;
  in Part 1 + Part 3, Part 1 stops at 12 so Part 3 is reached). `SessionPlan.unlimited` hides the total.
- Weekly PDF report: `/progress/report?week=YYYY-MM-DD[&user=id]` (route handler, pdf-lib + Inter TTF in
  `src/assets/fonts`, shipped via `outputFileTracingIncludes`; code in `src/lib/report/`). Students pick a week
  and download on `/progress`; admins on `/admin/students/[id]` and per row on `/admin/reports`.
- Footer on every page (`src/components/site-footer.tsx`); names, links and start date live in `src/config/site.ts`.
- Page changes: `(app)/loading.tsx` shows a skeleton instantly; `(app)/template.tsx` wraps pages in a React
  `<ViewTransition>` (fade + small rise, CSS in `globals.css`, off for reduced motion). Header and tab bar stay still.

- Footer on phones: the full footer only on `/home` (and login, privacy, landing); other signed-in pages show the
  one-line `CompactFooter` below `md` (`src/components/footer-by-page.tsx`). Computers always get the full footer.
- Small phones (checked at 320px and 375px): the session top bar shows a mic icon instead of the word "recording" so
  the end button always fits; login buttons may wrap; practice steps scroll to the top; a hint explains a grey Start.

## Groups, admin edit, offline, speed (added 2026-11-14)

- Lesson groups: 3 teachers (Abduraimov Erkinjon, Hojiakbar, Murodjon) x even/odd days x 08:00, 10:00, 13:00, 15:00,
  17:00 = 30 groups (migration `20261114000200_teacher_groups_admin_edit.sql`, applied). Columns `teacher`, `day_pattern`,
  `start_time`, `sort_order`; the old example groups are disabled. Labels are translated with `src/lib/groups.ts`;
  dropdowns use `GroupSelect` (one section per teacher), admin lists use `GroupFilter`.
- Admins edit a student's name and group on `/admin/students/[id]` via `admin_update_profile` (admins edit students,
  only the owner edits admins).
- Offline: `public/sw.js` (service worker, production only, registered by `src/components/offline/connectivity.tsx`)
  keeps static files and visited/main pages; `/offline.html` when a page was never saved; saved pages are deleted on
  sign-out. `experimental.useOffline` retries page changes and form saves when the internet returns; an offline banner shows.
- Offline practice: the General Training page saves the question pools (`/api/practice/content`) in localStorage;
  the mock page brings its set's steps along. Without internet (or if starting takes over 12 s) the session runs with a
  phone-made id (`src/lib/practice/offline-start.ts`). Time goes into a localStorage queue (`offline-queue.ts`, per user),
  sent to `/api/practice/sync` -> `start_offline_session` (migration `20261114000300_offline_sessions.sql`, applied;
  sessions up to 7 days old, real start time) + `practice_session_progress`. Failed online saves use the same queue.
- Speed: `getClaims()` instead of `getUser()` in the proxy and `getCurrentProfile` (token checked locally, ES256 keys),
  `vercel.json` region `fra1` (next to Supabase eu-central-1), `staleTimes.dynamic = 30`.

## Not in version 1

No scoring or feedback. No payments. No server-side recordings. A privacy page is required (Step 5).

## Build progress

- [x] Step 0/1: repo, Next.js app, design system, uz/en, Supabase clients, Google login (now hidden), first-time setup,
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
- [x] Step 5: admin analytics, privacy, Telegram login, polish, Vercel launch.
  Live on Vercel at https://speaking-practise.vercel.app (deployed from `main`). All migrations up to
  `20261114000400_telegram_channels_owner_login.sql` are applied. Admin pages were live-tested at 375px and on
  desktop with temporary accounts (created with SQL, signed in with @supabase/ssr, driven with Playwright, deleted
  afterwards). Sign-in confirmed working by the owner (2026-11-14): students use Telegram only (bot
  @speaking_easy_with_bot, webhook connected, channel check on Confirm); the owner signs in with Telegram or at
  `/login/owner` by email. Google is hidden and new sign-ups are off in Supabase. Old student accounts were deleted.

## Still to do

- Turn Hojiakbar's channel back on in `src/config/telegram-channels.ts` once the bot is an admin there.
- CEFR format and content (placeholders until the owner sends it).
- More IELTS question sets when the owner sends them.
