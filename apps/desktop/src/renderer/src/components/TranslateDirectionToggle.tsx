import { useEffect, useState } from "react";
import { Segmented } from "antd";
import type { TranslateDirection } from "../../../preload/index";

// Overrides translate.ts's diacritics-based auto-detect for the next lookup
// — a diacritic-less Vietnamese word ("chao" vs "chào") or an ambiguous
// word otherwise guesses wrong. Persisted (see settings.ts) so the choice
// sticks across lookups instead of resetting to "Tự động" every time;
// surfaced right next to wherever a word gets typed in (this popup's search
// box, App.tsx's lookup box) rather than tucked away in Settings, since
// it's a per-lookup mode more than a one-time preference.
export default function TranslateDirectionToggle({ size }: { size?: "small" | "middle" }) {
  const [direction, setDirection] = useState<TranslateDirection>("auto");

  useEffect(() => {
    window.api.settings.getTranslateDirection().then(setDirection);
  }, []);

  function handleChange(value: TranslateDirection) {
    setDirection(value);
    window.api.settings.setTranslateDirection(value);
  }

  return (
    <Segmented
      size={size}
      value={direction}
      onChange={(value) => handleChange(value as TranslateDirection)}
      options={[
        { label: "Tự động", value: "auto" },
        { label: "EN→VI", value: "en-vi" },
        { label: "VI→EN", value: "vi-en" },
      ]}
    />
  );
}
