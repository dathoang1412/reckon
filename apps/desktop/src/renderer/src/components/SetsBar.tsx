import { useState, type KeyboardEvent, type MouseEvent } from "react";
import AddIcon from "@mui/icons-material/Add";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { VocabSetRow } from "../../../preload/index";
import { COLOR_PRIMARY, styleTokens } from "../theme";

interface DeckRowProps {
  label: string;
  count: number;
  lastActivity: string | null;
  active: boolean;
  onClick: () => void;
  onRename?: () => void;
  onDelete?: () => void;
}

function DeckRow({ label, count, lastActivity, active, onClick, onRename, onDelete }: DeckRowProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const hasMenu = !!(onRename || onDelete);

  function openMenu(e: MouseEvent<HTMLElement>) {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
  }

  function closeMenu() {
    setAnchorEl(null);
  }

  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 8,
        cursor: "pointer",
        background: active ? `${COLOR_PRIMARY}14` : "transparent",
        borderLeft: `3px solid ${active ? COLOR_PRIMARY : "transparent"}`,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <Typography
          noWrap
          sx={{ display: "block", fontWeight: active ? 600 : 400 }}
        >
          {label}
        </Typography>
        <Typography color="text.secondary" sx={{ fontSize: styleTokens.secondaryFontSize, whiteSpace: "nowrap" }}>
          {count} từ{lastActivity ? ` · ${lastActivity}` : ""}
        </Typography>
      </div>
      {hasMenu && (
        <>
          <IconButton size="small" onClick={openMenu} sx={{ flexShrink: 0 }}>
            <MoreVertIcon fontSize="small" />
          </IconButton>
          <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={closeMenu} onClick={(e) => e.stopPropagation()}>
            {onRename && (
              <MenuItem
                onClick={() => {
                  closeMenu();
                  onRename();
                }}
              >
                Đổi tên
              </MenuItem>
            )}
            {onDelete && (
              <MenuItem
                onClick={() => {
                  closeMenu();
                  onDelete();
                }}
                sx={{ color: "error.main" }}
              >
                Xoá
              </MenuItem>
            )}
          </Menu>
        </>
      )}
    </div>
  );
}

export interface SetsBarProps {
  sets: VocabSetRow[];
  countAll: number;
  countFor: (setId: string) => number;
  // Human-readable label for the most recent word saved into this set
  // (or across everything, for null) — e.g. "Hôm nay", null when empty.
  latestDateFor: (setId: string | null) => string | null;
  activeSet: string | null;
  onSelect: (setId: string | null) => void;
  onCreate: (name: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export default function SetsBar({
  sets,
  countAll,
  countFor,
  latestDateFor,
  activeSet,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: SetsBarProps) {
  const [dialog, setDialog] = useState<{ mode: "create" } | { mode: "rename"; id: string } | null>(null);
  const [name, setName] = useState("");

  async function handleOk() {
    const trimmed = name.trim();
    if (!trimmed || !dialog) return;
    if (dialog.mode === "create") {
      await onCreate(trimmed);
    } else {
      await onRename(dialog.id, trimmed);
    }
    setDialog(null);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleOk();
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <Typography
          color="text.secondary"
          sx={{ fontSize: styleTokens.secondaryFontSize, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px" }}
        >
          Bộ từ
        </Typography>
        <IconButton
          size="small"
          onClick={() => {
            setName("");
            setDialog({ mode: "create" });
          }}
        >
          <AddIcon fontSize="small" />
        </IconButton>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <DeckRow
          label="Tất cả"
          count={countAll}
          lastActivity={latestDateFor(null)}
          active={activeSet === null}
          onClick={() => onSelect(null)}
        />
        {sets.map((s) => (
          <DeckRow
            key={s.id}
            label={s.name}
            count={countFor(s.id)}
            lastActivity={latestDateFor(s.id)}
            active={activeSet === s.id}
            onClick={() => onSelect(s.id)}
            onRename={() => {
              setName(s.name);
              setDialog({ mode: "rename", id: s.id });
            }}
            onDelete={() => onDelete(s.id)}
          />
        ))}
      </div>

      <Dialog open={dialog !== null} onClose={() => setDialog(null)} fullWidth maxWidth="xs">
        <DialogTitle>{dialog?.mode === "create" ? "Tạo bộ từ mới" : "Đổi tên bộ từ"}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tên bộ từ"
            fullWidth
            sx={{ marginTop: "4px" }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(null)}>Hủy</Button>
          <Button variant="contained" disabled={!name.trim()} onClick={handleOk}>
            OK
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
