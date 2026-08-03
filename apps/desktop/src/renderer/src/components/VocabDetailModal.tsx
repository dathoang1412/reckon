import { useEffect, useState } from "react";
import { SoundOutlined } from "@ant-design/icons";
import { Button, Modal, Space, Spin, Tag, Typography } from "antd";
import type { DictionaryInfo, VocabEntryRow } from "../../preload/index";
import DictionaryPanel from "./DictionaryPanel";
import { speak } from "./speak";

export default function VocabDetailModal({ entry, onClose }: { entry: VocabEntryRow | null; onClose: () => void }) {
  const [dictionary, setDictionary] = useState<DictionaryInfo | null>(null);
  const [loading, setLoading] = useState(false);

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

  return (
    <Modal open={!!entry} onCancel={onClose} footer={null} destroyOnHidden>
      {entry && (
        <div style={{ maxHeight: "70vh", overflowY: "auto", paddingRight: 4 }}>
          <Tag color="blue">{entry.sourceLang}</Tag>
          <Space align="center" style={{ margin: "8px 0" }}>
            <Typography.Paragraph style={{ margin: 0 }}>{entry.sourceText}</Typography.Paragraph>
            <Button
              type="text"
              size="small"
              icon={<SoundOutlined />}
              onClick={() => speak(entry.sourceText, entry.sourceLang)}
            />
          </Space>
          <Tag color="green">{entry.targetLang}</Tag>
          <Space align="center" style={{ margin: "8px 0 0" }}>
            <Typography.Paragraph strong style={{ margin: 0 }}>
              {entry.targetText}
            </Typography.Paragraph>
            <Button
              type="text"
              size="small"
              icon={<SoundOutlined />}
              onClick={() => speak(entry.targetText, entry.targetLang)}
            />
          </Space>

          {loading && <Spin style={{ display: "block", margin: "16px 0" }} />}
          {dictionary && <DictionaryPanel dictionary={dictionary} />}
        </div>
      )}
    </Modal>
  );
}
