import { CheckOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { Button, Space, Typography } from "antd";
import type { DictionaryInfo } from "../../../preload/index";
import AiSection from "./AiSection";
import { styleTokens } from "../theme";

// Dictionary definitions are already ordered by relevance (see
// DictionaryPanel.tsx, which renders them in this same order) — the first
// one is the best single-string candidate to offer alongside the
// AI-generated definition below.
export function firstDictionaryDefinition(dictionary: DictionaryInfo | null): string | null {
  return dictionary?.definitions[0]?.definition ?? null;
}

function Candidate({
  text,
  selected,
  onSelect,
}: {
  text: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Space align="start" style={{ width: "100%", justifyContent: "space-between" }}>
      <Typography.Text style={{ flex: 1, fontSize: styleTokens.secondaryFontSize }}>{text}</Typography.Text>
      <Button
        type={selected ? "primary" : "default"}
        size="small"
        icon={selected ? <CheckOutlined /> : undefined}
        onClick={onSelect}
      >
        {selected ? "Đang dùng" : "Dùng"}
      </Button>
    </Space>
  );
}

// Lets the user pick between the free-dictionary definition and an
// AI-generated one right after a lookup — whichever gets picked is written
// into the same VocabEntry.definition field the "Định nghĩa riêng" textbox
// already used, so there's no new persisted shape here, just a second
// source to fill it from. The picked text also gets threaded into the
// examples/"khi nào dùng"/related-words generation calls (see ai.ts's
// definitionContext) so they're grounded in the specific sense picked.
export default function DefinitionChooser({
  dictionaryDefinition,
  aiDefinition,
  aiLoading,
  aiError,
  onGenerateAi,
  selectedText,
  onSelect,
}: {
  dictionaryDefinition: string | null;
  aiDefinition: string | null;
  aiLoading: boolean;
  aiError: string | null;
  onGenerateAi: () => void;
  selectedText: string;
  onSelect: (text: string) => void;
}) {
  return (
    <>
      {dictionaryDefinition && (
        <div style={{ marginTop: 16, borderTop: `1px solid ${styleTokens.borderColorLight}`, paddingTop: 12 }}>
          <Typography.Text strong style={{ display: "block", marginBottom: 8 }}>
            Định nghĩa từ điển
          </Typography.Text>
          <Candidate
            text={dictionaryDefinition}
            selected={selectedText === dictionaryDefinition}
            onSelect={() => onSelect(dictionaryDefinition)}
          />
        </div>
      )}
      <AiSection
        icon={<ThunderboltOutlined />}
        title="Định nghĩa AI"
        hasContent={!!aiDefinition}
        loading={aiLoading}
        error={aiError}
        onGenerate={onGenerateAi}
      >
        {aiDefinition && (
          <Candidate text={aiDefinition} selected={selectedText === aiDefinition} onSelect={() => onSelect(aiDefinition)} />
        )}
      </AiSection>
    </>
  );
}
