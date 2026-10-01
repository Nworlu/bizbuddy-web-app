-- Match WhatsApp senders and customer phones as E.164 digits (country code + national number).
-- Nigerian local formats (0803…, 803…, 234803…) still work; other countries use digits stored from the app.

create or replace function public.phone_to_e164(raw text) returns text
language plpgsql immutable set search_path = '' as $$
declare
  d text := regexp_replace(coalesce(raw, ''), '\D', '', 'g');
  national text;
begin
  if d = '' then
    return null;
  end if;

  -- Nigeria (same rules as shared/lib/phone.ts)
  if length(d) = 13 and left(d, 3) = '234' then
    national := substr(d, 4);
    if national ~ '^[789][0-9]{9}$' then return d; end if;
  end if;
  if length(d) = 11 and left(d, 1) = '0' then
    national := substr(d, 2);
    if national ~ '^[789][0-9]{9}$' then return '234' || national; end if;
  end if;
  if length(d) = 10 and left(d, 1) in ('7', '8', '9') then
    if d ~ '^[789][0-9]{9}$' then return '234' || d; end if;
  end if;

  -- Other countries: already stored or sent as full E.164 digits (8–15).
  if length(d) >= 8 and length(d) <= 15 then
    return d;
  end if;

  return null;
end;
$$;

create or replace function public.customers_for_whatsapp(sender text)
returns table (business_id uuid, customer_id text, customer_name text, shop_name text, owner_name text)
language sql stable security definer set search_path = '' as $$
  with sender_phone as (
    select public.phone_to_e164(sender) as phone
  )
  select c.business_id, c.id, c.name, b.name, b.owner_name
  from public.customers c
  join public.businesses b on b.id = c.business_id
  cross join sender_phone s
  where c.deleted = false
    and s.phone is not null
    and public.phone_to_e164(c.phone) = s.phone
$$;
