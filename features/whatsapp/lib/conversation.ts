// One incoming WhatsApp message, start to finish: who sent it, what it says, and the reply.
//
// The shop owner types a note; the AI reads it (features/tell/server/interpret.ts); BizBuddy replies
// with what it understood, worked out by the app, and Save / Cancel buttons. Save records it by the
// same rules as the app (features/tell/lib/drafts.ts). Questions are answered from the books.
//
// Everything outside (WhatsApp, Supabase, the AI) comes in through Deps, so tests can run the whole
// conversation without any of them.

import { answerTopic, owingDetail } from "@/features/ask/lib/answer";
import { applyDraft, checkDraft, describeDraft, MISSING_QUESTIONS } from "@/features/tell/lib/drafts";
import { eitherDrafts, toDraft, type Draft, type EitherAction, type ExpenseDraft, type Interpretation, type ReminderAction, type SaleDraft } from "@/features/tell/lib/intents";
import { formatNaira } from "@/shared/lib/format";
import { added, AUTO_SAVE_AFTER, needsAsking, offerDue, reviewed, undo, withAutoSave, type Undo } from "@/features/tell/lib/autosave";
import { shopProfile } from "@/features/tell/lib/profile";
import { aboutSocials, describeLearned, learnedAnything, mergeCatalog, onlyLink, SOCIAL_LABELS, socialFromUrl, type Learned } from "@/features/tell/lib/knowledge";
import { learn, memoryForPrompt, type ShopMemory, type UnsavedReminder } from "@/features/tell/lib/memory";
import { dueFrom, formatWhen, lagosClock, reminderList, snoozed, type Reminder } from "@/features/reminders/lib/when";
import { normalizePhone } from "@/shared/lib/phone";
import type { BizData } from "@/shared/lib/types";
import { chatHeading, chatPrompt, nextAbout, personalize, type ChatWith } from "./person";
import { answerToText, AUTO_OFF, AUTO_ON, CANCEL, command, decision, HELP, lagosToday, notLinked, reminderButtonId, reminderCommand, SAVE, SAVE_EXPENSE, SAVE_SALE, UNDO, type Choice, type ReminderCommand } from "./text";
import { continueTalk, remember, threadPrompt, WHAT_YOU_CAN_ASK, type Turn } from "./thread";

export type Incoming = { id: string; from: string; profileName?: string; text?: string; buttonId?: string; image?: { id: string; caption?: string }; audio?: { id: string }; other?: string };
export type Button = { id: string; title: string };
/** Money a person sent that could be a customer paying or the team spending: the owner picks one. */
export type Either = { person: string; sale: SaleDraft; expense: ExpenseDraft };
/** What the last auto-save added, so Undo can take it back out. */
export type LastAutoSave = Undo & { text: string };
/**
 * Waiting on the owner. drafts: shown with Save / Cancel. either: shown with Save as sale / expense.
 * undo: what the last auto-save added. asking: a question about the note (e.g. "Who bought it?"),
 * whose short answer is added to the note and read again. remindedAt: when the one reminder went out.
 */
export type Pending = { businessId: string; note: string; drafts: Draft[]; either?: Either; undo?: LastAutoSave; asking?: string; remindedAt?: string; learn?: Learned };
export type TellInput = { message: string; today: string; weekday: string; time?: string; customers: string[]; chatWith?: string | null; memory?: string | null; thread?: string | null };

/** The owner's reminders (features/reminders/server/store.ts), each call limited to their shop. */
export interface ReminderDeps {
  add(businessId: string, phone: string, text: string, due: Date): Promise<Reminder>;
  upcoming(businessId: string): Promise<Reminder[]>;
  cancel(businessId: string, id: string): Promise<string | null>;
  settle(businessId: string, id: string, next: { done: true } | { due: Date }): Promise<string | null>;
}

