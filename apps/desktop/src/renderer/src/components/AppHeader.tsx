import SyncIcon from "@mui/icons-material/Sync";
import Button from "@mui/material/Button";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { keyframes } from "@mui/material/styles";
import { COLOR_PRIMARY, styleTokens } from "../theme";

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

export type AppView = "list" | "review" | "settings";

const VIEW_OPTIONS: { label: string; value: AppView }[] = [
  { label: "Từ vựng", value: "list" },
  { label: "Ôn tập", value: "review" },
  { label: "Cài đặt", value: "settings" },
];

// Persistent chrome shared by every view — previously Settings/Review fully
// replaced the whole window (own header, own back button), which made the
// app feel like a stack of disconnected screens instead of one piece.
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
      <Typography variant="h6" sx={{ margin: 0, color: COLOR_PRIMARY, flexShrink: 0 }}>
        Reckon
      </Typography>
      <ToggleButtonGroup
        value={view}
        exclusive
        onChange={(_e, value: AppView | null) => value && onChangeView(value)}
        size="small"
      >
        {VIEW_OPTIONS.map((opt) => (
          <ToggleButton key={opt.value} value={opt.value}>
            {opt.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <Button
        variant="outlined"
        startIcon={<SyncIcon sx={syncing ? { animation: `${spin} 1s linear infinite` } : undefined} />}
        loading={syncing}
        onClick={onSync}
        sx={{ flexShrink: 0 }}
      >
        Sync now
      </Button>
    </div>
  );
}
