import { useEffect, useRef, useState, type CSSProperties } from "react";
import { SendOutlined } from "@ant-design/icons";
import { Button, Input, Space, Spin, Typography } from "antd";
import type { ChatMessage } from "../../../preload/index";
import { COLOR_PRIMARY, styleTokens } from "../theme";

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// Self-contained chat box for asking freeform questions about a word — used
// both from Popup.tsx (as one of the tabs) and VocabDetailModal.tsx (as a
// section). Never persisted (see ai.ts's chatAboutWord): the conversation
// lives only in this component's own state and resets whenever the word
// itself changes, same as regenerating rather than caching the other AI
// features would.
export default function WordChat({
  sourceText,
  sourceLang,
  targetText,
  targetLang,
  targetMeanings,
  height,
}: {
  sourceText: string;
  sourceLang: string;
  targetText: string;
  targetLang: string;
  targetMeanings: string[];
  height: CSSProperties["height"];
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Keyed on the word itself, not e.g. a vocabId — a fresh conversation
  // whenever what's being asked about actually changes, not on every
  // unrelated re-render of the parent.
  useEffect(() => {
    setMessages([]);
    setInput("");
    setError(null);
  }, [sourceText, targetText]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    const history = [...messages, { role: "user" as const, content: text }];
    setMessages(history);
    setInput("");
    setLoading(true);
    setError(null);
    try {
      const reply = await window.api.ai.chatAboutWord(sourceText, sourceLang, targetText, targetLang, targetMeanings, history);
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height }}>
      <div ref={listRef} style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingRight: 2 }}>
        {messages.length === 0 && !loading && (
          <Typography.Text type="secondary" style={{ fontSize: styleTokens.secondaryFontSize }}>
            Hỏi bất kỳ điều gì về từ này — cách dùng, sắc thái, ví dụ thêm…
          </Typography.Text>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ textAlign: m.role === "user" ? "right" : "left", marginBottom: 8 }}>
            <div
              style={{
                display: "inline-block",
                maxWidth: "85%",
                padding: "6px 10px",
                borderRadius: 10,
                background: m.role === "user" ? COLOR_PRIMARY : styleTokens.borderColorLight,
                color: m.role === "user" ? "#fff" : "inherit",
                fontSize: 13,
                textAlign: "left",
                whiteSpace: "pre-wrap",
              }}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && <Spin size="small" />}
        {error && (
          <Typography.Text type="danger" style={{ display: "block", fontSize: styleTokens.secondaryFontSize }}>
            {error}
          </Typography.Text>
        )}
      </div>

      <Space.Compact style={{ width: "100%", flexShrink: 0, marginTop: 8 }}>
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onPressEnter={handleSend}
          placeholder="Hỏi về từ này…"
          disabled={loading}
        />
        <Button type="primary" icon={<SendOutlined />} loading={loading} onClick={handleSend} />
      </Space.Compact>
    </div>
  );
}
