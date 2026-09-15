create or replace function public.get_family_members()
returns table (user_id uuid, role text, username text, display_name text)
language sql
security definer
set search_path = public
as $$
  select member_row.user_id, member_row.role, profile.username, profile.display_name
  from public.family_members member_row
  left join public.user_profiles profile on profile.user_id = member_row.user_id
  where member_row.family_id = (
    select own_member.family_id
    from public.family_members own_member
    where own_member.user_id = auth.uid()
  )
  order by member_row.joined_at;
$$;

create or replace function public.leave_family()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  member_family_id uuid;
  member_role text;
begin
  select family_id, role into member_family_id, member_role
  from public.family_members
  where user_id = auth.uid();

  if member_family_id is null then
    raise exception 'You are not in a family pantry.';
  end if;

  if member_role = 'owner' then
    raise exception 'The family owner must delete the family or transfer ownership first.';
  end if;

  update public.kitchen_items
  set family_id = null, updated_at = now()
  where family_id = member_family_id and user_id = auth.uid();

  delete from public.family_members
  where family_id = member_family_id and user_id = auth.uid();
end;
$$;

create or replace function public.remove_family_member(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_family_id uuid;
begin
  select family_id into owner_family_id
  from public.family_members
  where user_id = auth.uid() and role = 'owner';

  if owner_family_id is null then
    raise exception 'Only the family owner can remove members.';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'Use delete family or leave family for your own account.';
  end if;

  update public.kitchen_items
  set family_id = null, updated_at = now()
  where family_id = owner_family_id and user_id = target_user_id;

  delete from public.family_members
  where family_id = owner_family_id and user_id = target_user_id;
end;
$$;

create or replace function public.delete_family()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_family_id uuid;
begin
  select family_id into owner_family_id
  from public.family_members
  where user_id = auth.uid() and role = 'owner';

  if owner_family_id is null then
    raise exception 'Only the family owner can delete the family.';
  end if;

  update public.kitchen_items
  set family_id = null, updated_at = now()
  where family_id = owner_family_id;

  delete from public.families
  where id = owner_family_id and created_by = auth.uid();
end;
$$;

revoke all on function public.get_family_members() from public;
grant execute on function public.get_family_members() to authenticated;
revoke all on function public.leave_family() from public;
grant execute on function public.leave_family() to authenticated;
revoke all on function public.remove_family_member(uuid) from public;
grant execute on function public.remove_family_member(uuid) to authenticated;
revoke all on function public.delete_family() from public;
grant execute on function public.delete_family() to authenticated;
