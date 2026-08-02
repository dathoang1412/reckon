import { useEffect, useRef, useState } from "react";
import { SoundOutlined } from "@ant-design/icons";
import { Button, ConfigProvider, Space, Tag, Typography } from "antd";
import type { TranslationResultPayload } from "../../preload/index";
import DictionaryPanel from "./DictionaryPanel";
import { speak } from "./speak";

export default function Popup() {
  const [payload, setPayload] = useState<TranslationResultPayload | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.api.onTranslationResult(setPayload);
  }, []);

  // Reports the content's actual rendered size to the main process once,
  // which resizes/repositions (and only then shows) the window to fit — a
  // fixed window size either wastes space with no dictionary data or clips
  // a long one. Deliberately one-shot, not a live ResizeObserver: the
  // content is `width: fit-content`, so its size depends on the window's
  // current viewport — reacting to every size change would mean our own
  // resize triggers another measurement, feeding back into itself. A
  // single post-layout measurement is enough since the payload already
  // carries the dictionary data too (nothing arrives after the fact).
  useEffect(() => {
    if (!payload) return;
    const el = contentRef.current;
    if (!el) return;

    const frame = requestAnimationFrame(() => {
      window.api.popup.resize({ width: el.scrollWidth, height: el.scrollHeight });
    });
    return () => cancelAnimationFrame(frame);
  }, [payload]);

  if (!payload) {
    return (
      <ConfigProvider theme={{ token: { colorPrimary: "#1677ff" } }}>
        <div style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
          <Typography.Text type="secondary">Waiting for lookup…</Typography.Text>
        </div>
      </ConfigProvider>
    );
  }

  const { result, dictionary } = payload;

  return (
    <ConfigProvider theme={{ token: { colorPrimary: "#1677ff" } }}>
      <div
        ref={contentRef}
        style={{
          padding: 16,
          fontFamily: "system-ui, sans-serif",
          width: "fit-content",
          maxWidth: 420,
          maxHeight: "80vh",
          overflowY: "auto",
        }}
      >
        <Tag color="blue">{result.sourceLang}</Tag>
        <Space align="center" style={{ margin: "8px 0" }}>
          <Typography.Paragraph style={{ margin: 0 }}>{result.sourceText}</Typography.Paragraph>
          <Button
            type="text"
            size="small"
            icon={<SoundOutlined />}
            onClick={() => speak(result.sourceText, result.sourceLang)}
          />
        </Space>
        <Tag color="green">{result.targetLang}</Tag>
        <Space align="center" style={{ margin: "8px 0 0" }}>
          <Typography.Paragraph strong style={{ margin: 0 }}>
            {result.targetText}
          </Typography.Paragraph>
          <Button
            type="text"
            size="small"
            icon={<SoundOutlined />}
            onClick={() => speak(result.targetText, result.targetLang)}
          />
        </Space>

        {dictionary && <DictionaryPanel dictionary={dictionary} />}
      </div>
    </ConfigProvider>
  );
}
