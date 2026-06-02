create or replace function public.delete_current_user()
returns void
language plpgsql
security definer
set search_path = public, auth
as $func$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.sikt_changes          where user_id = uid;
  delete from public.sikt_page_context     where user_id = uid;
  delete from public.sikt_actions          where user_id = uid;
  delete from public.api_credentials       where user_id = uid;
  delete from public.user_keywords         where user_id = uid;
  delete from public.keyword_opportunities where user_id = uid;
  delete from public.competitor_changes    where user_id = uid;
  delete from public.competitors           where user_id = uid;
  delete from public.sites                 where user_id = uid;
  delete from public.user_sites            where user_id = uid;
  delete from public.clients               where user_id = uid;
  delete from public.client_hosts          where user_id = uid;
  delete from public.user_profiles         where id = uid;
  delete from public.profiles              where id = uid;

  delete from auth.users where id = uid;
end;
$func$;

revoke all on function public.delete_current_user() from public, anon;
grant execute on function public.delete_current_user() to authenticated;