export interface Deps {
  markSeen(messageId: string): Promise<boolean>;
  /** The chat, and the owner's books when it found them (so they aren't loaded twice). */
  whoIsChatting(phone: string, profileName: string | null): Promise<{ chat: ChatWith; books: BizData | null }>;
  /** Shows "typing…" in the sender's chat and marks their message read, while the reply is worked out. */
  showTyping?(messageId: string): Promise<void>;
  loadBooks(businessId: string): Promise<BizData>;
  saveChanges(businessId: string, before: BizData, after: BizData): Promise<void>;
  getPending(phone: string): Promise<Pending | null>;
  setPending(phone: string, pending: Pending): Promise<void>;
  clearPending(phone: string): Promise<void>;
  setAbout(phone: string, about: { businessId: string; customerId: string; name: string } | null): Promise<void>;
  /** What you were just talking about, so a short follow-up stays on it. */
  getThread(phone: string): Promise<Turn[]>;
  saveThread(phone: string, turns: Turn[]): Promise<void>;
  getMemory(businessId: string): Promise<ShopMemory>;
  saveMemory(businessId: string, memory: ShopMemory): Promise<void>;
  /** Turns a voice note (Meta's media id) into the words they said. */
  listen?(mediaId: string): Promise<string>;
  interpret(input: TellInput): Promise<Interpretation>;
  isBusy(error: unknown): boolean;
  send(to: string, body: string, buttons?: Button[]): Promise<void>;
  reminders: ReminderDeps;
  /** Records that the owner just wrote (a reminder can then be a normal message for 24 hours). */
  noteInbound?(phone: string): Promise<void>;
  /** Reads a picture or website about the business (features/tell/server/learn-business.ts). */
  learn?: {
    fromImage(image: { id: string; caption?: string }): Promise<Learned>;
    fromWebsite(url: string): Promise<Learned>;
    /** Words for the owner when reading failed for a reason they can fix (too big, not a page), else null. */
    problem(error: unknown): string | null;
  };
  appUrl?: string;
  now?: () => Date;
}

const BUTTONS: Button[] = [
  { id: SAVE, title: "Save" },
  { id: CANCEL, title: "Cancel" },
];
const EITHER_BUTTONS: Button[] = [
  { id: SAVE_SALE, title: "Save as sale" },
  { id: SAVE_EXPENSE, title: "Save as expense" },
  { id: CANCEL, title: "Cancel" },
];
const WHICH = "Which is it? Tap *Save as sale* or *Save as expense*.";
const ANSWER_WORDS = 8;
const WHEN = "When should I remind you? (e.g. tomorrow 9am, Friday at 4pm, in 2 hours)";
const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
const clip = (text: string) => (text.length > 80 ? `${text.slice(0, 77)}…` : text).replace(/\s+/g, " ");

const UNDO_BUTTON: Button[] = [{ id: UNDO, title: "Undo" }];
const OFFER_BUTTONS: Button[] = [
  { id: AUTO_ON, title: "Yes, auto-save" },
  { id: AUTO_OFF, title: "No, keep asking" },
];
const STILL_ASKS = "I'll still ask about new customers, payments, big amounts, and anything that could be a sale or an expense.";
const OFFER = `I've read your last ${AUTO_SAVE_AFTER} notes right. Want me to save notes like these straight away, without asking?\n\n${STILL_ASKS} Every one I save by myself has an *Undo*.`;

/** The words in a voice note, or null when the owner was already told it couldn't be heard. */
async function hear(mediaId: string, to: string, deps: Deps): Promise<string | null> {
  if (!deps.listen) {
    await deps.send(to, "I couldn't hear that. Say it again, or type it.");
    return null;
  }
  try {
    const words = (await deps.listen(mediaId)).replace(/\s+/g, " ").trim().slice(0, 800);
    if (!words) {
      await deps.send(to, "I couldn't hear any words in that. Say it again, or type it.");
      return null;
    }
    return words;
  } catch (error) {
    const tooLong = error instanceof Error && error.name === "MediaTooBigError";
    await deps.send(to, tooLong ? "That voice note is too long. Send a shorter one, or type it." : "I couldn't hear that. Say it again, or type it.");
    return null;
  }
}

