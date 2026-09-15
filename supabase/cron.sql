-- Run this in Supabase Dashboard > SQL Editor for project gdkayzoiwbofkaxjnxgc.
-- Replace REPLACE_WITH_REMINDER_FUNCTION_SECRET with your REMINDER_FUNCTION_SECRET.

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  perform cron.unschedule('daily-expiry-reminders');
exception when others then null;
end $$;

do $$
begin
  perform cron.unschedule('morning-expiry-reminders');
  perform cron.unschedule('afternoon-expiry-reminders');
  perform cron.unschedule('night-expiry-reminders');
  perform cron.unschedule('daily-recipe-recommendations');
exception when others then null;
end $$;

select cron.schedule('morning-expiry-reminders', '0 7 * * *', $$
  select net.http_post(
    url := 'https://gdkayzoiwbofkaxjnxgc.supabase.co/functions/v1/send-expiry-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer kitchen-test-secret-2026-xyz789'),
    body := '{"slot":"morning"}'::jsonb
  );
$$);

select cron.schedule('afternoon-expiry-reminders', '0 13 * * *', $$
  select net.http_post(
    url := 'https://gdkayzoiwbofkaxjnxgc.supabase.co/functions/v1/send-expiry-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer kitchen-test-secret-2026-xyz789'),
    body := '{"slot":"afternoon"}'::jsonb
  );
$$);

select cron.schedule('night-expiry-reminders', '0 19 * * *', $$
  select net.http_post(
    url := 'https://gdkayzoiwbofkaxjnxgc.supabase.co/functions/v1/send-expiry-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer kitchen-test-secret-2026-xyz789'),
    body := '{"slot":"night"}'::jsonb
  );
$$);

select cron.schedule('daily-recipe-recommendations', '0 8 * * *', $$
  select net.http_post(
    url := 'https://gdkayzoiwbofkaxjnxgc.supabase.co/functions/v1/send-recipe-recommendations',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer kitchen-test-secret-2026-xyz789'),
    body := '{}'::jsonb
  );
$$);

-- Verify the jobs after running the statements above:
-- select jobid, jobname, schedule, active from cron.job;
