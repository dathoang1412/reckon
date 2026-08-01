import { useEffect, useState } from "react";

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

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
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
    <main style={{ fontFamily: "system-ui, sans-serif", maxWidth: 480, margin: "2rem auto" }}>
      <h1>Reckon</h1>
      <form onSubmit={handleAdd} style={{ display: "flex", gap: 8 }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New task"
          style={{ flex: 1, padding: 8 }}
        />
        <button type="submit">Add</button>
      </form>
      <ul style={{ listStyle: "none", padding: 0, marginTop: "1rem" }}>
        {tasks.map((task) => (
          <li key={task.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
            <input type="checkbox" checked={task.done} onChange={() => handleToggle(task.id)} />
            <span style={{ flex: 1, textDecoration: task.done ? "line-through" : "none" }}>{task.title}</span>
            <button onClick={() => handleDelete(task.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </main>
  );
}