export async function handleMessage(message: Incoming, deps: Deps): Promise<void> {
  // WhatsApp can deliver the same message twice: handle each once.
  if (!(await deps.markSeen(message.id))) return;

  // Straight away: blue ticks and "typing…", so the owner knows BizBuddy is on it. Never blocks the reply.
  await deps.showTyping?.(message.id).catch(() => undefined);

  const to = message.from;
  const phone = normalizePhone(message.from);
  if (!phone) return deps.send(to, "BizBuddy works with Nigerian phone numbers for now.");

  const { chat, books: found } = await deps.whoIsChatting(phone, message.profileName ?? null);
  if (chat.kind !== "owner") return deps.send(to, notLinked(deps.appUrl));
  await deps.noteInbound?.(phone).catch(() => undefined);

  const { today, weekday } = lagosToday(deps.now?.() ?? new Date());
  let text = message.text;
  if (!text && message.audio) {
    const heard = await hear(message.audio.id, to, deps);
    if (heard === null) return;
    text = heard;
  }
  const asked = command({ text, buttonId: message.buttonId });
  if (asked) return runCommand(asked, phone, to, chat, deps);
  const aboutReminders = reminderCommand({ text, buttonId: message.buttonId });
  if (aboutReminders) return runReminderCommand(aboutReminders, to, chat, deps);
  const choice = decision({ text, buttonId: message.buttonId });
  if (choice) return confirm(choice, phone, to, chat, today, deps);

  if (message.image) return learnFrom(() => deps.learn!.fromImage(message.image!), phone, to, chat, deps);

  // Any other button (e.g. "Hi BizBuddy" on the welcome message) is a hello.
  if (message.buttonId) return deps.send(to, [chatHeading(chat), "Tell me what happened, the way you'd say it."].filter(Boolean).join("\n\n"));
  if (!text) {
    // A reaction or a system note is not the owner talking. Don't answer it with a script.
    if (message.other && ["reaction", "system", "unsupported", "ephemeral", "request_welcome"].includes(message.other)) return;
    const voice = message.other === "audio" || message.other === "video";
    return deps.send(to, voice ? "I couldn't hear that. Say it again, or type it." : "I can only read what you type for now. A photo of your page or price list I can learn from.");
  }

  const [books, memory, waiting, thread] = await Promise.all([
    found ? Promise.resolve(found) : deps.loadBooks(chat.businessId),
    deps.getMemory(chat.businessId),
    deps.getPending(phone),
    deps.getThread(phone),
  ]);
  const pending = waiting?.businessId === chat.businessId ? waiting : null;

  // BizBuddy asked for something missing ("Who bought it?"): a short reply is the answer, so read the
  // note again with it. Anything longer is a new note.
  const answering = pending?.asking && words(text) <= ANSWER_WORDS;
  const note = answering ? `${pending.note}\n(${pending.asking} ${text.trim()})` : text;
  if (pending?.asking) await deps.clearPending(phone);

  // Just a link: their Instagram / TikTok / Facebook handle is saved; a website is read to learn the business.
  const link = !answering ? onlyLink(text) : null;
  if (link) {
    const social = socialFromUrl(link);
    if (social) {
      await deps.saveMemory(chat.businessId, { ...memory, socials: { ...memory.socials, [social.platform]: social.handle } });
      return deps.send(
        to,
        `Saved your ${SOCIAL_LABELS[social.platform]}: @${social.handle}.\n\nI can't open social media pages myself yet. Send me *screenshots* of your page, catalogue, or price list, and I'll learn what you sell from them.`,
      );
    }
    return learnFrom(() => deps.learn!.fromWebsite(link), phone, to, chat, deps);
  }
  // A note still waiting on Save / Cancel from before.
  const earlier = !answering && pending && (pending.drafts.length > 0 || pending.either) ? pending : null;

  let turns = thread;
  const say = async (body: string, buttons?: Button[]) => {
    turns = remember(turns, text ?? note, body);
    await deps.saveThread(phone, turns);
    return deps.send(to, body, buttons);
  };

  // A short follow-up stays on the last question. The numbers still come from the books.
  const continued = !answering && text ? continueTalk(text, thread) : null;
  if (continued) {
    const now = deps.now?.();
    const text =
      continued.kind === "help"
        ? WHAT_YOU_CAN_ASK
        : continued.kind === "chat"
          ? continued.reply
          : answerToText(continued.detail ? owingDetail(books) : answerTopic(continued.topic, continued.customer, continued.period, books, now));
    await say(text);
    const reminder = earlier && reminderFor(earlier, books);
    if (reminder) await deps.send(to, reminder.body, reminder.buttons);
    return;
  }

  const socials = !answering && text ? aboutSocials(text, memory.socials) : null;
  if (socials) {
    await say(socials);
    const reminder = earlier && reminderFor(earlier, books);
    if (reminder) await deps.send(to, reminder.body, reminder.buttons);
    return;
  }

  let actions;
  try {
    const result = await deps.interpret({
      message: note.slice(0, 800),
      today,
      weekday,
      time: lagosClock(deps.now?.() ?? new Date()).time,
      customers: books.customers.map((c) => c.name),
      chatWith: [chatPrompt(chat), shopProfile(books.business)].filter(Boolean).join(" ") || null,
      memory: [memoryForPrompt(memory), Object.values(memory.socials).some(Boolean) ? null : "No social accounts are saved for this shop yet. If they ask, say they aren't connected yet. Never invent a handle."].filter(Boolean).join("\n") || null,
      thread: threadPrompt(thread),
    });
    actions = personalize(result.actions, chat);
  } catch (error) {
    return say(deps.isBusy(error) ? "I'm busy right now. Send that again in a minute." : "Sorry, I couldn't read that just now. Try again, or record it in the app.");
  }

  // The owner's next "he paid 20k" is about whoever this note named.
  const about = nextAbout(actions, books.customers);
  if (about) await deps.setAbout(phone, { businessId: chat.businessId, customerId: about.id, name: about.name });

  const answers: string[] = [];
  const drafts: Draft[] = [];
  let unsure: EitherAction | null = null;
  const reminders: ReminderAction[] = [];
  for (const action of actions) {
    if (action.kind === "reminder") reminders.push(action);
    else if (action.kind === "question") answers.push(answerToText(answerTopic(action.topic, action.customer, action.period, books, deps.now?.())));
    else if (action.kind === "unclear") answers.push(action.reply);
    else if (action.kind === "either") {
      if (unsure) answers.push(`Send the part about ${action.person} again on its own, and I'll ask about it.`);
      else unsure = action;
    } else drafts.push(toDraft(action, today));
  }

  if (answers.length > 0) await say(answers.join("\n\n"));
  const noTime = await setReminders(reminders, phone, to, chat, deps);
  if (noTime && drafts.length === 0 && !unsure) {
    // "Remind me to call David" with no time: ask when, and read the answer with this note.
    await deps.setPending(phone, { businessId: chat.businessId, note, drafts: [], asking: "When should I remind you?" });
    return say(WHEN);
  }
  // A new note to record replaces the one still waiting: say so, so it isn't lost silently.
  if (earlier && (unsure || drafts.length > 0)) await say(`(Your earlier note wasn't saved: _${clip(earlier.note)}_. Send it again if you want it.)`);
  if (unsure) return askWhich(unsure, drafts, note, phone, to, chat, books, today, deps);
  if (memory.autoSave === "on" && drafts.length > 0 && drafts.every((draft) => needsAsking(draft, books, today) === null)) {
    return saveNow(drafts, note, phone, to, chat, books, memory, deps);
  }
  if (drafts.length === 0) {
    if (answers.length === 0 && reminders.length === 0) await say([chatHeading(chat), HELP].filter(Boolean).join("\n\n"));
    // Only a question: the earlier note is still waiting, so remind them with its buttons.
    const reminder = earlier && reminderFor(earlier, books);
    if (reminder) await deps.send(to, reminder.body, reminder.buttons);
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
    // Ask for the first thing that's missing; the owner's short answer is read with this note.
    const question = problems.find((problem): problem is string => problem !== null && MISSING_QUESTIONS.has(problem));
    if (question) {
      await deps.setPending(phone, { businessId: chat.businessId, note, drafts: [], asking: question });
      return say(`${blocks.join("\n\n")}\n\n${question}`);
    }
    await deps.clearPending(phone);
    return say(`${blocks.join("\n\n")}\n\nSend it again with what's missing, and I'll record it.`);
  }

  await deps.setPending(phone, { businessId: chat.businessId, note, drafts: ready });
  const ask = ready.length === drafts.length ? (ready.length > 1 ? "Save these?" : "Save this?") : `Save the ${ready.length === 1 ? "complete one" : `${ready.length} complete ones`}? The rest need what's missing.`;
  return say(`${blocks.join("\n\n")}\n\n${ask}`, BUTTONS);
}

