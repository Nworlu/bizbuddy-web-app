"use client";

import { useEffect, useState } from "react";
import { accountThread, clearStoredChats } from "@/features/tell/lib/client";
import { clearThread, loadThread, transcript } from "@/features/tell/lib/talk";
import { useBiz } from "@/features/shell/hooks/use-biz";
import { useSyncMeta } from "@/shared/lib/store";
import { showToast } from "@/shared/lib/toast";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { SettingsFrame } from "../components/settings-frame";

export function ChatSettings() {
  const { business } = useBiz();
  const signedIn = useSyncMeta() !== null;
  const [lines, setLines] = useState<{ text: string; reply: string }[]>([]);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    setLines(transcript(loadThread(business.id)));
    if (!signedIn) return;
    let live = true;
    accountThread().then((remote) => {
      if (!live || !remote || remote.length === 0) return;
      setLines(transcript(remote));
    });
    return () => {
      live = false;
    };
  }, [business.id, signedIn]);

  async function clear() {
    clearThread(business.id);
    if (signedIn) await clearStoredChats();
    setLines([]);
    setConfirming(false);
    showToast("Chat cleared. Saved sales stay, and so does what BizBuddy learned from notes you confirmed.");
  }

  return (
    <SettingsFrame title="Chat">
      <section className="rounded-2xl border border-stone-200 bg-white">
        <div className="border-b border-stone-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-ink">Kept for this shop</h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            Tell BizBuddy and WhatsApp chats stay with this shop, so the next note can follow how you write. Clearing the chat removes that conversation. It does not delete sales, and it does not forget notes you already saved.
          </p>
        </div>
        <div className="px-5 py-4">
          {lines.length === 0 ? (
            <p className="text-sm text-ink-muted">No chat kept on this phone yet.</p>
          ) : (
            <ol className="space-y-3">
              {lines.slice(-8).map((line, index) => (
                <li key={`${index}-${line.text}`} className="text-sm">
                  <p className="font-medium text-ink">{line.text}</p>
                  {line.reply && <p className="mt-0.5 text-ink-muted">{line.reply}</p>}
                </li>
              ))}
            </ol>
          )}
          <button type="button" onClick={() => setConfirming(true)} disabled={lines.length === 0 && !signedIn} className="mt-4 w-full rounded-xl bg-stone-100 py-2.5 text-sm font-medium text-ink hover:bg-stone-200 disabled:opacity-50">
            Clear chat
          </button>
        </div>
      </section>
      <ConfirmDialog open={confirming} title="Clear the chat?" confirmLabel="Clear chat" onConfirm={clear} onCancel={() => setConfirming(false)}>
        <p>This removes the Tell BizBuddy chat on this phone{signedIn ? " and the chat kept on the account, including WhatsApp" : ""}. Sales you saved stay.</p>
      </ConfirmDialog>
    </SettingsFrame>
  );
}
