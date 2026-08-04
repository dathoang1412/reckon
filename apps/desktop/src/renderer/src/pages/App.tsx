import { useEffect, useState } from "react";
import { DeleteOutlined, ImportOutlined, SoundOutlined } from "@ant-design/icons";
import { Button, Card, Empty, Input, List, Select, Space, Tag, Typography } from "antd";
import toast from "react-hot-toast";
import type { VocabEntryRow, VocabPreview, VocabSetRow } from "../../../preload/index";
import AppHeader, { type AppView } from "../components/AppHeader";
import BulkExtractModal from "../components/BulkExtractModal";
import DictionaryPanel from "../components/DictionaryPanel";
import SetsBar from "../components/SetsBar";
import VocabDetailModal from "../components/VocabDetailModal";
import { dayKey, dayLabel, timeLabel } from "../lib/date";
import { speak } from "../lib/speak";
import { styleTokens } from "../theme";
import Login from "./Login";
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
  const [syncing, setSyncing] = useState(false);
  const [view, setView] = useState<AppView>("list");
  const [bulkExtractOpen, setBulkExtractOpen] = useState(false);

  // Local read only (no network) — see authSession.ts — so login gating
  // never blocks app startup on connectivity, just on "have we ever
  // logged in and not logged out".
  useEffect(() => {
    window.api.auth.getSession().then((session) => setAuthed(!!session));
  }, []);

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

  async function handleSearch() {
    if (!text.trim()) return;
    setLooking(true);
    setPreview(null);
    try {
      setPreview(await window.api.vocab.preview(text.trim()));
    } catch (err) {
      toast.error(`Tra từ thất bại: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLooking(false);
    }
  }

  async function handleSavePreview() {
    if (!preview) return;
    setSaving(true);
    try {
      await window.api.vocab.save(preview.result);
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

  if (!authed) {
    return <Login onSuccess={() => setAuthed(true)} />;
  }

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
        <AppHeader view={view} onChangeView={setView} onSync={handleSync} syncing={syncing} />

        {view === "review" && (
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
            <div style={{ maxWidth: 480, width: "100%", margin: "0 auto", padding: "1rem" }}>
              <Review />
            </div>
          </div>
        )}

        {view === "settings" && (
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
            <Settings onLogout={() => setAuthed(false)} />
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
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
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

              {/* Everything below the lookup box shares one scroll region — the
                  preview card can grow arbitrarily tall (long dictionary
                  entries), and without this it could push the entries list
                  past the window's bottom edge with no way to reach it, since
                  only this region (not the whole window) scrolls. */}
              <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
                {preview && (
                  <Card size="small" style={{ marginBottom: 16 }}>
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
                  </Card>
                )}

                <Input.Search
                  allowClear
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm trong từ đã lưu..."
                  style={{ marginBottom: 16 }}
                />

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
    </>
  );
}
