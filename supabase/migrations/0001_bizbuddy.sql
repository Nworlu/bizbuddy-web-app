-- BizBuddy: one shop per account, and its customers, sales, payments, and expenses.
--
-- Run once in the Supabase SQL editor (or `supabase db push`).
--
-- Offline-first sync (shared/lib/sync.ts) relies on three things here:
--   * Record ids are made on the phone, so a record keeps its id before and after it reaches the server.
--     They are unique per shop, not globally, so the key is (business_id, id).
--   * Deletes are soft (deleted = true), so other phones learn about them when they pull.
--   * updated_at is set by the server on every write. Phones pull "everything changed since" it.
--
-- Row level security: a signed-in user can only see and change their own shop's rows.

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  owner_name text not null check (length(trim(owner_name)) > 0),
  phone text not null default '',
  type text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customers (
  business_id uuid not null references public.businesses (id) on delete cascade,
  id text not null,
  name text not null check (length(trim(name)) > 0),
  phone text not null default '',
  created_at timestamptz not null default now(),
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (business_id, id)
);

create table public.sales (
  business_id uuid not null references public.businesses (id) on delete cascade,
  id text not null,
  customer_id text not null,
  product text not null,
  total_amount bigint not null check (total_amount > 0), -- whole naira
  date date not null,
  created_at timestamptz not null default now(),
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (business_id, id)
);

create table public.payments (
  business_id uuid not null references public.businesses (id) on delete cascade,
  id text not null,
  sale_id text not null,
  customer_id text not null,
  batch_id text,
  amount bigint not null check (amount > 0), -- whole naira
  method text not null,
  date date not null,
  created_at timestamptz not null default now(),
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (business_id, id)
);

create table public.expenses (
  business_id uuid not null references public.businesses (id) on delete cascade,
  id text not null,
  category text not null,
  amount bigint not null check (amount > 0), -- whole naira
  description text not null default '',
  date date not null,
  created_at timestamptz not null default now(),
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (business_id, id)
);

-- Pulls ask for rows changed since a time, per shop.
create index customers_changed on public.customers (business_id, updated_at);
create index sales_changed on public.sales (business_id, updated_at);
create index payments_changed on public.payments (business_id, updated_at);
create index expenses_changed on public.expenses (business_id, updated_at);

-- The server's clock decides updated_at, never the phone's.
create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger businesses_touch before insert or update on public.businesses for each row execute function public.touch_updated_at();
create trigger customers_touch before insert or update on public.customers for each row execute function public.touch_updated_at();
create trigger sales_touch before insert or update on public.sales for each row execute function public.touch_updated_at();
create trigger payments_touch before insert or update on public.payments for each row execute function public.touch_updated_at();
create trigger expenses_touch before insert or update on public.expenses for each row execute function public.touch_updated_at();

-- Row level security ---------------------------------------------------------------------------

alter table public.businesses enable row level security;
alter table public.customers enable row level security;
alter table public.sales enable row level security;
alter table public.payments enable row level security;
alter table public.expenses enable row level security;

create policy "Owners manage their shop" on public.businesses
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- The signed-in user's shop id, if any. security definer so the records policies below don't
-- re-check businesses' own policy on every row.
create function public.my_business_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.businesses where owner_id = (select auth.uid())
$$;

create policy "Owners manage their customers" on public.customers
  for all to authenticated
  using (business_id = (select public.my_business_id()))
  with check (business_id = (select public.my_business_id()));

create policy "Owners manage their sales" on public.sales
  for all to authenticated
  using (business_id = (select public.my_business_id()))
  with check (business_id = (select public.my_business_id()));

create policy "Owners manage their payments" on public.payments
  for all to authenticated
  using (business_id = (select public.my_business_id()))
  with check (business_id = (select public.my_business_id()));

create policy "Owners manage their expenses" on public.expenses
  for all to authenticated
  using (business_id = (select public.my_business_id()))
  with check (business_id = (select public.my_business_id()));
