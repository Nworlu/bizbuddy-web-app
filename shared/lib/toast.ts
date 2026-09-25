"use client";

export function showToast(message: string) {
  window.dispatchEvent(new CustomEvent("bizbuddy:toast", { detail: message }));
}
