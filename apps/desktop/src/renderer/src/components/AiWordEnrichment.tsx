import { ApartmentOutlined, DiffOutlined, FileTextOutlined, SoundOutlined } from "@ant-design/icons";
import { Button, Space, Tag, Typography } from "antd";
import type { AiExample, AiRelatedWords } from "../../../preload/index";
import AiSection from "./AiSection";
import { safeForms } from "../lib/aiRelatedWords";
import { speak } from "../lib/speak";
import { styleTokens } from "../theme";

interface GenerateState {
  loading: boolean;
  error: string | null;
}

// The three Groq enrichment blocks (examples, nuance, related words) shared
// between VocabDetailModal (a saved entry, generate calls persist directly)
// and App.tsx's search preview (not saved yet, generate calls hit the
// ai:preview* channels instead) — same layout either way, only how each
// caller fetches/stores the results differs.
export default function AiWordEnrichment({
  aiExamples,
  aiNuance,
  aiRelatedWords,
  relatedWordsDisabledReason,
  sourceLang,
  examplesState,
  nuanceState,
  relatedState,
  onGenerateExamples,
  onGenerateNuance,
  onGenerateRelated,
}: {
  aiExamples: AiExample[];
  aiNuance: string | null;
  aiRelatedWords: AiRelatedWords | null;
  relatedWordsDisabledReason: string | null;
  // Example sentences are generated in whichever language the looked-up
  // word itself is (see ai.ts's examplesContent prompt) — always the
  // word's sourceLang, not necessarily "en", so the speaker button needs
  // this to pass the right language to speak().
  sourceLang: string;
  examplesState: GenerateState;
  nuanceState: GenerateState;
  relatedState: GenerateState;
  onGenerateExamples: () => void;
  onGenerateNuance: () => void;
  onGenerateRelated: () => void;
}) {
  return (
    <>
      <AiSection
        icon={<FileTextOutlined />}
        title="Ví dụ câu"
        hasContent={aiExamples.length > 0}
        loading={examplesState.loading}
        error={examplesState.error}
        onGenerate={onGenerateExamples}
      >
        <Space direction="vertical" size={8} style={{ width: "100%" }}>
          {aiExamples.map((ex, i) => (
            <div key={i}>
              <Space align="start" size={4}>
                <Typography.Text>{ex.sentence}</Typography.Text>
                {sourceLang !== "vi" && (
                  <Button
                    type="text"
                    size="small"
                    icon={<SoundOutlined />}
                    onClick={() => speak(ex.sentence, sourceLang)}
                  />
                )}
              </Space>
              <Typography.Text
                type="secondary"
                italic
                style={{ display: "block", fontSize: styleTokens.secondaryFontSize }}
              >
                {ex.translation}
              </Typography.Text>
            </div>
          ))}
        </Space>
      </AiSection>

      <AiSection
        icon={<DiffOutlined />}
        title="Khi nào dùng"
        hasContent={!!aiNuance}
        loading={nuanceState.loading}
        error={nuanceState.error}
        onGenerate={onGenerateNuance}
      >
        <Typography.Paragraph style={{ margin: 0 }}>{aiNuance}</Typography.Paragraph>
      </AiSection>

      <AiSection
        icon={<ApartmentOutlined />}
        title="Từ liên quan"
        hasContent={!!aiRelatedWords}
        loading={relatedState.loading}
        error={relatedState.error}
        disabledReason={relatedWordsDisabledReason}
        onGenerate={onGenerateRelated}
      >
        {aiRelatedWords && (
          <Space direction="vertical" size={6} style={{ width: "100%" }}>
            {aiRelatedWords.synonyms.length > 0 && (
              <div>
                <Typography.Text type="secondary" style={{ fontSize: styleTokens.secondaryFontSize }}>
                  Đồng nghĩa
                </Typography.Text>
                <div>
                  {aiRelatedWords.synonyms.map((w) => (
                    <Tag key={w}>{w}</Tag>
                  ))}
                </div>
              </div>
            )}
            {aiRelatedWords.antonyms.length > 0 && (
              <div>
                <Typography.Text type="secondary" style={{ fontSize: styleTokens.secondaryFontSize }}>
                  Trái nghĩa
                </Typography.Text>
                <div>
                  {aiRelatedWords.antonyms.map((w) => (
                    <Tag key={w} color="default">
                      {w}
                    </Tag>
                  ))}
                </div>
              </div>
            )}
            {safeForms(aiRelatedWords.forms).length > 0 && (
              <div>
                <Typography.Text type="secondary" style={{ fontSize: styleTokens.secondaryFontSize }}>
                  Dạng từ khác
                </Typography.Text>
                <div>
                  {safeForms(aiRelatedWords.forms).map((f, i) => (
                    <Tag key={i} color="blue">
                      {f.word} {f.pos && <Typography.Text type="secondary">({f.pos})</Typography.Text>}
                    </Tag>
                  ))}
                </div>
              </div>
            )}
          </Space>
        )}
      </AiSection>
    </>
  );
}
