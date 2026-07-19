/** Product vs showcase (demo) mode. Demo is opt-in only. */

const DEMO_KEY = "circle_demo_mode";

export function isDemoMode(): boolean {
  if (typeof window === "undefined") return false;
  const q = new URLSearchParams(window.location.search);
  if (q.get("demo") === "1" || q.get("demo") === "true") return true;
  if (q.get("product") === "1") return false;
  try {
    return window.localStorage.getItem(DEMO_KEY) === "1";
  } catch {
    return false;
  }
}

export function enableDemoMode(): void {
  try {
    window.localStorage.setItem(DEMO_KEY, "1");
  } catch {
    /* ignore */
  }
  const url = new URL(window.location.href);
  url.searchParams.set("demo", "1");
  window.history.replaceState({}, "", url.toString());
}

export function disableDemoMode(): void {
  try {
    window.localStorage.removeItem(DEMO_KEY);
  } catch {
    /* ignore */
  }
  const url = new URL(window.location.href);
  url.searchParams.delete("demo");
  window.history.replaceState({}, "", url.toString());
}
