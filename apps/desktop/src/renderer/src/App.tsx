import { useEffect, useState } from "react";
import { DeleteOutlined } from "@ant-design/icons";
import { Button, Checkbox, ConfigProvider, Empty, Input, List, Space, Typography } from "antd";

interface TaskRow {
  id: string;
  title: string;
  done: boolean;
}

export default function App() {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [title, setTitle] = useState("");

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

  return (
    <ConfigProvider theme={{ token: { colorPrimary: "#1677ff" } }}>
      <div style={{ maxWidth: 480, margin: "2rem auto", padding: "0 1rem" }}>
        <Typography.Title level={2}>Reckon</Typography.Title>
        <Space.Compact style={{ width: "100%", marginBottom: 16 }}>
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
