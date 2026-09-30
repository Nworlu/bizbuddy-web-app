// One incoming WhatsApp message, start to finish: who sent it, what it says, and the reply.
//
// The shop owner types a note; the AI reads it (features/tell/server/interpret.ts); BizBuddy replies
// with what it understood, worked out by the app, and Save / Cancel buttons. Save records it by the
// same rules as the app (features/tell/lib/drafts.ts). Questions are answered from the books.
//
// Everything outside (WhatsApp, Supabase, the AI) comes in through Deps, so tests can run the whole
// conversation without any of them.

import { answerTopic } from "@/features/ask/lib/answer";
import { applyDraft, checkDraft, describeDraft } from "@/features/tell/lib/drafts";
import { toDraft, type Draft, type Interpretation } from "@/features/tell/lib/intents";
import { learn, memoryForPrompt, type ShopMemory } from "@/features/tell/lib/memory";
import { normalizePhone } from "@/shared/lib/phone";
import type { BizData } from "@/shared/lib/types";
import { chatHeading, chatPrompt, nextAbout, personalize, type ChatWith } from "./person";
import { answerToText, CANCEL, decision, HELP, lagosToday, notLinked, SAVE } from "./text";

export type Incoming = { id: string; from: string; profileName?: string; text?: string; buttonId?: string; other?: string };
export type Button = { id: string; title: string };
export type Pending = { businessId: string; note: string; drafts: Draft[] };
export type TellInput = { message: string; today: string; weekday: string; customers: string[]; chatWith?: string | null; memory?: string | null };

export interface Deps {
  markSeen(messageId: string): Promise<boolean>;
  whoIsChatting(phone: string, profileName: string | null): Promise<ChatWith>;
  loadBooks(businessId: string): Promise<BizData>;
  saveChanges(businessId: string, before: BizData, after: BizData): Promise<void>;
  getPending(phone: string): Promise<Pending | null>;
  setPending(phone: string, pending: Pending): Promise<void>;
  clearPending(phone: string): Promise<void>;
  setAbout(phone: string, about: { businessId: string; customerId: string; name: string } | null): Promise<void>;
  getMemory(businessId: string): Promise<ShopMemory>;
  saveMemory(businessId: string, memory: ShopMemory): Promise<void>;
  /** Throws BusyError when the AI is overloaded, RefusedError when it declines, anything else on failure. */
  interpret(input: TellInput): Promise<Interpretation>;
  isBusy(error: unknown): boolean;
  send(to: string, body: string, buttons?: Button[]): Promise<void>;
  appUrl?: string;
  now?: () => Date;
}

const BUTTONS: Button[] = [
  { id: SAVE, title: "Save" },
  { id: CANCEL, title: "Cancel" },
];

