import type { ReactNode } from "react";
import { RedoOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { Button, Space, Spin, Tooltip, Typography } from "antd";
import { useHasGroqKey } from "../lib/useHasGroqKey";
import { COLOR_PRIMARY, styleTokens } from "../theme";

// The reusable "AI enrichment block" used by VocabDetailModal's four Groq
// features (examples, nuance, related words, mnemonic) — one consistent
// header/loading/error/empty treatment so each feature only has to supply
// its own prompt call and result rendering (children).
export default function AiSection({
  icon,
  title,
  hasContent,
  loading,
  error,
  disabledReason,
  onGenerate,
  children,
}: {
  icon: ReactNode;
  title: string;
  hasContent: boolean;
  loading: boolean;
  error: string | null;
  // Set when generation isn't offered at all for this entry (e.g. related
  // words only supports English) — takes priority over the key-missing
  // state below, since no key would still fix nothing here.
  disabledReason?: string | null;
  onGenerate: () => void;
  children: ReactNode;
}) {
  const hasKey = useHasGroqKey();

  const generateButton = (
    <Tooltip title={hasKey === false ? "Cần thêm Groq API key trong Cài đặt" : undefined}>
      <span>
        <Button
          type="dashed"
          size="small"
          icon={<ThunderboltOutlined />}
          disabled={hasKey === false}
          onClick={onGenerate}
        >
          Tạo với AI
        </Button>
      </span>
    </Tooltip>
  );

  return (
    <div style={{ marginTop: 16, borderTop: `1px solid ${styleTokens.borderColorLight}`, paddingTop: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography.Text strong>
          <span style={{ color: COLOR_PRIMARY, marginRight: 6 }}>{icon}</span>
          {title}
        </Typography.Text>
        {hasContent && !loading && !disabledReason && (
          <Button type="text" size="small" icon={<RedoOutlined />} title="Tạo lại" onClick={onGenerate} />
        )}
      </div>
      <div style={{ marginTop: 8 }}>
        {disabledReason ? (
          <Typography.Text type="secondary" style={{ fontSize: styleTokens.secondaryFontSize }}>
            {disabledReason}
          </Typography.Text>
        ) : loading ? (
          <Spin size="small" />
        ) : error ? (
          <Space direction="vertical" size={4}>
            <Typography.Text type="danger" style={{ fontSize: styleTokens.secondaryFontSize }}>
              {error}
            </Typography.Text>
            <Button size="small" onClick={onGenerate}>
              Thử lại
            </Button>
          </Space>
        ) : hasContent ? (
          children
        ) : (
          generateButton
        )}
      </div>
    </div>
  );
}
