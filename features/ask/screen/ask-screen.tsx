"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useBiz } from "@/features/shell/hooks/use-biz";
import { AskIcon, ChevronRightIcon } from "@/shared/ui/icons";
import { answerQuestion, SUGGESTIONS, type Answer } from "../lib/answer";

type Message = { id: number; question: string; answer: Answer };

export function AskPage() {
  const { data, business } = useBiz();
  const params = useSearchParams();
  const nextId = useRef(1);
  // A question sent from the dashboard (?q=…) is answered on the first render.
  const [messages, setMessages] = useState<Message[]>(() => {
    const q = params.get("q")?.trim();
    return q ? [{ id: 0, question: q, answer: answerQuestion(q, data) }] : [];
  });
  const [input, setInput] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length > 0) bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  function ask(question: string) {
    const q = question.trim();
    if (!q) return;
    setMessages((current) => [...current, { id: nextId.current++, question: q, answer: answerQuestion(q, data) }]);
    setInput("");
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    ask(input);
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col px-4 py-6 md:px-8 md:py-8">
      <div className="mb-6 flex items-center gap-3">
        <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-xl bg-brand-900 text-brand-100">
          <AskIcon />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-ink">Ask BizBuddy</h1>
          <p className="text-sm text-ink-muted">Questions about your sales, expenses, and who owes you.</p>
        </div>
      </div>

      <div role="log" aria-live="polite" aria-label="Questions and answers" className="space-y-4">
        <Bubble from="bizbuddy">
          <p>Hi {business.ownerName}. Ask me who owes you, how much you sold, or how much you spent. Every number comes straight from your books.</p>
        </Bubble>
        {messages.map((message) => (
          <div key={message.id} className="space-y-4">
            <Bubble from="you">
              <p>{message.question}</p>
            </Bubble>
            <Bubble from="bizbuddy">
              <AnswerView answer={message.answer} onAsk={ask} />
            </Bubble>
          </div>
        ))}
        <div ref={bottom} />
      </div>

      <div className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] mt-6 rounded-2xl bg-surface/95 pt-2 backdrop-blur md:bottom-6">
        <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" onClick={() => ask(s)} className="shrink-0 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-muted hover:border-brand-700 hover:text-brand-800">
              {s}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="flex gap-2">
          <label htmlFor="ask-question" className="sr-only">Ask a question about your business</label>
          <input
            id="ask-question"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="e.g. How much does David owe?"
            autoComplete="off"
            className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-ink outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-200"
          />
          <button type="submit" disabled={!input.trim()} className="shrink-0 rounded-xl bg-brand-700 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50">
            Ask
          </button>
        </form>
      </div>
    </div>
  );
}

function Bubble({ from, children }: { from: "you" | "bizbuddy"; children: React.ReactNode }) {
  const you = from === "you";
  return (
    <div className={`flex ${you ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${you ? "rounded-br-md bg-brand-700 text-white" : "rounded-bl-md border border-stone-200 bg-white text-ink"}`}>
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
