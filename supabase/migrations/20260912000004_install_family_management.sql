create or replace function public.leave_family()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_family_id uuid;
  current_role text;
begin
  select family_id, role into current_family_id, current_role
  from public.family_members
  where user_id = auth.uid();
  if current_family_id is null then raise exception 'You are not in a family pantry.'; end if;
  if current_role = 'owner' then raise exception 'The family owner must delete the family first.'; end if;
  update public.kitchen_items
  set family_id = null, updated_at = now()
  where family_id = current_family_id and user_id = auth.uid();
  delete from public.family_members
  where family_id = current_family_id and user_id = auth.uid();
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
  if owner_family_id is null then raise exception 'Only the family owner can remove members.'; end if;
  if target_user_id = auth.uid() then raise exception 'The owner cannot remove themselves.'; end if;
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
  if owner_family_id is null then raise exception 'Only the family owner can delete the family.'; end if;
  update public.kitchen_items
  set family_id = null, updated_at = now()
  where family_id = owner_family_id;
  delete from public.families
  where id = owner_family_id and created_by = auth.uid();
end;
$$;

revoke all on function public.leave_family() from public;
grant execute on function public.leave_family() to authenticated;
revoke all on function public.remove_family_member(uuid) from public;
grant execute on function public.remove_family_member(uuid) to authenticated;
revoke all on function public.delete_family() from public;
grant execute on function public.delete_family() to authenticated;
