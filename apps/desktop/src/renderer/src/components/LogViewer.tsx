import { useEffect, useRef, useState } from "react";
import { ClearOutlined } from "@ant-design/icons";
import { Button, Segmented, Space, Tag, Typography } from "antd";
import type { LogEntry, LogLevel } from "../../../preload/index";

// Kept independent from the main-process ring buffer's own cap (see
// log.ts's MAX_ENTRIES) — this is just how much the DOM holds at once, no
// need for the two to match.
const MAX_DISPLAYED = 2000;

type LevelFilter = "all" | LogLevel;

const LEVEL_COLOR: Record<LogLevel, string> = {
  info: "#8fd3ff",
  warn: "#ffd479",
  error: "#ff8080",
};

const SOURCE_COLOR: Record<LogEntry["source"], string> = {
  app: "#c792ea",
  server: "#7ee7a8",
};

function formatTime(iso: string): string {
  // HH:MM:SS from the ISO string directly — a terminal-style log doesn't
  // need locale-aware formatting, just a stable fixed-width stamp.
  return iso.slice(11, 19);
}

// A tail -f-style console for the app's own process and the spawned sync
// backend (see main/services/system/log.ts) — in a packaged build neither has any
// other visible output, since there's no attached terminal. Colored by
// level/source rather than literal chalk ANSI codes: chalk's escape
// sequences are meant for a real terminal, not HTML, so the same
// level→color mapping chalk uses on the terminal side is re-expressed here
// as CSS instead of trying to render ANSI in the DOM.
export default function LogViewer({ height = 420 }: { height?: number }) {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<LevelFilter>("all");
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.api.log.getHistory().then(setEntries);
    window.api.log.onEntry((entry) => {
      setEntries((prev) => {
        const next = [...prev, entry];
        return next.length > MAX_DISPLAYED ? next.slice(next.length - MAX_DISPLAYED) : next;
      });
    });
  }, []);

  useEffect(() => {
    if (!autoScroll) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries, autoScroll]);

  // Auto-scroll stays on while the user is at (or near) the bottom, and
  // switches off the moment they scroll up to read older lines — otherwise
  // every new line would yank them back down mid-read. Scrolling back to
  // the bottom themselves re-enables it rather than needing a separate
  // toggle.
  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    setAutoScroll(atBottom);
  }

  const visible = filter === "all" ? entries : entries.filter((e) => e.level === filter);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <Space align="center" style={{ justifyContent: "space-between", width: "100%" }} wrap>
        <Segmented
          size="small"
          value={filter}
          onChange={(v) => setFilter(v as LevelFilter)}
          options={[
            { label: "Tất cả", value: "all" },
            { label: "Info", value: "info" },
            { label: "Warn", value: "warn" },
            { label: "Error", value: "error" },
          ]}
        />
        <Space>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {visible.length} dòng
          </Typography.Text>
          <Button size="small" icon={<ClearOutlined />} onClick={() => setEntries([])}>
            Xóa
          </Button>
        </Space>
      </Space>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          height,
          overflowY: "auto",
          background: "#1e1e1e",
          borderRadius: 6,
          padding: "8px 12px",
          fontFamily: "Consolas, 'Cascadia Mono', 'Courier New', monospace",
          fontSize: 12.5,
          lineHeight: 1.6,
        }}
      >
        {visible.length === 0 && (
          <Typography.Text style={{ color: "#888" }}>Chưa có nhật ký nào.</Typography.Text>
        )}
        {visible.map((entry) => (
          <div key={entry.id} style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            <span style={{ color: "#6a6a6a" }}>{formatTime(entry.timestamp)}</span>{" "}
            <Tag
              style={{
                margin: "0 4px 0 0",
                color: SOURCE_COLOR[entry.source],
                borderColor: SOURCE_COLOR[entry.source],
                background: "transparent",
                fontSize: 11,
                lineHeight: "16px",
              }}
            >
              {entry.source}
            </Tag>
            <span style={{ color: LEVEL_COLOR[entry.level], fontWeight: 600 }}>
              {entry.level.toUpperCase().padEnd(5, " ")}
            </span>{" "}
            <span style={{ color: "#d4d4d4" }}>{entry.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
