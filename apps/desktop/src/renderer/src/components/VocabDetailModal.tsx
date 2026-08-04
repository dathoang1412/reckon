import { useEffect, useState } from "react";
import {
  ApartmentOutlined,
  CloseOutlined,
  DiffOutlined,
  FileTextOutlined,
  BulbOutlined,
  SoundOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { Button, Input, Modal, Select, Space, Spin, Tag, Tooltip, Typography } from "antd";
import toast from "react-hot-toast";
import type { DictionaryInfo, TagSuggestion, VocabEntryRow } from "../../../preload/index";
import AiSection from "./AiSection";
import DictionaryPanel from "./DictionaryPanel";
import { dayLabel, timeLabel } from "../lib/date";
import { speak } from "../lib/speak";
import { useHasGroqKey } from "../lib/useHasGroqKey";
import { styleTokens } from "../theme";

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export default function VocabDetailModal({
  entry,
  onClose,
  onUpdate,
}: {
  entry: VocabEntryRow | null;
  onClose: () => void;
  onUpdate: (entry: VocabEntryRow) => void;
}) {
  const [dictionary, setDictionary] = useState<DictionaryInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");
  const [definition, setDefinition] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  const [suggesting, setSuggesting] = useState(false);
  const [suggestedTags, setSuggestedTags] = useState<TagSuggestion | null>(null);
  const hasGroqKey = useHasGroqKey();

  const [examplesLoading, setExamplesLoading] = useState(false);
  const [examplesError, setExamplesError] = useState<string | null>(null);
  const [nuanceLoading, setNuanceLoading] = useState(false);
  const [nuanceError, setNuanceError] = useState<string | null>(null);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [relatedError, setRelatedError] = useState<string | null>(null);
  const [mnemonicLoading, setMnemonicLoading] = useState(false);
  const [mnemonicError, setMnemonicError] = useState<string | null>(null);

  // Fetched on demand rather than stored on the entry — the dictionary
  // data can always be re-fetched fresh, so there's no need to widen the
  // synced schema just to cache it.
  useEffect(() => {
    setDictionary(null);
    if (!entry) return;

    const englishWord =
      entry.sourceLang === "en" ? entry.sourceText : entry.targetLang === "en" ? entry.targetText : null;
    if (!englishWord) return;

    setLoading(true);
    window.api.dictionary
      .lookup(englishWord)
      .then(setDictionary)
      .finally(() => setLoading(false));
  }, [entry]);

  // Keyed on entry.id (not the whole entry object) so typing in the fields
  // doesn't get clobbered by an onUpdate-triggered re-render of the same entry.
  useEffect(() => {
    setNote(entry?.note ?? "");
    setDefinition(entry?.definition ?? "");
    setTags(entry?.tags ?? []);
    setSuggestedTags(null);
    setExamplesError(null);
    setNuanceError(null);
    setRelatedError(null);
    setMnemonicError(null);
  }, [entry?.id]);

  async function handleSaveEdit() {
    if (!entry) return;
    setSavingEdit(true);
    try {
      const updated = await window.api.vocab.update(entry.id, {
        note: note.trim() || null,
        definition: definition.trim() || null,
        tags,
      });
      onUpdate(updated);
      toast.success("Đã lưu");
    } catch (err) {
      toast.error(`Lưu thất bại: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleSuggestTags() {
    if (!entry) return;
    setSuggesting(true);
    try {
      setSuggestedTags(await window.api.ai.suggestTags(entry.id));
    } catch (err) {
      toast.error(`Gợi ý thất bại: ${errorMessage(err)}`);
    } finally {
      setSuggesting(false);
    }
  }

  function acceptSuggestedTag(tag: string) {
    setTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]));
  }

  async function acceptSuggestedSet() {
    if (!entry || !suggestedTags?.suggestedSetId) return;
    try {
      onUpdate(await window.api.vocab.setSet(entry.id, suggestedTags.suggestedSetId));
      toast.success("Đã xếp vào bộ từ");
    } catch (err) {
      toast.error(`Thất bại: ${errorMessage(err)}`);
    }
  }

  async function handleGenerateExamples() {
    if (!entry) return;
    setExamplesLoading(true);
    setExamplesError(null);
    try {
      onUpdate(await window.api.ai.generateExamples(entry.id));
    } catch (err) {
      setExamplesError(errorMessage(err));
    } finally {
      setExamplesLoading(false);
    }
  }

  async function handleExplainNuance() {
    if (!entry) return;
    setNuanceLoading(true);
    setNuanceError(null);
    try {
      onUpdate(await window.api.ai.explainNuance(entry.id));
    } catch (err) {
      setNuanceError(errorMessage(err));
    } finally {
      setNuanceLoading(false);
    }
  }

  async function handleSuggestRelatedWords() {
    if (!entry) return;
    setRelatedLoading(true);
    setRelatedError(null);
    try {
      onUpdate(await window.api.ai.suggestRelatedWords(entry.id));
    } catch (err) {
      setRelatedError(errorMessage(err));
    } finally {
      setRelatedLoading(false);
    }
  }

  async function handleGenerateMnemonic() {
    if (!entry) return;
    setMnemonicLoading(true);
    setMnemonicError(null);
    try {
      onUpdate(await window.api.ai.generateMnemonic(entry.id));
    } catch (err) {
      setMnemonicError(errorMessage(err));
    } finally {
      setMnemonicLoading(false);
    }
  }

  return (
    <Modal
      open={!!entry}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
      centered
      // antd's default close button is absolutely positioned over the
      // content's top-right corner, which collided with this modal's own
      // scrollbar there — closable={false} + a hand-rolled button in normal
      // flow (below, outside the scroll area) sidesteps that entirely
      // instead of guessing padding to match antd's internal offsets.
      closable={false}
      // antd's own modal wrap also scrolls by default (overflow: auto) —
      // with the body below already managing its own scroll region
      // (maxHeight 70vh + overflowY auto), that produced two nested
      // scrollbars once the note/tags/definition section made content
      // taller. Disabling the wrap's own scroll leaves exactly one.
      styles={{ wrapper: { overflow: "hidden" } }}
    >
      {entry && (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button type="text" size="small" icon={<CloseOutlined />} onClick={onClose} />
          </div>
          <div style={{ maxHeight: "70vh", overflowY: "auto", paddingRight: 4 }}>
            <Typography.Text type="secondary" style={{ fontSize: styleTokens.secondaryFontSize }}>
              {dayLabel(entry.createdAt)} · {timeLabel(entry.createdAt)}
            </Typography.Text>
            <Tag color="blue" style={{ display: "block", width: "fit-content", marginTop: 4 }}>
              {entry.sourceLang}
            </Tag>
            <Space align="center" style={{ margin: "8px 0" }}>
              <Typography.Paragraph style={{ margin: 0 }}>{entry.sourceText}</Typography.Paragraph>
              {entry.sourceLang !== "vi" && (
                <Button
                  type="text"
                  size="small"
                  icon={<SoundOutlined />}
                  onClick={() => speak(entry.sourceText, entry.sourceLang)}
                />
              )}
            </Space>
            <Tag color="green">{entry.targetLang}</Tag>
            <Space align="center" style={{ margin: "8px 0 0" }}>
              <Typography.Paragraph strong style={{ margin: 0 }}>
                {entry.targetText}
              </Typography.Paragraph>
              {entry.targetLang !== "vi" && (
                <Button
                  type="text"
                  size="small"
                  icon={<SoundOutlined />}
                  onClick={() => speak(entry.targetText, entry.targetLang)}
                />
              )}
            </Space>
            {entry.targetMeanings.length > 1 && (
              <Space size={[4, 4]} wrap style={{ marginTop: 4 }}>
                {entry.targetMeanings.slice(1).map((meaning) => (
                  <Tag key={meaning} color="default">
                    {meaning}
                  </Tag>
                ))}
              </Space>
            )}

            {loading && <Spin style={{ display: "block", margin: "16px 0" }} />}
            {dictionary && <DictionaryPanel dictionary={dictionary} />}

            <div
              style={{
                marginTop: 16,
                borderTop: `1px solid ${styleTokens.borderColorLight}`,
                paddingTop: 12,
              }}
            >
              <Typography.Text strong>Ghi chú</Typography.Text>
              <Input.TextArea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ghi chú cá nhân..."
                autoSize={{ minRows: 2, maxRows: 4 }}
                style={{ marginTop: 4 }}
              />
              <Typography.Text strong style={{ display: "block", marginTop: 12 }}>
                Định nghĩa riêng
              </Typography.Text>
              <Input.TextArea
                value={definition}
                onChange={(e) => setDefinition(e.target.value)}
                placeholder="Định nghĩa của riêng bạn..."
                autoSize={{ minRows: 2, maxRows: 4 }}
                style={{ marginTop: 4 }}
              />
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: 12,
                }}
              >
                <Typography.Text strong>Nhãn</Typography.Text>
                <Tooltip title={hasGroqKey === false ? "Cần thêm Groq API key trong Cài đặt" : undefined}>
                  <span>
                    <Button
                      type="link"
                      size="small"
                      icon={<ThunderboltOutlined />}
                      loading={suggesting}
                      disabled={hasGroqKey === false}
                      onClick={handleSuggestTags}
                    >
                      Gợi ý
                    </Button>
                  </span>
                </Tooltip>
              </div>
              <Select
                mode="tags"
                value={tags}
                onChange={setTags}
                style={{ width: "100%", marginTop: 4 }}
                placeholder="Thêm nhãn..."
                tokenSeparators={[","]}
              />
              {suggestedTags && (suggestedTags.tags.length > 0 || suggestedTags.suggestedSetId) && (
                <Space size={[4, 4]} wrap style={{ marginTop: 6 }}>
                  {suggestedTags.tags
                    .filter((t) => !tags.includes(t))
                    .map((t) => (
                      <Tag
                        key={t}
                        style={{ cursor: "pointer", borderStyle: "dashed" }}
                        onClick={() => acceptSuggestedTag(t)}
                      >
                        + {t}
                      </Tag>
                    ))}
                  {suggestedTags.suggestedSetId && (
                    <Tag color="blue" style={{ cursor: "pointer" }} onClick={acceptSuggestedSet}>
                      Xếp vào: {suggestedTags.suggestedSetName}
                    </Tag>
                  )}
                </Space>
              )}
              <Button
                type="primary"
                size="small"
                loading={savingEdit}
                onClick={handleSaveEdit}
                style={{ marginTop: 12 }}
              >
                Lưu
              </Button>
            </div>

            <AiSection
              icon={<FileTextOutlined />}
              title="Ví dụ câu"
              hasContent={entry.aiExamples.length > 0}
              loading={examplesLoading}
              error={examplesError}
              onGenerate={handleGenerateExamples}
            >
              <Space direction="vertical" size={8} style={{ width: "100%" }}>
                {entry.aiExamples.map((ex, i) => (
                  <div key={i}>
                    <Typography.Text>{ex.sentence}</Typography.Text>
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
              title="Sắc thái & ngữ cảnh"
              hasContent={!!entry.aiNuance}
              loading={nuanceLoading}
              error={nuanceError}
              onGenerate={handleExplainNuance}
            >
              <Typography.Paragraph style={{ margin: 0 }}>{entry.aiNuance}</Typography.Paragraph>
            </AiSection>

            <AiSection
              icon={<ApartmentOutlined />}
              title="Từ liên quan"
              hasContent={!!entry.aiRelatedWords}
              loading={relatedLoading}
              error={relatedError}
              disabledReason={
                entry.sourceLang === "en" || entry.targetLang === "en" ? null : "Chỉ hỗ trợ cho từ tiếng Anh"
              }
              onGenerate={handleSuggestRelatedWords}
            >
              {entry.aiRelatedWords && (
                <Space direction="vertical" size={6} style={{ width: "100%" }}>
                  {entry.aiRelatedWords.synonyms.length > 0 && (
                    <div>
                      <Typography.Text type="secondary" style={{ fontSize: styleTokens.secondaryFontSize }}>
                        Đồng nghĩa
                      </Typography.Text>
                      <div>
                        {entry.aiRelatedWords.synonyms.map((w) => (
                          <Tag key={w}>{w}</Tag>
                        ))}
                      </div>
                    </div>
                  )}
                  {entry.aiRelatedWords.antonyms.length > 0 && (
                    <div>
                      <Typography.Text type="secondary" style={{ fontSize: styleTokens.secondaryFontSize }}>
                        Trái nghĩa
                      </Typography.Text>
                      <div>
                        {entry.aiRelatedWords.antonyms.map((w) => (
                          <Tag key={w} color="default">
                            {w}
                          </Tag>
                        ))}
                      </div>
                    </div>
                  )}
                  {entry.aiRelatedWords.forms.length > 0 && (
                    <div>
                      <Typography.Text type="secondary" style={{ fontSize: styleTokens.secondaryFontSize }}>
                        Dạng từ khác
                      </Typography.Text>
                      <div>
                        {entry.aiRelatedWords.forms.map((f, i) => (
                          <Tag key={i} color="blue">
                            {f.word} <Typography.Text type="secondary">({f.pos})</Typography.Text>
                          </Tag>
                        ))}
                      </div>
                    </div>
                  )}
                </Space>
              )}
            </AiSection>

            <AiSection
              icon={<BulbOutlined />}
              title="Mẹo ghi nhớ"
              hasContent={!!entry.mnemonic}
              loading={mnemonicLoading}
              error={mnemonicError}
              onGenerate={handleGenerateMnemonic}
            >
              <Typography.Text>{entry.mnemonic}</Typography.Text>
            </AiSection>
          </div>
        </>
      )}
    </Modal>
  );
}
