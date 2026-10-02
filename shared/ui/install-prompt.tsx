"use client";

import { useEffect, useRef, useState } from "react";
import { INSTALL_DISMISS_KEY, installGuide, runningAsApp, type InstallGuide } from "./install-guide";

type InstallEvent = Event & { prompt: () => Promise<void> };

const BODY = "The website needs internet to open. The home screen app is what opens later with no internet. What you record stays on this phone.";

export function InstallPrompt() {
  const [guide, setGuide] = useState<InstallGuide | null>(null);
  const promptEvent = useRef<InstallEvent | null>(null);

  useEffect(() => {
    if (runningAsApp()) return;
    try {
      if (localStorage.getItem(INSTALL_DISMISS_KEY)) return;
    } catch {
      // A blocked store still shows the prompt. Dismissing it just won't stick.
    }
    const onPrompt = (event: Event) => {
      event.preventDefault();
      promptEvent.current = event as InstallEvent;
      setGuide("button");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    setGuide(installGuide({ ios: isiPhone(), canPrompt: false }));
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!guide) return null;

  async function add() {
    const event = promptEvent.current;
    if (!event) return;
    await event.prompt();
    hide();
  }

  function hide() {
    try {
      localStorage.setItem(INSTALL_DISMISS_KEY, "1");
    } catch {
      // Closing it for this visit is enough.
    }
    setGuide(null);
  }

  return (
    <div className="border-b border-brand-200 bg-brand-50 px-4 py-3 text-sm text-ink md:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p>
          <span className="font-semibold">Add BizBuddy to your home screen.</span> {BODY}
          {guide === "ios" && " On iPhone, tap Share, then Add to Home Screen."}
          {guide === "browser" && " On Android, open this page in Chrome and use Add to Home screen. On iPhone, tap Share, then Add to Home Screen."}
        </p>
        <div className="flex shrink-0 items-center gap-3">
          {guide === "button" && (
            <button type="button" onClick={add} className="rounded-lg bg-brand-700 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-800">
              Add to home screen
            </button>
          )}
          <button type="button" onClick={hide} className="text-sm font-semibold text-brand-700 hover:text-brand-800">
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}

function isiPhone(): boolean {
  if (/iPhone|iPad|iPod/.test(navigator.userAgent)) return true;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}
