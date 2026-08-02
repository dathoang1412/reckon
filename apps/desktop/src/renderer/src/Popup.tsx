import { useEffect, useState } from "react";
import { SoundOutlined } from "@ant-design/icons";
import { Button, ConfigProvider, Space, Tag, Typography } from "antd";
import type { VocabEntryRow } from "../../preload/index";
import { speak } from "./speak";

export default function Popup() {
  const [result, setResult] = useState<VocabEntryRow | null>(null);

  useEffect(() => {
    window.api.onTranslationResult(setResult);
  }, []);

  return (
    <ConfigProvider theme={{ token: { colorPrimary: "#1677ff" } }}>
      <div style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
        {!result ? (
          <Typography.Text type="secondary">Waiting for lookup…</Typography.Text>
        ) : (
          <>
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
          </>
        )}
      </div>
    </ConfigProvider>
  );
}
