import type { ReactNode } from "react";
import BoltIcon from "@mui/icons-material/Bolt";
import ReplayIcon from "@mui/icons-material/Replay";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useHasGroqKey } from "../lib/useHasGroqKey";
import { COLOR_PRIMARY, styleTokens } from "../theme";

// The reusable "AI enrichment block" used by VocabDetailModal's four Groq
// features (examples, nuance, related words, mnemonic) — one consistent
// header/loading/error/empty treatment so each feature only has to supply
// its own prompt call and result rendering (children).
export default function AiSection({
  icon,
  title,
  hasContent,
  loading,
  error,
  disabledReason,
  onGenerate,
  children,
}: {
  icon: ReactNode;
  title: string;
  hasContent: boolean;
  loading: boolean;
  error: string | null;
  // Set when generation isn't offered at all for this entry (e.g. related
  // words only supports English) — takes priority over the key-missing
  // state below, since no key would still fix nothing here.
  disabledReason?: string | null;
  onGenerate: () => void;
  children: ReactNode;
}) {
  const hasKey = useHasGroqKey();

  const generateButton = (
    <Tooltip title={hasKey === false ? "Cần thêm Groq API key trong Cài đặt" : ""}>
      <span>
        <Button variant="outlined" size="small" startIcon={<BoltIcon />} disabled={hasKey === false} onClick={onGenerate}>
          Tạo với AI
        </Button>
      </span>
    </Tooltip>
  );

  return (
    <div style={{ marginTop: 16, borderTop: `1px solid ${styleTokens.borderColorLight}`, paddingTop: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography sx={{ fontWeight: 600 }}>
          <span style={{ color: COLOR_PRIMARY, marginRight: 6 }}>{icon}</span>
          {title}
        </Typography>
        {hasContent && !loading && !disabledReason && (
          <IconButton size="small" title="Tạo lại" onClick={onGenerate}>
            <ReplayIcon fontSize="small" />
          </IconButton>
        )}
      </div>
      <div style={{ marginTop: 8 }}>
        {disabledReason ? (
          <Typography color="text.secondary" sx={{ fontSize: styleTokens.secondaryFontSize }}>
            {disabledReason}
          </Typography>
        ) : loading ? (
          <CircularProgress size={20} />
        ) : error ? (
          <Stack spacing={0.5}>
            <Typography color="error" sx={{ fontSize: styleTokens.secondaryFontSize }}>
              {error}
            </Typography>
            <Button size="small" variant="outlined" onClick={onGenerate}>
              Thử lại
            </Button>
          </Stack>
        ) : hasContent ? (
          children
        ) : (
          generateButton
        )}
      </div>
    </div>
  );
}
