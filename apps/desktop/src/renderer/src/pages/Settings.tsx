import { useEffect, useState, type ReactNode } from "react";
import { useRecordHotkeys } from "react-hotkeys-hook";
import BoltIcon from "@mui/icons-material/Bolt";
import SyncIcon from "@mui/icons-material/Sync";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import toast from "react-hot-toast";
import PageShell from "../components/PageShell";
import type { UpdateStatus } from "../../../preload/index";

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

const MODIFIER_ORDER = ["ctrl", "meta", "alt", "shift"];

// Labels for the raw tokens react-hotkeys-hook reports while recording
// (see its useRecordHotkeys source — codes like "ControlLeft"/"KeyD" get
// normalized to lowercase "ctrl"/"d" before reaching us).
const RECORDING_KEY_LABELS: Record<string, string> = {
  ctrl: "Ctrl",
  meta: "Win",
  alt: "Alt",
  shift: "Shift",
  arrowup: "↑",
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
  enter: "Enter",
  escape: "Esc",
  space: "Space",
  backspace: "Backspace",
  delete: "Delete",
  tab: "Tab",
};

// Labels for tokens in a saved Electron Accelerator string (e.g.
// "CommandOrControl+Shift+D") — a different vocabulary than the recording
// one above, so kept as its own table rather than reusing it.
const ACCELERATOR_KEY_LABELS: Record<string, string> = {
  CommandOrControl: "Ctrl",
  Control: "Ctrl",
  Command: "Cmd",
  Super: "Win",
  Alt: "Alt",
  Shift: "Shift",
  Return: "Enter",
  Escape: "Esc",
  Up: "↑",
  Down: "↓",
  Left: "←",
  Right: "→",
};

function recordingKeyLabel(key: string): string {
  if (RECORDING_KEY_LABELS[key]) return RECORDING_KEY_LABELS[key];
  if (/^f\d{1,2}$/.test(key)) return key.toUpperCase();
  return key.length === 1 ? key.toUpperCase() : key.charAt(0).toUpperCase() + key.slice(1);
}

function acceleratorKeyLabel(token: string): string {
  return ACCELERATOR_KEY_LABELS[token] ?? token;
}

// Converts the Set react-hotkeys-hook records into Electron's Accelerator
// string format (globalShortcut.register only understands that format).
// Returns null when the combo has no non-modifier key yet, or the main key
// isn't one Electron's Accelerator syntax supports.
function toAccelerator(keys: Set<string>): string | null {
  const pressed = Array.from(keys);
  const modifiers = MODIFIER_ORDER.filter((m) => pressed.includes(m));
  const mainKeys = pressed.filter((k) => !MODIFIER_ORDER.includes(k));
  if (mainKeys.length !== 1) return null;

  const modifierTokens = modifiers.map((m) => {
    switch (m) {
      case "ctrl":
        return "CommandOrControl";
      case "meta":
        return "Super";
      case "alt":
        return "Alt";
      case "shift":
        return "Shift";
      default:
        return m;
    }
  });

  const specialMainKeys: Record<string, string> = {
    arrowup: "Up",
    arrowdown: "Down",
    arrowleft: "Left",
    arrowright: "Right",
    enter: "Return",
    escape: "Escape",
    space: "Space",
    backspace: "Backspace",
    delete: "Delete",
    tab: "Tab",
  };

  const main = mainKeys[0];
  let mainToken: string;
  if (specialMainKeys[main]) {
    mainToken = specialMainKeys[main];
  } else if (/^f\d{1,2}$/.test(main)) {
    mainToken = main.toUpperCase();
  } else if (main.length === 1) {
    mainToken = main.toUpperCase();
  } else {
    return null;
  }

  return [...modifierTokens, mainToken].join("+");
}

function Keycap({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 32,
        height: 32,
        padding: "0 10px",
        borderRadius: 6,
        border: "1px solid #d9d9d9",
        borderBottom: "2px solid #bfbfbf",
        background: "#fafafa",
        fontFamily: "ui-monospace, monospace",
        fontSize: 13,
        fontWeight: 600,
        color: "#333",
      }}
    >
      {children}
    </span>
  );
}

