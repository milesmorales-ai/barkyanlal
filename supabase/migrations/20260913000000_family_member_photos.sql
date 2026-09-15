create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text,
  email text,
  avatar_url text,
  updated_at timestamptz not null default now()
);

alter table public.user_profiles add column if not exists avatar_url text;

alter table public.user_profiles enable row level security;

drop policy if exists "Users can view their own profile" on public.user_profiles;
create policy "Users can view their own profile"
  on public.user_profiles for select
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can manage their own profile" on public.user_profiles;
create policy "Users can manage their own profile"
  on public.user_profiles for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

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
    coalesce(auth_user.raw_user_meta_data->>'username', split_part(auth_user.email, '@', 1)) as display_name,
    coalesce(preferences.settings->'profile'->>'photo', profile.avatar_url) as photo
  from public.family_members member_row
  join auth.users auth_user on auth_user.id = member_row.user_id
  left join public.user_preferences preferences on preferences.user_id = member_row.user_id
  left join public.user_profiles profile on profile.user_id = member_row.user_id
  where member_row.family_id = (
    select own_member.family_id
    from public.family_members own_member
    where own_member.user_id = auth.uid()
  )
  order by member_row.joined_at;
$$;

revoke all on function public.get_family_members() from public;
grant execute on function public.get_family_members() to authenticated;
