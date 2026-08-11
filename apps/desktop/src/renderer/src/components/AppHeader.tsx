import { SyncOutlined, UserOutlined } from "@ant-design/icons";
import { Avatar, Button, Segmented, Space, Typography } from "antd";
import type { UserProfile } from "../../../preload/index";
import { COLOR_PRIMARY, styleTokens } from "../theme";

export type AppView = "list" | "review" | "stats" | "profile" | "settings" | "logs";

const VIEW_OPTIONS: { label: string; value: AppView }[] = [
  { label: "Từ vựng", value: "list" },
  { label: "Ôn tập", value: "review" },
  { label: "Thống kê", value: "stats" },
  { label: "Hồ sơ", value: "profile" },
  { label: "Cài đặt", value: "settings" },
  { label: "Nhật ký", value: "logs" },
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
  profile,
}: {
  view: AppView;
  onChangeView: (view: AppView) => void;
  onSync: () => void;
  syncing: boolean;
  // null while logged out — the "Reckon" wordmark stays put then, since
  // there's no account to show instead.
  profile: UserProfile | null;
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
      {profile ? (
        <Space
          align="center"
          // minWidth:0 lets this shrink instead of forcing the row to wrap
          // sooner than necessary just because of a long name/email — the
          // name itself is what actually truncates (see below).
          style={{ flexShrink: 1, minWidth: 0, cursor: "pointer" }}
          onClick={() => onChangeView("profile")}
        >
          <Avatar
            size={32}
            src={profile.avatarBase64 ?? undefined}
            icon={!profile.avatarBase64 && <UserOutlined />}
          />
          <Typography.Text strong ellipsis style={{ color: COLOR_PRIMARY, maxWidth: 160 }}>
            {profile.name || profile.email}
          </Typography.Text>
        </Space>
      ) : (
        <Typography.Title level={4} style={{ margin: 0, color: COLOR_PRIMARY, flexShrink: 0 }}>
          Reckon
        </Typography.Title>
      )}
      <div style={{ flexShrink: 0 }}>
        <Segmented value={view} onChange={(value) => onChangeView(value as AppView)} options={VIEW_OPTIONS} />
      </div>
      <Button icon={<SyncOutlined spin={syncing} />} loading={syncing} onClick={onSync} style={{ flexShrink: 0 }}>
        Sync now
      </Button>
    </div>
  );
}
