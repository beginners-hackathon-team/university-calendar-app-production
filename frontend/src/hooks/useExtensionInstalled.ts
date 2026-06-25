import { useEffect, useState } from "react";

const DETECTION_TIMEOUT_MS = 1500;
const STORAGE_KEY = "ku-calendar-extension-installed";

export type ExtensionInstalledState = "checking" | "installed" | "not_installed";

function getInitialState(): ExtensionInstalledState {
  try {
    if (localStorage.getItem(STORAGE_KEY) === "1") return "installed";
  } catch {
    // localStorage unavailable
  }
  return "checking";
}

export function useExtensionInstalled(): ExtensionInstalledState {
  const [state, setState] = useState<ExtensionInstalledState>(getInitialState);

  useEffect(() => {
    if (state === "installed") return;

    const timer = setTimeout(() => {
      console.log("[ku-calendar] EXTENSION_INSTALLED not received within timeout → treating as not installed");
      setState("not_installed");
    }, DETECTION_TIMEOUT_MS);

    const handler = (e: MessageEvent) => {
      if (
        e.source === window &&
        e.data?.source === "ku-calendar-extension" &&
        e.data?.type === "EXTENSION_INSTALLED"
      ) {
        console.log("[ku-calendar] EXTENSION_INSTALLED received → extension is active");
        clearTimeout(timer);
        try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* ignore */ }
        setState("installed");
      }
    };

    window.addEventListener("message", handler);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("message", handler);
    };
  }, [state]);

  return state;
}
