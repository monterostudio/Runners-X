create extension if not exists pgcrypto;

create table if not exists public.content_items (
  collection text not null,
  item_id text not null,
  position integer not null default 0,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (collection, item_id)
);

create index if not exists content_items_collection_position_idx
  on public.content_items (collection, position);

create table if not exists public.registrations (
  id text primary key,
  created_at timestamptz not null default now(),
  status text not null default 'Pendiente',
  payload jsonb not null
);

create index if not exists registrations_created_at_idx
  on public.registrations (created_at desc);

create table if not exists public.demo_registrations (
  id text primary key,
  created_at timestamptz not null default now(),
  status text not null default 'Pendiente',
  payload jsonb not null
);

create index if not exists demo_registrations_created_at_idx
  on public.demo_registrations (created_at desc);

create table if not exists public.admin_users (
  id text primary key,
  username text not null unique,
  email text not null unique,
  password_hash text not null,
  role text not null default 'admin' check (role in ('owner', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_users add column if not exists updated_at timestamptz not null default now();
create unique index if not exists admin_users_single_owner_idx
  on public.admin_users ((role))
  where role = 'owner';

alter table public.content_items enable row level security;
alter table public.registrations enable row level security;
alter table public.demo_registrations enable row level security;
alter table public.admin_users enable row level security;

revoke all on public.content_items, public.registrations, public.demo_registrations, public.admin_users from anon, authenticated;
grant all on public.content_items, public.registrations, public.demo_registrations, public.admin_users to service_role;

create or replace function public.replace_content_collection(p_collection text, p_items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_collection <> 'resultados' or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Invalid collection replacement request';
  end if;

  delete from public.content_items where collection = p_collection;
  insert into public.content_items (collection, item_id, position, payload, updated_at)
  select
    p_collection,
    item->>'item_id',
    (ordinality - 1)::integer,
    item->'payload',
    now()
  from jsonb_array_elements(p_items) with ordinality as rows(item, ordinality);
end;
$$;

revoke all on function public.replace_content_collection(text, jsonb) from public, anon, authenticated;
grant execute on function public.replace_content_collection(text, jsonb) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'runnersx-media',
  'runnersx-media',
  true,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