/**
 * A person sent money "for" something and the note doesn't say which way it went. Shows both readings,
 * with the app's sums, and waits for Save as sale / Save as expense. Other drafts in the note go with it.
 */
async function askWhich(action: EitherAction, drafts: Draft[], note: string, phone: string, to: string, chat: Extract<ChatWith, { kind: "owner" }>, books: BizData, today: string, deps: Deps) {
  const { sale, expense } = eitherDrafts(action, today);
  const person = action.person.trim();
  const saleProblem = checkDraft(sale, books, today);
  const expenseProblem = checkDraft(expense, books, today);
  const others = drafts.map((draft) => ({ draft, problem: checkDraft(draft, books, today) }));
  const ready = others.filter((o) => o.problem === null).map((o) => o.draft);
  const blocks = others.map(({ draft, problem }) => (problem ? `${describeDraft(draft, books)}\n⚠️ ${problem}` : describeDraft(draft, books)));

  const sent = expense.amount === null ? "sent money" : `sent ${formatNaira(expense.amount)}`;
  const question = [
    `*${person}* ${sent}${sale.product ? ` for ${sale.product}` : ""}. Did ${person} pay you, or spend it for the shop?`,
    `*If ${person} paid you (a sale):*\n${describeDraft(sale, books)}${saleProblem ? `\n⚠️ ${saleProblem}` : ""}`,
    `*If ${person} spent it for the shop (an expense):*\n${describeDraft(expense, books)}${expenseProblem ? `\n⚠️ ${expenseProblem}` : ""}`,
  ].join("\n\n");

  // Neither reading can be saved yet (e.g. no amount): say what's missing instead of asking.
  if (saleProblem && expenseProblem) {
    await deps.clearPending(phone);
    return deps.send(to, [...blocks, question, "Send it again with what's missing, and I'll record it."].join("\n\n"));
  }
  // Only one reading works: offer that one with the normal Save.
  if (saleProblem || expenseProblem) {
    const only = saleProblem ? expense : sale;
    await deps.setPending(phone, { businessId: chat.businessId, note, drafts: [...ready, only] });
    return deps.send(to, [...blocks, question, `Save the ${saleProblem ? "expense" : "sale"}?`].join("\n\n"), BUTTONS);
  }
  await deps.setPending(phone, { businessId: chat.businessId, note, drafts: ready, either: { person, sale, expense } });
  const rest = ready.length > 0 ? ` The ${ready.length === 1 ? "other one is" : "others are"} saved with it.` : "";
  return deps.send(to, [...blocks, question, `${WHICH}${rest}`].join("\n\n"), EITHER_BUTTONS);
}

