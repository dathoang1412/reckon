import { useEffect, useState } from "react";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import BoltIcon from "@mui/icons-material/Bolt";
import CloseIcon from "@mui/icons-material/Close";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import DescriptionIcon from "@mui/icons-material/Description";
import LightbulbIcon from "@mui/icons-material/Lightbulb";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import Autocomplete from "@mui/material/Autocomplete";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
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
    <Dialog open={!!entry} onClose={onClose} fullWidth maxWidth="sm" scroll="paper">
      {entry && (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 8px 0" }}>
            <IconButton size="small" onClick={onClose}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </div>
          <DialogContent sx={{ paddingTop: 0 }}>
            <Typography color="text.secondary" sx={{ fontSize: styleTokens.secondaryFontSize }}>
              {dayLabel(entry.createdAt)} · {timeLabel(entry.createdAt)}
            </Typography>
            <Chip label={entry.sourceLang} color="primary" size="small" sx={{ display: "flex", width: "fit-content", marginTop: "4px" }} />
            <Stack direction="row" sx={{ alignItems: "center", margin: "8px 0" }}>
              <Typography sx={{ margin: 0 }}>{entry.sourceText}</Typography>
              {entry.sourceLang !== "vi" && (
                <IconButton size="small" onClick={() => speak(entry.sourceText, entry.sourceLang)}>
                  <VolumeUpIcon fontSize="small" />
                </IconButton>
              )}
            </Stack>
            <Chip label={entry.targetLang} color="success" size="small" />
            <Stack direction="row" sx={{ alignItems: "center", margin: "8px 0 0" }}>
              <Typography sx={{ margin: 0, fontWeight: 600 }}>{entry.targetText}</Typography>
              {entry.targetLang !== "vi" && (
                <IconButton size="small" onClick={() => speak(entry.targetText, entry.targetLang)}>
                  <VolumeUpIcon fontSize="small" />
                </IconButton>
              )}
            </Stack>
            {entry.targetMeanings.length > 1 && (
              <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", marginTop: "4px" }}>
                {entry.targetMeanings.slice(1).map((meaning) => (
                  <Chip key={meaning} label={meaning} size="small" variant="outlined" />
                ))}
              </Stack>
            )}

            {loading && <CircularProgress size={20} sx={{ display: "block", margin: "16px 0" }} />}
            {dictionary && <DictionaryPanel dictionary={dictionary} />}

            <div
              style={{
                marginTop: 16,
                borderTop: `1px solid ${styleTokens.borderColorLight}`,
                paddingTop: 12,
              }}
            >
              <Typography sx={{ fontWeight: 600 }}>Ghi chú</Typography>
              <TextField
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ghi chú cá nhân..."
                multiline
                minRows={2}
                maxRows={4}
                fullWidth
                sx={{ marginTop: "4px" }}
              />
              <Typography sx={{ fontWeight: 600, display: "block", marginTop: "12px" }}>Định nghĩa riêng</Typography>
              <TextField
                value={definition}
                onChange={(e) => setDefinition(e.target.value)}
                placeholder="Định nghĩa của riêng bạn..."
                multiline
                minRows={2}
                maxRows={4}
                fullWidth
                sx={{ marginTop: "4px" }}
              />
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: 12,
                }}
              >
                <Typography sx={{ fontWeight: 600 }}>Nhãn</Typography>
                <Tooltip title={hasGroqKey === false ? "Cần thêm Groq API key trong Cài đặt" : ""}>
                  <span>
                    <Button
                      size="small"
                      startIcon={<BoltIcon />}
                      loading={suggesting}
                      disabled={hasGroqKey === false}
                      onClick={handleSuggestTags}
                    >
                      Gợi ý
                    </Button>
                  </span>
                </Tooltip>
              </div>
              <Autocomplete
                multiple
                freeSolo
                options={[]}
                value={tags}
                onChange={(_e, value) => setTags(value as string[])}
                renderValue={(value, getItemProps) =>
                  value.map((option, index) => {
                    const { key, ...itemProps } = getItemProps({ index });
                    return <Chip key={key} label={option} size="small" {...itemProps} />;
                  })
                }
                renderInput={(params) => <TextField {...params} placeholder="Thêm nhãn..." />}
                sx={{ marginTop: "4px" }}
              />
              {suggestedTags && (suggestedTags.tags.length > 0 || suggestedTags.suggestedSetId) && (
                <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", marginTop: "6px" }}>
                  {suggestedTags.tags
                    .filter((t) => !tags.includes(t))
                    .map((t) => (
                      <Chip
                        key={t}
                        label={`+ ${t}`}
                        variant="outlined"
                        sx={{ cursor: "pointer", borderStyle: "dashed" }}
                        onClick={() => acceptSuggestedTag(t)}
                      />
                    ))}
                  {suggestedTags.suggestedSetId && (
                    <Chip
                      label={`Xếp vào: ${suggestedTags.suggestedSetName}`}
                      color="primary"
                      sx={{ cursor: "pointer" }}
                      onClick={acceptSuggestedSet}
                    />
                  )}
                </Stack>
              )}
              <Button variant="contained" size="small" loading={savingEdit} onClick={handleSaveEdit} sx={{ marginTop: "12px" }}>
                Lưu
              </Button>
            </div>

            <AiSection
              icon={<DescriptionIcon fontSize="small" />}
              title="Ví dụ câu"
              hasContent={entry.aiExamples.length > 0}
              loading={examplesLoading}
              error={examplesError}
              onGenerate={handleGenerateExamples}
            >
              <Stack spacing={1} sx={{ width: "100%" }}>
                {entry.aiExamples.map((ex, i) => (
                  <div key={i}>
                    <Typography>{ex.sentence}</Typography>
                    <Typography color="text.secondary" sx={{ display: "block", fontSize: styleTokens.secondaryFontSize, fontStyle: "italic" }}>
                      {ex.translation}
                    </Typography>
                  </div>
                ))}
              </Stack>
            </AiSection>

            <AiSection
              icon={<CompareArrowsIcon fontSize="small" />}
              title="Sắc thái & ngữ cảnh"
              hasContent={!!entry.aiNuance}
              loading={nuanceLoading}
              error={nuanceError}
              onGenerate={handleExplainNuance}
            >
              <Typography sx={{ margin: 0 }}>{entry.aiNuance}</Typography>
            </AiSection>

            <AiSection
              icon={<AccountTreeIcon fontSize="small" />}
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
                <Stack spacing={0.75} sx={{ width: "100%" }}>
                  {entry.aiRelatedWords.synonyms.length > 0 && (
                    <div>
                      <Typography color="text.secondary" sx={{ fontSize: styleTokens.secondaryFontSize }}>
                        Đồng nghĩa
                      </Typography>
                      <div>
                        {entry.aiRelatedWords.synonyms.map((w) => (
                          <Chip key={w} label={w} size="small" sx={{ marginRight: 0.5, marginBottom: 0.5 }} />
                        ))}
                      </div>
                    </div>
                  )}
                  {entry.aiRelatedWords.antonyms.length > 0 && (
                    <div>
                      <Typography color="text.secondary" sx={{ fontSize: styleTokens.secondaryFontSize }}>
                        Trái nghĩa
                      </Typography>
                      <div>
                        {entry.aiRelatedWords.antonyms.map((w) => (
                          <Chip key={w} label={w} size="small" variant="outlined" sx={{ marginRight: 0.5, marginBottom: 0.5 }} />
                        ))}
                      </div>
                    </div>
                  )}
                  {entry.aiRelatedWords.forms.length > 0 && (
                    <div>
                      <Typography color="text.secondary" sx={{ fontSize: styleTokens.secondaryFontSize }}>
                        Dạng từ khác
                      </Typography>
                      <div>
                        {entry.aiRelatedWords.forms.map((f, i) => (
                          <Chip
                            key={i}
                            label={
                              <>
                                {f.word} <Typography component="span" color="text.secondary">({f.pos})</Typography>
                              </>
                            }
                            color="primary"
                            size="small"
                            sx={{ marginRight: 0.5, marginBottom: 0.5 }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </Stack>
              )}
            </AiSection>

            <AiSection
              icon={<LightbulbIcon fontSize="small" />}
              title="Mẹo ghi nhớ"
              hasContent={!!entry.mnemonic}
              loading={mnemonicLoading}
              error={mnemonicError}
              onGenerate={handleGenerateMnemonic}
            >
              <Typography>{entry.mnemonic}</Typography>
            </AiSection>
          </DialogContent>
        </>
      )}
    </Dialog>
  );
}
