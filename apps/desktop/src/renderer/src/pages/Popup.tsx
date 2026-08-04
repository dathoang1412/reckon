import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  ApartmentOutlined,
  DiffOutlined,
  FileTextOutlined,
  MessageOutlined,
  RedoOutlined,
  SoundOutlined,
  ThunderboltOutlined,
  TranslationOutlined,
} from "@ant-design/icons";
import { Button, Input, type InputRef, Select, Space, Spin, Tag, Tooltip, Typography } from "antd";
import toast from "react-hot-toast";
import type {
  AiExample,
  AiRelatedWords,
  DictionaryInfo,
  TranslationResultData,
  VocabEntryPatch,
  VocabEntryRow,
  VocabSetRow,
} from "../../../preload/index";
import DictionaryPanel from "../components/DictionaryPanel";
import WordChat from "../components/WordChat";
import { speak } from "../lib/speak";
import { COLOR_PRIMARY, styleTokens } from "../theme";

// Mirrors App.tsx's UNASSIGNED sentinel — antd's Select needs a real string
// value for "no set chosen", it can't use null/undefined as an option value.
const UNASSIGNED = "__unassigned__";

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// Normalizes the two ways a word ends up in this popup — already saved
// (selection hotkey with auto-save on, or a VocabDetailModal-style entry)
// vs. just previewed (auto-save off, or a manually typed search) — into
// one shape the rest of the component works with. id is the only thing
// that tells the two apart: null means "not saved yet, AI tabs work on
// ad-hoc text via the ai:preview* channels and a Lưu button appears".
interface DisplayEntry {
  id: string | null;
  sourceText: string;
  sourceLang: string;
  targetText: string;
  targetMeanings: string[];
  targetLang: string;
  aiExamples: AiExample[];
  aiNuance: string | null;
  aiRelatedWords: AiRelatedWords | null;
}

function fromVocabEntryRow(row: VocabEntryRow): DisplayEntry {
  return {
    id: row.id,
    sourceText: row.sourceText,
    sourceLang: row.sourceLang,
    targetText: row.targetText,
    targetMeanings: row.targetMeanings,
    targetLang: row.targetLang,
    aiExamples: row.aiExamples,
    aiNuance: row.aiNuance,
    aiRelatedWords: row.aiRelatedWords,
  };
}

function fromPreview(data: TranslationResultData): DisplayEntry {
  return {
    id: null,
    sourceText: data.sourceText,
    sourceLang: data.sourceLang,
    targetText: data.targetText,
    targetMeanings: data.targetMeanings,
    targetLang: data.targetLang,
    aiExamples: [],
    aiNuance: null,
    aiRelatedWords: null,
  };
}

// A flat pixel cap — NOT "80vh", which is relative to this popup's *own
// current* window height. Since that height is itself set from a
// measurement of this content, "80vh" creates a feedback loop: a smaller
// window shrinks the cap, which clips more content into the inner scroll
// area, which under-measures the true height needed, which requests an
// even smaller window next time — the popup ratchets down to a sliver
// over a couple of tab switches. A fixed number has nothing to feed back
// into, regardless of screen size or the window's current state. Used as a
// fixed `height` (not `maxHeight`) on the tab content below so every tab
// measures the same, and switching tabs never jumps the window's height.
const MAX_CONTENT_HEIGHT = 288;

type TabKey = "dict" | "examples" | "nuance" | "related" | "chat";
type AiFeature = "examples" | "nuance" | "related";

const TAB_DEFS: { key: TabKey; icon: ReactNode; label: string }[] = [
  { key: "dict", icon: <TranslationOutlined />, label: "Dịch & từ điển" },
  { key: "examples", icon: <FileTextOutlined />, label: "Ví dụ câu" },
  { key: "nuance", icon: <DiffOutlined />, label: "Sắc thái & ngữ cảnh" },
  { key: "related", icon: <ApartmentOutlined />, label: "Từ liên quan" },
  { key: "chat", icon: <MessageOutlined />, label: "Hỏi AI" },
];

