-- The last few lines of a WhatsApp chat, so "what of today?" stays on the question before it.
-- Only the server (secret key) reads and writes this. Row level security is on and there is no policy.

create table public.whatsapp_thread (
  phone text primary key,
  turns jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.whatsapp_thread enable row level security;
