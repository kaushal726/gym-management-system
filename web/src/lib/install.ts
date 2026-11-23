/* Installing GymDesk on a phone's home screen. Android/Chrome offers a real install prompt (captured early, used
 * on a tap); iPhone has none, so the banner explains Share → Add to Home Screen instead. */
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "gymdesk.installDismissedAt";
/** After "Not now", the banner stays away this long. */
const DISMISS_DAYS = 14;
const DAY_MS = 86_400_000;

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

/** Call once at startup, before React renders: the browser fires the event early and only once. */
export function captureInstallPrompt(): void {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}

export function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isPhone(): boolean {
  return window.matchMedia("(pointer: coarse)").matches && window.matchMedia("(max-width: 1023px)").matches;
}

function dismissedRecently(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    return Date.now() - at < DISMISS_DAYS * DAY_MS;
  } catch {
    return false;
  }
}

export function dismissInstall(): void {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* Storage blocked: the banner simply comes back next time. */
  }
}

export type InstallMode = "prompt" | "ios" | null;

/** Which install help to show right now, if any. */
export function useInstallMode(): InstallMode {
  const [, setTick] = useState(0);
  useEffect(() => {
    const update = () => setTick((t) => t + 1);
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);
  if (isStandalone() || !isPhone() || dismissedRecently()) return null;
  if (deferred) return "prompt";
  return isIos() ? "ios" : null;
}

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const event = deferred;
  await event.prompt();
  const choice = await event.userChoice;
  deferred = null;
  listeners.forEach((l) => l());
  return choice.outcome === "accepted";
}
