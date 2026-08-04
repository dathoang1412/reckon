import { useEffect, useState } from "react";
import { DeleteOutlined, ImportOutlined, SoundOutlined } from "@ant-design/icons";
import { Button, Card, Empty, Input, List, Select, Space, Tag, Typography } from "antd";
import toast from "react-hot-toast";
import type {
  AiExample,
  AiRelatedWords,
  UserProfile,
  VocabEntryPatch,
  VocabEntryRow,
  VocabPreview,
  VocabSetRow,
} from "../../../preload/index";
import AiWordEnrichment from "../components/AiWordEnrichment";
import AppHeader, { type AppView } from "../components/AppHeader";
import BulkExtractModal from "../components/BulkExtractModal";
import DictionaryPanel from "../components/DictionaryPanel";
import LoginModal from "../components/LoginModal";
import SetsBar from "../components/SetsBar";
import VocabDetailModal from "../components/VocabDetailModal";
import { dayKey, dayLabel, timeLabel } from "../lib/date";
import { speak } from "../lib/speak";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [text, setText] = useState("");
  const [looking, setLooking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<VocabPreview | null>(null);
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

  useEffect(() => {
    window.api.onVocabCreated((entry) => {
      setEntries((prev) => (prev.some((e) => e.id === entry.id) ? prev : [entry, ...prev]));
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

  async function runSearch(query: string) {
    if (!query.trim()) return;
    setLooking(true);
    setPreview(null);
    setPreviewAiExamples([]);
    setPreviewAiNuance(null);
    setPreviewAiRelatedWords(null);
    setPreviewExamplesState({ loading: false, error: null });
    setPreviewNuanceState({ loading: false, error: null });
    setPreviewRelatedState({ loading: false, error: null });
    try {
      setPreview(await window.api.vocab.preview(query.trim()));
    } catch (err) {
      toast.error(`Tra từ thất bại: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLooking(false);
    }
  }

  async function handleSearch() {
    await runSearch(text);
  }

  // "Ý bạn là ...?" — re-runs the lookup with Google's spelling correction
  // instead of what was actually typed (see preview.spellingSuggestion).
  async function handleUseSpellingSuggestion(suggestion: string) {
    setText(suggestion);
    await runSearch(suggestion);
  }

  async function handleGeneratePreviewExamples() {
    if (!preview) return;
    setPreviewExamplesState({ loading: true, error: null });
    try {
      setPreviewAiExamples(await window.api.ai.previewExamples(preview.result.sourceText, preview.result.targetMeanings));
      setPreviewExamplesState({ loading: false, error: null });
    } catch (err) {
      setPreviewExamplesState({ loading: false, error: err instanceof Error ? err.message : String(err) });
    }
  }

  async function handleGeneratePreviewNuance() {
    if (!preview) return;
    setPreviewNuanceState({ loading: true, error: null });
    try {
      setPreviewAiNuance(await window.api.ai.previewNuance(preview.result.sourceText, preview.result.targetMeanings));
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
      if (Object.keys(patch).length > 0) await window.api.vocab.update(saved.id, patch);
      setText("");
      setPreview(null);
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
  const query = searchQuery.trim().toLowerCase();
  const visibleEntries = query
    ? bySet.filter(
        (e) =>
          e.sourceText.toLowerCase().includes(query) ||
          e.targetText.toLowerCase().includes(query) ||
          (e.note ?? "").toLowerCase().includes(query) ||
          e.tags.some((tag) => tag.toLowerCase().includes(query)),
      )
    : bySet;
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

              <Space.Compact style={{ width: "100%", marginTop: 16 }}>
                <Input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onPressEnter={handleSearch}
                  placeholder="Look up a word or phrase"
                />
                <Button type="primary" loading={looking} onClick={handleSearch}>
                  Look up
                </Button>
              </Space.Compact>
              <Button
                type="dashed"
                size="small"
                icon={<ImportOutlined />}
                onClick={() => setBulkExtractOpen(true)}
                style={{ marginTop: 8, alignSelf: "flex-end" }}
              >
                Trích xuất từ đoạn văn
              </Button>

              {/* Pinned above the scroll region below, not inside it — a
                  search box you have to scroll back up to reach defeats its
                  own purpose once the list is long. */}
              <Input.Search
                allowClear
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm trong từ đã lưu..."
                style={{ marginTop: 16 }}
              />

              {/* Everything below shares one scroll region — the preview
                  card can grow arbitrarily tall (long dictionary entries),
                  and without this it could push the entries list past the
                  window's bottom edge with no way to reach it, since only
                  this region (not the whole window) scrolls. */}
              <div style={{ flex: 1, minHeight: 0, overflowY: "auto", marginTop: 16 }}>
                {preview && (
                  <Card size="small" style={{ marginBottom: 16 }}>
                    {preview.spellingSuggestion && (
                      <Typography.Paragraph type="secondary" style={{ marginTop: 0, marginBottom: 12 }}>
                        Ý bạn là:{" "}
                        <Typography.Link onClick={() => handleUseSpellingSuggestion(preview.spellingSuggestion!)}>
                          {preview.spellingSuggestion}
                        </Typography.Link>
                        ?
                      </Typography.Paragraph>
                    )}
                    <Space align="start" style={{ width: "100%", justifyContent: "space-between" }}>
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
                      <Button type="primary" loading={saving} onClick={handleSavePreview}>
                        Lưu
                      </Button>
                    </Space>
                    {preview.dictionary && <DictionaryPanel dictionary={preview.dictionary} />}
                    <AiWordEnrichment
                      aiExamples={previewAiExamples}
                      aiNuance={previewAiNuance}
                      aiRelatedWords={previewAiRelatedWords}
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
                  </Card>
                )}

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
                            onClick={() => setDetailEntry(entry)}
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

      <VocabDetailModal entry={detailEntry} onClose={() => setDetailEntry(null)} onUpdate={handleUpdateEntry} />
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
