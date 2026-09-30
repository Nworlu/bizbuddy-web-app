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
import { DraftCard } from "../components/draft-card";
import { toDraft, type Draft, type Interpretation } from "../lib/intents";
import { canTell, TellError, tellBizBuddy } from "../lib/client";

type Reply =
  | { kind: "pending" }
  | { kind: "error"; text: string }
  | { kind: "text"; text: string }
  | { kind: "answer"; answer: Answer }
  | { kind: "draft"; draft: Draft };

type Message = { id: number; text: string; replies: Reply[] };

const EXAMPLES = ["Sold 2 shoes to David for 85k, he paid 50k", "Paid 4k for delivery to Lekki", ...SUGGESTIONS.slice(0, 1)];
const MAX = 600;

/** Turns what Claude understood into replies. Answers and totals are worked out here, from the books. */
function repliesFor(result: Interpretation): Reply[] {
  if (result.actions.length === 0) return [{ kind: "text", text: "I didn't catch anything to record. Try: “Sold 2 shoes to David for 85k, he paid 50k”." }];
  return result.actions.map((action): Reply => {
    if (action.kind === "question") return { kind: "answer", answer: answerTopic(action.topic, action.customer, action.period, getBizData()) };
    if (action.kind === "unclear") return { kind: "text", text: action.reply };
    return { kind: "draft", draft: toDraft(action, today()) };
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
  const firstNote = params.get("q")?.trim().slice(0, MAX) ?? "";
  // A note sent from the dashboard (?q=…) shows straight away; if Claude reads it, its reply follows.
  const [messages, setMessages] = useState<Message[]>(() =>
    firstNote ? [{ id: 0, text: firstNote, replies: canTell() ? [{ kind: "pending" }] : offlineReplies(firstNote) }] : [],
  );
  const [input, setInput] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  function resolve(id: number, replies: Reply[]) {
    setMessages((current) => current.map((m) => (m.id === id ? { ...m, replies } : m)));
  }

  function read(id: number, text: string) {
    tellBizBuddy(text, getBizData())
      .then((result) => resolve(id, repliesFor(result)))
      .catch((error) => resolve(id, [{ kind: "error", text: error instanceof TellError ? error.message : "BizBuddy couldn't read that just now. Try again." }]));
  }

  useEffect(() => {
    if (!firstNote || startedFirst.current || !canTell()) return;
    startedFirst.current = true;
    read(0, firstNote);
    // Runs once for the note from the dashboard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (messages.length > 0) bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  function send(raw: string) {
    const text = raw.trim().slice(0, MAX);
    if (!text) return;
    const id = nextId.current++;
    const live = canTell();
    setMessages((current) => [...current, { id, text, replies: live ? [{ kind: "pending" }] : offlineReplies(text) }]);
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
          <p className="text-sm text-ink-muted">Type what happened, or ask about your books.</p>
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
            Hi {business.ownerName}. {readsNotes ? "Tell me what happened in your own words, like “Sold 2 shoes to David for 85k, he paid 50k”. I'll show you what I understood before anything is saved." : "Ask me who owes you, how much you sold, or how much you spent."}
          </p>
        </Bubble>
        {messages.map((message) => (
          <div key={message.id} className="space-y-3">
            <Bubble from="you">
              <p className="whitespace-pre-wrap">{message.text}</p>
            </Bubble>
            {message.replies.map((reply, i) => (
              <Bubble key={i} from="bizbuddy" wide={reply.kind === "draft"}>
                {reply.kind === "pending" && <p className="text-ink-muted">Reading…</p>}
                {reply.kind === "error" && <p className="text-rose-700">{reply.text}</p>}
                {reply.kind === "text" && <p>{reply.text}</p>}
                {reply.kind === "answer" && <AnswerView answer={reply.answer} onAsk={send} />}
                {reply.kind === "draft" && <DraftCard draft={reply.draft} data={data} />}
              </Bubble>
            ))}
          </div>
        ))}
        <div ref={bottom} />
      </div>

      <div className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] mt-6 rounded-2xl bg-surface/95 pt-2 backdrop-blur md:bottom-6">
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
            placeholder={readsNotes ? "e.g. Musa paid 20k by transfer" : "e.g. How much does David owe?"}
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

function Bubble({ from, children, wide = false }: { from: "you" | "bizbuddy"; children: ReactNode; wide?: boolean }) {
  const you = from === "you";
  return (
    <div className={`flex ${you ? "justify-end" : "justify-start"}`}>
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
