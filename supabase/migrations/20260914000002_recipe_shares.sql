create table if not exists public.recipe_shares (
  token uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  recipe jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.recipe_shares enable row level security;

drop policy if exists "Users can create their recipe shares" on public.recipe_shares;
create policy "Users can create their recipe shares"
  on public.recipe_shares for insert
  with check ((select auth.uid()) = owner_id);

drop policy if exists "Users can view their recipe shares" on public.recipe_shares;
create policy "Users can view their recipe shares"
  on public.recipe_shares for select
  using ((select auth.uid()) = owner_id);

create or replace function public.claim_recipe_share(share_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  shared_recipe jsonb;
  current_settings jsonb;
  existing_recipes jsonb;
  recipe_id text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to save a shared recipe.' using errcode = '42501';
  end if;

  select recipe into shared_recipe
  from public.recipe_shares
  where token = share_token;

  if shared_recipe is null then
    raise exception 'This recipe share link is invalid or expired.' using errcode = 'P0002';
  end if;

  recipe_id := coalesce(shared_recipe->>'id', shared_recipe->>'name', share_token::text);
  select coalesce(settings, '{}'::jsonb) into current_settings
  from public.user_preferences
  where user_id = auth.uid();

  existing_recipes := coalesce(current_settings->'savedRecipes', '[]'::jsonb);
  if not exists (
    select 1 from jsonb_array_elements(existing_recipes) item
    where coalesce(item->>'id', item->>'name') = recipe_id
  ) then
    shared_recipe := jsonb_set(shared_recipe, '{savedAt}', to_jsonb(extract(epoch from now()) * 1000));
    existing_recipes := existing_recipes || jsonb_build_array(shared_recipe);
  end if;

  insert into public.user_preferences(user_id, settings, updated_at)
  values (auth.uid(), jsonb_set(coalesce(current_settings, '{}'::jsonb), '{savedRecipes}', existing_recipes), now())
  on conflict (user_id) do update set
    settings = jsonb_set(coalesce(public.user_preferences.settings, '{}'::jsonb), '{savedRecipes}', existing_recipes),
    updated_at = now();

  return shared_recipe;
end;
$$;

revoke all on function public.claim_recipe_share(uuid) from public;
grant execute on function public.claim_recipe_share(uuid) to authenticated;
