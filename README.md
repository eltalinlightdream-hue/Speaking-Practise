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
npm run build
```

## Database

- SQL migrations are in `supabase/migrations/`, applied in order. Example lesson groups: `supabase/seed.sql`.
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
