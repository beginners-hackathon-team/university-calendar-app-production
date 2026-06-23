import { useEffect, useState } from "react";

const DETECTION_TIMEOUT_MS = 1500;

export function useExtensionInstalled(): boolean | null {
  const [installed, setInstalled] = useState<boolean | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      console.log("[ku-calendar] EXTENSION_INSTALLED not received within timeout → treating as not installed");
      setInstalled(false);
    }, DETECTION_TIMEOUT_MS);

    const handler = (e: MessageEvent) => {
      if (
        e.data?.source === "ku-calendar-extension" &&
        e.data?.type === "EXTENSION_INSTALLED"
      ) {
        console.log("[ku-calendar] EXTENSION_INSTALLED received → extension is active");
        clearTimeout(timer);
        setInstalled(true);
      }
    };

    window.addEventListener("message", handler);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("message", handler);
    };
  }, []);

  return installed;
}
