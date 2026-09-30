-- Keep the owner's note with the drafts waiting for Save, so shop memory can learn from it
-- when they tap Save on WhatsApp (features/whatsapp/lib/conversation.ts).
alter table public.whatsapp_pending add column if not exists note text not null default '';