/**
 * The one reminder for a note left waiting on Save / Cancel (or sale-or-expense): what it was, with the
 * same buttons. null when nothing is waiting on a tap. Sent by app/api/whatsapp/remind.
 */
export function reminderFor(pending: Pending, books: BizData): { body: string; buttons: Button[] } | null {
  if (pending.drafts.length === 0 && !pending.either) return null;
  const blocks = pending.drafts.map((draft) => describeDraft(draft, books));
  if (pending.either) {
    const { person, sale, expense } = pending.either;
    blocks.push(`*If ${person} paid you (a sale):*\n${describeDraft(sale, books)}`, `*If ${person} spent it for the shop (an expense):*\n${describeDraft(expense, books)}`);
  }
  const intro = `⏰ You haven't saved or cancelled this yet: _${clip(pending.note)}_`;
  return pending.either
    ? { body: [intro, ...blocks, WHICH].join("\n\n"), buttons: EITHER_BUTTONS }
    : { body: [intro, ...blocks, pending.drafts.length > 1 ? "Save these?" : "Save this?"].join("\n\n"), buttons: BUTTONS };
}

/** Reads a picture or website, and shows what it learned about the business with Save / Cancel. */
async function learnFrom(read: () => Promise<Learned>, phone: string, to: string, chat: Extract<ChatWith, { kind: "owner" }>, deps: Deps) {
  if (!deps.learn) return deps.send(to, "I can only read what you type for now. A photo of your page or price list I can learn from.");
  let learned: Learned;
  try {
    learned = await read();
  } catch (error) {
    return deps.send(to, deps.learn.problem(error) ?? "Sorry, I couldn't read that just now. Try again in a moment.");
  }
  if (!learnedAnything(learned)) {
    return deps.send(to, "I couldn't find anything about your business in that. I learn from screenshots of your Instagram or WhatsApp catalogue, photos of your price list, or your website.");
  }
  await deps.setPending(phone, { businessId: chat.businessId, note: `(${learned.source})`, drafts: [], learn: learned });
  return deps.send(to, describeLearned(learned), BUTTONS);
}

