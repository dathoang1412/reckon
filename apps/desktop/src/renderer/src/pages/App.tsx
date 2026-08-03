import { useEffect, useState } from "react";
import { DeleteOutlined, ReadOutlined, SettingOutlined, SoundOutlined, SyncOutlined } from "@ant-design/icons";
import { Button, Card, ConfigProvider, Empty, Input, List, message, Select, Space, Tag, Typography } from "antd";
import type { VocabEntryRow, VocabPreview, VocabSetRow } from "../../../preload/index";
import DictionaryPanel from "../components/DictionaryPanel";
import SetsBar from "../components/SetsBar";
import VocabDetailModal from "../components/VocabDetailModal";
import { speak } from "../lib/speak";
import Review from "./Review";
import Settings from "./Settings";

const UNASSIGNED = "__unassigned__";

export default function App() {
  const [entries, setEntries] = useState<VocabEntryRow[]>([]);
  const [sets, setSets] = useState<VocabSetRow[]>([]);
  const [activeSet, setActiveSet] = useState<string | null>(null);
  const [detailEntry, setDetailEntry] = useState<VocabEntryRow | null>(null);
  const [text, setText] = useState("");
  const [looking, setLooking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<VocabPreview | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [view, setView] = useState<"list" | "review" | "settings">("list");

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
      message.error(`Tra từ thất bại: ${err instanceof Error ? err.message : String(err)}`);
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
      message.success("Đã lưu");
    } catch (err) {
      message.error(`Lưu thất bại: ${err instanceof Error ? err.message : String(err)}`);
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
      message.success(`Synced — pushed ${result.pushed}, pulled ${result.pulled}`);
      await refresh();
      await refreshSets();
    } catch (err) {
      message.error(`Sync failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSyncing(false);
    }
  }

  if (view === "review") {
    return (
      <ConfigProvider theme={{ token: { colorPrimary: "#1677ff" } }}>
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "1rem" }}>
          <Button onClick={() => setView("list")}>← Quay lại</Button>
        </div>
        <Review />
      </ConfigProvider>
    );
  }

  if (view === "settings") {
    return <Settings onBack={() => setView("list")} />;
  }

  const visibleEntries = activeSet === null ? entries : entries.filter((e) => e.setId === activeSet);
  const setOptions = [
    { value: UNASSIGNED, label: "Chưa phân loại" },
    ...sets.map((s) => ({ value: s.id, label: s.name })),
  ];

  return (
    <ConfigProvider theme={{ token: { colorPrimary: "#1677ff" } }}>
      <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
        <div
          style={{
            width: "100%",
            maxWidth: 720,
            margin: "0 auto",
            padding: "1.5rem 1.5rem 0",
            display: "flex",
            flexDirection: "column",
            flex: 1,
            minHeight: 0,
          }}
        >
          <Space align="center" style={{ width: "100%", justifyContent: "space-between", flexWrap: "wrap" }}>
            <Typography.Title level={2} style={{ margin: 0 }}>
              Reckon
            </Typography.Title>
            <Space wrap>
              <Button icon={<ReadOutlined />} onClick={() => setView("review")}>
                Ôn tập
              </Button>
              <Button icon={<SyncOutlined spin={syncing} />} loading={syncing} onClick={handleSync}>
                Sync now
              </Button>
              <Button icon={<SettingOutlined />} onClick={() => setView("settings")} />
            </Space>
          </Space>
          <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
            Copy a word anywhere, press the hotkey — or look one up here.
          </Typography.Paragraph>

          <Space.Compact style={{ width: "100%", margin: "16px 0" }}>
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

          {preview && (
            <Card size="small" style={{ marginBottom: 16 }}>
              <Space align="start" style={{ width: "100%", justifyContent: "space-between" }}>
                <Space direction="vertical" size={4}>
                  <span>
                    <Tag color="blue">{preview.result.sourceLang}</Tag>
                    {preview.result.sourceText}
                    <Button
                      type="text"
                      size="small"
                      icon={<SoundOutlined />}
                      onClick={() => speak(preview.result.sourceText, preview.result.sourceLang)}
                    />
                  </span>
                  <span>
                    <Tag color="green">{preview.result.targetLang}</Tag>
                    {preview.result.targetText}
                    <Button
                      type="text"
                      size="small"
                      icon={<SoundOutlined />}
                      onClick={() => speak(preview.result.targetText, preview.result.targetLang)}
                    />
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

          <SetsBar
            sets={sets}
            countAll={entries.length}
            countFor={(setId) => entries.filter((e) => e.setId === setId).length}
            activeSet={activeSet}
            onSelect={setActiveSet}
            onCreate={handleCreateSet}
            onRename={handleRenameSet}
            onDelete={handleDeleteSet}
          />

          <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
            <List
              dataSource={visibleEntries}
              locale={{ emptyText: <Empty description="No lookups yet" /> }}
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
                  <Space direction="vertical" size={0} style={{ cursor: "pointer" }} onClick={() => setDetailEntry(entry)}>
                    <span>
                      <Tag color="blue">{entry.sourceLang}</Tag>
                      {entry.sourceText}
                      <Button
                        type="text"
                        size="small"
                        icon={<SoundOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          speak(entry.sourceText, entry.sourceLang);
                        }}
                      />
                    </span>
                    <span>
                      <Tag color="green">{entry.targetLang}</Tag>
                      {entry.targetText}
                      <Button
                        type="text"
                        size="small"
                        icon={<SoundOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          speak(entry.targetText, entry.targetLang);
                        }}
                      />
                      {entry.targetMeanings.length > 1 && (
                        <Typography.Text type="secondary" style={{ marginLeft: 4 }}>
                          ({entry.targetMeanings.slice(1).join(", ")})
                        </Typography.Text>
                      )}
                    </span>
                  </Space>
                </List.Item>
              )}
            />
          </div>
        </div>
      </div>

      <VocabDetailModal entry={detailEntry} onClose={() => setDetailEntry(null)} />
    </ConfigProvider>
  );
}
