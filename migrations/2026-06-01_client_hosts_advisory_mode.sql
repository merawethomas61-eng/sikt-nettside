-- Tillat connection_mode 'advisory' for Wix (rådgiver-modus, ingen push).
alter table public.client_hosts drop constraint if exists client_hosts_connection_mode_check;
alter table public.client_hosts add constraint client_hosts_connection_mode_check
  check (connection_mode in ('light', 'full', 'skipped', 'advisory'));