/** Sets each reminder that says when, confirming it with a Cancel button. True if one had no time. */
async function setReminders(reminders: ReminderAction[], phone: string, to: string, chat: Extract<ChatWith, { kind: "owner" }>, deps: Deps): Promise<boolean> {
  const now = deps.now?.() ?? new Date();
  let noTime = false;
  for (const reminder of reminders) {
    const due = dueFrom({ date: reminder.date, time: reminder.time, inMinutes: reminder.in_minutes }, now);
    const text = reminder.text.trim();
    if (!due || !text) {
      noTime = true;
      continue;
    }
    const saved = await deps.reminders.add(chat.businessId, phone, text, due);
    await deps.send(to, `⏰ I'll remind you *${formatWhen(due, now)}*: ${saved.text}`, [{ id: reminderButtonId("cancel", saved.id), title: "Cancel reminder" }]);
  }
  return noTime;
}

const UNSAVED_WORDS: Record<UnsavedReminder, string> = {
  "30m": "Okay. If you leave a note without Save or Cancel, I'll remind you after 30 minutes.",
  "2h": "Okay. If you leave a note without Save or Cancel, I'll remind you after 2 hours.",
  never: "Okay. I won't remind you about notes you didn't save or cancel. Reminders you set yourself still come; send _my reminders_ to see them.",
};

async function runReminderCommand(asked: ReminderCommand, to: string, chat: Extract<ChatWith, { kind: "owner" }>, deps: Deps) {
  const now = deps.now?.() ?? new Date();
  const { businessId } = chat;
  switch (asked.kind) {
    case "list":
      return deps.send(to, reminderList(await deps.reminders.upcoming(businessId), now));
    case "cancel-number": {
      const target = (await deps.reminders.upcoming(businessId))[asked.number - 1];
      if (!target) return deps.send(to, `There's no reminder ${asked.number}. Send _my reminders_ to see the list.`);
      await deps.reminders.cancel(businessId, target.id);
      return deps.send(to, `Cancelled: ${target.text}`);
    }
    case "check-ins": {
      const memory = await deps.getMemory(businessId);
      await deps.saveMemory(businessId, { ...memory, checkIns: { evening: asked.on, weekly: asked.on } });
      return deps.send(
        to,
        asked.on
          ? "Okay. I'll check in at 7pm on days with nothing recorded, and send your week's numbers on Sunday evening."
          : "Okay, no more check-ins. Send _start check-ins_ any time to get them back.",
      );
    }
    case "unsaved": {
      const memory = await deps.getMemory(businessId);
      await deps.saveMemory(businessId, { ...memory, unsavedReminder: asked.choice });
      return deps.send(to, UNSAVED_WORDS[asked.choice]);
    }
    case "button": {
      if (asked.action === "cancel") {
        const text = await deps.reminders.cancel(businessId, asked.id);
        return deps.send(to, text ? `Cancelled: ${text}` : "That reminder is already gone.");
      }
      if (asked.action === "done") {
        const text = await deps.reminders.settle(businessId, asked.id, { done: true });
        return deps.send(to, text ? `✓ Done: ${text}` : "That reminder is already gone.");
      }
      const due = snoozed(asked.action, now);
      const text = await deps.reminders.settle(businessId, asked.id, { due });
      return deps.send(to, text ? `⏰ Okay, I'll remind you again *${formatWhen(due, now)}*: ${text}` : "That reminder is already gone.");
    }
  }
}

/** Auto-save is on and every draft is safe to save: record it now, and keep what Undo needs. */
async function saveNow(drafts: Draft[], note: string, phone: string, to: string, chat: Extract<ChatWith, { kind: "owner" }>, before: BizData, memory: ShopMemory, deps: Deps) {
  let books = before;
  let learned = memory;
  const done: string[] = [];
  for (const draft of drafts) {
    const saved = applyDraft(books, draft);
    books = saved.data;
    done.push(saved.text);
    learned = learn(learned, note, draft);
  }
  await deps.saveChanges(chat.businessId, before, books);
  if (learned !== memory) await deps.saveMemory(chat.businessId, learned).catch(() => undefined);
  await deps.setPending(phone, { businessId: chat.businessId, note, drafts: [], undo: { ...added(before, books), text: done.join(" ") } });
  return deps.send(to, [...done.map((text) => `✓ ${text}`), "", "Saved without asking. Wrong? Tap *Undo*."].join("\n"), UNDO_BUTTON);
}

