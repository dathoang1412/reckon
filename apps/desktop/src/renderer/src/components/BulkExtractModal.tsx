import { useState } from "react";
import BoltIcon from "@mui/icons-material/Bolt";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
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

const MAX_PARAGRAPH_LENGTH = 4000;

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
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>Trích xuất từ vựng từ đoạn văn</DialogTitle>
      <DialogContent>
        {stage !== "reviewing" ? (
          <>
            <Typography color="text.secondary" sx={{ marginTop: "4px" }}>
              Dán một đoạn văn bản — AI sẽ tìm những từ/cụm từ đáng học trong đó.
            </Typography>
            <TextField
              value={paragraph}
              onChange={(e) => setParagraph(e.target.value.slice(0, MAX_PARAGRAPH_LENGTH))}
              placeholder="Dán đoạn văn ở đây..."
              multiline
              minRows={6}
              maxRows={12}
              fullWidth
              helperText={`${paragraph.length}/${MAX_PARAGRAPH_LENGTH}`}
              sx={{ marginTop: 1 }}
            />
            {analyzeError && (
              <Typography color="error" sx={{ display: "block", marginTop: "8px" }}>
                {analyzeError}
              </Typography>
            )}
            <Tooltip title={hasGroqKey === false ? "Cần thêm Groq API key trong Cài đặt" : ""}>
              <span>
                <Button
                  variant="contained"
                  startIcon={<BoltIcon />}
                  loading={stage === "analyzing"}
                  disabled={!paragraph.trim() || hasGroqKey === false}
                  onClick={handleAnalyze}
                  sx={{ marginTop: "12px" }}
                >
                  Phân tích
                </Button>
              </span>
            </Tooltip>
          </>
        ) : (
          <>
            {hiddenCount > 0 && (
              <Typography color="text.secondary" sx={{ display: "block", marginBottom: "8px" }}>
                {hiddenCount} từ đã có trong sổ, đã ẩn.
              </Typography>
            )}
            {rows.length === 0 ? (
              <Typography color="text.secondary">Không tìm thấy từ nào đáng học trong đoạn văn này.</Typography>
            ) : (
              <Stack spacing={1} sx={{ maxHeight: "50vh", overflowY: "auto" }}>
                {rows.map((row, i) => (
                  <Stack key={i} direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
                    <Checkbox
                      checked={row.checked}
                      disabled={row.status !== "resolved"}
                      onChange={(e) => toggleRow(i, e.target.checked)}
                      sx={{ padding: "4px" }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 600 }}>{row.text}</Typography>
                      <Typography color="text.secondary" sx={{ display: "block", fontSize: styleTokens.secondaryFontSize }}>
                        {row.reason}
                      </Typography>
                      {row.status === "pending" && <CircularProgress size={16} sx={{ marginTop: "4px" }} />}
                      {row.status === "resolved" && row.preview && (
                        <Typography color="text.secondary" sx={{ display: "block", marginTop: "2px" }}>
                          → {row.preview.result.targetText}
                        </Typography>
                      )}
                      {row.status === "error" && (
                        <Typography color="error" sx={{ display: "block", marginTop: "2px" }}>
                          Bỏ qua — {row.error}
                        </Typography>
                      )}
                    </div>
                  </Stack>
                ))}
              </Stack>
            )}
            <Button
              variant="contained"
              fullWidth
              loading={saving}
              disabled={pendingCount > 0 || selectedResolved.length === 0}
              onClick={handleSaveSelected}
              sx={{ marginTop: "12px" }}
            >
              {saving
                ? `Đã lưu ${savedCount}/${selectedResolved.length}`
                : `Lưu tất cả đã chọn (${selectedResolved.length})`}
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