// One recorder instance per configurable hotkey (lookup vs. empty-search
// popup) — each needs its own independent useRecordHotkeys recording state,
// so this can't just be a render function sharing the parent's state.
function HotkeySection({
  description,
  savedHotkey,
  onSaved,
  save,
}: {
  description: string;
  savedHotkey: string | null;
  onSaved: (accelerator: string) => void;
  save: (accelerator: string) => Promise<boolean>;
}) {
  const [saving, setSaving] = useState(false);
  const [keys, { start, stop, resetKeys, isRecording }] = useRecordHotkeys();

  // Stop listening for keys if the user navigates away mid-recording.
  useEffect(() => stop, [stop]);

  async function handleSave() {
    const accelerator = toAccelerator(keys);
    if (!accelerator) {
      toast.error("Cần bấm thêm một phím chính, không chỉ Ctrl/Shift/Alt.");
      return;
    }
    setSaving(true);
    try {
      const ok = await save(accelerator);
      if (ok) {
        onSaved(accelerator);
        stop();
        resetKeys();
        toast.success("Đã lưu phím tắt mới");
      } else {
        toast.error("Tổ hợp phím này đang được ứng dụng khác dùng — thử tổ hợp khác nhé.");
      }
    } finally {
      setSaving(false);
    }
  }

  const displayTokens = isRecording ? Array.from(keys) : (savedHotkey?.split("+") ?? []);
  const displayLabel = isRecording ? recordingKeyLabel : acceleratorKeyLabel;

  return (
    <div>
      <Typography color="text.secondary" sx={{ marginTop: 1 }}>
        {description}
      </Typography>

      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", margin: "20px 0", minHeight: 32 }}>
        {displayTokens.length > 0 ? (
          displayTokens.map((token, i) => <Keycap key={`${token}-${i}`}>{displayLabel(token)}</Keycap>)
        ) : (
          <Typography color="text.secondary">Đang bấm tổ hợp phím…</Typography>
        )}
      </Stack>

      <Stack direction="row" spacing={1}>
        {!isRecording ? (
          <Button
            variant="contained"
            onClick={() => {
              resetKeys();
              start();
            }}
          >
            Đổi phím tắt
          </Button>
        ) : (
          <>
            <Button variant="contained" loading={saving} onClick={handleSave}>
              Lưu
            </Button>
            <Button
              variant="outlined"
              onClick={() => {
                stop();
                resetKeys();
              }}
            >
              Hủy
            </Button>
          </>
        )}
      </Stack>
    </div>
  );
}