async function runCommand(asked: typeof UNDO | typeof AUTO_ON | typeof AUTO_OFF, phone: string, to: string, chat: Extract<ChatWith, { kind: "owner" }>, deps: Deps) {
  const memory = await deps.getMemory(chat.businessId);
  if (asked === AUTO_ON) {
    await deps.saveMemory(chat.businessId, withAutoSave(memory, "on"));
    return deps.send(to, `Done. I'll save notes like these straight away.\n\n${STILL_ASKS} Tap *Undo* on any I save by myself, or type *auto-save off* to stop.`);
  }
  if (asked === AUTO_OFF) {
    await deps.saveMemory(chat.businessId, withAutoSave(memory, "declined"));
    return deps.send(to, "Okay. I'll show you every note before saving. Type *auto-save on* any time to start.");
  }
  const pending = await deps.getPending(phone);
  if (!pending?.undo || pending.businessId !== chat.businessId) {
    return deps.send(to, "Nothing to undo here. Only the last note I saved by myself can be undone on WhatsApp; fix anything older in the app.");
  }
  const before = await deps.loadBooks(chat.businessId);
  await deps.saveChanges(chat.businessId, before, undo(before, pending.undo));
  await deps.clearPending(phone);
  await deps.saveMemory(chat.businessId, reviewed(memory, "undone")).catch(() => undefined);
  return deps.send(to, `↩️ Undone. I took out: ${pending.undo.text}\n\nSend it again the right way, and I'll show it to you before saving.`);
}

async function confirm(choice: Choice, phone: string, to: string, chat: Extract<ChatWith, { kind: "owner" }>, today: string, deps: Deps) {
  const pending = await deps.getPending(phone);
  const waiting = pending !== null && pending.businessId === chat.businessId && (pending.drafts.length > 0 || pending.either !== undefined || pending.learn !== undefined);
  if (!waiting) {
    if (pending && pending.businessId !== chat.businessId) await deps.clearPending(phone);
    return deps.send(to, choice === CANCEL ? "Okay." : `Nothing is waiting to be saved.\n\n${HELP}`);
  }
  if (choice === CANCEL) {
    await deps.clearPending(phone);
    const memory = await deps.getMemory(chat.businessId);
    // BizBuddy read it wrong (or the owner changed their mind): the run of right answers starts again.
    if (!pending.either) await deps.saveMemory(chat.businessId, reviewed(memory, "cancelled")).catch(() => undefined);
    return deps.send(to, "Okay, I didn't save that.");
  }
  if (pending.learn) {
    const memory = await deps.getMemory(chat.businessId);
    const merged = mergeCatalog(memory.catalog, memory.description, pending.learn);
    await deps.saveMemory(chat.businessId, { ...memory, ...merged });
    await deps.clearPending(phone);
    const count = pending.learn.products.length;
    return deps.send(to, `✓ Saved. I'll use this to understand your notes${count > 0 ? `, and I know ${merged.catalog.length} of your products now` : ""}.`);
  }
  // A plain "yes" can't say which reading: ask again, and keep it waiting.
  if (pending.either && choice === SAVE) return deps.send(to, WHICH, EITHER_BUTTONS);
  const chosen = pending.either ? [choice === SAVE_SALE ? pending.either.sale : pending.either.expense] : [];
  const drafts = [...pending.drafts, ...chosen];

  // Check again against the books as they are now: another phone may have changed them since.
  const before = await deps.loadBooks(chat.businessId);
  let books = before;
  let memory = await deps.getMemory(chat.businessId);
  const startMemory = memory;
  const done: string[] = [];
  const skipped: string[] = [];
  for (const draft of drafts) {
    const problem = checkDraft(draft, books, today);
    if (problem) {
      skipped.push(problem);
      continue;
    }
    const saved = applyDraft(books, draft);
    books = saved.data;
    done.push(saved.text);
    memory = learn(memory, pending.note, draft);
    // Saved just as BizBuddy read it. Picking sale or expense doesn't count: BizBuddy had to ask.
    if (!pending.either) memory = reviewed(memory, "saved");
  }
  if (done.length > 0) await deps.saveChanges(chat.businessId, before, books);
  const offer = offerDue(memory);
  if (offer) memory = withAutoSave(memory, "offered");
  if (memory !== startMemory) await deps.saveMemory(chat.businessId, memory).catch(() => undefined); // A missed lesson never undoes a save.
  await deps.clearPending(phone);

  const lines = done.map((text) => `✓ ${text}`);
  if (skipped.length > 0) lines.push(...skipped.map((problem) => `Not saved: ${problem}`));
  if (done.length > 0) lines.push("It's in your books; the app shows it next time it syncs.");
  await deps.send(to, lines.join("\n"));
  if (offer) await deps.send(to, OFFER, OFFER_BUTTONS);
}
