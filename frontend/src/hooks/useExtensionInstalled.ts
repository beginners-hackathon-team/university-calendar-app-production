import { useEffect, useState } from "react";

const DETECTION_TIMEOUT_MS = 1500;
const STORAGE_KEY = "ku-tasks-extension-installed";

// content script が document_idle で起動した後もリスナー登録が間に合うよう、
// 複数タイミングで ping を送る（ms）
const PING_DELAYS = [0, 200, 500, 1000];

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

    let resolved = false;

    const timeoutTimer = setTimeout(() => {
      console.log("[ku-tasks] EXTENSION_INSTALLED not received within timeout → treating as not installed");
      setState("not_installed");
    }, DETECTION_TIMEOUT_MS);

    const handler = (e: MessageEvent) => {
      if (
        e.source === window &&
        e.data?.source === "ku-tasks-extension" &&
        e.data?.type === "EXTENSION_INSTALLED"
      ) {
        if (resolved) return;
        resolved = true;
        console.log("[ku-tasks] EXTENSION_INSTALLED received → extension is active");
        clearTimeout(timeoutTimer);
        pingTimers.forEach(clearTimeout);
        try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* ignore */ }
        setState("installed");
      }
    };

    // リスナーを先に登録してから ping を送る
    window.addEventListener("message", handler);

    // content script が document_idle で起動するタイミングはページの複雑さによって変わる。
    // 0ms（即時）＋ 数回のリトライで、どちらが先に起動しても確実に応答を受け取れる。
    const pingTimers = PING_DELAYS.map((delay) =>
      setTimeout(() => {
        if (!resolved) {
          window.postMessage({ type: "KU_TASKS_PING" }, "*");
        }
      }, delay)
    );

    return () => {
      clearTimeout(timeoutTimer);
      pingTimers.forEach(clearTimeout);
      window.removeEventListener("message", handler);
    };
  }, [state]);

  return state;
}