export default function Settings({ onLogout }: { onLogout: () => void }) {
  const [savedHotkey, setSavedHotkey] = useState<string | null>(null);
  const [savedSearchHotkey, setSavedSearchHotkey] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  const [groqKey, setGroqKey] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [testingKey, setTestingKey] = useState(false);

  const [appVersion, setAppVersion] = useState<string | null>(null);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);

  useEffect(() => {
    window.api.settings.getHotkey().then(setSavedHotkey);
    window.api.settings.getSearchHotkey().then(setSavedSearchHotkey);
    window.api.settings.getGroqApiKey().then(setGroqKey);
    window.api.auth.getSession().then((session) => setEmail(session?.email ?? null));
    window.api.app.getVersion().then(setAppVersion);
    window.api.onUpdateStatus(setUpdateStatus);
  }, []);

  async function handleLogout() {
    await window.api.auth.logout();
    onLogout();
  }

  async function handleSaveGroqKey() {
    setSavingKey(true);
    try {
      await window.api.settings.setGroqApiKey(groqKey.trim());
      toast.success("Đã lưu API key");
    } catch (err) {
      toast.error(`Lưu thất bại: ${errorMessage(err)}`);
    } finally {
      setSavingKey(false);
    }
  }

  async function handleTestGroqKey() {
    setTestingKey(true);
    try {
      await window.api.settings.testGroqApiKey(groqKey.trim());
      toast.success("Kết nối thành công");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setTestingKey(false);
    }
  }

  return (
    <PageShell>
      <Typography variant="h6" sx={{ marginTop: 0 }}>
        Tra từ đang chọn
      </Typography>
      <HotkeySection
        description="Bôi đen một đoạn văn bản rồi bấm tổ hợp phím này để tra từ nhanh."
        savedHotkey={savedHotkey}
        save={(accelerator) => window.api.settings.setHotkey(accelerator)}
        onSaved={setSavedHotkey}
      />

      <Typography variant="h6" sx={{ marginTop: 4 }}>
        Mở khung tìm từ
      </Typography>
      <HotkeySection
        description="Bấm tổ hợp phím này ở bất kỳ đâu để mở khung nhỏ và gõ một từ cần tìm."
        savedHotkey={savedSearchHotkey}
        save={(accelerator) => window.api.settings.setSearchHotkey(accelerator)}
        onSaved={setSavedSearchHotkey}
      />

      <Typography variant="h6" sx={{ marginTop: 4 }}>
        Tài khoản
      </Typography>
      <Stack direction="row" sx={{ alignItems: "center", width: "100%", justifyContent: "space-between" }}>
        <Typography color="text.secondary">{email}</Typography>
        <Button variant="outlined" color="error" onClick={handleLogout}>
          Đăng xuất
        </Button>
      </Stack>

      <Typography variant="h6" sx={{ marginTop: 4 }}>
        Groq API (tính năng AI)
      </Typography>
      <Typography color="text.secondary" sx={{ marginTop: 1 }}>
        Cần để dùng ví dụ câu, giải thích sắc thái, từ liên quan, mẹo ghi nhớ, trắc nghiệm ôn tập và
        trích xuất từ vựng. Lấy key miễn phí tại{" "}
        <Link href="https://console.groq.com/keys" target="_blank" rel="noreferrer">
          console.groq.com/keys
        </Link>
        .
      </Typography>
      <TextField
        type="password"
        value={groqKey}
        onChange={(e) => setGroqKey(e.target.value)}
        placeholder="gsk_..."
        autoComplete="off"
        size="small"
        sx={{ maxWidth: 420, width: "100%" }}
      />
      <Stack direction="row" spacing={1} sx={{ marginTop: "12px" }}>
        <Button variant="contained" loading={savingKey} onClick={handleSaveGroqKey}>
          Lưu
        </Button>
        <Button variant="outlined" startIcon={<BoltIcon />} loading={testingKey} onClick={handleTestGroqKey}>
          Kiểm tra kết nối
        </Button>
      </Stack>

      <Typography variant="h6" sx={{ marginTop: 4 }}>
        Cập nhật
      </Typography>
      <Typography color="text.secondary" sx={{ marginTop: 1 }}>
        Phiên bản hiện tại: {appVersion ? `v${appVersion}` : "…"}
      </Typography>

      {updateStatus?.state === "downloading" && (
        <LinearProgress variant="determinate" value={updateStatus.percent} sx={{ maxWidth: 300 }} />
      )}
      {updateStatus?.state === "available" && (
        <Typography color="text.secondary" sx={{ display: "block", marginBottom: "8px" }}>
          Đã tìm thấy bản v{updateStatus.version} — đang tải…
        </Typography>
      )}
      {updateStatus?.state === "not-available" && (
        <Typography color="text.secondary" sx={{ display: "block", marginBottom: "8px" }}>
          Bạn đang dùng bản mới nhất.
        </Typography>
      )}
      {updateStatus?.state === "error" && (
        <Typography color="error" sx={{ display: "block", marginBottom: "8px" }}>
          {updateStatus.message}
        </Typography>
      )}

      <Stack direction="row" spacing={1}>
        {updateStatus?.state === "downloaded" ? (
          <Button variant="contained" onClick={() => window.api.updater.quitAndInstall()}>
            Khởi động lại để cài đặt v{updateStatus.version}
          </Button>
        ) : (
          <Button
            variant="outlined"
            startIcon={<SyncIcon />}
            loading={updateStatus?.state === "checking"}
            onClick={() => window.api.updater.checkNow()}
          >
            Kiểm tra cập nhật
          </Button>
        )}
      </Stack>
    </PageShell>
  );
}
