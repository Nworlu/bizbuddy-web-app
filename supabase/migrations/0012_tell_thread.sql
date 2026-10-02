-- The Tell BizBuddy chat for one shop, so the next note can follow how the owner writes,
-- and so they can clear it later. The website reads and writes it with the owner's login.
-- Confirmed notes stay in shop_memory. Clearing this chat does not remove those.

create table public.tell_threads (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  turns jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.tell_threads enable row level security;

create policy "Owners manage their tell chat" on public.tell_threads
  for all to authenticated
  using (business_id = (select public.my_business_id()))
  with check (business_id = (select public.my_business_id()));
