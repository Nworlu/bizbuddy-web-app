/** How to tell someone to put BizBuddy on the home screen. The website itself needs internet. */

export const INSTALL_DISMISS_KEY = "bizbuddy:hide-install";

export type InstallGuide = "button" | "ios" | "browser";

export function installGuide(input: { ios: boolean; canPrompt: boolean }): InstallGuide {
  if (input.canPrompt) return "button";
  if (input.ios) return "ios";
  return "browser";
}

/** True when BizBuddy was opened from the home screen, not from a browser tab. */
export function runningAsApp(): boolean {
  const ios = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || ios.standalone === true;
}