// Compact icon-only tab bar (matching a dictionary-extension-style header)
// — hand-rolled rather than antd's Tabs, which fights back on a colored,
// icon-only, evenly-spaced bar like this one.
function TabBar({ active, onChange }: { active: TabKey; onChange: (key: TabKey) => void }) {
  return (
    <div style={{ display: "flex", background: COLOR_PRIMARY, flexShrink: 0 }}>
      {TAB_DEFS.map((tab) => (
        <Tooltip key={tab.key} title={tab.label} mouseEnterDelay={0.3}>
          <button
            onClick={() => onChange(tab.key)}
            style={{
              flex: 1,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              padding: "10px 0",
              border: "none",
              cursor: "pointer",
              background: active === tab.key ? "rgba(255,255,255,0.22)" : "transparent",
              color: "#fff",
              fontSize: 16,
              lineHeight: 1,
            }}
          >
            {tab.icon}
          </button>
        </Tooltip>
      ))}
    </div>
  );
}

function TranslationTab({
  entry,
  dictionary,
  spellingSuggestion,
  onUseSuggestion,
}: {
  entry: DisplayEntry;
  dictionary: DictionaryInfo | null;
  spellingSuggestion: string | null;
  onUseSuggestion: (suggestion: string) => void;
}) {
  return (
    <>
      {spellingSuggestion && (
        <Typography.Paragraph type="secondary" style={{ margin: "0 0 8px" }}>
          Ý bạn là:{" "}
          <Typography.Link onClick={() => onUseSuggestion(spellingSuggestion)}>{spellingSuggestion}</Typography.Link>?
        </Typography.Paragraph>
      )}
      <Tag color="blue">{entry.sourceLang}</Tag>
      <Space align="center" style={{ margin: "8px 0" }}>
        <Typography.Paragraph style={{ margin: 0 }}>{entry.sourceText}</Typography.Paragraph>
        {entry.sourceLang !== "vi" && (
          <Button
            type="text"
            size="small"
            icon={<SoundOutlined />}
            onClick={() => speak(entry.sourceText, entry.sourceLang)}
          />
        )}
      </Space>
      <Tag color="green">{entry.targetLang}</Tag>
      <Space align="center" style={{ margin: "8px 0 0" }}>
        <Typography.Paragraph strong style={{ margin: 0 }}>
          {entry.targetText}
        </Typography.Paragraph>
        {entry.targetLang !== "vi" && (
          <Button
            type="text"
            size="small"
            icon={<SoundOutlined />}
            onClick={() => speak(entry.targetText, entry.targetLang)}
          />
        )}
      </Space>
      {entry.targetMeanings.length > 1 && (
        <Space size={[4, 4]} wrap style={{ marginTop: 4 }}>
          {entry.targetMeanings.slice(1).map((meaning) => (
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

// Shared chrome for the four AI tabs — empty/generate button, loading,
// error+retry, or the generated content plus a "Tạo lại" link.
function AiTabPanel({
  hasContent,
  loading,
  error,
  disabledReason,
  onGenerate,
  children,
}: {
  hasContent: boolean;
  loading: boolean;
  error: string | null;
  disabledReason?: string | null;
  onGenerate: () => void;
  children: ReactNode;
}) {
  if (disabledReason) {
    return <Typography.Text type="secondary">{disabledReason}</Typography.Text>;
  }
  if (loading) {
    return <Spin size="small" />;
  }
  if (error) {
    return (
      <Space direction="vertical" size={8}>
        <Typography.Text type="danger">{error}</Typography.Text>
        <Button size="small" onClick={onGenerate}>
          Thử lại
        </Button>
      </Space>
    );
  }
  if (hasContent) {
    return (
      <div>
        {children}
        <Button type="link" size="small" icon={<RedoOutlined />} onClick={onGenerate} style={{ paddingLeft: 0 }}>
          Tạo lại
        </Button>
      </div>
    );
  }
  return (
    <Button type="primary" ghost icon={<ThunderboltOutlined />} onClick={onGenerate}>
      Tạo với AI
    </Button>
  );
}

export default function Popup() {
  const [entry, setEntry] = useState<DisplayEntry | null>(null);
  const [dictionary, setDictionary] = useState<DictionaryInfo | null>(null);
  const [spellingSuggestion, setSpellingSuggestion] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("dict");
  const [saving, setSaving] = useState(false);
  const [sets, setSets] = useState<VocabSetRow[]>([]);
  const [selectedSetId, setSelectedSetId] = useState(UNASSIGNED);

  const [aiStatus, setAiStatus] = useState<Record<AiFeature, { loading: boolean; error: string | null }>>({
    examples: { loading: false, error: null },
    nuance: { loading: false, error: null },
    related: { loading: false, error: null },
  });

  // Search mode: opened via the empty-popup hotkey (no pre-fetched result),
  // the user types a word themselves instead of it coming from a selection.
  const [searchMode, setSearchMode] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [searching, setSearching] = useState(false);

  // Bumped on every popup:openSearch event, even if the mode/text/entry
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
    window.api.vocabSet.list().then(setSets);
    window.api.onTranslationResult((data) => {
      setSearchMode(false);
      setDictionary(data.dictionary);
      setEntry(fromVocabEntryRow(data.result));
      setSpellingSuggestion(null);
      setActiveTab("dict");
    });
    window.api.onTranslationPreview((data) => {
      setSearchMode(false);
      setDictionary(data.dictionary);
      setEntry(fromPreview(data.result));
      setSpellingSuggestion(data.spellingSuggestion);
      setActiveTab("dict");
      setSelectedSetId(UNASSIGNED);
    });
    window.api.onOpenSearchPopup(() => {
      setEntry(null);
      setDictionary(null);
      setSpellingSuggestion(null);
      setSearchText("");
      setActiveTab("dict");
      setSelectedSetId(UNASSIGNED);
      setSearchMode(true);
      setSearchOpenSeq((n) => n + 1);
    });
  }, []);

  // Autofocus the instant the input actually mounts (search mode just
  // turned on), not on some later render — there's no other way for the
  // user to start typing since this window never had keyboard focus before.
  useEffect(() => {
    if (searchMode && !entry) inputRef.current?.focus();
  }, [searchMode, entry, searchOpenSeq]);

  // Escape dismisses the popup. The window already hides on blur, but a
  // keyboard-only escape hatch matters here specifically because it's a
  // keyboard-triggered popup in the first place.
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
  // after the fact) — aiStatus is included so a tab's loading spinner or
  // freshly generated content also gets measured.
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
  }, [entry, dictionary, spellingSuggestion, searchMode, searchOpenSeq, activeTab, aiStatus]);

  async function runPreview(text: string) {
    setSearching(true);
    try {
      const preview = await window.api.vocab.preview(text);
      setDictionary(preview.dictionary);
      setEntry(fromPreview(preview.result));
      setSpellingSuggestion(preview.spellingSuggestion);
      setActiveTab("dict");
      setSelectedSetId(UNASSIGNED);
    } catch (err) {
      toast.error(`Tra từ thất bại: ${errorMessage(err)}`);
    } finally {
      setSearching(false);
    }
  }

  async function handleSearch() {
    const text = searchText.trim();
    if (!text) return;
    await runPreview(text);
  }

  // "Ý bạn là ...?" — re-runs the lookup with Google's spelling correction
  // instead of what was actually searched/selected (see spellingSuggestion).
  async function handleUseSpellingSuggestion(suggestion: string) {
    setSearchText(suggestion);
    await runPreview(suggestion);
  }

  async function handleSave() {
    if (!entry || entry.id) return;
    setSaving(true);
    try {
      let finalRow = await window.api.vocab.save({
        sourceText: entry.sourceText,
        sourceLang: entry.sourceLang,
        targetText: entry.targetText,
        targetMeanings: entry.targetMeanings,
        targetLang: entry.targetLang,
      });
      if (selectedSetId !== UNASSIGNED) {
        finalRow = await window.api.vocab.setSet(finalRow.id, selectedSetId);
      }
      // Carry over whatever AI content the tabs already generated while
      // this was still just a preview — otherwise saving would silently
      // throw away Groq calls the user already paid the latency for.
      const patch: VocabEntryPatch = {};
      if (entry.aiExamples.length > 0) patch.aiExamples = entry.aiExamples;
      if (entry.aiNuance) patch.aiNuance = entry.aiNuance;
      if (entry.aiRelatedWords) patch.aiRelatedWords = entry.aiRelatedWords;
      if (Object.keys(patch).length > 0) finalRow = await window.api.vocab.update(finalRow.id, patch);
      setEntry(fromVocabEntryRow(finalRow));
      toast.success("Đã lưu");
    } catch (err) {
      toast.error(`Lưu thất bại: ${errorMessage(err)}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerate(feature: AiFeature) {
    if (!entry) return;
    setAiStatus((prev) => ({ ...prev, [feature]: { loading: true, error: null } }));
    try {
      if (entry.id) {
        const id = entry.id;
        const updated = await (feature === "examples"
          ? window.api.ai.generateExamples(id)
          : feature === "nuance"
            ? window.api.ai.explainNuance(id)
            : window.api.ai.suggestRelatedWords(id));
        setEntry(fromVocabEntryRow(updated));
      } else if (feature === "examples") {
        const aiExamples = await window.api.ai.previewExamples(entry.sourceText, entry.targetMeanings);
        setEntry((prev) => prev && { ...prev, aiExamples });
      } else if (feature === "nuance") {
        const aiNuance = await window.api.ai.previewNuance(entry.sourceText, entry.targetMeanings);
        setEntry((prev) => prev && { ...prev, aiNuance });
      } else {
        const aiRelatedWords = await window.api.ai.previewRelatedWords(
          entry.sourceText,
          entry.sourceLang,
          entry.targetText,
          entry.targetLang,
        );
        setEntry((prev) => prev && { ...prev, aiRelatedWords });
      }
      setAiStatus((prev) => ({ ...prev, [feature]: { loading: false, error: null } }));
    } catch (err) {
      setAiStatus((prev) => ({ ...prev, [feature]: { loading: false, error: errorMessage(err) } }));
    }
  }

  // Switching to an AI tab generates automatically instead of waiting for
  // the "Tạo với AI" button — but only the first time: skipped once there's
  // already content, a request in flight, or a past error (that still needs
  // an explicit "Thử lại" so a bad key/network blip doesn't retry-loop every
  // time the user tabs back to it).
  useEffect(() => {
    if (!entry) return;
    if (activeTab !== "examples" && activeTab !== "nuance" && activeTab !== "related") return;
    if (activeTab === "related" && entry.sourceLang !== "en" && entry.targetLang !== "en") return;

    const hasContent =
      activeTab === "examples"
        ? entry.aiExamples.length > 0
        : activeTab === "nuance"
          ? !!entry.aiNuance
          : !!entry.aiRelatedWords;
    const status = aiStatus[activeTab];
    if (hasContent || status.loading || status.error) return;

    handleGenerate(activeTab);
  }, [activeTab, entry, aiStatus]);

  const isEnglishPair = !!entry && (entry.sourceLang === "en" || entry.targetLang === "en");

  return (
    <div
      ref={contentRef}
      className="fade-in"
      style={{
        fontFamily: "system-ui, sans-serif",
        width: entry ? 320 : 304,
        maxWidth: 336,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {searchMode && !entry && (
        <div style={{ padding: 16 }}>
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
        </div>
      )}

      {entry && (
        <>
          <TabBar active={activeTab} onChange={setActiveTab} />
          {/* Fixed height, not maxHeight — a cap alone still lets the window
              shrink-then-regrow (a visible jump/"giật") as you switch
              between a short tab and a long one, since each tab's natural
              content height differs. Locking this to one constant number
              means every tab measures (and resizes the window to) the exact
              same height, so switching tabs never moves the window edge. */}
          <div style={{ padding: 16, overflowY: "auto", height: MAX_CONTENT_HEIGHT }}>
            {activeTab === "dict" && (
              <TranslationTab
                entry={entry}
                dictionary={dictionary}
                spellingSuggestion={spellingSuggestion}
                onUseSuggestion={handleUseSpellingSuggestion}
              />
            )}

            {activeTab === "examples" && (
              <AiTabPanel
                hasContent={entry.aiExamples.length > 0}
                loading={aiStatus.examples.loading}
                error={aiStatus.examples.error}
                onGenerate={() => handleGenerate("examples")}
              >
                <Space direction="vertical" size={8} style={{ width: "100%", marginBottom: 8 }}>
                  {entry.aiExamples.map((ex, i) => (
                    <div key={i}>
                      <Typography.Text>{ex.sentence}</Typography.Text>
                      <Typography.Text type="secondary" italic style={{ display: "block", fontSize: 12 }}>
                        {ex.translation}
                      </Typography.Text>
                    </div>
                  ))}
                </Space>
              </AiTabPanel>
            )}

            {activeTab === "nuance" && (
              <AiTabPanel
                hasContent={!!entry.aiNuance}
                loading={aiStatus.nuance.loading}
                error={aiStatus.nuance.error}
                onGenerate={() => handleGenerate("nuance")}
              >
                <Typography.Paragraph style={{ margin: 0, marginBottom: 8 }}>{entry.aiNuance}</Typography.Paragraph>
              </AiTabPanel>
            )}

            {activeTab === "related" && (
              <AiTabPanel
                hasContent={!!entry.aiRelatedWords}
                loading={aiStatus.related.loading}
                error={aiStatus.related.error}
                disabledReason={isEnglishPair ? null : "Chỉ hỗ trợ cho từ tiếng Anh"}
                onGenerate={() => handleGenerate("related")}
              >
                {entry.aiRelatedWords && (
                  <Space direction="vertical" size={6} style={{ width: "100%", marginBottom: 8 }}>
                    {entry.aiRelatedWords.synonyms.length > 0 && (
                      <div>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          Đồng nghĩa
                        </Typography.Text>
                        <div>
                          {entry.aiRelatedWords.synonyms.map((w) => (
                            <Tag key={w}>{w}</Tag>
                          ))}
                        </div>
                      </div>
                    )}
                    {entry.aiRelatedWords.antonyms.length > 0 && (
                      <div>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          Trái nghĩa
                        </Typography.Text>
                        <div>
                          {entry.aiRelatedWords.antonyms.map((w) => (
                            <Tag key={w} color="default">
                              {w}
                            </Tag>
                          ))}
                        </div>
                      </div>
                    )}
                    {entry.aiRelatedWords.forms.length > 0 && (
                      <div>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          Dạng từ khác
                        </Typography.Text>
                        <div>
                          {entry.aiRelatedWords.forms.map((f, i) => (
                            <Tag key={i} color="blue">
                              {f.word} <Typography.Text type="secondary">({f.pos})</Typography.Text>
                            </Tag>
                          ))}
                        </div>
                      </div>
                    )}
                  </Space>
                )}
              </AiTabPanel>
            )}

            {activeTab === "chat" && (
              <WordChat
                sourceText={entry.sourceText}
                sourceLang={entry.sourceLang}
                targetText={entry.targetText}
                targetLang={entry.targetLang}
                targetMeanings={entry.targetMeanings}
                height="100%"
              />
            )}
          </div>

          {!entry.id && (
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
                gap: 8,
                padding: "10px 16px",
                borderTop: `1px solid ${styleTokens.borderColorLight}`,
                flexShrink: 0,
              }}
            >
              <Select
                size="small"
                value={selectedSetId}
                onChange={setSelectedSetId}
                style={{ minWidth: 140 }}
                options={[
                  { value: UNASSIGNED, label: "Không phân loại" },
                  ...sets.map((s) => ({ value: s.id, label: s.name })),
                ]}
              />
              <Button type="primary" size="small" loading={saving} onClick={handleSave}>
                Lưu
              </Button>
            </div>
          )}
        </>
      )}

      {!searchMode && !entry && (
        <div style={{ padding: 16 }}>
          <Typography.Text type="secondary">Waiting for lookup…</Typography.Text>
        </div>
      )}
    </div>
  );
}
