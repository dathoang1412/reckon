import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import toast from "react-hot-toast";
import type { DictionaryInfo, TranslationResultData, TranslationResultPayload, VocabPreview } from "../../../preload/index";
import DictionaryPanel from "../components/DictionaryPanel";
import { speak } from "../lib/speak";

// Shared by both popup modes: a pre-fetched selection lookup (payload) and a
// manually typed search (searchPreview) render their translation the same
// way, just wrapped by different surrounding chrome (see below).
function TranslationView({ result, dictionary }: { result: TranslationResultData; dictionary: DictionaryInfo | null }) {
  return (
    <>
      <Chip label={result.sourceLang} color="primary" size="small" />
      <Stack direction="row" sx={{ alignItems: "center", margin: "8px 0" }}>
        <Typography sx={{ margin: 0 }}>{result.sourceText}</Typography>
        {result.sourceLang !== "vi" && (
          <IconButton size="small" onClick={() => speak(result.sourceText, result.sourceLang)}>
            <VolumeUpIcon fontSize="small" />
          </IconButton>
        )}
      </Stack>
      <Chip label={result.targetLang} color="success" size="small" />
      <Stack direction="row" sx={{ alignItems: "center", margin: "8px 0 0" }}>
        <Typography sx={{ margin: 0, fontWeight: 600 }}>{result.targetText}</Typography>
        {result.targetLang !== "vi" && (
          <IconButton size="small" onClick={() => speak(result.targetText, result.targetLang)}>
            <VolumeUpIcon fontSize="small" />
          </IconButton>
        )}
      </Stack>
      {result.targetMeanings.length > 1 && (
        <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", marginTop: "4px" }}>
          {result.targetMeanings.slice(1).map((meaning) => (
            <Chip key={meaning} label={meaning} size="small" variant="outlined" />
          ))}
        </Stack>
      )}

      {dictionary && <DictionaryPanel dictionary={dictionary} />}
    </>
  );
}

export default function Popup() {
  const [payload, setPayload] = useState<TranslationResultPayload | null>(null);

  // Search mode: opened via the empty-popup hotkey (no pre-fetched result),
  // the user types a word themselves instead of it coming from a selection.
  const [searchMode, setSearchMode] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchPreview, setSearchPreview] = useState<VocabPreview | null>(null);
  const [saving, setSaving] = useState(false);

  // Bumped on every popup:openSearch event, even if the mode/text/preview
  // state it resets to is identical to what's already there (e.g. the
  // hotkey fired twice in a row with nothing typed in between) — without
  // this, React sees no state change, skips the re-render, and the resize
  // effect below (the only thing that re-shows the window; see popup.ts's
  // hide-then-wait-for-resize reuse path) never re-runs, leaving the popup
  // stuck hidden after the second press.
  const [searchOpenSeq, setSearchOpenSeq] = useState(0);

  const contentRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    window.api.onTranslationResult((data) => {
      setSearchMode(false);
      setPayload(data);
    });
    window.api.onOpenSearchPopup(() => {
      setPayload(null);
      setSearchText("");
      setSearchPreview(null);
      setSearchMode(true);
      setSearchOpenSeq((n) => n + 1);
    });
  }, []);

  // Autofocus the instant the input actually mounts (search mode just
  // turned on), not on some later render — there's no other way for the
  // user to start typing since this window never had keyboard focus before.
  useEffect(() => {
    if (searchMode) inputRef.current?.focus();
  }, [searchMode, searchOpenSeq]);

  // Escape dismisses either popup mode. The window already hides on blur,
  // but a keyboard-only escape hatch matters here specifically because it's
  // a keyboard-triggered popup in the first place.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") window.api.popup.hide();
    }
    window.addEventListener("keydown", onKeyDown as unknown as EventListener);
    return () => window.removeEventListener("keydown", onKeyDown as unknown as EventListener);
  }, []);

  // Reports the content's actual rendered size to the main process once,
  // which resizes/repositions (and only then shows) the window to fit — a
  // fixed window size either wastes space with no dictionary data or clips
  // a long one. Deliberately one-shot, not a live ResizeObserver: the
  // content is `width: fit-content`, so its size depends on the window's
  // current viewport — reacting to every size change would mean our own
  // resize triggers another measurement, feeding back into itself. A
  // single post-layout measurement per state change is enough since each
  // one already carries all the data it'll ever show (nothing arrives
  // after the fact).
  //
  // Must be useLayoutEffect (synchronous, no requestAnimationFrame): the
  // window is hidden between lookups (see popup.ts), and Chromium pauses
  // rAF for hidden/occluded windows — a second lookup's rAF callback would
  // simply never fire, so the resize (and the show() it triggers) would
  // never happen and the popup would stay hidden forever after the first.
  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    window.api.popup.resize({ width: el.scrollWidth, height: el.scrollHeight });
  }, [payload, searchMode, searchPreview, searchOpenSeq]);

  async function handleSearch() {
    const text = searchText.trim();
    if (!text) return;
    setSearching(true);
    setSearchPreview(null);
    try {
      setSearchPreview(await window.api.vocab.preview(text));
    } catch (err) {
      toast.error(`Tra từ thất bại: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSearching(false);
    }
  }

  function handleSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleSearch();
  }

  async function handleSaveSearch() {
    if (!searchPreview) return;
    setSaving(true);
    try {
      await window.api.vocab.save(searchPreview.result);
      toast.success("Đã lưu");
      window.api.popup.hide();
    } catch (err) {
      toast.error(`Lưu thất bại: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  if (searchMode) {
    return (
      <div
        ref={contentRef}
        className="fade-in"
        style={{
          padding: 16,
          fontFamily: "system-ui, sans-serif",
          width: 380,
          maxHeight: "80vh",
          overflowY: "auto",
        }}
      >
        <Stack direction="row" sx={{ width: "100%" }}>
          <TextField
            inputRef={inputRef}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Tìm một từ hoặc cụm từ…"
            size="small"
            fullWidth
            sx={{ "& .MuiOutlinedInput-root": { borderTopRightRadius: 0, borderBottomRightRadius: 0 } }}
          />
          <Button
            variant="contained"
            loading={searching}
            onClick={handleSearch}
            sx={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, flexShrink: 0 }}
          >
            Tra từ
          </Button>
        </Stack>

        {searchPreview && (
          <div style={{ marginTop: 12 }}>
            <TranslationView result={searchPreview.result} dictionary={searchPreview.dictionary} />
            <Button variant="contained" fullWidth loading={saving} onClick={handleSaveSearch} sx={{ marginTop: "10px" }}>
              Lưu
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (!payload) {
    return (
      <div style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
        <Typography color="text.secondary">Waiting for lookup…</Typography>
      </div>
    );
  }

  return (
    <div
      ref={contentRef}
      className="fade-in"
      style={{
        padding: 16,
        fontFamily: "system-ui, sans-serif",
        width: "fit-content",
        maxWidth: 420,
        maxHeight: "80vh",
        overflowY: "auto",
      }}
    >
      <TranslationView result={payload.result} dictionary={payload.dictionary} />
    </div>
  );
}
