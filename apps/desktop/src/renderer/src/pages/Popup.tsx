import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { SoundOutlined } from "@ant-design/icons";
import { Button, Input, type InputRef, Space, Tag, Typography } from "antd";
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
      <Tag color="blue">{result.sourceLang}</Tag>
      <Space align="center" style={{ margin: "8px 0" }}>
        <Typography.Paragraph style={{ margin: 0 }}>{result.sourceText}</Typography.Paragraph>
        {result.sourceLang !== "vi" && (
          <Button
            type="text"
            size="small"
            icon={<SoundOutlined />}
            onClick={() => speak(result.sourceText, result.sourceLang)}
          />
        )}
      </Space>
      <Tag color="green">{result.targetLang}</Tag>
      <Space align="center" style={{ margin: "8px 0 0" }}>
        <Typography.Paragraph strong style={{ margin: 0 }}>
          {result.targetText}
        </Typography.Paragraph>
        {result.targetLang !== "vi" && (
          <Button
            type="text"
            size="small"
            icon={<SoundOutlined />}
            onClick={() => speak(result.targetText, result.targetLang)}
          />
        )}
      </Space>
      {result.targetMeanings.length > 1 && (
        <Space size={[4, 4]} wrap style={{ marginTop: 4 }}>
          {result.targetMeanings.slice(1).map((meaning) => (
            <Tag key={meaning} color="default">
              {meaning}
            </Tag>
          ))}
        </Space>
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
  const inputRef = useRef<InputRef>(null);

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
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
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
        <Space.Compact style={{ width: "100%" }}>
          <Input
            ref={inputRef}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onPressEnter={handleSearch}
            placeholder="Tìm một từ hoặc cụm từ…"
          />
          <Button type="primary" loading={searching} onClick={handleSearch}>
            Tra từ
          </Button>
        </Space.Compact>

        {searchPreview && (
          <div style={{ marginTop: 12 }}>
            <TranslationView result={searchPreview.result} dictionary={searchPreview.dictionary} />
            <Button type="primary" block loading={saving} onClick={handleSaveSearch} style={{ marginTop: 10 }}>
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
        <Typography.Text type="secondary">Waiting for lookup…</Typography.Text>
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
