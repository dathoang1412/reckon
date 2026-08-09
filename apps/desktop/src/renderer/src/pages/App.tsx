import { useEffect, useRef, useState } from "react";
import {
  DeleteOutlined,
  ImportOutlined,
  PictureOutlined,
  SearchOutlined,
  SoundOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { Button, DatePicker, Empty, Image, Input, List, Modal, Select, Space, Tag, Typography } from "antd";
import type { InputRef } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import toast from "react-hot-toast";
import type {
  AiExample,
  AiRelatedWords,
  ImageCandidate,
  UserProfile,
  VocabEntryPatch,
  VocabEntryRow,
  VocabPreview,
  VocabSetRow,
} from "../../../preload/index";
import AiWordEnrichment from "../components/AiWordEnrichment";
import AppHeader, { type AppView } from "../components/AppHeader";
import BulkExtractModal from "../components/BulkExtractModal";
import DefinitionChooser, { firstDictionaryDefinition } from "../components/DefinitionChooser";
import DictionaryPanel from "../components/DictionaryPanel";
import ErrorBoundary from "../components/ErrorBoundary";
import LogViewer from "../components/LogViewer";
import LoginModal from "../components/LoginModal";
import SetsBar from "../components/SetsBar";
import TranslateDirectionToggle from "../components/TranslateDirectionToggle";
import VocabDetailModal from "../components/VocabDetailModal";
import { dayKey, dayLabel, timeLabel } from "../lib/date";
import { speak } from "../lib/speak";
import { useHasGroqKey } from "../lib/useHasGroqKey";
import { styleTokens } from "../theme";
import Profile from "./Profile";
import Review from "./Review";
import Settings from "./Settings";

const UNASSIGNED = "__unassigned__";

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [entries, setEntries] = useState<VocabEntryRow[]>([]);
  const [sets, setSets] = useState<VocabSetRow[]>([]);
  const [activeSet, setActiveSet] = useState<string | null>(null);
  const [detailEntry, setDetailEntry] = useState<VocabEntryRow | null>(null);
  // Bumped every time a detail modal is opened (including reopening the
  // same word) — keys the ErrorBoundary below so a crash from one entry's
  // malformed AI data (see ai.ts's relatedWordsContent) doesn't leave the
  // fallback stuck showing forever; id alone wouldn't remount on a
  // close-then-reopen of the very same word.
  const [detailOpenSeq, setDetailOpenSeq] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<InputRef>(null);
  // Filters the saved list down to entries saved within this day range —
  // null means no filter (show everything), same "null = no cap" convention
  // used elsewhere in this file (see previewDefinition/limit comments).
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [text, setText] = useState("");
  const [looking, setLooking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<VocabPreview | null>(null);
  // Look-up now lives in an overlay instead of inline above the saved list
  // (see the "Tra từ mới" trigger button below) — open while typing a
  // search, then transitions in place to show the result (still `preview`)
  // once one comes back, so editing note/definition/image/tags happens in
  // the same focused surface VocabDetailModal already uses for saved words.
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  // Bumped on every runSearch call — keys the ErrorBoundary around the
  // preview card's AI section (see previewSeq usage below) so re-searching
  // the same word after a crash remounts and self-heals instead of leaving
  // the fallback stuck.
  const [previewSeq, setPreviewSeq] = useState(0);
  // AI enrichment generated on the not-yet-saved preview (see
  // AiWordEnrichment below) — kept separate from `preview` itself since
  // VocabPreview/TranslationResultData has no AI fields (those only exist
  // on a saved VocabEntryRow); carried over into a vocab.update patch right
  // after saving so generating before Lưu isn't wasted work.
  const [previewAiExamples, setPreviewAiExamples] = useState<AiExample[]>([]);
  const [previewAiNuance, setPreviewAiNuance] = useState<string | null>(null);
  const [previewAiRelatedWords, setPreviewAiRelatedWords] = useState<AiRelatedWords | null>(null);
  const [previewExamplesState, setPreviewExamplesState] = useState({ loading: false, error: null as string | null });
  const [previewNuanceState, setPreviewNuanceState] = useState({ loading: false, error: null as string | null });
  const [previewRelatedState, setPreviewRelatedState] = useState({ loading: false, error: null as string | null });
  // The definition the user picked (dictionary vs AI, see DefinitionChooser)
  // for the not-yet-saved preview — App.tsx has no note/definition editor
  // pre-save otherwise, so this is a standalone piece of state instead of
  // reusing a textarea's value like Popup.tsx/VocabDetailModal do.
  const [previewDefinition, setPreviewDefinition] = useState("");
  const [previewAiDefinition, setPreviewAiDefinition] = useState<string | null>(null);
  const [previewAiDefinitionState, setPreviewAiDefinitionState] = useState({
    loading: false,
    error: null as string | null,
  });
  // Ảnh minh họa on the not-yet-saved preview, same carry-over-on-save
  // reasoning as previewDefinition above.
  const [previewImageUrl, setPreviewImageUrl] = useState("");
  const [previewImageCredit, setPreviewImageCredit] = useState<string | null>(null);
  const [previewImageCreditUrl, setPreviewImageCreditUrl] = useState<string | null>(null);
  const [previewImageSearching, setPreviewImageSearching] = useState(false);
  const [previewImageCandidates, setPreviewImageCandidates] = useState<ImageCandidate[] | null>(null);
  const hasGroqKey = useHasGroqKey();
  const [syncing, setSyncing] = useState(false);
  const [view, setView] = useState<AppView>("list");
  const [bulkExtractOpen, setBulkExtractOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Local read only (no network) — see authSession.ts. Login is opt-in
  // (see LoginModal), not a gate the app sits behind, so this is only
  // tracked to decide whether Sync (and Settings' profile section) can
  // run straight away or need to prompt for one first.
  useEffect(() => {
    window.api.auth.getSession().then((session) => setAuthed(!!session));
  }, []);

  // Drives the header's avatar/name (see AppHeader) — re-fetched whenever
  // authed flips (login/logout), and also refreshed directly by Settings
  // right after a profile save so the header doesn't wait for a full
  // refetch to reflect it.
  useEffect(() => {
    if (!authed) {
      setProfile(null);
      return;
    }
    window.api.auth.getProfile().then(setProfile);
  }, [authed]);

  async function refresh() {
    setEntries(await window.api.vocab.list());
  }

  async function refreshSets() {
    setSets(await window.api.vocabSet.list());
  }

  useEffect(() => {
    refresh();
    refreshSets();
  }, []);

  // Keeps this window's list (and the detail modal, if it's open on the
  // affected word) live across every vocab CRUD, whether it originated here
  // or from the popup window — see ipc/handlers.ts's broadcast calls.
  // Redundant but harmless when the change originated in this same window
  // (the caller's own .then already applied it); this just re-applies the
  // same data.
  useEffect(() => {
    window.api.onVocabCreated((entry) => {
      setEntries((prev) => (prev.some((e) => e.id === entry.id) ? prev : [entry, ...prev]));
    });
    window.api.onVocabUpdated((entry) => {
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? entry : e)));
      setDetailEntry((prev) => (prev?.id === entry.id ? entry : prev));
    });
    window.api.onVocabDeleted((entry) => {
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
      setDetailEntry((prev) => (prev?.id === entry.id ? null : prev));
    });
  }, []);

  // Only the "downloaded" state needs surfacing outside Settings — it's the
  // one moment that needs a user decision (restart now or later) regardless
  // of which page they're on; every other update state (checking/available/
  // error) is just passive status Settings already shows on its own.
  useEffect(() => {
    window.api.onUpdateStatus((status) => {
      if (status.state !== "downloaded") return;
      toast(
        (t) => (
          <Space>
            <span>Đã tải bản cập nhật v{status.version}.</span>
            <Button
              size="small"
              type="primary"
              onClick={() => {
                toast.dismiss(t.id);
                window.api.updater.quitAndInstall();
              }}
            >
              Khởi động lại
            </Button>
          </Space>
        ),
        { duration: Infinity, icon: "🚀" },
      );
    });
  }, []);

  // Ctrl+F (Cmd+F on mac) jumps straight to the saved-list filter box
  // instead of doing nothing (Electron doesn't wire up a native find bar
  // here), mirroring the browser shortcut users already reach for.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  async function runSearch(query: string) {
    if (!query.trim()) return;
    setLooking(true);
    setPreviewSeq((n) => n + 1);
    setPreview(null);
    setPreviewAiExamples([]);
    setPreviewAiNuance(null);
    setPreviewAiRelatedWords(null);
    setPreviewExamplesState({ loading: false, error: null });
    setPreviewNuanceState({ loading: false, error: null });
    setPreviewRelatedState({ loading: false, error: null });
    setPreviewDefinition("");
    setPreviewAiDefinition(null);
    setPreviewAiDefinitionState({ loading: false, error: null });
    setPreviewImageUrl("");
    setPreviewImageCredit(null);
    setPreviewImageCreditUrl(null);
    setPreviewImageCandidates(null);
    try {
      const result = await window.api.vocab.preview(query.trim());
      setPreview(result);
      // Auto-fires right after the lookup lands, same moment the dictionary
      // definition arrives — silently skipped without a Groq key, same
      // convention as the disabled "Tạo với AI" buttons elsewhere.
      if (hasGroqKey) {
        setPreviewAiDefinitionState({ loading: true, error: null });
        try {
          const aiDefinition = await window.api.ai.previewDefinition(
            result.result.sourceText,
            result.result.targetMeanings,
          );
          setPreviewAiDefinition(aiDefinition);
          setPreviewAiDefinitionState({ loading: false, error: null });
        } catch (err) {
          setPreviewAiDefinitionState({ loading: false, error: err instanceof Error ? err.message : String(err) });
        }
      }
    } catch (err) {
      toast.error(`Tra từ thất bại: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLooking(false);
    }
  }

  async function handleSearch() {
    await runSearch(text);
  }

  function handleOpenSearchModal() {
    setSearchModalOpen(true);
  }

  // Resets back to the blank search step so reopening never shows a stale
  // result from whatever was last looked up.
  function handleCloseSearchModal() {
    setSearchModalOpen(false);
    setText("");
    setPreview(null);
  }

  // "Ý bạn là ...?" — re-runs the lookup with Google's spelling correction
  // instead of what was actually typed (see preview.spellingSuggestion).
  async function handleUseSpellingSuggestion(suggestion: string) {
    setText(suggestion);
    await runSearch(suggestion);
  }

  async function handleSearchPreviewImages() {
    if (!preview) return;
    const { sourceText, sourceLang, targetText, targetLang } = preview.result;
    const englishWord = sourceLang === "en" ? sourceText : targetLang === "en" ? targetText : null;
    setPreviewImageSearching(true);
    try {
      setPreviewImageCandidates(await window.api.images.search(englishWord ?? sourceText));
    } catch (err) {
      toast.error(`Tìm ảnh thất bại: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPreviewImageSearching(false);
    }
  }

  function handlePickPreviewImage(candidate: ImageCandidate) {
    setPreviewImageUrl(candidate.url);
    setPreviewImageCredit(candidate.title);
    setPreviewImageCreditUrl(candidate.pageUrl);
    setPreviewImageCandidates(null);
  }

  // Typing a URL by hand means it's no longer the Wikipedia photo the
  // credit fields describe (if any were set from a previous pick) — clear
  // them so a manually-pasted image never carries stale credit.
  function handlePreviewImageUrlChange(value: string) {
    setPreviewImageUrl(value);
    setPreviewImageCredit(null);
    setPreviewImageCreditUrl(null);
  }

  function handleClearPreviewImage() {
    setPreviewImageUrl("");
    setPreviewImageCredit(null);
    setPreviewImageCreditUrl(null);
  }

  async function handleGeneratePreviewAiDefinition() {
    if (!preview) return;
    setPreviewAiDefinitionState({ loading: true, error: null });
    try {
      setPreviewAiDefinition(
        await window.api.ai.previewDefinition(preview.result.sourceText, preview.result.targetMeanings),
      );
      setPreviewAiDefinitionState({ loading: false, error: null });
    } catch (err) {
      setPreviewAiDefinitionState({ loading: false, error: err instanceof Error ? err.message : String(err) });
    }
  }

  async function handleGeneratePreviewExamples() {
    if (!preview) return;
    setPreviewExamplesState({ loading: true, error: null });
    try {
      setPreviewAiExamples(
        await window.api.ai.previewExamples(preview.result.sourceText, preview.result.targetMeanings, previewDefinition),
      );
      setPreviewExamplesState({ loading: false, error: null });
    } catch (err) {
      setPreviewExamplesState({ loading: false, error: err instanceof Error ? err.message : String(err) });
    }
  }

  async function handleGeneratePreviewNuance() {
    if (!preview) return;
    setPreviewNuanceState({ loading: true, error: null });
    try {
      setPreviewAiNuance(
        await window.api.ai.previewNuance(preview.result.sourceText, preview.result.targetMeanings, previewDefinition),
      );
      setPreviewNuanceState({ loading: false, error: null });
    } catch (err) {
      setPreviewNuanceState({ loading: false, error: err instanceof Error ? err.message : String(err) });
    }
  }

  async function handleGeneratePreviewRelated() {
    if (!preview) return;
    setPreviewRelatedState({ loading: true, error: null });
    try {
      setPreviewAiRelatedWords(
        await window.api.ai.previewRelatedWords(
          preview.result.sourceText,
          preview.result.sourceLang,
          preview.result.targetText,
          preview.result.targetLang,
          previewDefinition,
        ),
      );
      setPreviewRelatedState({ loading: false, error: null });
    } catch (err) {
      setPreviewRelatedState({ loading: false, error: err instanceof Error ? err.message : String(err) });
    }
  }

  async function handleSavePreview() {
    if (!preview) return;
    setSaving(true);
    try {
      const saved = await window.api.vocab.save(preview.result);
      // Carry over whatever AI content was generated on the preview —
      // otherwise saving would silently throw away Groq calls the user
      // already paid the latency for (same reasoning as Popup.tsx).
      const patch: VocabEntryPatch = {};
      if (previewAiExamples.length > 0) patch.aiExamples = previewAiExamples;
      if (previewAiNuance) patch.aiNuance = previewAiNuance;
      if (previewAiRelatedWords) patch.aiRelatedWords = previewAiRelatedWords;
      if (previewDefinition.trim()) patch.definition = previewDefinition.trim();
      if (previewImageUrl.trim()) {
        patch.imageUrl = previewImageUrl.trim();
        patch.imageCredit = previewImageCredit;
        patch.imageCreditUrl = previewImageCreditUrl;
      }
      if (Object.keys(patch).length > 0) await window.api.vocab.update(saved.id, patch);
      setText("");
      setPreview(null);
      setSearchModalOpen(false);
      await refresh();
      toast.success("Đã lưu");
    } catch (err) {
      toast.error(`Lưu thất bại: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await window.api.vocab.delete(id);
    await refresh();
  }

  async function handleAssignSet(id: string, setId: string) {
    const resolved = setId === UNASSIGNED ? null : setId;
    await window.api.vocab.setSet(id, resolved);
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, setId: resolved } : e)));
  }

  function handleUpdateEntry(updated: VocabEntryRow) {
    setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    setDetailEntry(updated);
  }

  async function handleCreateSet(name: string) {
    await window.api.vocabSet.create(name);
    await refreshSets();
  }

  async function handleRenameSet(id: string, name: string) {
    await window.api.vocabSet.rename(id, name);
    await refreshSets();
  }

  async function handleDeleteSet(id: string) {
    await window.api.vocabSet.delete(id);
    if (activeSet === id) setActiveSet(null);
    await refreshSets();
    await refresh();
  }

  async function handleSync() {
    // Sync is the only thing here that touches the shared server/Postgres
    // — everything else works fully offline against local SQLite, so this
    // is also the only place that needs to prompt for an account instead
    // of just working.
    if (!authed) {
      setLoginModalOpen(true);
      return;
    }
    setSyncing(true);
    try {
      const result = await window.api.sync.run();
      toast.success(`Synced — pushed ${result.pushed}, pulled ${result.pulled}`);
      await refresh();
      await refreshSets();
    } catch (err) {
      toast.error(`Sync failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSyncing(false);
    }
  }

  if (authed === null) return null;

  const bySet = activeSet === null ? entries : entries.filter((e) => e.setId === activeSet);
  const byDate = dateRange
    ? bySet.filter((e) => {
        const created = dayjs(e.createdAt);
        return !created.isBefore(dateRange[0], "day") && !created.isAfter(dateRange[1], "day");
      })
    : bySet;
  const query = searchQuery.trim().toLowerCase();
  const visibleEntries = query
    ? byDate.filter(
        (e) =>
          e.sourceText.toLowerCase().includes(query) ||
          e.targetText.toLowerCase().includes(query) ||
          (e.note ?? "").toLowerCase().includes(query) ||
          e.tags.some((tag) => tag.toLowerCase().includes(query)),
      )
    : byDate;
  const setOptions = [
    { value: UNASSIGNED, label: "Chưa phân loại" },
    ...sets.map((s) => ({ value: s.id, label: s.name })),
  ];

  // Most recent save date for a set (or across everything, for null) — more
  // useful in the sidebar than a raw "set last renamed" timestamp, since it
  // reflects actual vocab activity instead of bookkeeping.
  function latestDateFor(setId: string | null): string | null {
    const matching = setId === null ? entries : entries.filter((e) => e.setId === setId);
    if (matching.length === 0) return null;
    const latest = matching.reduce((a, b) => (a.createdAt > b.createdAt ? a : b));
    return dayLabel(latest.createdAt);
  }

  // Groups consecutive same-day entries under one header — entries stay in
  // their existing (updatedAt desc) order within a group instead of being
  // re-sorted by createdAt, so moving/editing an entry doesn't reshuffle it
  // out of the day it was actually saved on.
  const entryGroups: { key: string; label: string; items: VocabEntryRow[] }[] = [];
  for (const entry of visibleEntries) {
    const key = dayKey(entry.createdAt);
    const lastGroup = entryGroups[entryGroups.length - 1];
    if (lastGroup && lastGroup.key === key) {
      lastGroup.items.push(entry);
    } else {
      entryGroups.push({ key, label: dayLabel(entry.createdAt), items: [entry] });
    }
  }

  return (
    <>
      <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
        <AppHeader view={view} onChangeView={setView} onSync={handleSync} syncing={syncing} profile={profile} />

        {view === "review" && (
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
            <div style={{ maxWidth: 480, width: "100%", margin: "0 auto", padding: "1rem" }}>
              <Review />
            </div>
          </div>
        )}

        {view === "profile" && (
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
            <Profile
              authed={authed}
              onLogout={() => setAuthed(false)}
              onRequireLogin={() => setLoginModalOpen(true)}
              onProfileUpdated={setProfile}
            />
          </div>
        )}

        {view === "settings" && (
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
            <Settings />
          </div>
        )}

        {view === "logs" && (
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
            <div style={{ maxWidth: 960, width: "100%", margin: "0 auto", padding: "1.5rem" }}>
              <Typography.Title level={4} style={{ marginTop: 0 }}>
                Nhật ký hệ thống
              </Typography.Title>
              <Typography.Paragraph type="secondary" style={{ marginTop: 4 }}>
                Log của ứng dụng (app) và backend đồng bộ (server) chạy nền — hữu ích khi báo lỗi.
              </Typography.Paragraph>
              <LogViewer height={520} />
            </div>
          </div>
        )}

        {view === "list" && (
          <div
            style={{
              width: "100%",
              maxWidth: 960,
              margin: "0 auto",
              padding: "1.5rem 1.5rem 0",
              display: "flex",
              gap: 24,
              flex: 1,
              minHeight: 0,
            }}
          >
            {/* minWidth:320 (not 0) is a deliberate floor, not a relic — it's
                what the sidebar's fixed 220px is sized against (see
                mainWindow.ts's new BrowserWindow minWidth:720), so this
                column has a guaranteed usable width instead of getting
                squeezed toward 0 alongside it. */}
            <div style={{ flex: 1, minWidth: 320, display: "flex", flexDirection: "column" }}>
              <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
                Copy a word anywhere, press the hotkey — or look one up here.
              </Typography.Paragraph>

              <Space style={{ marginTop: 16 }}>
                <Button type="primary" icon={<SearchOutlined />} onClick={handleOpenSearchModal}>
                  Tra từ mới
                </Button>
                <Button icon={<ImportOutlined />} onClick={() => setBulkExtractOpen(true)}>
                  Trích xuất từ đoạn văn
                </Button>
              </Space>

              {/* Pinned above the scroll region below, not inside it — a
                  search box you have to scroll back up to reach defeats its
                  own purpose once the list is long. */}
              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <Input.Search
                  ref={searchInputRef}
                  allowClear
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm trong từ đã lưu... (Ctrl+F)"
                  style={{ flex: "0 1 65%" }}
                />
                <DatePicker.RangePicker
                  value={dateRange}
                  onChange={(range) => setDateRange(range && range[0] && range[1] ? [range[0], range[1]] : null)}
                  allowClear
                  style={{ flex: "0 1 35%" }}
                  placeholder={["Từ ngày", "Đến ngày"]}
                />
              </div>

              {/* Every saved word shares one scroll region — see the search
                  Modal (rendered at the end of this component) for the
                  not-yet-saved lookup/preview flow, which used to live
                  inline here instead. */}
              <div style={{ flex: 1, minHeight: 0, overflowY: "auto", marginTop: 16 }}>
                {visibleEntries.length === 0 && (
                  <Empty description={query ? "Không tìm thấy từ nào" : "No lookups yet"} />
                )}
                {entryGroups.map((group) => (
                  <div key={group.key}>
                    <Typography.Text type="secondary" strong style={{ display: "block", margin: "12px 0 4px" }}>
                      {group.label}
                    </Typography.Text>
                    <List
                      dataSource={group.items}
                      renderItem={(entry) => (
                        <List.Item
                          actions={[
                            <Select
                              key="set"
                              size="small"
                              variant="borderless"
                              value={entry.setId ?? UNASSIGNED}
                              options={setOptions}
                              onChange={(value) => handleAssignSet(entry.id, value)}
                              style={{ width: 140 }}
                            />,
                            <Button
                              key="delete"
                              type="text"
                              danger
                              icon={<DeleteOutlined />}
                              onClick={() => handleDelete(entry.id)}
                            />,
                          ]}
                        >
                          {/* onClick lives here, not on List.Item — the actions
                          above (esp. Select's portaled dropdown) are a sibling
                          render slot, not a DOM/React descendant of this div,
                          so clicking them can never reach this handler. */}
                          <Space
                            direction="vertical"
                            size={0}
                            className="entry-row"
                            style={{ cursor: "pointer", width: "100%", padding: "4px 8px", borderRadius: 6 }}
                            onClick={() => {
                              setDetailEntry(entry);
                              setDetailOpenSeq((n) => n + 1);
                            }}
                          >
                            <span>
                              <Tag color="blue">{entry.sourceLang}</Tag>
                              {entry.sourceText}
                              {entry.sourceLang !== "vi" && (
                                <Button
                                  type="text"
                                  size="small"
                                  icon={<SoundOutlined />}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    speak(entry.sourceText, entry.sourceLang);
                                  }}
                                />
                              )}
                            </span>
                            <span>
                              <Tag color="green">{entry.targetLang}</Tag>
                              {entry.targetText}
                              {entry.targetLang !== "vi" && (
                                <Button
                                  type="text"
                                  size="small"
                                  icon={<SoundOutlined />}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    speak(entry.targetText, entry.targetLang);
                                  }}
                                />
                              )}
                              {entry.targetMeanings.length > 1 && (
                                <Typography.Text type="secondary" style={{ marginLeft: 4 }}>
                                  ({entry.targetMeanings.slice(1).join(", ")})
                                </Typography.Text>
                              )}
                              <Typography.Text
                                type="secondary"
                                style={{ marginLeft: 8, fontSize: styleTokens.secondaryFontSize }}
                              >
                                {timeLabel(entry.createdAt)}
                              </Typography.Text>
                            </span>
                          </Space>
                        </List.Item>
                      )}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                width: 220,
                flexShrink: 0,
                borderLeft: `1px solid ${styleTokens.borderColorLight}`,
                paddingLeft: 20,
                paddingBottom: "1.5rem",
                overflowY: "auto",
              }}
            >
              <SetsBar
                sets={sets}
                countAll={entries.length}
                countFor={(setId) => entries.filter((e) => e.setId === setId).length}
                latestDateFor={latestDateFor}
                activeSet={activeSet}
                onSelect={setActiveSet}
                onCreate={handleCreateSet}
                onRename={handleRenameSet}
                onDelete={handleDeleteSet}
              />
            </div>
          </div>
        )}
      </div>

      {/* Keyed by detailOpenSeq (not just entry.id) so a crash from one
          word's malformed AI data self-heals on the very next open,
          including reopening the same word — see main.tsx's single
          top-level ErrorBoundary comment above for why this used to brick
          the whole window instead of just this modal. */}
      <ErrorBoundary key={detailOpenSeq}>
        <VocabDetailModal entry={detailEntry} onClose={() => setDetailEntry(null)} onUpdate={handleUpdateEntry} />
      </ErrorBoundary>

      {/* Overlay for looking up a not-yet-saved word — opened via the "Tra
          từ mới" button above instead of an inline search bar. Two steps in
          the same modal, told apart by `preview`: blank search form first,
          then (once a lookup lands) the result/editing view that used to be
          an inline Card mixed into the saved-words list. destroyOnHidden so
          the search input remounts (and autoFocuses) fresh every time it's
          reopened, and so a crash from one lookup's malformed AI data (see
          detailOpenSeq's ErrorBoundary above for the same reasoning) can't
          persist into the next one. */}
      <Modal
        title={preview ? null : "Tra từ mới"}
        open={searchModalOpen}
        onCancel={handleCloseSearchModal}
        // Fixed in the modal's own footer (outside the scrollable result
        // body below) instead of scrolling away with the content — a long
        // dictionary entry/AI section used to carry the button out of view,
        // forcing a scroll back up just to save.
        footer={
          preview && (
            <Button type="primary" loading={saving} onClick={handleSavePreview}>
              Lưu
            </Button>
          )
        }
        destroyOnHidden
        centered
        width={preview ? 640 : 420}
      >
        {!preview ? (
          <>
            <Space.Compact style={{ width: "100%" }}>
              <Input
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                onPressEnter={handleSearch}
                placeholder="Look up a word or phrase"
              />
              <Button type="primary" loading={looking} onClick={handleSearch}>
                Look up
              </Button>
            </Space.Compact>
            <div style={{ marginTop: 8 }}>
              <TranslateDirectionToggle size="small" />
            </div>
          </>
        ) : (
          <div style={{ maxHeight: "70vh", overflowY: "auto", paddingRight: 4 }}>
            {preview.spellingSuggestion && (
              <Typography.Paragraph type="secondary" style={{ marginTop: 0, marginBottom: 12 }}>
                Ý bạn là:{" "}
                <Typography.Link onClick={() => handleUseSpellingSuggestion(preview.spellingSuggestion!)}>
                  {preview.spellingSuggestion}
                </Typography.Link>
                ?
              </Typography.Paragraph>
            )}
            <Space direction="vertical" size={4}>
              <span>
                <Tag color="blue">{preview.result.sourceLang}</Tag>
                {preview.result.sourceText}
                {preview.result.sourceLang !== "vi" && (
                  <Button
                    type="text"
                    size="small"
                    icon={<SoundOutlined />}
                    onClick={() => speak(preview.result.sourceText, preview.result.sourceLang)}
                  />
                )}
              </span>
              <span>
                <Tag color="green">{preview.result.targetLang}</Tag>
                {preview.result.targetText}
                {preview.result.targetLang !== "vi" && (
                  <Button
                    type="text"
                    size="small"
                    icon={<SoundOutlined />}
                    onClick={() => speak(preview.result.targetText, preview.result.targetLang)}
                  />
                )}
              </span>
              {preview.result.targetMeanings.length > 1 && (
                <Space size={[4, 4]} wrap>
                  {preview.result.targetMeanings.slice(1).map((meaning) => (
                    <Tag key={meaning} color="default">
                      {meaning}
                    </Tag>
                  ))}
                </Space>
              )}
            </Space>
            {preview.dictionary && <DictionaryPanel dictionary={preview.dictionary} />}
            <ErrorBoundary key={`def-${previewSeq}`}>
              <DefinitionChooser
                dictionaryDefinition={firstDictionaryDefinition(preview.dictionary)}
                aiDefinition={previewAiDefinition}
                aiLoading={previewAiDefinitionState.loading}
                aiError={previewAiDefinitionState.error}
                onGenerateAi={handleGeneratePreviewAiDefinition}
                selectedText={previewDefinition}
                onSelect={setPreviewDefinition}
              />
            </ErrorBoundary>

            {/* Available on the not-yet-saved preview, same as
                DefinitionChooser above — the picked image rides along in
                handleSavePreview()'s patch. */}
            <div
              style={{
                marginTop: 16,
                borderTop: `1px solid ${styleTokens.borderColorLight}`,
                paddingTop: 12,
              }}
            >
              <Space align="center" style={{ width: "100%", justifyContent: "space-between" }}>
                <Typography.Text strong>Ảnh minh họa</Typography.Text>
                <Button
                  type="link"
                  size="small"
                  icon={<ThunderboltOutlined />}
                  loading={previewImageSearching}
                  onClick={handleSearchPreviewImages}
                >
                  Tìm ảnh bằng AI
                </Button>
              </Space>
              {previewImageUrl && (
                <div style={{ marginTop: 4 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <Image
                      src={previewImageUrl}
                      alt=""
                      width={80}
                      height={80}
                      style={{ objectFit: "cover", borderRadius: 6 }}
                    />
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={handleClearPreviewImage}
                    >
                      Xóa ảnh
                    </Button>
                  </div>
                  {previewImageCredit && (
                    <Typography.Text type="secondary" style={{ display: "block", fontSize: 11, marginTop: 4 }}>
                      Ảnh từ bài{" "}
                      <Typography.Link href={previewImageCreditUrl ?? undefined} target="_blank">
                        {previewImageCredit}
                      </Typography.Link>{" "}
                      trên Wikipedia
                    </Typography.Text>
                  )}
                </div>
              )}
              <Input
                value={previewImageUrl}
                onChange={(e) => handlePreviewImageUrlChange(e.target.value)}
                placeholder="Dán URL ảnh, hoặc bấm Tìm ảnh bằng AI ở trên..."
                prefix={<PictureOutlined style={{ color: styleTokens.borderColorLight }} />}
                style={{ marginTop: 4 }}
              />
              {previewImageCandidates && (
                <div style={{ marginTop: 8 }}>
                  {previewImageCandidates.length === 0 ? (
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      Không tìm thấy ảnh phù hợp.
                    </Typography.Text>
                  ) : (
                    <>
                      <Space size={6} wrap>
                        {previewImageCandidates.map((c) => (
                          <img
                            key={c.id}
                            src={c.thumbUrl}
                            alt={c.title}
                            title={`Ảnh từ bài: ${c.title} (Wikipedia)`}
                            onClick={() => handlePickPreviewImage(c)}
                            style={{
                              width: 56,
                              height: 56,
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
            {/* Scoped and keyed by previewSeq — a render error here (e.g.
                malformed AI data) used to unmount the entire App tree via
                main.tsx's single top-level ErrorBoundary, bricking the whole
                window until a restart. Catching it here keeps the rest of
                the app (header, list, sidebar) usable and self-heals on the
                next search. */}
            <ErrorBoundary key={previewSeq}>
              <AiWordEnrichment
                aiExamples={previewAiExamples}
                aiNuance={previewAiNuance}
                aiRelatedWords={previewAiRelatedWords}
                sourceLang={preview.result.sourceLang}
                relatedWordsDisabledReason={
                  preview.result.sourceLang === "en" || preview.result.targetLang === "en"
                    ? null
                    : "Chỉ hỗ trợ cho từ tiếng Anh"
                }
                examplesState={previewExamplesState}
                nuanceState={previewNuanceState}
                relatedState={previewRelatedState}
                onGenerateExamples={handleGeneratePreviewExamples}
                onGenerateNuance={handleGeneratePreviewNuance}
                onGenerateRelated={handleGeneratePreviewRelated}
              />
            </ErrorBoundary>
          </div>
        )}
      </Modal>

      <BulkExtractModal
        open={bulkExtractOpen}
        onClose={() => setBulkExtractOpen(false)}
        entries={entries}
        onSaved={refresh}
      />
      <LoginModal
        open={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        onSuccess={() => {
          setAuthed(true);
          setLoginModalOpen(false);
        }}
      />
    </>
  );
}
