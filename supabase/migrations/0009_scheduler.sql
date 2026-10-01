-- The scheduler: every minute Supabase calls the app's /api/whatsapp/remind, which sends due
-- reminders, reminders about unsaved notes, and check-ins. Uses pg_cron (the timer) and pg_net (the web
-- request), both built into Supabase.
--
-- The app's address and CRON_SECRET are kept in Supabase Vault, not in this file. After running this,
-- run once in the SQL editor (with your own values; the secret is CRON_SECRET from .env / Vercel):
--
--   select vault.create_secret('https://<your app>/api/whatsapp/remind', 'bizbuddy_remind_url');
--   select vault.create_secret('<CRON_SECRET>', 'bizbuddy_cron_secret');
--
-- When the address changes (a new ngrok address, or moving to Vercel):
--
--   select vault.update_secret((select id from vault.secrets where name = 'bizbuddy_remind_url'), 'https://<new address>/api/whatsapp/remind');
--
-- Until both secrets exist, the job runs and does nothing. To stop it: select cron.unschedule('bizbuddy-reminders');
-- To see recent runs: select * from cron.job_run_details order by start_time desc limit 10;
-- To see the app's answers: select status_code, content from net._http_response order by created desc limit 10;

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.bizbuddy_run_reminders() returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  remind_url text := (select decrypted_secret from vault.decrypted_secrets where name = 'bizbuddy_remind_url');
  cron_secret text := (select decrypted_secret from vault.decrypted_secrets where name = 'bizbuddy_cron_secret');
begin
  if remind_url is null or cron_secret is null then
    return;
  end if;
  perform net.http_get(
    url := remind_url,
    headers := jsonb_build_object('Authorization', 'Bearer ' || cron_secret, 'ngrok-skip-browser-warning', 'true'),
    timeout_milliseconds := 55000
  );
end;
$$;

-- Only the scheduler (running as the database owner) may call it.
revoke all on function public.bizbuddy_run_reminders() from public, anon, authenticated;

-- Scheduling the same name again replaces the job, so running this file twice is safe.
-- Every minute, so a reminder arrives within a minute of its time.
select cron.schedule('bizbuddy-reminders', '* * * * *', $$select public.bizbuddy_run_reminders()$$);
