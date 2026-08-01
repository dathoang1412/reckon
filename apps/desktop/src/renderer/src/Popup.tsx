import { useEffect, useState } from "react";
import { ConfigProvider, Tag, Typography } from "antd";
import type { VocabEntryRow } from "../../preload/index";

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
            <Typography.Paragraph style={{ margin: "8px 0" }}>{result.sourceText}</Typography.Paragraph>
            <Tag color="green">{result.targetLang}</Tag>
            <Typography.Paragraph strong style={{ margin: "8px 0 0" }}>
              {result.targetText}
            </Typography.Paragraph>
          </>
        )}
      </div>
    </ConfigProvider>
  );
}
