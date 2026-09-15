create or replace function public.join_family(p_invite_code text)
returns table (id uuid, name text, invite_code text, role text)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_family_id uuid;
  target_family_name text;
  target_family_invite_code text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to join a family.';
  end if;

  if exists (
    select 1
    from public.family_members member_row
    where member_row.user_id = auth.uid()
  ) then
    raise exception 'You already belong to a family.';
  end if;

  select family_row.id, family_row.name, family_row.invite_code
  into target_family_id, target_family_name, target_family_invite_code
  from public.families family_row
  where family_row.invite_code = upper(trim(p_invite_code));

  if target_family_id is null then
    raise exception 'That invite code is not valid.';
  end if;

  insert into public.family_members (family_id, user_id, role)
  values (target_family_id, auth.uid(), 'member');

  update public.kitchen_items item_row
  set family_id = target_family_id, updated_at = now()
  where item_row.user_id = auth.uid() and item_row.family_id is null;

  return query
  select target_family_id, target_family_name, target_family_invite_code, 'member'::text;
end;
$$;

revoke all on function public.join_family(text) from public;
grant execute on function public.join_family(text) to authenticated;
