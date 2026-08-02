import { useEffect, useState, type ReactNode } from "react";
import { useRecordHotkeys } from "react-hotkeys-hook";
import { Button, ConfigProvider, Space, Typography, message } from "antd";

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

export default function Settings({ onBack }: { onBack: () => void }) {
  const [savedHotkey, setSavedHotkey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [keys, { start, stop, resetKeys, isRecording }] = useRecordHotkeys();

  useEffect(() => {
    window.api.settings.getHotkey().then(setSavedHotkey);
  }, []);

  // Stop listening for keys if the user navigates away mid-recording.
  useEffect(() => stop, [stop]);

  async function handleSave() {
    const accelerator = toAccelerator(keys);
    if (!accelerator) {
      message.error("Cần bấm thêm một phím chính, không chỉ Ctrl/Shift/Alt.");
      return;
    }
    setSaving(true);
    try {
      const ok = await window.api.settings.setHotkey(accelerator);
      if (ok) {
        setSavedHotkey(accelerator);
        stop();
        resetKeys();
        message.success("Đã lưu phím tắt mới");
      } else {
        message.error("Tổ hợp phím này đang được ứng dụng khác dùng — thử tổ hợp khác nhé.");
      }
    } finally {
      setSaving(false);
    }
  }

  const displayTokens = isRecording ? Array.from(keys) : (savedHotkey?.split("+") ?? []);
  const displayLabel = isRecording ? recordingKeyLabel : acceleratorKeyLabel;

  return (
    <ConfigProvider theme={{ token: { colorPrimary: "#1677ff" } }}>
      <div style={{ maxWidth: 480, margin: "2rem auto", padding: "0 1rem" }}>
        <Space align="center" style={{ width: "100%", justifyContent: "space-between" }}>
          <Typography.Title level={2} style={{ margin: 0 }}>
            Cài đặt
          </Typography.Title>
          <Button onClick={onBack}>← Quay lại</Button>
        </Space>

        <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
          Bôi đen một đoạn văn bản rồi bấm tổ hợp phím này để tra từ nhanh.
        </Typography.Paragraph>

        <Space size={8} wrap style={{ margin: "20px 0", minHeight: 32 }}>
          {displayTokens.length > 0 ? (
            displayTokens.map((token, i) => <Keycap key={`${token}-${i}`}>{displayLabel(token)}</Keycap>)
          ) : (
            <Typography.Text type="secondary">Đang bấm tổ hợp phím…</Typography.Text>
          )}
        </Space>

        <Space>
          {!isRecording ? (
            <Button
              type="primary"
              onClick={() => {
                resetKeys();
                start();
              }}
            >
              Đổi phím tắt
            </Button>
          ) : (
            <>
              <Button type="primary" loading={saving} onClick={handleSave}>
                Lưu
              </Button>
              <Button
                onClick={() => {
                  stop();
                  resetKeys();
                }}
              >
                Hủy
              </Button>
            </>
          )}
        </Space>
      </div>
    </ConfigProvider>
  );
}
