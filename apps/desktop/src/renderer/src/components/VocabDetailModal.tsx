import { useEffect, useState } from "react";
import { CloseOutlined, SoundOutlined } from "@ant-design/icons";
import { Button, Input, message, Modal, Select, Space, Spin, Tag, Typography } from "antd";
import type { DictionaryInfo, VocabEntryRow } from "../../../preload/index";
import DictionaryPanel from "./DictionaryPanel";
import { dayLabel, timeLabel } from "../lib/date";
import { speak } from "../lib/speak";
import { styleTokens } from "../theme";

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
      message.success("Đã lưu");
    } catch (err) {
      message.error(`Lưu thất bại: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSavingEdit(false);
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
              <Typography.Text strong style={{ display: "block", marginTop: 12 }}>
                Nhãn
              </Typography.Text>
              <Select
                mode="tags"
                value={tags}
                onChange={setTags}
                style={{ width: "100%", marginTop: 4 }}
                placeholder="Thêm nhãn..."
                tokenSeparators={[","]}
              />
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
          </div>
        </>
      )}
    </Modal>
  );
}
