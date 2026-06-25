import { Workbox } from "workbox-window";

let wb: Workbox | null = null;

export function registerSW() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  if (import.meta.env.DEV) return;
  wb = new Workbox("/sw.js");
  wb.addEventListener("waiting", () => {
    void wb?.messageSkipWaiting();
  });
  void wb.register();
}
