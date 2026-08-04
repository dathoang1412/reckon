import { useEffect, useState } from "react";

// Cheap local IPC round-trip (electron-store read, no network) — safe to
// call from every component that gates an AI action on a configured key,
// rather than threading a single fetch result through props.
export function useHasGroqKey(): boolean | null {
  const [hasKey, setHasKey] = useState<boolean | null>(null);

  useEffect(() => {
    window.api.settings.hasGroqApiKey().then(setHasKey);
  }, []);

  return hasKey;
}
