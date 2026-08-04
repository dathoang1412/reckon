import { useEffect, useState } from "react";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import LightbulbIcon from "@mui/icons-material/Lightbulb";
import QuizIcon from "@mui/icons-material/Quiz";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import type { DueEntryRow, QuizQuestion, VocabSetRow } from "../../../preload/index";
import { speak } from "../lib/speak";

// Mirrors App.tsx's activeSet convention (null = "Tất cả") — unlike the
// service layer's setId param, this UI never exposes an "unassigned only"
// option, so null is unambiguous here.
const ALL_SETS = "__all__";

type ReviewMode = "flashcard" | "quiz";

const CORRECT_STYLE = { borderColor: "#52c41a", color: "#52c41a" };
const WRONG_STYLE = { borderColor: "#ff4d4f", color: "#ff4d4f" };

export default function Review() {
  const [queue, setQueue] = useState<DueEntryRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [rating, setRating] = useState(false);
  const [sets, setSets] = useState<VocabSetRow[]>([]);
  const [setId, setSetId] = useState<string | null>(null);

  const [mode, setMode] = useState<ReviewMode>("flashcard");
  const [showMnemonic, setShowMnemonic] = useState(false);

  // Not persisted/cached like mnemonics — a fresh question every time keeps
  // quiz mode from just becoming "guess the same 4 options again".
  const [quiz, setQuiz] = useState<QuizQuestion | null>(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  useEffect(() => {
    window.api.vocabSet.list().then(setSets);
  }, []);

  useEffect(() => {
    setQueue(null);
    window.api.review.due(20, setId ?? undefined).then((due) => {
      setQueue(due);
      setTotal(due.length);
    });
  }, [setId]);

  const current = queue && queue.length > 0 ? queue[0] : null;

  function loadQuiz(vocabId: string) {
    setQuiz(null);
    setQuizError(null);
    setSelectedOption(null);
    setQuizLoading(true);
    window.api.ai
      .quizQuestion(vocabId)
      .then(setQuiz)
      .catch((err) => setQuizError(err instanceof Error ? err.message : String(err)))
      .finally(() => setQuizLoading(false));
  }

  // Keyed on current?.id (not the whole entry) + mode, so switching modes
  // or advancing to the next card both trigger a fresh question, but typing
  // or other unrelated re-renders don't refetch.
  useEffect(() => {
    if (mode !== "quiz" || !current) {
      setQuiz(null);
      setQuizError(null);
      setSelectedOption(null);
      return;
    }
    loadQuiz(current.id);
  }, [current?.id, mode]);

  async function rate(remembered: boolean) {
    if (!queue || queue.length === 0) return;
    setRating(true);
    try {
      await window.api.review.rate(queue[0].id, remembered);
      setQueue(queue.slice(1));
      setRevealed(false);
      setShowMnemonic(false);
    } finally {
      setRating(false);
    }
  }

  function handleQuizAnswer(index: number) {
    if (selectedOption !== null || !quiz) return;
    setSelectedOption(index);
    // Brief pause so the correct/wrong coloring registers before the card
    // advances — same "explicit rating" spaced-repetition signal as
    // flashcard mode's Nhớ/Chưa nhớ buttons, just derived from the answer.
    setTimeout(() => rate(index === quiz.correctIndex), 700);
  }

  const setSelector = (
    <Select
      value={setId ?? ALL_SETS}
      onChange={(e) => setSetId(e.target.value === ALL_SETS ? null : e.target.value)}
      size="small"
      fullWidth
      sx={{ marginBottom: 2 }}
    >
      <MenuItem value={ALL_SETS}>Tất cả</MenuItem>
      {sets.map((s) => (
        <MenuItem key={s.id} value={s.id}>
          {s.name}
        </MenuItem>
      ))}
    </Select>
  );

  const modeSelector = (
    <ToggleButtonGroup
      value={mode}
      exclusive
      onChange={(_e, value: ReviewMode | null) => value && setMode(value)}
      fullWidth
      sx={{ marginBottom: 2 }}
    >
      <ToggleButton value="flashcard">Thẻ ghi nhớ</ToggleButton>
      <ToggleButton value="quiz">Trắc nghiệm (AI)</ToggleButton>
    </ToggleButtonGroup>
  );

  if (queue === null) {
    return <div style={{ maxWidth: 480, margin: "2rem auto", padding: "0 1rem" }}>{setSelector}</div>;
  }

  if (queue.length === 0) {
    return (
      <div style={{ maxWidth: 480, margin: "2rem auto", padding: "0 1rem" }}>
        {setSelector}
        <Stack spacing={1} sx={{ alignItems: "center", margin: "4rem 0", color: "text.secondary" }}>
          <QuizIcon fontSize="large" color="disabled" />
          <Typography color="text.secondary">
            {total === 0 ? "Không có từ nào cần ôn" : "Đã ôn xong hết lượt này"}
          </Typography>
        </Stack>
      </div>
    );
  }

  const card = current!;
  const reviewed = total - queue.length;

  return (
    <div style={{ maxWidth: 480, margin: "2rem auto", padding: "0 1rem" }}>
      {setSelector}
      {modeSelector}
      <LinearProgress variant="determinate" value={Math.round((reviewed / total) * 100)} />
      <Typography color="text.secondary">
        {reviewed}/{total}
      </Typography>
      <Card sx={{ marginTop: 2, minHeight: 180, textAlign: "center" }}>
        <CardContent>
          <Stack spacing={1.5} sx={{ alignItems: "center", width: "100%" }}>
            <Chip label={card.sourceLang} color="primary" size="small" />
            <Stack direction="row" sx={{ alignItems: "center" }}>
              <Typography variant="h5" sx={{ margin: 0 }}>
                {card.sourceText}
              </Typography>
              {card.sourceLang !== "vi" && (
                <IconButton onClick={() => speak(card.sourceText, card.sourceLang)}>
                  <VolumeUpIcon />
                </IconButton>
              )}
            </Stack>

            {mode === "flashcard" &&
              (revealed ? (
                <>
                  <Chip label={card.targetLang} color="success" size="small" />
                  <Stack direction="row" sx={{ alignItems: "center" }}>
                    <Typography variant="h6" sx={{ margin: 0 }}>
                      {card.targetText}
                    </Typography>
                    {card.targetLang !== "vi" && (
                      <IconButton onClick={() => speak(card.targetText, card.targetLang)}>
                        <VolumeUpIcon />
                      </IconButton>
                    )}
                  </Stack>
                  {card.targetMeanings.length > 1 && (
                    <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", justifyContent: "center" }}>
                      {card.targetMeanings.slice(1).map((meaning) => (
                        <Chip key={meaning} label={meaning} size="small" variant="outlined" />
                      ))}
                    </Stack>
                  )}
                </>
              ) : (
                <Stack spacing={0.5} sx={{ alignItems: "center" }}>
                  <Button variant="outlined" onClick={() => setRevealed(true)}>
                    Hiện đáp án
                  </Button>
                  {card.mnemonic && (
                    <Button size="small" startIcon={<LightbulbIcon />} onClick={() => setShowMnemonic((v) => !v)}>
                      {showMnemonic ? "Ẩn mẹo ghi nhớ" : "Xem mẹo ghi nhớ"}
                    </Button>
                  )}
                  {showMnemonic && card.mnemonic && (
                    <Typography color="text.secondary" sx={{ display: "block", maxWidth: 360, fontStyle: "italic" }}>
                      {card.mnemonic}
                    </Typography>
                  )}
                </Stack>
              ))}

            {mode === "quiz" &&
              (quizLoading ? (
                <Stack spacing={1} sx={{ width: "100%" }}>
                  {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} variant="rounded" height={36} />
                  ))}
                </Stack>
              ) : quizError ? (
                <Stack spacing={1}>
                  <Typography color="error">{quizError}</Typography>
                  <Stack direction="row" spacing={1}>
                    <Button variant="outlined" onClick={() => loadQuiz(card.id)}>
                      Thử lại
                    </Button>
                    <Button variant="outlined" onClick={() => setMode("flashcard")}>
                      Chuyển sang thẻ ghi nhớ
                    </Button>
                  </Stack>
                </Stack>
              ) : (
                quiz && (
                  <Stack spacing={1} sx={{ width: "100%" }}>
                    {quiz.options.map((option, i) => {
                      const isCorrect = i === quiz.correctIndex;
                      const isSelected = i === selectedOption;
                      const revealedStyle =
                        selectedOption !== null ? (isCorrect ? CORRECT_STYLE : isSelected ? WRONG_STYLE : undefined) : undefined;
                      return (
                        <Button
                          key={i}
                          variant="outlined"
                          fullWidth
                          disabled={selectedOption !== null}
                          sx={revealedStyle}
                          onClick={() => handleQuizAnswer(i)}
                        >
                          {option}
                        </Button>
                      );
                    })}
                  </Stack>
                )
              ))}
          </Stack>
        </CardContent>
      </Card>
      {mode === "flashcard" && revealed && (
        <Stack direction="row" spacing={2} sx={{ width: "100%", justifyContent: "center", marginTop: 2 }}>
          <Button variant="outlined" color="error" startIcon={<CloseIcon />} loading={rating} onClick={() => rate(false)}>
            Chưa nhớ
          </Button>
          <Button variant="contained" startIcon={<CheckIcon />} loading={rating} onClick={() => rate(true)}>
            Đã nhớ
          </Button>
        </Stack>
      )}
    </div>
  );
}