export async function handleMessage(message: Incoming, deps: Deps): Promise<void> {
  // WhatsApp can deliver the same message twice: handle each once.
  if (!(await deps.markSeen(message.id))) return;

  const to = message.from;
  const phone = normalizePhone(message.from);
  if (!phone) return deps.send(to, "BizBuddy works with Nigerian phone numbers for now.");

  const chat = await deps.whoIsChatting(phone, message.profileName ?? null);
  if (chat.kind !== "owner") return deps.send(to, notLinked(deps.appUrl));

  const { today, weekday } = lagosToday(deps.now?.() ?? new Date());
  const choice = decision({ text: message.text, buttonId: message.buttonId });
  if (choice) return confirm(choice, phone, to, chat, today, deps);

  if (!message.text) return deps.send(to, `I can only read text messages for now.\n\n${HELP}`);

  const books = await deps.loadBooks(chat.businessId);
  const memory = await deps.getMemory(chat.businessId);

  let actions;
  try {
    const result = await deps.interpret({
      message: message.text.slice(0, 600),
      today,
      weekday,
      customers: books.customers.map((c) => c.name),
      chatWith: chatPrompt(chat),
      memory: memoryForPrompt(memory),
    });
    actions = personalize(result.actions, chat);
  } catch (error) {
    return deps.send(to, deps.isBusy(error) ? "I'm busy right now. Send that again in a minute." : "Sorry, I couldn't read that just now. Try again, or record it in the app.");
  }

  // The owner's next "he paid 20k" is about whoever this note named.
  const about = nextAbout(actions, books.customers);
  if (about) await deps.setAbout(phone, { businessId: chat.businessId, customerId: about.id, name: about.name });

  const answers: string[] = [];
  const drafts: Draft[] = [];
  for (const action of actions) {
    if (action.kind === "question") answers.push(answerToText(answerTopic(action.topic, action.customer, action.period, books, deps.now?.())));
    else if (action.kind === "unclear") answers.push(action.reply);
    else drafts.push(toDraft(action, today));
  }

  if (answers.length > 0) await deps.send(to, answers.join("\n\n"));
  if (drafts.length === 0) {
    if (answers.length === 0) await deps.send(to, [chatHeading(chat), HELP].filter(Boolean).join("\n\n"));
    return;
  }

  // What will be recorded, with the app's own sums. Incomplete drafts say what's missing.
  const problems = drafts.map((draft) => checkDraft(draft, books, today));
  const ready = drafts.filter((_, i) => problems[i] === null);
  const numbered = drafts.length > 1;
  const blocks = drafts.map((draft, i) => {
    const text = describeDraft(draft, books);
    const lead = numbered ? `${i + 1}. ` : "";
    return problems[i] ? `${lead}${text}\n⚠️ ${problems[i]}` : `${lead}${text}`;
  });

  if (ready.length === 0) {
    await deps.clearPending(phone);
    return deps.send(to, `${blocks.join("\n\n")}\n\nSend it again with what's missing, and I'll record it.`);
  }

  await deps.setPending(phone, { businessId: chat.businessId, note: message.text, drafts: ready });
  const ask = ready.length === drafts.length ? (ready.length > 1 ? "Save these?" : "Save this?") : `Save the ${ready.length === 1 ? "complete one" : `${ready.length} complete ones`}? The rest need what's missing.`;
  return deps.send(to, `${blocks.join("\n\n")}\n\n${ask}`, BUTTONS);
}

async function confirm(choice: typeof SAVE | typeof CANCEL, phone: string, to: string, chat: Extract<ChatWith, { kind: "owner" }>, today: string, deps: Deps) {
  const pending = await deps.getPending(phone);
  if (!pending || pending.businessId !== chat.businessId) {
    if (pending) await deps.clearPending(phone);
    return deps.send(to, choice === SAVE ? `Nothing is waiting to be saved.\n\n${HELP}` : "Okay.");
  }
  if (choice === CANCEL) {
    await deps.clearPending(phone);
    return deps.send(to, "Okay, I didn't save that.");
  }

  // Check again against the books as they are now: another phone may have changed them since.
  const before = await deps.loadBooks(chat.businessId);
  let books = before;
  let memory = await deps.getMemory(chat.businessId);
  const startMemory = memory;
  const done: string[] = [];
  const skipped: string[] = [];
  for (const draft of pending.drafts) {
    const problem = checkDraft(draft, books, today);
    if (problem) {
      skipped.push(problem);
      continue;
    }
    const saved = applyDraft(books, draft);
    books = saved.data;
    done.push(saved.text);
    memory = learn(memory, pending.note, draft);
  }
  if (done.length > 0) await deps.saveChanges(chat.businessId, before, books);
  if (memory !== startMemory) await deps.saveMemory(chat.businessId, memory).catch(() => undefined); // A missed lesson never undoes a save.
  await deps.clearPending(phone);

  const lines = done.map((text) => `✓ ${text}`);
  if (skipped.length > 0) lines.push(...skipped.map((problem) => `Not saved: ${problem}`));
  if (done.length > 0) lines.push("It's in your books; the app shows it next time it syncs.");
  return deps.send(to, lines.join("\n"));
}
