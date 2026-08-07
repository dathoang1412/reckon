import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Typography } from "antd";
import type { VocabEntryRow } from "../../../preload/index";
import { COLOR_PRIMARY, FONT_FAMILY, styleTokens } from "../theme";

const DAYS_SHOWN = 14;

export interface DayBucket {
  key: string;
  label: string;
  count: number;
}

// Builds a fixed, contiguous run of the last `DAYS_SHOWN` calendar days
// (local timezone) with zero-filled counts — as opposed to just grouping
// whatever's in `entries`, which would silently skip days with no saves
// instead of showing the gap, and wouldn't include today until the first
// word of the day is saved.
export function buildDailyCounts(entries: VocabEntryRow[]): DayBucket[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const buckets: DayBucket[] = [];
  for (let i = DAYS_SHOWN - 1; i >= 0; i--) {
    const d = new Date(startOfToday);
    d.setDate(d.getDate() - i);
    buckets.push({
      key: `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`,
      label: d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }),
      count: 0,
    });
  }
  const byKey = new Map(buckets.map((b) => [b.key, b]));

  for (const entry of entries) {
    const d = new Date(entry.createdAt);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const bucket = byKey.get(key);
    if (bucket) bucket.count += 1;
  }

  return buckets;
}

// Consecutive days (counting back from today) with at least one save —
// stops at the first empty day, except today itself is allowed to still be
// empty without breaking a streak that's otherwise intact (the day isn't
// over yet).
export function computeStreak(daily: DayBucket[]): number {
  let streak = 0;
  for (let i = daily.length - 1; i >= 0; i--) {
    if (daily[i].count > 0) {
      streak++;
    } else if (i !== daily.length - 1) {
      break;
    }
  }
  return streak;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: DayBucket }[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const bucket = payload[0].payload;
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
      <div style={{ color: "var(--chart-tick)" }}>{bucket.label}</div>
      <div style={{ fontWeight: 600 }}>{bucket.count} từ</div>
    </div>
  );
}

// A word-count-by-day bar chart plus a few headline stat tiles — the
// "how much am I actually studying" view, computed entirely from the local
// vocab list (no server/login needed, unlike the rest of Profile).
export default function ActivityChart({ entries }: { entries: VocabEntryRow[] }) {
  const daily = buildDailyCounts(entries);
  const totalSaved = entries.length;
  const thisWeek = daily.slice(-7).reduce((sum, b) => sum + b.count, 0);
  const streak = computeStreak(daily);

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Tổng số từ", value: totalSaved },
          { label: "Tuần này", value: thisWeek },
          { label: "Chuỗi ngày liên tiếp", value: streak },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              flex: 1,
              padding: "12px 16px",
              border: `1px solid ${styleTokens.borderColorLight}`,
              borderRadius: 8,
            }}
          >
            <Typography.Text type="secondary" style={{ fontSize: styleTokens.secondaryFontSize }}>
              {stat.label}
            </Typography.Text>
            <div style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.4, fontFamily: FONT_FAMILY }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      <Typography.Text type="secondary" style={{ fontSize: styleTokens.secondaryFontSize }}>
        Số từ đã lưu mỗi ngày ({DAYS_SHOWN} ngày gần nhất)
      </Typography.Text>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={daily} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
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
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--chart-cursor)" }} />
          <Bar dataKey="count" fill={COLOR_PRIMARY} radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
