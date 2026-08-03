import { SyncOutlined } from "@ant-design/icons";
import { Button, Segmented, Typography } from "antd";
import { COLOR_PRIMARY, styleTokens } from "../theme";

export type AppView = "list" | "review" | "settings";

const VIEW_OPTIONS: { label: string; value: AppView }[] = [
  { label: "Từ vựng", value: "list" },
  { label: "Ôn tập", value: "review" },
  { label: "Cài đặt", value: "settings" },
];

// Persistent chrome shared by every view — previously Settings/Review fully
// replaced the whole window (own header, own back button), which made the
// app feel like a stack of disconnected screens instead of one piece.
//
// Plain flexbox rather than antd's Space: Space's children don't reliably
// wrap under `flexWrap` (its gap is implemented via child margins, not a
// real CSS gap), which let the Sync button get clipped off the right edge
// on a narrower window instead of dropping to its own row.
export default function AppHeader({
  view,
  onChangeView,
  onSync,
  syncing,
}: {
  view: AppView;
  onChangeView: (view: AppView) => void;
  onSync: () => void;
  syncing: boolean;
}) {
  return (
    <div
      style={{
        width: "100%",
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "8px 16px",
        padding: "12px 24px",
        borderBottom: `1px solid ${styleTokens.borderColorLight}`,
        flexShrink: 0,
      }}
    >
      <Typography.Title level={4} style={{ margin: 0, color: COLOR_PRIMARY, flexShrink: 0 }}>
        Reckon
      </Typography.Title>
      <Segmented value={view} onChange={(value) => onChangeView(value as AppView)} options={VIEW_OPTIONS} />
      <Button icon={<SyncOutlined spin={syncing} />} loading={syncing} onClick={onSync} style={{ flexShrink: 0 }}>
        Sync now
      </Button>
    </div>
  );
}
