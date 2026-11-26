-- The 15-minute clock for practice reminders.
--
-- pg_cron runs a job every 15 minutes; pg_net sends an HTTP POST to the site,
-- which decides who gets a reminder (src/app/api/cron/reminders/route.ts).
-- The secret is NOT in git: it is only in Supabase Vault (name 'cron_secret').
-- The job sends it, and the site asks the database (cron_token_ok) if it is right.
-- Set it once:  select vault.create_secret('<random, 32+ characters>', 'cron_secret');
-- To pause reminders for everyone:   select cron.unschedule('practice-reminders');

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.unschedule(jobid) from cron.job where jobname = 'practice-reminders';

select cron.schedule(
  'practice-reminders',
  '*/15 * * * *',
  $job$
  select net.http_post(
    url := 'https://speaking-practise.vercel.app/api/cron/reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
  $job$
);
