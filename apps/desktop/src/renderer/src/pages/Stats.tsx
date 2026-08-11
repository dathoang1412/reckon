import { useEffect, useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Empty, Skeleton, Space, Typography } from "antd";
import type { ForecastBucket, ReviewStateCounts, ReviewStats } from "../../../preload/index";
import { COLOR_PRIMARY, FONT_FAMILY, styleTokens } from "../theme";

const FORECAST_DAYS_SHOWN = 14;

// Fixed identity order + validated categorical colors (see index.html's
// --fsrs-* vars) — passes the data-viz skill's adjacent-pair CVD/contrast
// checks in both themes for a 4-slot categorical palette.
const STATE_META: { key: keyof ReviewStateCounts; label: string; color: string }[] = [
  { key: "new", label: "Mới", color: "var(--fsrs-new)" },
  { key: "learning", label: "Đang học", color: "var(--fsrs-learning)" },
  { key: "review", label: "Đang ôn", color: "var(--fsrs-review)" },
  { key: "relearning", label: "Ôn lại", color: "var(--fsrs-relearning)" },
];

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 130,
        padding: "12px 16px",
        border: `1px solid ${styleTokens.borderColorLight}`,
        borderRadius: 8,
      }}
    >
      <Typography.Text type="secondary" style={{ fontSize: styleTokens.secondaryFontSize }}>
        {label}
      </Typography.Text>
      <div style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.4, fontFamily: FONT_FAMILY }}>{value}</div>
    </div>
  );
}

function TooltipCard({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        background: "var(--chart-tooltip-bg)",
        border: `1px solid ${styleTokens.borderColorLight}`,
        borderRadius: 6,
        padding: "6px 10px",
        boxShadow: "0 2px 8px var(--chart-tooltip-shadow)",
        fontSize: 12,
        fontFamily: FONT_FAMILY,
      }}
    >
      {children}
    </div>
  );
}

function ForecastTooltip({ active, payload }: { active?: boolean; payload?: { payload: ForecastBucket }[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const bucket = payload[0].payload;
  return (
    <TooltipCard>
      <div style={{ color: "var(--chart-tick)" }}>{bucket.label}</div>
      <div style={{ fontWeight: 600 }}>{bucket.count} từ đến hạn</div>
    </TooltipCard>
  );
}

function StateTooltip({ active, payload }: { active?: boolean; payload?: { dataKey: string; value: number }[] }) {
  if (!active || !payload) return null;
  const shown = payload.filter((p) => p.value > 0);
  if (shown.length === 0) return null;
  return (
    <TooltipCard>
      {shown.map((p) => {
        const meta = STATE_META.find((m) => m.key === p.dataKey);
        return (
          <div key={p.dataKey}>
            {meta?.label ?? p.dataKey}: <strong>{p.value}</strong>
          </div>
        );
      })}
    </TooltipCard>
  );
}

// Aggregate FSRS view across the whole vocab list — state distribution +
// upcoming due forecast. Per-word numbers live on VocabDetailModal's
// ReviewStateBadge instead, since they're only meaningful one word at a time.
export default function Stats() {
  const [stats, setStats] = useState<ReviewStats | null>(null);

  useEffect(() => {
    window.api.review.stats().then(setStats);
  }, []);

  if (!stats) {
    return (
      <div style={{ maxWidth: 720, margin: "2rem auto", padding: "0 1rem" }}>
        <Skeleton active />
      </div>
    );
  }

  if (stats.totalVocab === 0) {
    return (
      <div style={{ maxWidth: 720, margin: "2rem auto", padding: "0 1rem" }}>
        <Empty description="Chưa có từ nào để thống kê" />
      </div>
    );
  }

  const stateRow = [
    {
      name: "state",
      new: stats.stateCounts.new,
      learning: stats.stateCounts.learning,
      review: stats.stateCounts.review,
      relearning: stats.stateCounts.relearning,
    },
  ];

  return (
    <div style={{ maxWidth: 720, margin: "2rem auto", padding: "0 1rem 2rem" }}>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        Thống kê ôn tập
      </Typography.Title>

      <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <StatTile label="Tổng số từ" value={String(stats.totalVocab)} />
        <StatTile label="Cần ôn ngay" value={String(stats.dueNow)} />
        <StatTile label="Tổng lượt ôn" value={String(stats.totalReps)} />
        <StatTile label="Tổng lượt quên" value={String(stats.totalLapses)} />
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <StatTile
          label="Độ ổn định trung bình"
          value={stats.avgStability !== null ? `${stats.avgStability.toFixed(1)} ngày` : "—"}
        />
        <StatTile label="Độ khó trung bình" value={stats.avgDifficulty !== null ? stats.avgDifficulty.toFixed(1) : "—"} />
      </div>

      <Typography.Text type="secondary" style={{ fontSize: styleTokens.secondaryFontSize }}>
        Phân bố theo trạng thái ghi nhớ
      </Typography.Text>
      {/* overflow:hidden + a rounded container (rather than per-segment
          radius) rounds only the two outer ends of the stacked bar, keeping
          the internal boundaries between segments square. */}
      <div style={{ borderRadius: 6, overflow: "hidden", marginTop: 6 }}>
        <ResponsiveContainer width="100%" height={40}>
          <BarChart data={stateRow} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <XAxis type="number" hide domain={[0, stats.totalVocab]} />
            <YAxis type="category" dataKey="name" hide />
            <Tooltip content={<StateTooltip />} cursor={{ fill: "var(--chart-cursor)" }} />
            {STATE_META.map((m) => (
              <Bar key={m.key} dataKey={m.key} stackId="state" fill={m.color} radius={0} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Direct labels for the legend (not the fill itself) satisfy the
          contrast relief this palette needs on the light surface, and give
          every segment an always-visible count instead of squeezing labels
          into thin interior segments. */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 10, marginBottom: 24 }}>
        {STATE_META.map((m) => (
          <Space key={m.key} size={6} align="center">
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: m.color,
                display: "inline-block",
                flexShrink: 0,
              }}
            />
            <Typography.Text style={{ fontSize: styleTokens.secondaryFontSize }}>
              {m.label}: {stats.stateCounts[m.key]}
            </Typography.Text>
          </Space>
        ))}
      </div>

      <Typography.Text type="secondary" style={{ fontSize: styleTokens.secondaryFontSize }}>
        Số từ đến hạn ôn trong {FORECAST_DAYS_SHOWN} ngày tới
      </Typography.Text>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={stats.forecast} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={styleTokens.borderColorLight} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--chart-tick)" }}
            axisLine={{ stroke: styleTokens.borderColorLight }}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "var(--chart-tick)" }}
            axisLine={false}
            tickLine={false}
            width={28}
          />
          <Tooltip content={<ForecastTooltip />} cursor={{ fill: "var(--chart-cursor)" }} />
          <Bar dataKey="count" fill={COLOR_PRIMARY} radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
