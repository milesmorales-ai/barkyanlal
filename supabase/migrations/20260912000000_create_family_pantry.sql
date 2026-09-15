create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  invite_code text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.family_members (
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (family_id, user_id),
  unique (user_id)
);

alter table public.kitchen_items add column if not exists family_id uuid references public.families(id) on delete cascade;

create index if not exists family_members_user_id_idx on public.family_members(user_id);
create index if not exists kitchen_items_family_id_idx on public.kitchen_items(family_id);

alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.kitchen_items enable row level security;

create or replace function public.is_family_member(target_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.family_members
    where family_id = target_family_id
      and user_id = (select auth.uid())
  );
$$;

drop policy if exists "Members can view their families" on public.families;
create policy "Members can view their families"
  on public.families for select
  using (public.is_family_member(id));

drop policy if exists "Owners can update their families" on public.families;
create policy "Owners can update their families"
  on public.families for update
  using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()));

drop policy if exists "Users can view their family memberships" on public.family_members;
create policy "Users can view their family memberships"
  on public.family_members for select
  using (user_id = (select auth.uid()));

drop policy if exists "Owners can manage family memberships" on public.family_members;
create policy "Owners can manage family memberships"
  on public.family_members for delete
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.families
      where id = family_id and created_by = (select auth.uid())
    )
  );

drop policy if exists "Users can view their own kitchen items" on public.kitchen_items;
drop policy if exists "Users can insert their own kitchen items" on public.kitchen_items;
drop policy if exists "Users can update their own kitchen items" on public.kitchen_items;
drop policy if exists "Users can delete their own kitchen items" on public.kitchen_items;

create policy "Members can view kitchen items"
  on public.kitchen_items for select
  using (
    user_id = (select auth.uid())
    or public.is_family_member(family_id)
  );

create policy "Members can insert kitchen items"
  on public.kitchen_items for insert
  with check (
    user_id = (select auth.uid())
    and (family_id is null or public.is_family_member(family_id))
  );

create policy "Members can update kitchen items"
  on public.kitchen_items for update
  using (
    user_id = (select auth.uid())
    or public.is_family_member(family_id)
  )
  with check (
    (family_id is null and user_id = (select auth.uid()))
    or public.is_family_member(family_id)
  );

create policy "Members can delete kitchen items"
  on public.kitchen_items for delete
  using (
    user_id = (select auth.uid())
    or public.is_family_member(family_id)
  );

create or replace function public.create_family(p_name text)
returns table (id uuid, name text, invite_code text, role text)
language plpgsql
security definer
set search_path = public
as $$
declare
  new_family_id uuid;
  new_invite_code text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to create a family.';
  end if;

  if exists (select 1 from public.family_members where user_id = auth.uid()) then
    raise exception 'You already belong to a family.';
  end if;

  new_invite_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.families (name, invite_code, created_by)
  values (trim(p_name), new_invite_code, auth.uid())
  returning families.id into new_family_id;

  insert into public.family_members (family_id, user_id, role)
  values (new_family_id, auth.uid(), 'owner');

  update public.kitchen_items
  set family_id = new_family_id, updated_at = now()
  where user_id = auth.uid() and family_id is null;

  return query
  select new_family_id, trim(p_name), new_invite_code, 'owner'::text;
end;
$$;

create or replace function public.join_family(p_invite_code text)
returns table (id uuid, name text, invite_code text, role text)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_family public.families%rowtype;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to join a family.';
  end if;

  if exists (select 1 from public.family_members where user_id = auth.uid()) then
    raise exception 'You already belong to a family.';
  end if;

  select * into target_family
  from public.families
  where invite_code = upper(trim(p_invite_code));

  if target_family.id is null then
    raise exception 'That invite code is not valid.';
  end if;

  insert into public.family_members (family_id, user_id, role)
  values (target_family.id, auth.uid(), 'member');

  update public.kitchen_items
  set family_id = target_family.id, updated_at = now()
  where user_id = auth.uid() and family_id is null;

  return query
  select target_family.id, target_family.name, target_family.invite_code, 'member'::text;
end;
$$;

create or replace function public.regenerate_family_invite()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_invite_code text;
begin
  new_invite_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  update public.families
  set invite_code = new_invite_code
  where created_by = auth.uid();

  if not found then
    raise exception 'Only a family owner can regenerate the invite code.';
  end if;

  return new_invite_code;
end;
$$;

revoke all on function public.create_family(text) from public;
grant execute on function public.create_family(text) to authenticated;
revoke all on function public.join_family(text) from public;
grant execute on function public.join_family(text) to authenticated;
revoke all on function public.regenerate_family_invite() from public;
grant execute on function public.regenerate_family_invite() to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'kitchen_items'
  ) then
    alter publication supabase_realtime add table public.kitchen_items;
  end if;
exception when undefined_object then
  null;
end $$;
