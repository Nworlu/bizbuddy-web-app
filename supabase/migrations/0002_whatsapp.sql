-- WhatsApp: find a shop from the sender's number, remember drafts waiting for Save, and ignore repeats.
--
-- Only the server (Supabase secret key, which bypasses row level security) uses these. They have row
-- level security on and no policies, so the app's publishable key can't read or write them.

-- The shop whose account logs in with this address (shared/lib/phone.ts turns the WhatsApp sender's
-- number into it). Matching on the account's login, not on a phone typed into the app, means nobody
-- can route someone else's WhatsApp messages into their shop.
create function public.business_for_login(login_email text) returns uuid
language sql stable security definer set search_path = '' as $$
  select b.id
  from public.businesses b
  join auth.users u on u.id = b.owner_id
  where lower(u.email) = lower(login_email)
$$;

revoke all on function public.business_for_login(text) from public, anon, authenticated;
grant execute on function public.business_for_login(text) to service_role;

-- What BizBuddy understood from a sender's last note, waiting for them to tap Save or Cancel.
-- One per phone: a new note replaces the old drafts.
create table public.whatsapp_pending (
  phone text primary key,
  business_id uuid not null references public.businesses (id) on delete cascade,
  drafts jsonb not null,
  created_at timestamptz not null default now()
);

-- Message ids already handled. WhatsApp can deliver the same message more than once.
create table public.whatsapp_messages (
  id text primary key,
  received_at timestamptz not null default now()
);

alter table public.whatsapp_pending enable row level security;
alter table public.whatsapp_messages enable row level security;

-- Who an owner's chat is about. A customer's own chat doesn't need a row: the sender is that person.
create table public.whatsapp_focus (
  phone text primary key,
  business_id uuid not null references public.businesses (id) on delete cascade,
  customer_id text not null,
  customer_name text not null,
  updated_at timestamptz not null default now()
);

alter table public.whatsapp_focus enable row level security;

-- Customers saved with this WhatsApp number, in any shop. The sender is 234XXXXXXXXXX.
-- Phones in the books may be "0803 123 4567", "+234…" or "234…".
create function public.customers_for_whatsapp(sender text)
returns table (business_id uuid, customer_id text, customer_name text, shop_name text, owner_name text)
language sql stable security definer set search_path = '' as $$
  with sender_phone as (
    select case
      when length(d) = 13 and left(d, 3) = '234' then d
      when length(d) = 11 and left(d, 1) = '0' then '234' || substr(d, 2)
      when length(d) = 10 then '234' || d
      else null
    end as phone
    from (select regexp_replace(coalesce(sender, ''), '\D', '', 'g') as d) raw
  )
  select c.business_id, c.id, c.name, b.name, b.owner_name
  from public.customers c
  join public.businesses b on b.id = c.business_id
  cross join sender_phone s
  where c.deleted = false
    and s.phone is not null
    and case
      when length(regexp_replace(c.phone, '\D', '', 'g')) = 13 and left(regexp_replace(c.phone, '\D', '', 'g'), 3) = '234' then regexp_replace(c.phone, '\D', '', 'g')
      when length(regexp_replace(c.phone, '\D', '', 'g')) = 11 and left(regexp_replace(c.phone, '\D', '', 'g'), 1) = '0' then '234' || substr(regexp_replace(c.phone, '\D', '', 'g'), 2)
      when length(regexp_replace(c.phone, '\D', '', 'g')) = 10 then '234' || regexp_replace(c.phone, '\D', '', 'g')
      else null
    end = s.phone
$$;

revoke all on function public.customers_for_whatsapp(text) from public, anon, authenticated;
grant execute on function public.customers_for_whatsapp(text) to service_role;
