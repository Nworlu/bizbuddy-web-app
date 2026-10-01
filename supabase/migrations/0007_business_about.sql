-- What the business is about, in the owner's words ("We sell fairly used laptops and phones in Ikeja").
-- Sent to the AI with each note so it knows the shop. Optional.

alter table public.businesses add column if not exists about text not null default '' check (char_length(about) <= 300);
