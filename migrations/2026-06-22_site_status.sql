-- Oppetids-status per kunde, for «kritiske varsler»-e-posten (nettsiden nede).
-- job=uptime i api/cron-scan-competitors.js pinger website_url og sender e-post
-- KUN på overgang (oppe→nede og nede→oppe), så vi aldri spammer.
create table if not exists site_status (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  url                text,
  is_up              boolean not null default true,
  last_status_at     timestamptz not null default now(),
  last_down_email_at timestamptz
);

-- Kun service-role (cron) skriver/leser dette. Ingen policy + RLS på = ingen
-- anon/auth-tilgang; service-role-nøkkelen bypasser RLS (samme mønster som email_events).
alter table site_status enable row level security;

notify pgrst, 'reload schema';
