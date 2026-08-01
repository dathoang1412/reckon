import { useEffect, useState } from "react";
import { DeleteOutlined, SyncOutlined } from "@ant-design/icons";
import { Button, Checkbox, ConfigProvider, Empty, Input, List, message, Space, Typography } from "antd";

interface TaskRow {
  id: string;
  title: string;
  done: boolean;
}

export default function App() {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [title, setTitle] = useState("");
  const [syncing, setSyncing] = useState(false);

  async function refresh() {
    setTasks(await window.api.tasks.list());
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleAdd() {
    if (!title.trim()) return;
    await window.api.tasks.create(title.trim());
    setTitle("");
    await refresh();
  }

  async function handleToggle(id: string) {
    await window.api.tasks.toggle(id);
    await refresh();
  }

  async function handleDelete(id: string) {
    await window.api.tasks.delete(id);
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
        <Space.Compact style={{ width: "100%", margin: "16px 0" }}>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onPressEnter={handleAdd}
            placeholder="New task"
          />
          <Button type="primary" onClick={handleAdd}>
            Add
          </Button>
        </Space.Compact>
        <List
          dataSource={tasks}
          locale={{ emptyText: <Empty description="No tasks yet" /> }}
          renderItem={(task) => (
            <List.Item
              actions={[
                <Button key="delete" type="text" danger icon={<DeleteOutlined />} onClick={() => handleDelete(task.id)} />,
              ]}
            >
              <Checkbox checked={task.done} onChange={() => handleToggle(task.id)}>
                <span style={{ textDecoration: task.done ? "line-through" : "none" }}>{task.title}</span>
              </Checkbox>
            </List.Item>
          )}
        />
      </div>
    </ConfigProvider>
  );
}
