import { useEffect, useState } from "react";
import { DeleteOutlined, SyncOutlined } from "@ant-design/icons";
import { Button, ConfigProvider, Empty, Input, List, message, Space, Tag, Typography } from "antd";
import type { VocabEntryRow } from "../../preload/index";

export default function App() {
  const [entries, setEntries] = useState<VocabEntryRow[]>([]);
  const [text, setText] = useState("");
  const [looking, setLooking] = useState(false);
  const [syncing, setSyncing] = useState(false);

  async function refresh() {
    setEntries(await window.api.vocab.list());
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleLookup() {
    if (!text.trim()) return;
    setLooking(true);
    try {
      await window.api.vocab.lookup(text.trim());
      setText("");
      await refresh();
    } catch (err) {
      message.error(`Lookup failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLooking(false);
    }
  }

  async function handleDelete(id: string) {
    await window.api.vocab.delete(id);
    await refresh();
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const result = await window.api.sync.run();
      message.success(`Synced — pushed ${result.pushed}, pulled ${result.pulled}`);
      await refresh();
    } catch (err) {
      message.error(`Sync failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <ConfigProvider theme={{ token: { colorPrimary: "#1677ff" } }}>
      <div style={{ maxWidth: 480, margin: "2rem auto", padding: "0 1rem" }}>
        <Space align="center" style={{ width: "100%", justifyContent: "space-between" }}>
          <Typography.Title level={2} style={{ margin: 0 }}>
            Reckon
          </Typography.Title>
          <Button icon={<SyncOutlined spin={syncing} />} loading={syncing} onClick={handleSync}>
            Sync now
          </Button>
        </Space>
        <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
          Copy a word anywhere, press Ctrl+Shift+D — or look one up here.
        </Typography.Paragraph>
        <Space.Compact style={{ width: "100%", margin: "16px 0" }}>
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onPressEnter={handleLookup}
            placeholder="Look up a word or phrase"
          />
          <Button type="primary" loading={looking} onClick={handleLookup}>
            Look up
          </Button>
        </Space.Compact>
        <List
          dataSource={entries}
          locale={{ emptyText: <Empty description="No lookups yet" /> }}
          renderItem={(entry) => (
            <List.Item
              actions={[
                <Button key="delete" type="text" danger icon={<DeleteOutlined />} onClick={() => handleDelete(entry.id)} />,
              ]}
            >
              <Space direction="vertical" size={0}>
                <span>
                  <Tag color="blue">{entry.sourceLang}</Tag>
                  {entry.sourceText}
                </span>
                <span>
                  <Tag color="green">{entry.targetLang}</Tag>
                  {entry.targetText}
                </span>
              </Space>
            </List.Item>
          )}
        />
      </div>
    </ConfigProvider>
  );
}
