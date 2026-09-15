drop function if exists public.get_family_members();

create or replace function public.get_family_members()
returns table (user_id uuid, role text, username text, display_name text, photo text)
language sql
security definer
set search_path = public
as $$
  select
    member_row.user_id,
    member_row.role,
    coalesce(auth_user.raw_user_meta_data->>'username', split_part(auth_user.email, '@', 1)) as username,
    coalesce(auth_user.raw_user_meta_data->>'full_name', auth_user.raw_user_meta_data->>'name', auth_user.raw_user_meta_data->>'username', split_part(auth_user.email, '@', 1)) as display_name,
    preferences.settings->'profile'->>'photo' as photo
  from public.family_members member_row
  join auth.users auth_user on auth_user.id = member_row.user_id
  left join public.user_preferences preferences on preferences.user_id = member_row.user_id
  where member_row.family_id = (
    select own_member.family_id
    from public.family_members own_member
    where own_member.user_id = auth.uid()
  )
  order by member_row.joined_at;
$$;

revoke all on function public.get_family_members() from public;
grant execute on function public.get_family_members() to authenticated;
