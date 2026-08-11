import { useEffect, useState } from "react";
import { InfoCircleOutlined } from "@ant-design/icons";
import { Popover, Skeleton, Tag, Typography } from "antd";
import type { ReviewStateSnapshot } from "../../../preload/index";
import { dayLabel, timeLabel } from "../lib/date";
import { styleTokens } from "../theme";

// Mirrors main/services/review/srs.ts's ts-fsrs State enum ordinal
// (New=0, Learning=1, Review=2, Relearning=3).
const STATE_LABELS: Record<number, string> = {
  0: "Mới",
  1: "Đang học",
  2: "Đang ôn",
  3: "Ôn lại",
};

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

function dueSummary(dueAt: string): string {
  const days = daysUntil(dueAt);
  if (days <= 0) return "Đến hạn ôn";
  if (days === 1) return "Còn 1 ngày";
  return `Còn ${days} ngày`;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "2px 0" }}>
      <Typography.Text type="secondary" style={{ fontSize: styleTokens.secondaryFontSize }}>
        {label}
      </Typography.Text>
      <Typography.Text style={{ fontSize: styleTokens.secondaryFontSize }}>{value}</Typography.Text>
    </div>
  );
}

// Small clickable "FSRS" summary on VocabDetailModal — a compact tag showing
// the word's current review state, expanding into the full FSRS numbers
// (stability, difficulty, reps, lapses, ...) on click rather than always
// taking up space in the modal.
export default function ReviewStateBadge({ vocabId }: { vocabId: string }) {
  // undefined = still loading, null = never reviewed (no ReviewState row).
  const [state, setState] = useState<ReviewStateSnapshot | null | undefined>(undefined);

  useEffect(() => {
    setState(undefined);
    window.api.review.state(vocabId).then(setState);
  }, [vocabId]);

  if (state === undefined) {
    return <Skeleton.Button active size="small" style={{ width: 120 }} />;
  }

  if (state === null) {
    return <Tag color="default">Chưa ôn lần nào</Tag>;
  }

  const content = (
    <div style={{ minWidth: 200 }}>
      <Row label="Trạng thái" value={STATE_LABELS[state.state] ?? "?"} />
      <Row label="Đến hạn ôn" value={`${dayLabel(state.dueAt)} · ${timeLabel(state.dueAt)}`} />
      {state.lastReviewedAt && (
        <Row label="Ôn lần cuối" value={`${dayLabel(state.lastReviewedAt)} · ${timeLabel(state.lastReviewedAt)}`} />
      )}
      <Row label="Số lần ôn" value={String(state.reps)} />
      <Row label="Số lần quên" value={String(state.lapses)} />
      <Row label="Độ ổn định" value={`${state.stability.toFixed(1)} ngày`} />
      <Row label="Độ khó" value={state.difficulty.toFixed(1)} />
    </div>
  );

  return (
    <Popover content={content} title="Chi tiết FSRS" trigger="click" placement="bottomLeft">
      <Tag icon={<InfoCircleOutlined />} color="blue" style={{ cursor: "pointer" }}>
        {STATE_LABELS[state.state] ?? "?"} · {dueSummary(state.dueAt)}
      </Tag>
    </Popover>
  );
}
