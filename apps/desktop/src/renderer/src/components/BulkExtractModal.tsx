import { useState } from "react";
import { ThunderboltOutlined } from "@ant-design/icons";
import { Button, Checkbox, Input, List, Modal, Space, Spin, Tooltip, Typography } from "antd";
import toast from "react-hot-toast";
import type { VocabEntryRow, VocabPreview } from "../../../preload/index";
import { useHasGroqKey } from "../lib/useHasGroqKey";
import { styleTokens } from "../theme";

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

interface CandidateRow {
  text: string;
  reason: string;
  checked: boolean;
  status: "pending" | "resolved" | "error";
  preview?: VocabPreview;
  error?: string;
}

// How many vocab.preview calls run at once while resolving candidate
// translations — high enough to feel fast, low enough not to hammer the
// translate/dictionary endpoints with 15 simultaneous requests.
const PREVIEW_CONCURRENCY = 3;

type Stage = "idle" | "analyzing" | "reviewing";

export default function BulkExtractModal({
  open,
  onClose,
  entries,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  entries: VocabEntryRow[];
  onSaved: () => void;
}) {
  const hasGroqKey = useHasGroqKey();
  const [stage, setStage] = useState<Stage>("idle");
  const [paragraph, setParagraph] = useState("");
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [rows, setRows] = useState<CandidateRow[]>([]);
  const [hiddenCount, setHiddenCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  function reset() {
    setStage("idle");
    setParagraph("");
    setAnalyzeError(null);
    setRows([]);
    setHiddenCount(0);
    setSaving(false);
    setSavedCount(0);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function resolvePreviews(candidateRows: CandidateRow[]) {
    let cursor = 0;
    async function worker() {
      while (cursor < candidateRows.length) {
        const i = cursor++;
        try {
          const preview = await window.api.vocab.preview(candidateRows[i].text);
          setRows((prev) => prev.map((r, ri) => (ri === i ? { ...r, status: "resolved", preview } : r)));
        } catch (err) {
          setRows((prev) => prev.map((r, ri) => (ri === i ? { ...r, status: "error", error: errorMessage(err) } : r)));
        }
      }
    }
    await Promise.all(Array.from({ length: PREVIEW_CONCURRENCY }, worker));
  }

  async function handleAnalyze() {
    const trimmed = paragraph.trim();
    if (!trimmed) return;
    setStage("analyzing");
    setAnalyzeError(null);
    try {
      const candidates = await window.api.ai.extractVocab(trimmed);
      const existing = new Set(entries.map((e) => e.sourceText.toLowerCase()));
      const fresh = candidates.filter((c) => !existing.has(c.text.toLowerCase()));
      setHiddenCount(candidates.length - fresh.length);
      const newRows: CandidateRow[] = fresh.map((c) => ({
        text: c.text,
        reason: c.reason,
        checked: true,
        status: "pending",
      }));
      setRows(newRows);
      setStage("reviewing");
      resolvePreviews(newRows);
    } catch (err) {
      setAnalyzeError(errorMessage(err));
      setStage("idle");
    }
  }

  function toggleRow(index: number, checked: boolean) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, checked } : r)));
  }

  const pendingCount = rows.filter((r) => r.status === "pending").length;
  const selectedResolved = rows.filter((r) => r.checked && r.status === "resolved" && r.preview);

  async function handleSaveSelected() {
    if (selectedResolved.length === 0) return;
    setSaving(true);
    setSavedCount(0);
    try {
      for (const row of selectedResolved) {
        await window.api.vocab.save(row.preview!.result);
        setSavedCount((c) => c + 1);
      }
      toast.success(`Đã lưu ${selectedResolved.length} từ`);
      onSaved();
      handleClose();
    } catch (err) {
      toast.error(`Lưu thất bại: ${errorMessage(err)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Trích xuất từ vựng từ đoạn văn" open={open} onCancel={handleClose} footer={null} width={560}>
      {stage !== "reviewing" ? (
        <>
          <Typography.Paragraph type="secondary" style={{ marginTop: 4 }}>
            Dán một đoạn văn bản — AI sẽ tìm những từ/cụm từ đáng học trong đó.
          </Typography.Paragraph>
          <Input.TextArea
            value={paragraph}
            onChange={(e) => setParagraph(e.target.value)}
            placeholder="Dán đoạn văn ở đây..."
            maxLength={4000}
            showCount
            autoSize={{ minRows: 6, maxRows: 12 }}
          />
          {analyzeError && (
            <Typography.Text type="danger" style={{ display: "block", marginTop: 8 }}>
              {analyzeError}
            </Typography.Text>
          )}
          <Tooltip title={hasGroqKey === false ? "Cần thêm Groq API key trong Cài đặt" : undefined}>
            <span>
              <Button
                type="primary"
                icon={<ThunderboltOutlined />}
                loading={stage === "analyzing"}
                disabled={!paragraph.trim() || hasGroqKey === false}
                onClick={handleAnalyze}
                style={{ marginTop: 12 }}
              >
                Phân tích
              </Button>
            </span>
          </Tooltip>
        </>
      ) : (
        <>
          {hiddenCount > 0 && (
            <Typography.Text type="secondary" style={{ display: "block", marginBottom: 8 }}>
              {hiddenCount} từ đã có trong sổ, đã ẩn.
            </Typography.Text>
          )}
          {rows.length === 0 ? (
            <Typography.Text type="secondary">Không tìm thấy từ nào đáng học trong đoạn văn này.</Typography.Text>
          ) : (
            <List
              style={{ maxHeight: "50vh", overflowY: "auto" }}
              dataSource={rows}
              renderItem={(row, i) => (
                <List.Item style={{ alignItems: "flex-start" }}>
                  <Space align="start" style={{ width: "100%" }}>
                    <Checkbox
                      checked={row.checked}
                      disabled={row.status !== "resolved"}
                      onChange={(e) => toggleRow(i, e.target.checked)}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Typography.Text strong>{row.text}</Typography.Text>
                      <Typography.Text
                        type="secondary"
                        style={{ display: "block", fontSize: styleTokens.secondaryFontSize }}
                      >
                        {row.reason}
                      </Typography.Text>
                      {row.status === "pending" && <Spin size="small" style={{ marginTop: 4 }} />}
                      {row.status === "resolved" && row.preview && (
                        <Typography.Text type="secondary" style={{ display: "block", marginTop: 2 }}>
                          → {row.preview.result.targetText}
                        </Typography.Text>
                      )}
                      {row.status === "error" && (
                        <Typography.Text type="danger" style={{ display: "block", marginTop: 2 }}>
                          Bỏ qua — {row.error}
                        </Typography.Text>
                      )}
                    </div>
                  </Space>
                </List.Item>
              )}
            />
          )}
          <Button
            type="primary"
            block
            loading={saving}
            disabled={pendingCount > 0 || selectedResolved.length === 0}
            onClick={handleSaveSelected}
            style={{ marginTop: 12 }}
          >
            {saving
              ? `Đã lưu ${savedCount}/${selectedResolved.length}`
              : `Lưu tất cả đã chọn (${selectedResolved.length})`}
          </Button>
        </>
      )}
    </Modal>
  );
}
