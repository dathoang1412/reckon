import { useEffect, useState } from "react";
import { CheckOutlined, CloseOutlined, SoundOutlined } from "@ant-design/icons";
import { Button, Card, Empty, Progress, Segmented, Select, Skeleton, Space, Tag, Typography } from "antd";
import type { DueEntryRow, QuizQuestion, VocabSetRow } from "../../../preload/index";
import { speak } from "../lib/speak";

// Mirrors App.tsx's activeSet convention (null = "Tất cả") — unlike the
// service layer's setId param, this UI never exposes an "unassigned only"
// option, so null is unambiguous here.
const ALL_SETS = "__all__";

// String sentinel for the Select (antd options need a scalar, not `null`
// itself) — mapped back to the actual `number | null` limit (null = "ôn
// hết", no cap) right before it reaches window.api.review.due.
const NO_LIMIT = "__no_limit__";
const LIMIT_OPTIONS = [10, 20, 30, 50];

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
  // null = "Tất cả" (ôn hết những từ đến hạn hôm nay, không giới hạn số
  // lượng) — null while still loading the persisted value from settings,
  // same reasoning as Popup.tsx's searchOpenSeq comment: don't fire the
  // due-queue fetch below with a wrong default before the real value lands.
  const [limit, setLimit] = useState<number | null | undefined>(undefined);

  const [mode, setMode] = useState<ReviewMode>("flashcard");

  // Not persisted/cached — a fresh question every time keeps quiz mode from
  // just becoming "guess the same 4 options again".
  const [quiz, setQuiz] = useState<QuizQuestion | null>(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  useEffect(() => {
    window.api.vocabSet.list().then(setSets);
    window.api.settings.getReviewLimit().then(setLimit);
  }, []);

  useEffect(() => {
    if (limit === undefined) return;
    setQueue(null);
    window.api.review.due(limit, setId ?? undefined).then((due) => {
      setQueue(due);
      setTotal(due.length);
    });
  }, [setId, limit]);

  function handleLimitChange(value: string) {
    const next = value === NO_LIMIT ? null : Number(value);
    setLimit(next);
    window.api.settings.setReviewLimit(next);
  }

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

  const filtersRow = (
    <Space.Compact style={{ width: "100%", marginBottom: 16 }}>
      <Select
        value={setId ?? ALL_SETS}
        onChange={(value) => setSetId(value === ALL_SETS ? null : value)}
        style={{ width: "60%" }}
        options={[{ value: ALL_SETS, label: "Tất cả bộ từ" }, ...sets.map((s) => ({ value: s.id, label: s.name }))]}
      />
      <Select
        value={limit === null ? NO_LIMIT : String(limit ?? 20)}
        onChange={handleLimitChange}
        style={{ width: "40%" }}
        options={[
          ...LIMIT_OPTIONS.map((n) => ({ value: String(n), label: `${n} từ` })),
          { value: NO_LIMIT, label: "Ôn hết hôm nay" },
        ]}
      />
    </Space.Compact>
  );

  const modeSelector = (
    <Segmented
      block
      value={mode}
      onChange={(value) => setMode(value as ReviewMode)}
      options={[
        { label: "Thẻ ghi nhớ", value: "flashcard" },
        { label: "Trắc nghiệm (AI)", value: "quiz" },
      ]}
      style={{ marginBottom: 16 }}
    />
  );

  if (queue === null) {
    return (
      <div style={{ maxWidth: 480, margin: "2rem auto", padding: "0 1rem" }}>
        {filtersRow}
      </div>
    );
  }

  if (queue.length === 0) {
    return (
      <div style={{ maxWidth: 480, margin: "2rem auto", padding: "0 1rem" }}>
        {filtersRow}
        <div style={{ margin: "4rem 0", textAlign: "center" }}>
          <Empty description={total === 0 ? "Không có từ nào cần ôn" : "Đã ôn xong hết lượt này"} />
        </div>
      </div>
    );
  }

  const card = current!;
  const reviewed = total - queue.length;

  return (
    <div style={{ maxWidth: 480, margin: "2rem auto", padding: "0 1rem" }}>
      {filtersRow}
      {modeSelector}
      <Progress percent={Math.round((reviewed / total) * 100)} showInfo={false} />
      <Typography.Text type="secondary">
        {reviewed}/{total}
      </Typography.Text>
      <Card style={{ marginTop: 16, minHeight: 180, textAlign: "center" }}>
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Tag color="blue">{card.sourceLang}</Tag>
          <Space align="center">
            <Typography.Title level={3} style={{ margin: 0 }}>
              {card.sourceText}
            </Typography.Title>
            {card.sourceLang !== "vi" && (
              <Button icon={<SoundOutlined />} onClick={() => speak(card.sourceText, card.sourceLang)} />
            )}
          </Space>

          {mode === "flashcard" &&
            (revealed ? (
              <>
                <Tag color="green">{card.targetLang}</Tag>
                <Space align="center">
                  <Typography.Title level={4} style={{ margin: 0 }}>
                    {card.targetText}
                  </Typography.Title>
                  {card.targetLang !== "vi" && (
                    <Button icon={<SoundOutlined />} onClick={() => speak(card.targetText, card.targetLang)} />
                  )}
                </Space>
                {card.targetMeanings.length > 1 && (
                  <Space size={[4, 4]} wrap style={{ justifyContent: "center" }}>
                    {card.targetMeanings.slice(1).map((meaning) => (
                      <Tag key={meaning} color="default">
                        {meaning}
                      </Tag>
                    ))}
                  </Space>
                )}
              </>
            ) : (
              <Button onClick={() => setRevealed(true)}>Hiện đáp án</Button>
            ))}

          {mode === "quiz" &&
            (quizLoading ? (
              <Space direction="vertical" size={8} style={{ width: "100%" }}>
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton.Button key={i} active block />
                ))}
              </Space>
            ) : quizError ? (
              <Space direction="vertical" size={8}>
                <Typography.Text type="danger">{quizError}</Typography.Text>
                <Space>
                  <Button onClick={() => loadQuiz(card.id)}>Thử lại</Button>
                  <Button onClick={() => setMode("flashcard")}>Chuyển sang thẻ ghi nhớ</Button>
                </Space>
              </Space>
            ) : (
              quiz && (
                <Space direction="vertical" size={8} style={{ width: "100%" }}>
                  {quiz.options.map((option, i) => {
                    const isCorrect = i === quiz.correctIndex;
                    const isSelected = i === selectedOption;
                    const revealedStyle =
                      selectedOption !== null ? (isCorrect ? CORRECT_STYLE : isSelected ? WRONG_STYLE : undefined) : undefined;
                    return (
                      <Button
                        key={i}
                        block
                        disabled={selectedOption !== null}
                        style={revealedStyle}
                        onClick={() => handleQuizAnswer(i)}
                      >
                        {option}
                      </Button>
                    );
                  })}
                </Space>
              )
            ))}
        </Space>
      </Card>
      {mode === "flashcard" && revealed && (
        <Space style={{ width: "100%", justifyContent: "center", marginTop: 16 }} size="large">
          <Button danger icon={<CloseOutlined />} loading={rating} onClick={() => rate(false)}>
            Chưa nhớ
          </Button>
          <Button type="primary" icon={<CheckOutlined />} loading={rating} onClick={() => rate(true)}>
            Đã nhớ
          </Button>
        </Space>
      )}
    </div>
  );
}
