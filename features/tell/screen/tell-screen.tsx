"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { answerQuestion, answerTopic, SUGGESTIONS, type Answer } from "@/features/ask/lib/answer";
import { useBiz } from "@/features/shell/hooks/use-biz";
import { today } from "@/shared/lib/dates";
import { getBizData, useSyncMeta } from "@/shared/lib/store";
import { accountsEnabled } from "@/shared/lib/supabase";
import { AskIcon, ChevronRightIcon } from "@/shared/ui/icons";
import { AutoSavedCard, DraftCard, saveDraftNow } from "../components/draft-card";
import { ReminderCard } from "@/features/reminders/components/reminder-card";
import { createReminder } from "@/features/reminders/lib/client";
import { dueFrom, type Reminder } from "@/features/reminders/lib/when";
import { AUTO_SAVE_AFTER, needsAsking, type Undo } from "../lib/autosave";
import { eitherDrafts, toDraft, type Draft, type Interpretation } from "../lib/intents";
import { canTell, setAutoSave, TellError, tellBizBuddy } from "../lib/client";
import { getKnowledge } from "../lib/knowledge-client";
import type { Socials } from "../lib/knowledge";
import { loadThread, localTalk, remember, rememberedReply, saveThread, threadPrompt, transcript, type Turn } from "../lib/talk";

type Reply =
  | { kind: "pending" }
  | { kind: "error"; text: string }
  | { kind: "text"; text: string }
  | { kind: "answer"; answer: Answer }
  | { kind: "draft"; draft: Draft; counts?: boolean }
  | { kind: "auto"; text: string; href?: string; undo: Undo }
  | { kind: "offer" }
  | { kind: "reminder"; text: string; saving: Promise<Reminder> | null };

type Message = { id: number; text: string; replies: Reply[] };

const EXAMPLES = ["Sold 2 shoes to David for 85k, he paid 50k", "Paid 4k for delivery to Lekki", ...SUGGESTIONS.slice(0, 1)];
const MAX = 600;

/**
 * Turns what BizBuddy understood into replies. Answers and totals are worked out here, from the books.
 * With auto-save on, a note whose drafts are all safe to save (lib/autosave.ts) is saved straight away.
 */
function repliesFor(result: Interpretation & { autoSave?: boolean }, note: string): Reply[] {
  const replies = readReplies(result);
  const drafts = replies.filter((r): r is Extract<Reply, { kind: "draft" }> => r.kind === "draft");
  const data = getBizData();
  const safe = result.autoSave && drafts.length > 0 && drafts.every((r) => r.counts !== false && needsAsking(r.draft, data, today()) === null);
  if (!safe) return replies;
  try {
    return replies.map((reply): Reply => {
      if (reply.kind !== "draft") return reply;
      const saved = saveDraftNow(reply.draft, note);
      return { kind: "auto", text: saved.text, href: saved.href, undo: saved.undo };
    });
  } catch {
    return replies; // Couldn't save here: show the drafts to save by hand instead.
  }
}

function readReplies(result: Interpretation): Reply[] {
  if (result.actions.length === 0) return [{ kind: "text", text: "Say that once more, the way you mean it." }];
  return result.actions.flatMap((action): Reply[] => {
    if (action.kind === "question") return [{ kind: "answer", answer: answerTopic(action.topic, action.customer, action.period, getBizData()) }];
    if (action.kind === "unclear") return [{ kind: "text", text: action.reply }];
    if (action.kind === "reminder") {
      // Said when: set it now (once, here, not in a component effect). Otherwise the card asks when.
      const due = dueFrom({ date: action.date, time: action.time, inMinutes: action.in_minutes }, new Date());
      return [{ kind: "reminder", text: action.text, saving: due ? createReminder(action.text, due) : null }];
    }
    if (action.kind === "either") {
      // The note doesn't say which way the money went: show both, and the owner saves the right one.
      const { sale, expense } = eitherDrafts(action, today());
      return [
        { kind: "text", text: `Did ${action.person} pay you for this (a sale), or spend it for the shop (an expense)? Save the one that's right.` },
        { kind: "draft", draft: sale, counts: false },
        { kind: "draft", draft: expense, counts: false },
      ];
    }
    return [{ kind: "draft", draft: toDraft(action, today()) }];
  });
}

