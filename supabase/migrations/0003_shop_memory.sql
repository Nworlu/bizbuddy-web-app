-- What BizBuddy has learned about one shop, from notes the owner confirmed.
-- The website reads and writes it with the owner's login (row level security).
-- WhatsApp's server uses the secret key, which bypasses that, and must only touch the sender's shop.

create table public.shop_memory (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  memory jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.shop_memory enable row level security;

create policy "Owners manage their shop memory" on public.shop_memory
  for all to authenticated
  using (business_id = (select public.my_business_id()))
  with check (business_id = (select public.my_business_id()));
