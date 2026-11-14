# Speaking Easy with Practise

A free website where students practise IELTS and CEFR speaking every day. Questions are read aloud,
students answer by voice, recordings stay on their own device, and a daily streak keeps them going.

The full plan and every decision are in [CLAUDE.md](./CLAUDE.md).

## Run it on your computer

1. Install [Node.js](https://nodejs.org) (LTS) and Git.
2. Install the packages:

   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env.local` and fill in the two Supabase values
   (Supabase dashboard → your project → **Connect** or **Project Settings → API**).
4. Start the app and open http://localhost:3000:

   ```bash
   npm run dev
   ```

Useful pages: `/` landing, `/login`, `/design` (hidden page showing the colours and components).

## Checks

```bash
npm run lint
npm test
npm run build
```

`npm test` runs the unit tests (`src/**/*.test.ts`) with Node's built-in test runner: no extra packages.

## Database

- SQL migrations are in `supabase/migrations/`, applied in order. Example lesson groups: `supabase/seed.sql`.
- Question content: `supabase/seed_content.sql` (safe to run more than once). Rebuild it after changing
  `content/ielts/mock-sets.json` with `python3 scripts/content/build_seed_sql.py`.
- Admins can also export and import all content as JSON at `/admin/import-export`.
- The owner email is set once with SQL (it is not stored in this repository):

  ```sql
  insert into private.app_config (key, value) values ('owner_email', 'you@example.com')
  on conflict (key) do update set value = excluded.value;
  ```

## Question content

`content/ielts/mock-sets.json` holds the 40 IELTS sets (34 complete). It was made from the PDFs with
`scripts/content/parse_speaking_pdfs.py`; the raw text is in `content/ielts/raw/`.

## Tools for Claude Code (on your own computer)

`.mcp.json` adds these tools for this project (no keys inside):

- **Supabase**: run migrations and check security rules
- **Vercel**: deploys and build logs
- **Context7**: up-to-date docs for Next.js, Supabase, next-intl, Tailwind
- **Playwright**: open the site in a real browser and take screenshots

After opening Claude Code in this folder, approve the project tools, then type `/mcp` and log in to Supabase and Vercel.

## Going live on Vercel (free)

1. On [vercel.com](https://vercel.com), **Add New → Project**, import this GitHub repository. Framework: Next.js (found by itself).
2. Under **Environment Variables**, add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   (same values as `.env.local`). Optional: `NEXT_PUBLIC_CONTACT_EMAIL` (shown on the privacy page).
3. Deploy. The site gets a free address like `https://speaking-easy.vercel.app`.
4. In Supabase → **Authentication → URL Configuration**: set **Site URL** to that address and add
   `https://<your-address>/auth/callback` to **Redirect URLs**. Google sign-in needs this.
5. Every push to `main` deploys again by itself.

## Telegram login (one-time setup)

Students sign in through the bot: on `/login` they tap **Continue with Telegram**, the bot opens, they press
**Start** and then **Confirm**, and the login page signs them in by itself. Telegram login stays hidden until
these steps are done.

1. In Telegram, open **@BotFather**, send `/newbot`, and follow the questions (name: *Speaking Easy*).
   BotFather gives you a **token**. Keep it secret: never paste it into chat or into the code.
2. In Vercel → Project → **Settings → Environment Variables**, add:
   - `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`: the bot's username, without `@`
   - `TELEGRAM_BOT_TOKEN`: the token from step 1
   - `SUPABASE_SERVICE_ROLE_KEY`: Supabase → **Project Settings → API Keys** → the secret (service_role) key
3. Redeploy (Vercel → Deployments → ⋯ → Redeploy). The Telegram button appears on `/login`.
4. Sign in as the owner, open **`/owner`** and press **Connect bot** in the "Telegram bot" card. This tells
   Telegram to send the bot's messages to `https://<your-address>/auth/telegram/webhook`. Press it again
   if the site address or the bot token ever changes.
5. **Required channels.** Students must join the channels listed in `src/config/telegram-channels.ts`
   before the bot lets them in. In **each** channel, add the bot as an **administrator** (Channel → Manage
   channel → Administrators → Add admin → the bot; no special rights needed). Without this Telegram does not
   let the bot see members; that channel is then skipped (not checked) and a warning appears in the Vercel logs.
6. **Owner on Telegram (optional).** So the owner's Telegram goes to the same account as the owner email,
   find your numeric Telegram id (send any message to @userinfobot) and run once in the Supabase SQL editor:
   `insert into private.app_config (key, value) values ('owner_telegram_id', '123456789') on conflict (key) do update set value = excluded.value;`

### Owner email sign-in

The owner can also sign in at **`/login/owner`** (not linked anywhere): it emails a one-time link, but only to
the `owner_email` in `private.app_config`. New sign-ups are switched off in Supabase (Authentication → Sign In /
Providers → "Allow new users to sign up" = off), so nobody can make an account by email or Google and skip the
channel check. Telegram accounts are still created by the server.

### Google sign-in (hidden)

The Google button is hidden but the code is kept. To show it again set `NEXT_PUBLIC_GOOGLE_LOGIN=on` in Vercel
and switch "Allow new users to sign up" back on (new Google users would then skip the channel check).
