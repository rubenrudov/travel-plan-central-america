-- Run only AFTER the functions and their secrets are configured.
-- In Supabase enable pg_cron and pg_net, then add these two Vault secrets:
-- reservation_jobs_url = https://zpvmiwnqywachfrpzvyl.supabase.co/functions/v1/reservation-jobs
-- reservation_job_secret = the SAME random value as RESERVATION_JOB_SECRET in Edge Function secrets.
-- Enter secret VALUES only through the secure dashboard, not this committed script.
select cron.schedule(
 'adventure-reservation-sync',
 '*/30 * * * *',
 $job$
 select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name='reservation_jobs_url'),
  headers := jsonb_build_object('Content-Type','application/json','x-job-secret',(select decrypted_secret from vault.decrypted_secrets where name='reservation_job_secret')),
  body := '{}'::jsonb,
  timeout_milliseconds := 55000
 );
 $job$
);
