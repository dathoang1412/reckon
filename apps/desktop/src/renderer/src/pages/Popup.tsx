import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type UIEvent } from "react";
import {
  ApartmentOutlined,
  DeleteOutlined,
  DiffOutlined,
  FileTextOutlined,
  MessageOutlined,
  PictureOutlined,
  RedoOutlined,
  SoundOutlined,
  ThunderboltOutlined,
  TranslationOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import { Button, Input, type InputRef, Select, Space, Spin, Tag, Tooltip, Typography } from "antd";
import toast from "react-hot-toast";
import type {
  AiExample,
  AiRelatedWords,
  DictionaryInfo,
  GrammarCheckResult,
  ImageCandidate,
  TranslationResultData,
  VocabEntryPatch,
  VocabEntryRow,
  VocabSetRow,
} from "../../../preload/index";
import DefinitionChooser, { firstDictionaryDefinition } from "../components/DefinitionChooser";
import DictionaryPanel from "../components/DictionaryPanel";
import ErrorBoundary from "../components/ErrorBoundary";
import TranslateDirectionToggle from "../components/TranslateDirectionToggle";
import WordChat from "../components/WordChat";
import { safeForms } from "../lib/aiRelatedWords";
import { speak } from "../lib/speak";
import { useHasGroqKey } from "../lib/useHasGroqKey";
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
  // null for a not-yet-saved preview (see id above) — there's nowhere to
  // persist a note/definition/image until the word has a row of its own.
  note: string | null;
  definition: string | null;
  imageUrl: string | null;
  imageCredit: string | null;
  imageCreditUrl: string | null;
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
    note: row.note,
    definition: row.definition,
    imageUrl: row.imageUrl,
    imageCredit: row.imageCredit,
    imageCreditUrl: row.imageCreditUrl,
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
    note: null,
    definition: null,
    imageUrl: null,
    imageCredit: null,
    imageCreditUrl: null,
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
// See browseRenderLimit above.
const BROWSE_RENDER_BATCH_SIZE = 50;

type TabKey = "dict" | "examples" | "nuance" | "related" | "chat" | "browse";
type AiFeature = "examples" | "nuance" | "related";

const TAB_DEFS: { key: TabKey; icon: ReactNode; label: string }[] = [
  { key: "dict", icon: <TranslationOutlined />, label: "Dịch & từ điển" },
  { key: "examples", icon: <FileTextOutlined />, label: "Ví dụ câu" },
  { key: "nuance", icon: <DiffOutlined />, label: "Khi nào dùng" },
  { key: "related", icon: <ApartmentOutlined />, label: "Từ liên quan" },
  { key: "chat", icon: <MessageOutlined />, label: "Hỏi AI" },
  // Browsing the saved list, not looking a specific word up — "dict" (the
  // default tab) stays the entry point for a fresh lookup/search; this is
  // for navigating to a word you already have without leaving the popup.
  { key: "browse", icon: <UnorderedListOutlined />, label: "Danh sách từ đã lưu" },
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
  note,
  definition,
  onNoteChange,
  onDefinitionChange,
  savingNote,
  onSaveNote,
  aiDefinition,
  aiDefinitionState,
  onGenerateAiDefinition,
  imageUrl,
  imageCredit,
  imageCreditUrl,
  imageSearching,
  imageCandidates,
  onImageUrlChange,
  onSearchImages,
  onPickImage,
  onClearImage,
}: {
  entry: DisplayEntry;
  dictionary: DictionaryInfo | null;
  spellingSuggestion: string | null;
  onUseSuggestion: (suggestion: string) => void;
  note: string;
  definition: string;
  onNoteChange: (value: string) => void;
  onDefinitionChange: (value: string) => void;
  savingNote: boolean;
  onSaveNote: () => void;
  aiDefinition: string | null;
  aiDefinitionState: { loading: boolean; error: string | null };
  onGenerateAiDefinition: () => void;
  imageUrl: string;
  imageCredit: string | null;
  imageCreditUrl: string | null;
  imageSearching: boolean;
  imageCandidates: ImageCandidate[] | null;
  onImageUrlChange: (value: string) => void;
  onSearchImages: () => void;
  onPickImage: (candidate: ImageCandidate) => void;
  onClearImage: () => void;
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

      <DefinitionChooser
        dictionaryDefinition={firstDictionaryDefinition(dictionary)}
        aiDefinition={aiDefinition}
        aiLoading={aiDefinitionState.loading}
        aiError={aiDefinitionState.error}
        onGenerateAi={onGenerateAiDefinition}
        selectedText={definition}
        onSelect={onDefinitionChange}
      />

      {/* Available regardless of entry.id, same as DefinitionChooser above —
          for a not-yet-saved preview, the picked image rides along in the
          patch handleSave() applies right after saving (mirrors how
          `definition` already gets carried over there). */}
      <div style={{ marginTop: 16, borderTop: `1px solid ${styleTokens.borderColorLight}`, paddingTop: 12 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Typography.Text strong>Ảnh minh họa</Typography.Text>
          <Button type="link" size="small" icon={<ThunderboltOutlined />} loading={imageSearching} onClick={onSearchImages}>
            Tìm ảnh bằng AI
          </Button>
        </div>
        {imageUrl && (
          <div style={{ marginTop: 4 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <img src={imageUrl} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 6 }} />
              <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={onClearImage}>
                Xóa ảnh
              </Button>
            </div>
            {/* Credits the source article wherever the photo is shown, not
                just at selection time — see imageCredit's comment in
                preload/types.ts. Absent for a manually-pasted URL. */}
            {imageCredit && (
              <Typography.Text type="secondary" style={{ display: "block", fontSize: 11, marginTop: 4 }}>
                Ảnh từ bài{" "}
                <Typography.Link href={imageCreditUrl ?? undefined} target="_blank">
                  {imageCredit}
                </Typography.Link>{" "}
                trên Wikipedia
              </Typography.Text>
            )}
          </div>
        )}
        <Input
          value={imageUrl}
          onChange={(e) => onImageUrlChange(e.target.value)}
          placeholder="Dán URL ảnh, hoặc bấm Tìm ảnh bằng AI ở trên..."
          prefix={<PictureOutlined style={{ color: styleTokens.borderColorLight }} />}
          style={{ marginTop: 4 }}
        />
        {imageCandidates && (
          <div style={{ marginTop: 8 }}>
            {imageCandidates.length === 0 ? (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Không tìm thấy ảnh phù hợp.
              </Typography.Text>
            ) : (
              <>
                <Space size={6} wrap>
                  {imageCandidates.map((c) => (
                    <img
                      key={c.id}
                      src={c.thumbUrl}
                      alt={c.title}
                      title={`Ảnh từ bài: ${c.title} (Wikipedia)`}
                      onClick={() => onPickImage(c)}
                      style={{
                        width: 48,
                        height: 48,
                        objectFit: "cover",
                        borderRadius: 6,
                        cursor: "pointer",
                        border: `1px solid ${styleTokens.borderColorLight}`,
                      }}
                    />
                  ))}
                </Space>
                <Typography.Text type="secondary" style={{ display: "block", fontSize: 11, marginTop: 4 }}>
                  Ảnh từ Wikipedia — bấm để chọn.
                </Typography.Text>
              </>
            )}
          </div>
        )}
      </div>

      {/* Ghi chú/Định nghĩa riêng (free-text, distinct from DefinitionChooser's
          pick-one-of-two above) stay locked behind entry.id — unlike
          definition-via-picking/image above, there's no pre-save carry-over
          path for free-typed text here (see handleSave()'s patch), since
          typing a personal note only makes sense once the word is kept. */}
      <div style={{ marginTop: 16, borderTop: `1px solid ${styleTokens.borderColorLight}`, paddingTop: 12 }}>
        {entry.id ? (
          <>
            <Typography.Text strong>Ghi chú</Typography.Text>
            <Input.TextArea
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder="Ghi chú cá nhân..."
              autoSize={{ minRows: 2, maxRows: 4 }}
              style={{ marginTop: 4 }}
            />
            <Typography.Text strong style={{ display: "block", marginTop: 12 }}>
              Định nghĩa riêng
            </Typography.Text>
            <Input.TextArea
              value={definition}
              onChange={(e) => onDefinitionChange(e.target.value)}
              placeholder="Định nghĩa của riêng bạn..."
              autoSize={{ minRows: 2, maxRows: 4 }}
              style={{ marginTop: 4 }}
            />
            <Button type="primary" size="small" loading={savingNote} onClick={onSaveNote} style={{ marginTop: 8 }}>
              Lưu ghi chú
            </Button>
          </>
        ) : (
          <Typography.Text type="secondary">Lưu từ này để thêm ghi chú.</Typography.Text>
        )}
      </div>
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

  // AI-generated definition offered alongside the dictionary one (see
  // DefinitionChooser) — auto-generated right after a lookup, not tied to
  // aiStatus above since it's not one of the tab-gated AiFeature generations.
  const [aiDefinition, setAiDefinition] = useState<string | null>(null);
  const [aiDefinitionState, setAiDefinitionState] = useState<{ loading: boolean; error: string | null }>({
    loading: false,
    error: null,
  });
  const hasGroqKey = useHasGroqKey();

  // Ghi chú/Định nghĩa riêng on the "dict" tab, mirroring VocabDetailModal —
  // kept as separate editable state (not read straight off entry.note) so
  // typing doesn't require a round-trip through the DB on every keystroke.
  const [note, setNote] = useState("");
  const [definition, setDefinition] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Ảnh minh họa, same draft-until-"Lưu ghi chú" pattern as note/definition
  // above — mirrors VocabDetailModal's image section.
  const [imageUrl, setImageUrl] = useState("");
  const [imageCredit, setImageCredit] = useState<string | null>(null);
  const [imageCreditUrl, setImageCreditUrl] = useState<string | null>(null);
  const [imageSearching, setImageSearching] = useState(false);
  const [imageCandidates, setImageCandidates] = useState<ImageCandidate[] | null>(null);

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

  // Ctrl+Shift+G result — a fourth, mutually exclusive view alongside
  // searchMode/entry (see the render below), pushed by the grammar hotkey
  // (see main/app/hotkey.ts) rather than fetched by this component itself.
  const [grammarResult, setGrammarResult] = useState<GrammarCheckResult | null>(null);

  // Loaded lazily the first time the "browse" tab is opened (null = not
  // fetched yet), not up front on mount — most popup sessions never touch
  // it, and fetching a potentially long list on every single lookup would
  // be wasted work.
  const [browseEntries, setBrowseEntries] = useState<VocabEntryRow[] | null>(null);
  const [browseFilter, setBrowseFilter] = useState("");
  // Caps how many rows of the (already filtered) browse list are mounted at
  // once — grown in batches as the fixed-height tab body (see
  // MAX_CONTENT_HEIGHT) is scrolled toward its bottom, mirroring App.tsx's
  // saved-list rendering so a large saved list doesn't render every row
  // into this small popup at once.
  const [browseRenderLimit, setBrowseRenderLimit] = useState(BROWSE_RENDER_BATCH_SIZE);

  const contentRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<InputRef>(null);

  useEffect(() => {
    window.api.vocabSet.list().then(setSets);
    window.api.onTranslationResult((data) => {
      setGrammarResult(null);
      setSearchMode(false);
      setDictionary(data.dictionary);
      setEntry(fromVocabEntryRow(data.result));
      setSpellingSuggestion(null);
      setActiveTab("dict");
    });
    window.api.onTranslationPreview((data) => {
      setGrammarResult(null);
      setSearchMode(false);
      setDictionary(data.dictionary);
      setEntry(fromPreview(data.result));
      setSpellingSuggestion(data.spellingSuggestion);
      setActiveTab("dict");
      setSelectedSetId(UNASSIGNED);
    });
    window.api.onOpenSearchPopup(() => {
      setGrammarResult(null);
      setEntry(null);
      setDictionary(null);
      setSpellingSuggestion(null);
      setSearchText("");
      setActiveTab("dict");
      setSelectedSetId(UNASSIGNED);
      setSearchMode(true);
      setSearchOpenSeq((n) => n + 1);
    });
    window.api.onGrammarResult((result) => {
      setEntry(null);
      setDictionary(null);
      setSpellingSuggestion(null);
      setSearchMode(false);
      setGrammarResult(result);
    });
    // Keeps the browse tab's list (and whatever word is currently open,
    // if it's the one that changed) live across every vocab CRUD — whether
    // it originated in this popup or the main window (see
    // ipc/handlers.ts's broadcast calls). Previously the browse list was
    // only ever fetched once per popup session (see the browseEntries
    // effect below), so edits made elsewhere while the popup sat open/hidden
    // (it's a reused, not recreated, window — see windows/popup.ts) never
    // showed up without a full app restart.
    window.api.onVocabCreated((created) => {
      setBrowseEntries((prev) => (prev === null || prev.some((e) => e.id === created.id) ? prev : [created, ...prev]));
    });
    window.api.onVocabUpdated((updated) => {
      setBrowseEntries((prev) => (prev === null ? prev : prev.map((e) => (e.id === updated.id ? updated : e))));
      setEntry((prev) => (prev?.id === updated.id ? fromVocabEntryRow(updated) : prev));
    });
    window.api.onVocabDeleted((deleted) => {
      setBrowseEntries((prev) => (prev === null ? prev : prev.filter((e) => e.id !== deleted.id)));
    });
  }, []);

  // Autofocus the instant the input actually mounts (search mode just
  // turned on), not on some later render — there's no other way for the
  // user to start typing since this window never had keyboard focus before.
  useEffect(() => {
    if (searchMode && !entry) inputRef.current?.focus();
  }, [searchMode, entry, searchOpenSeq]);

  // Keyed on entry.id (not the whole entry object), same reasoning as
  // VocabDetailModal's identical effect — re-syncing on every entry update
  // (e.g. an AI tab finishing a generate call) would clobber whatever the
  // user is mid-typing into these fields.
  useEffect(() => {
    setNote(entry?.note ?? "");
    setDefinition(entry?.definition ?? "");
    setImageUrl(entry?.imageUrl ?? "");
    setImageCredit(entry?.imageCredit ?? null);
    setImageCreditUrl(entry?.imageCreditUrl ?? null);
    setImageCandidates(null);
  }, [entry?.id]);

  // Identifies "this looked-up word" stably across entry-object updates
  // that don't actually change the word (e.g. an AI tab finishing a
  // generate call replaces the entry object but keeps id/sourceText/
  // targetText the same) — entry?.id alone can't do this for not-yet-saved
  // previews, since every preview has id null regardless of which word it is.
  const entryKey = entry ? `${entry.id ?? ""}|${entry.sourceText}|${entry.targetText}` : null;

  async function generateAiDefinition(sourceText: string, meanings: string[]) {
    setAiDefinitionState({ loading: true, error: null });
    try {
      const result = await window.api.ai.previewDefinition(sourceText, meanings);
      setAiDefinition(result);
      setAiDefinitionState({ loading: false, error: null });
    } catch (err) {
      setAiDefinitionState({ loading: false, error: errorMessage(err) });
    }
  }

  // Auto-fires right after a fresh lookup lands (see DefinitionChooser) so
  // the AI definition is available the moment the dictionary one is —
  // silently skipped without a Groq key, same convention as the disabled
  // "Tạo với AI" buttons elsewhere (see AiSection.tsx).
  useEffect(() => {
    setAiDefinition(null);
    setAiDefinitionState({ loading: false, error: null });
    if (!entry || hasGroqKey !== true) return;
    generateAiDefinition(entry.sourceText, entry.targetMeanings);
  }, [entryKey, hasGroqKey]);

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
  }, [
    entry,
    dictionary,
    spellingSuggestion,
    searchMode,
    searchOpenSeq,
    activeTab,
    aiStatus,
    note,
    definition,
    aiDefinition,
    aiDefinitionState,
    grammarResult,
    imageUrl,
    imageCandidates,
  ]);

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

  // Clicking a synonym/antonym/word-form in the related-words tab re-runs
  // the lookup for that word, same as picking a spelling suggestion.
  async function handleRelatedWordClick(word: string) {
    setSearchText(word);
    await runPreview(word);
  }

  // Jumping to a word from the browse list works exactly like a fresh
  // lookup landing on "dict" (see onTranslationResult above), just sourced
  // from the local list instead of a new translate/dictionary round-trip —
  // dictionary/spellingSuggestion don't apply to an already-saved entry, so
  // they're cleared rather than left showing stale data from whatever was
  // open before.
  function handleBrowseSelect(row: VocabEntryRow) {
    setDictionary(null);
    setSpellingSuggestion(null);
    setEntry(fromVocabEntryRow(row));
    setActiveTab("dict");
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
      // Carry over whatever AI content the tabs already generated (and any
      // definition/image already picked via DefinitionChooser/the image
      // search above) while this was still just a preview — otherwise
      // saving would silently throw away Groq calls (and a chosen photo)
      // the user already paid the latency for.
      const patch: VocabEntryPatch = {};
      if (entry.aiExamples.length > 0) patch.aiExamples = entry.aiExamples;
      if (entry.aiNuance) patch.aiNuance = entry.aiNuance;
      if (entry.aiRelatedWords) patch.aiRelatedWords = entry.aiRelatedWords;
      if (definition.trim()) patch.definition = definition.trim();
      if (imageUrl.trim()) {
        patch.imageUrl = imageUrl.trim();
        patch.imageCredit = imageCredit;
        patch.imageCreditUrl = imageCreditUrl;
      }
      if (Object.keys(patch).length > 0) finalRow = await window.api.vocab.update(finalRow.id, patch);
      setEntry(fromVocabEntryRow(finalRow));
      toast.success("Đã lưu");
    } catch (err) {
      toast.error(`Lưu thất bại: ${errorMessage(err)}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveNote() {
    if (!entry?.id) return;
    setSavingNote(true);
    try {
      const trimmedImageUrl = imageUrl.trim() || null;
      const updated = await window.api.vocab.update(entry.id, {
        note: note.trim() || null,
        definition: definition.trim() || null,
        imageUrl: trimmedImageUrl,
        imageCredit: trimmedImageUrl ? imageCredit : null,
        imageCreditUrl: trimmedImageUrl ? imageCreditUrl : null,
      });
      setEntry(fromVocabEntryRow(updated));
      toast.success("Đã lưu ghi chú");
    } catch (err) {
      toast.error(`Lưu thất bại: ${errorMessage(err)}`);
    } finally {
      setSavingNote(false);
    }
  }

  async function handleSearchImages() {
    if (!entry) return;
    const englishWord =
      entry.sourceLang === "en" ? entry.sourceText : entry.targetLang === "en" ? entry.targetText : null;
    setImageSearching(true);
    try {
      setImageCandidates(await window.api.images.search(englishWord ?? entry.sourceText));
    } catch (err) {
      toast.error(`Tìm ảnh thất bại: ${errorMessage(err)}`);
    } finally {
      setImageSearching(false);
    }
  }

  function handlePickImage(candidate: ImageCandidate) {
    setImageUrl(candidate.url);
    setImageCredit(candidate.title);
    setImageCreditUrl(candidate.pageUrl);
    setImageCandidates(null);
  }

  // Typing a URL by hand means it's no longer the Wikipedia photo the
  // credit fields describe (if any were set from a previous pick) — clear
  // them so a manually-pasted image never carries stale credit.
  function handleImageUrlChange(value: string) {
    setImageUrl(value);
    setImageCredit(null);
    setImageCreditUrl(null);
  }

  function handleClearImage() {
    setImageUrl("");
    setImageCredit(null);
    setImageCreditUrl(null);
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
        const aiExamples = await window.api.ai.previewExamples(entry.sourceText, entry.targetMeanings, definition);
        setEntry((prev) => prev && { ...prev, aiExamples });
      } else if (feature === "nuance") {
        const aiNuance = await window.api.ai.previewNuance(entry.sourceText, entry.targetMeanings, definition);
        setEntry((prev) => prev && { ...prev, aiNuance });
      } else {
        const aiRelatedWords = await window.api.ai.previewRelatedWords(
          entry.sourceText,
          entry.sourceLang,
          entry.targetText,
          entry.targetLang,
          definition,
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

  useEffect(() => {
    if (activeTab !== "browse" || browseEntries !== null) return;
    window.api.vocab.list().then(setBrowseEntries);
  }, [activeTab, browseEntries]);

  // Narrowing the filter should start back at the first render batch, same
  // reasoning as App.tsx's list.
  useEffect(() => {
    setBrowseRenderLimit(BROWSE_RENDER_BATCH_SIZE);
  }, [browseFilter]);

  const isEnglishPair = !!entry && (entry.sourceLang === "en" || entry.targetLang === "en");

  const browseQuery = browseFilter.trim().toLowerCase();
  const filteredBrowseEntries = browseEntries?.filter(
    (row) => !browseQuery || row.sourceText.toLowerCase().includes(browseQuery) || row.targetText.toLowerCase().includes(browseQuery),
  );
  const renderedBrowseEntries = filteredBrowseEntries?.slice(0, browseRenderLimit);
  const hasMoreBrowseEntries = (renderedBrowseEntries?.length ?? 0) < (filteredBrowseEntries?.length ?? 0);

  // Shared by every tab body (see MAX_CONTENT_HEIGHT below) since they all
  // live under the same scroll container — only grows browseRenderLimit
  // when the browse tab is actually the one open.
  function handleTabBodyScroll(e: UIEvent<HTMLDivElement>) {
    if (activeTab !== "browse" || !hasMoreBrowseEntries) return;
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
      setBrowseRenderLimit((n) => n + BROWSE_RENDER_BATCH_SIZE);
    }
  }

  return (
    <div
      ref={contentRef}
      className="fade-in"
      style={{
        fontFamily: "system-ui, sans-serif",
        width: entry || grammarResult ? 320 : 304,
        maxWidth: 336,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {grammarResult && (
        <ErrorBoundary>
          <div style={{ padding: 16 }}>
            <Space align="center" style={{ width: "100%", justifyContent: "space-between" }}>
              <Typography.Text strong>Kiểm tra câu</Typography.Text>
              <Button type="text" size="small" onClick={() => setGrammarResult(null)}>
                Đóng
              </Button>
            </Space>

            <Typography.Text type="secondary" style={{ display: "block", marginTop: 8, fontSize: 12 }}>
              Câu gốc
            </Typography.Text>
            <Typography.Paragraph style={{ margin: "2px 0 0" }}>{grammarResult.original}</Typography.Paragraph>

            {grammarResult.isNatural ? (
              <Tag color="green" style={{ marginTop: 4 }}>
                Câu đã tự nhiên và đúng ngữ pháp
              </Tag>
            ) : (
              <>
                <Typography.Text type="secondary" style={{ display: "block", marginTop: 10, fontSize: 12 }}>
                  Gợi ý tự nhiên hơn
                </Typography.Text>
                <Typography.Paragraph strong style={{ margin: "2px 0 0" }}>
                  {grammarResult.corrected}
                </Typography.Paragraph>
                {grammarResult.explanation && (
                  <Typography.Paragraph type="secondary" style={{ margin: "6px 0 0", fontSize: 12 }}>
                    {grammarResult.explanation}
                  </Typography.Paragraph>
                )}
                <Button
                  size="small"
                  style={{ marginTop: 8 }}
                  onClick={() => navigator.clipboard.writeText(grammarResult.corrected)}
                >
                  Sao chép câu gợi ý
                </Button>
              </>
            )}
          </div>
        </ErrorBoundary>
      )}

      {searchMode && !entry && !grammarResult && (
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
          <div style={{ marginTop: 8 }}>
            <TranslateDirectionToggle size="small" />
          </div>
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
          {/* Keyed by activeTab and scoped to just the tab body (not the
              whole Popup) — a render error here (e.g. a malformed AI
              response) used to unmount all of Popup, including the
              useEffect above that registers this window's IPC listeners,
              leaving the popup permanently unresponsive until an app
              restart. Catching it at this level keeps those listeners
              alive and self-heals the moment the tab remounts (switch away
              and back, or the next successful generate). */}
          <ErrorBoundary key={activeTab}>
          <div
            style={{ padding: 16, overflowY: "auto", height: MAX_CONTENT_HEIGHT }}
            onScroll={handleTabBodyScroll}
          >
            {activeTab === "dict" && (
              <TranslationTab
                entry={entry}
                dictionary={dictionary}
                spellingSuggestion={spellingSuggestion}
                onUseSuggestion={handleUseSpellingSuggestion}
                note={note}
                definition={definition}
                onNoteChange={setNote}
                onDefinitionChange={setDefinition}
                savingNote={savingNote}
                onSaveNote={handleSaveNote}
                aiDefinition={aiDefinition}
                aiDefinitionState={aiDefinitionState}
                onGenerateAiDefinition={() =>
                  entry && generateAiDefinition(entry.sourceText, entry.targetMeanings)
                }
                imageUrl={imageUrl}
                imageCredit={imageCredit}
                imageCreditUrl={imageCreditUrl}
                imageSearching={imageSearching}
                imageCandidates={imageCandidates}
                onImageUrlChange={handleImageUrlChange}
                onSearchImages={handleSearchImages}
                onPickImage={handlePickImage}
                onClearImage={handleClearImage}
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
                      <Space align="start" size={4}>
                        <Typography.Text>{ex.sentence}</Typography.Text>
                        {entry.sourceLang !== "vi" && (
                          <Button
                            type="text"
                            size="small"
                            icon={<SoundOutlined />}
                            onClick={() => speak(ex.sentence, entry.sourceLang)}
                          />
                        )}
                      </Space>
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
                            <Tag key={w} onClick={() => handleRelatedWordClick(w)} style={{ cursor: "pointer" }}>
                              {w}
                            </Tag>
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
                            <Tag
                              key={w}
                              color="default"
                              onClick={() => handleRelatedWordClick(w)}
                              style={{ cursor: "pointer" }}
                            >
                              {w}
                            </Tag>
                          ))}
                        </div>
                      </div>
                    )}
                    {safeForms(entry.aiRelatedWords.forms).length > 0 && (
                      <div>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          Dạng từ khác
                        </Typography.Text>
                        <div>
                          {safeForms(entry.aiRelatedWords.forms).map((f, i) => (
                            <Tag
                              key={i}
                              color="blue"
                              onClick={() => handleRelatedWordClick(f.word)}
                              style={{ cursor: "pointer" }}
                            >
                              {f.word} {f.pos && <Typography.Text type="secondary">({f.pos})</Typography.Text>}
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

            {activeTab === "browse" && (
              <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                <Input.Search
                  size="small"
                  placeholder="Lọc trong danh sách đã lưu…"
                  value={browseFilter}
                  onChange={(e) => setBrowseFilter(e.target.value)}
                  allowClear
                  style={{ marginBottom: 8, flexShrink: 0 }}
                />
                {browseEntries === null ? (
                  <Spin size="small" />
                ) : (filteredBrowseEntries?.length ?? 0) === 0 ? (
                  <Typography.Text type="secondary">
                    {browseEntries.length === 0 ? "Chưa lưu từ nào." : "Không tìm thấy từ phù hợp."}
                  </Typography.Text>
                ) : (
                  <Space direction="vertical" size={2} style={{ width: "100%" }}>
                    {(renderedBrowseEntries ?? []).map((row) => (
                      <div
                        key={row.id}
                        className="entry-row"
                        style={{ cursor: "pointer", padding: "4px 6px", borderRadius: 6 }}
                        onClick={() => handleBrowseSelect(row)}
                      >
                        <Typography.Text strong>{row.sourceText}</Typography.Text>
                        <Typography.Text
                          type="secondary"
                          style={{ marginLeft: 6, fontSize: styleTokens.secondaryFontSize }}
                        >
                          {row.targetText}
                        </Typography.Text>
                      </div>
                    ))}
                    {hasMoreBrowseEntries && (
                      <Typography.Text
                        type="secondary"
                        style={{ display: "block", textAlign: "center", marginTop: 6, fontSize: 11 }}
                      >
                        Đang tải thêm...
                      </Typography.Text>
                    )}
                  </Space>
                )}
              </div>
            )}
          </div>
          </ErrorBoundary>

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

      {!searchMode && !entry && !grammarResult && (
        <div style={{ padding: 16 }}>
          <Typography.Text type="secondary">Waiting for lookup…</Typography.Text>
        </div>
      )}
    </div>
  );
}