/** Without Tell BizBuddy (offline, or no account), questions still work from the books. */
function offlineReplies(text: string): Reply[] {
  return [{ kind: "answer", answer: answerQuestion(text, getBizData()) }];
}

export function TellPage() {
  const { data, business } = useBiz();
  const signedIn = useSyncMeta() !== null;
  const params = useSearchParams();
  const nextId = useRef(1);
  const startedFirst = useRef(false);
  const turns = useRef<Turn[]>([]);
  const socials = useRef<Socials | null>(canTell() ? null : {});
  const firstNote = params.get("q")?.trim().slice(0, MAX) ?? "";
  // A note sent from the dashboard (?q=…) shows straight away; if Claude reads it, its reply follows.
  const [messages, setMessages] = useState<Message[]>(() =>
    firstNote ? [{ id: 0, text: firstNote, replies: canTell() ? [{ kind: "pending" }] : offlineReplies(firstNote) }] : [],
  );
  const [input, setInput] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  // Drafts shown but not yet saved or discarded, as "messageId:replyIndex", so earlier ones can be pointed out.
  const [unsettled, setUnsettled] = useState<string[]>(() => []);

  function resolve(id: number, replies: Reply[]) {
    setMessages((current) => current.map((m) => (m.id === id ? { ...m, replies } : m)));
    const keys = replies.flatMap((reply, i) => (reply.kind === "draft" ? [`${id}:${i}`] : []));
    if (keys.length > 0) setUnsettled((current) => [...current, ...keys]);
  }

  function settled(key: string) {
    setUnsettled((current) => current.filter((k) => k !== key));
  }

  // Reminder: drafts under earlier notes that were never saved or discarded.
  const latest = messages[messages.length - 1]?.id;
  const forgotten = unsettled.filter((key) => Number(key.split(":")[0]) !== latest);

  function keep(text: string, replies: Reply[]) {
    const parts = replies.map((reply) => {
      if (reply.kind === "text" || reply.kind === "error" || reply.kind === "auto") return reply.text;
      if (reply.kind === "answer") return reply.answer.text;
      if (reply.kind === "reminder") return `I'll remind you: ${reply.text}`;
      if (reply.kind === "draft") return "Shown for you to save.";
      return "";
    });
    turns.current = remember(turns.current, text, rememberedReply(parts));
    saveThread(business.id, turns.current);
  }

  function read(id: number, text: string) {
    tellBizBuddy(text, getBizData(), threadPrompt(turns.current))
      .then((result) => {
        const replies = repliesFor(result, text);
        if (result.trialNotice) replies.push({ kind: "text", text: result.trialNotice });
        keep(text, replies);
        resolve(id, replies);
      })
      .catch((error) => resolve(id, [{ kind: "error", text: error instanceof TellError ? error.message : "BizBuddy couldn't read that just now. Try again." }]));
  }

  useEffect(() => {
    const saved = loadThread(business.id);
    turns.current = saved;
    if (!firstNote && saved.length > 0) {
      const prior = transcript(saved);
      nextId.current = Math.max(nextId.current, prior.length);
      setMessages((current) => (current.length > 0 ? current : prior.map((line, index) => ({ id: index, text: line.text, replies: line.reply ? [{ kind: "text" as const, text: line.reply }] : [] }))));
    }
    if (canTell()) getKnowledge().then((known) => { socials.current = known.socials; }).catch(() => { socials.current = {}; });
  }, [business.id, firstNote]);

  useEffect(() => {
    if (!firstNote || startedFirst.current || !canTell()) return;
    startedFirst.current = true;
    const local = localTalk(firstNote, turns.current, getBizData(), socials.current, new Date());
    if (local) {
      turns.current = local.turns;
      saveThread(business.id, turns.current);
      resolve(0, local.answer ? [{ kind: "answer", answer: local.answer }] : [{ kind: "text", text: local.text }]);
      return;
    }
    read(0, firstNote);
    // Runs once for the note from the dashboard. The thread is loaded in the effect above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (messages.length > 0) bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  /** BizBuddy has read enough notes right in a row: ask once, under the note that got there. */
  function offerAutoSave(id: number) {
    setMessages((current) => current.map((m) => (m.id === id && !m.replies.some((r) => r.kind === "offer") ? { ...m, replies: [...m.replies, { kind: "offer" }] } : m)));
  }

  function send(raw: string) {
    const text = raw.trim().slice(0, MAX);
    if (!text) return;
    const id = nextId.current++;
    const local = localTalk(text, turns.current, getBizData(), canTell() ? socials.current : {}, new Date());
    if (local) {
      turns.current = local.turns;
      saveThread(business.id, turns.current);
      setMessages((current) => [...current, { id, text, replies: local.answer ? [{ kind: "answer", answer: local.answer }] : [{ kind: "text", text: local.text }] }]);
      setInput("");
      return;
    }
    const live = canTell();
    const replies = live ? [{ kind: "pending" as const }] : offlineReplies(text);
    if (!live) keep(text, replies);
    setMessages((current) => [...current, { id, text, replies }]);
    setInput("");
    if (live) read(id, text);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    send(input);
  }

  const readsNotes = accountsEnabled() && signedIn;

  return (
    <div className="mx-auto flex max-w-2xl flex-col px-4 py-6 md:px-8 md:py-8">
      <div className="mb-6 flex items-center gap-3">
        <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-xl bg-brand-900 text-brand-100">
          <AskIcon />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-ink">Tell BizBuddy</h1>
          <p className="text-sm text-ink-muted">Type what happened. Each note you save teaches this shop.</p>
        </div>
      </div>

      {!readsNotes && accountsEnabled() && (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          To record sales from a message, <Link href="/settings" className="font-semibold underline">back up your books</Link> with an account. You can still ask questions here.
        </p>
      )}

      <div role="log" aria-live="polite" aria-label="Notes and replies" className="space-y-4">
        <Bubble from="bizbuddy">
          <p>
            Hi {business.ownerName}. {readsNotes ? "Talk to me the way you talk. A sale, what you spent, or how the day went. I'll show you what I understood before anything is saved." : "Ask me how much you sold, what came in, or what you spent. A short follow-up stays on the last thing you asked."}
          </p>
        </Bubble>
        {messages.map((message) => (
          <div key={message.id} className="space-y-3">
            <Bubble from="you">
              <p className="whitespace-pre-wrap">{message.text}</p>
            </Bubble>
            {message.replies.map((reply, i) => (
              <Bubble key={i} id={`reply-${message.id}-${i}`} from="bizbuddy" wide={reply.kind === "draft"}>
                {reply.kind === "pending" && <p className="text-ink-muted">Reading…</p>}
                {reply.kind === "error" && <p className="text-rose-700">{reply.text}</p>}
                {reply.kind === "text" && <p className="whitespace-pre-wrap">{reply.text}</p>}
                {reply.kind === "answer" && <AnswerView answer={reply.answer} onAsk={send} />}
                {reply.kind === "draft" && <DraftCard draft={reply.draft} data={data} note={message.text} counts={reply.counts} onOffer={() => offerAutoSave(message.id)} onSettled={() => settled(`${message.id}:${i}`)} />}
                {reply.kind === "auto" && <AutoSavedCard done={{ text: reply.text, href: reply.href }} undo={reply.undo} note={message.text} />}
                {reply.kind === "offer" && <AutoSaveOffer />}
                {reply.kind === "reminder" && <ReminderCard text={reply.text} saving={reply.saving} />}
              </Bubble>
            ))}
          </div>
        ))}
        <div ref={bottom} />
      </div>

      <div className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] mt-6 rounded-2xl bg-surface/95 pt-2 backdrop-blur md:bottom-6">
        {forgotten.length > 0 && (
          <div role="status" className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <span>⏰ You haven&apos;t saved or cancelled {forgotten.length === 1 ? "an earlier note" : `${forgotten.length} earlier notes`}.</span>
            <button
              type="button"
              onClick={() => {
                const [id, i] = forgotten[0].split(":");
                document.getElementById(`reply-${id}-${i}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
              className="shrink-0 font-semibold underline"
            >
              Show me
            </button>
          </div>
        )}
        <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
          {(readsNotes ? EXAMPLES : SUGGESTIONS).map((s) => (
            <button key={s} type="button" onClick={() => send(s)} className="shrink-0 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-muted hover:border-brand-700 hover:text-brand-800">
              {s}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="flex gap-2">
          <label htmlFor="tell-note" className="sr-only">{readsNotes ? "Tell BizBuddy what happened" : "Ask a question about your business"}</label>
          <input
            id="tell-note"
            value={input}
            maxLength={MAX}
            onChange={(event) => setInput(event.target.value)}
            placeholder={readsNotes ? "e.g. Musa paid 20k by transfer" : "e.g. How much did I sell this month?"}
            autoComplete="off"
            className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-ink outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-200"
          />
          <button type="submit" disabled={!input.trim()} className="shrink-0 rounded-xl bg-brand-700 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50">
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

function AutoSaveOffer() {
  const [answer, setAnswer] = useState<"on" | "off" | "failed" | null>(null);

  async function choose(on: boolean) {
    setAnswer((await setAutoSave(on)) ? (on ? "on" : "off") : "failed");
  }

  if (answer === "on") return <p>Done. I&apos;ll save notes like these straight away, and you can undo any of them. Turn it off any time in Settings.</p>;
  if (answer === "off") return <p>Okay. I&apos;ll show you every note before saving. You can turn auto-save on in Settings.</p>;
  return (
    <div className="space-y-3">
      <p>
        I&apos;ve read your last {AUTO_SAVE_AFTER} notes right. Want me to save notes like these straight away, without asking? I&apos;ll still ask about new customers, payments, big amounts, and
        anything that could be a sale or an expense. Every one I save by myself has an Undo.
      </p>
      {answer === "failed" && <p role="alert" className="text-xs text-rose-700">Couldn&apos;t change that just now. Try again.</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => choose(true)} className="rounded-lg bg-brand-700 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-800">Yes, auto-save</button>
        <button type="button" onClick={() => choose(false)} className="rounded-lg bg-white px-3 py-2 text-xs font-medium text-ink ring-1 ring-stone-200 hover:bg-stone-100">No, keep asking</button>
      </div>
    </div>
  );
}

function Bubble({ from, children, wide = false, id }: { from: "you" | "bizbuddy"; children: ReactNode; wide?: boolean; id?: string }) {
  const you = from === "you";
  return (
    <div id={id} className={`flex ${you ? "justify-end" : "justify-start"}`}>
      <div className={`${wide ? "w-full max-w-md" : "max-w-[88%]"} rounded-2xl px-4 py-3 text-sm leading-relaxed ${you ? "rounded-br-md bg-brand-700 text-white" : "rounded-bl-md border border-stone-200 bg-white text-ink"}`}>
        <span className="sr-only">{you ? "You:" : "BizBuddy:"} </span>
        {children}
      </div>
    </div>
  );
}

function AnswerView({ answer, onAsk }: { answer: Answer; onAsk: (question: string) => void }) {
  return (
    <div className="space-y-3">
      <p>{answer.text}</p>
      {answer.rows && (
        <ul className="divide-y divide-stone-100 rounded-xl border border-stone-100">
          {answer.rows.map((row) => {
            const body = (
              <>
                <span className="truncate">{row.label}</span>
                <span className="shrink-0 font-semibold tabular-nums">{row.value}</span>
              </>
            );
            return (
              <li key={row.label}>
                {row.href ? (
                  <Link href={row.href} className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-stone-50">{body}</Link>
                ) : (
                  <div className="flex items-center justify-between gap-3 px-3 py-2">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {answer.total && (
        <p className="flex justify-between gap-3 font-semibold">
          <span>{answer.total.label}</span>
          <span className="tabular-nums text-amber-800">{answer.total.value}</span>
        </p>
      )}
      {answer.suggestions && (
        <div className="flex flex-wrap gap-2">
          {answer.suggestions.map((s) => (
            <button key={s} type="button" onClick={() => onAsk(s)} className="rounded-full bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-800 hover:bg-brand-100">
              {s}
            </button>
          ))}
        </div>
      )}
      {answer.link && (
        <Link href={answer.link.href} className="inline-flex items-center gap-0.5 text-xs font-semibold text-brand-700 hover:text-brand-800">
          {answer.link.label} <ChevronRightIcon className="size-3.5" />
        </Link>
      )}
    </div>
  );
}
