import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useRecordHotkeys } from "react-hotkeys-hook";
import { SyncOutlined, ThunderboltOutlined, UserOutlined } from "@ant-design/icons";
import { Avatar, Button, Input, Progress, Space, Switch, Typography } from "antd";
import toast from "react-hot-toast";
import PageShell from "../components/PageShell";
import type { UpdateStatus } from "../../../preload/index";

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// Resizes/compresses to a small square JPEG before it ever leaves the
// renderer — see the "Lưu ảnh đại diện ở đâu" decision: it ends up as a
// data: URI in Postgres (the only thing genuinely shared/durable across
// devices, since apps/server itself runs locally per-user), so keeping it
// small matters for both storage and every profile fetch afterward.
const AVATAR_SIZE = 256;

async function resizeImageToDataUrl(file: File, size = AVATAR_SIZE): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Không thể xử lý ảnh");

  // Cover-crop: scale so the shorter side fills the square, then center-crop
  // the overflow — avoids squashing non-square source images.
  const scale = Math.max(size / bitmap.width, size / bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  ctx.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h);

  return canvas.toDataURL("image/jpeg", 0.85);
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
      <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
        {description}
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
  );
}

export default function Settings({
  authed,
  onLogout,
  onRequireLogin,
}: {
  authed: boolean | null;
  onLogout: () => void;
  onRequireLogin: () => void;
}) {
  const [savedHotkey, setSavedHotkey] = useState<string | null>(null);
  const [savedSearchHotkey, setSavedSearchHotkey] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  const [groqKey, setGroqKey] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [testingKey, setTestingKey] = useState(false);

  const [appVersion, setAppVersion] = useState<string | null>(null);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);

  const [autoSave, setAutoSaveState] = useState<boolean | null>(null);
  const [savingAutoSave, setSavingAutoSave] = useState(false);

  const [name, setName] = useState("");
  const [avatarBase64, setAvatarBase64] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    window.api.settings.getHotkey().then(setSavedHotkey);
    window.api.settings.getSearchHotkey().then(setSavedSearchHotkey);
    window.api.settings.getGroqApiKey().then(setGroqKey);
    window.api.settings.getAutoSave().then(setAutoSaveState);
    window.api.auth.getSession().then((session) => setEmail(session?.email ?? null));
    window.api.app.getVersion().then(setAppVersion);
    window.api.onUpdateStatus(setUpdateStatus);
  }, []);

  // GET /auth/me is guarded server-side — only fetch once actually logged
  // in, and again right after LoginModal succeeds (authed flips to true).
  useEffect(() => {
    if (!authed) return;
    window.api.auth.getProfile().then((profile) => {
      setName(profile.name ?? "");
      setAvatarBase64(profile.avatarBase64);
    });
  }, [authed]);

  async function handleAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the user re-pick the same file later
    if (!file) return;
    try {
      setAvatarBase64(await resizeImageToDataUrl(file));
    } catch (err) {
      toast.error(`Không đọc được ảnh: ${errorMessage(err)}`);
    }
  }

  async function handleSaveProfile() {
    setSavingProfile(true);
    try {
      await window.api.auth.updateProfile({ name: name.trim() || null, avatarBase64 });
      toast.success("Đã lưu hồ sơ");
    } catch (err) {
      toast.error(`Lưu thất bại: ${errorMessage(err)}`);
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleToggleAutoSave(value: boolean) {
    setSavingAutoSave(true);
    try {
      await window.api.settings.setAutoSave(value);
      setAutoSaveState(value);
    } catch (err) {
      toast.error(`Lưu thất bại: ${errorMessage(err)}`);
    } finally {
      setSavingAutoSave(false);
    }
  }

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
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        Tra từ đang chọn
      </Typography.Title>
      <HotkeySection
        description="Bôi đen một đoạn văn bản rồi bấm tổ hợp phím này để tra từ nhanh."
        savedHotkey={savedHotkey}
        save={(accelerator) => window.api.settings.setHotkey(accelerator)}
        onSaved={setSavedHotkey}
      />

      <Space align="center" style={{ marginTop: 4 }}>
        <Switch checked={autoSave ?? true} loading={savingAutoSave} onChange={handleToggleAutoSave} />
        <Typography.Text>Tự động lưu từ khi tra</Typography.Text>
      </Space>
      <Typography.Paragraph type="secondary" style={{ marginTop: 4, marginBottom: 0 }}>
        Tắt để chỉ xem trước trong khung popup — bấm "Lưu" khi bạn thực sự muốn giữ lại từ đó.
      </Typography.Paragraph>

      <Typography.Title level={4} style={{ marginTop: 32 }}>
        Mở khung tìm từ
      </Typography.Title>
      <HotkeySection
        description="Bấm tổ hợp phím này ở bất kỳ đâu để mở khung nhỏ và gõ một từ cần tìm."
        savedHotkey={savedSearchHotkey}
        save={(accelerator) => window.api.settings.setSearchHotkey(accelerator)}
        onSaved={setSavedSearchHotkey}
      />

      <Typography.Title level={4} style={{ marginTop: 32 }}>
        Tài khoản
      </Typography.Title>
      {authed ? (
        <>
          <Space align="center" size={16} style={{ marginTop: 8 }}>
            <Avatar size={64} src={avatarBase64 ?? undefined} icon={!avatarBase64 && <UserOutlined />} />
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleAvatarChange}
              />
              <Button size="small" onClick={() => fileInputRef.current?.click()}>
                Đổi ảnh đại diện
              </Button>
            </div>
          </Space>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tên hiển thị"
            style={{ maxWidth: 300, marginTop: 12 }}
          />
          <div style={{ marginTop: 12 }}>
            <Button type="primary" loading={savingProfile} onClick={handleSaveProfile}>
              Lưu hồ sơ
            </Button>
          </div>

          <Space align="center" style={{ width: "100%", justifyContent: "space-between", marginTop: 20 }}>
            <Typography.Text type="secondary">{email}</Typography.Text>
            <Button danger onClick={handleLogout}>
              Đăng xuất
            </Button>
          </Space>
        </>
      ) : (
        <>
          <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
            Chưa đăng nhập — chỉ cần thiết cho đồng bộ nhiều thiết bị và hồ sơ (ảnh đại diện, tên hiển
            thị). Mọi tính năng tra từ, lưu từ, ôn tập đều dùng được bình thường mà không cần tài khoản.
          </Typography.Paragraph>
          <Button type="primary" onClick={onRequireLogin}>
            Đăng nhập
          </Button>
        </>
      )}

      <Typography.Title level={4} style={{ marginTop: 32 }}>
        Groq API (tính năng AI)
      </Typography.Title>
      <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
        Cần để dùng ví dụ câu, giải thích sắc thái, từ liên quan, mẹo ghi nhớ, trắc nghiệm ôn tập và
        trích xuất từ vựng. Lấy key miễn phí tại{" "}
        <Typography.Link href="https://console.groq.com/keys" target="_blank">
          console.groq.com/keys
        </Typography.Link>
        .
      </Typography.Paragraph>
      <Input.Password
        value={groqKey}
        onChange={(e) => setGroqKey(e.target.value)}
        placeholder="gsk_..."
        autoComplete="off"
        style={{ maxWidth: 420 }}
      />
      <Space style={{ marginTop: 12 }}>
        <Button type="primary" loading={savingKey} onClick={handleSaveGroqKey}>
          Lưu
        </Button>
        <Button icon={<ThunderboltOutlined />} loading={testingKey} onClick={handleTestGroqKey}>
          Kiểm tra kết nối
        </Button>
      </Space>

      <Typography.Title level={4} style={{ marginTop: 32 }}>
        Cập nhật
      </Typography.Title>
      <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
        Phiên bản hiện tại: {appVersion ? `v${appVersion}` : "…"}
      </Typography.Paragraph>

      {updateStatus?.state === "downloading" && (
        <Progress percent={updateStatus.percent} style={{ maxWidth: 300 }} />
      )}
      {updateStatus?.state === "available" && (
        <Typography.Text type="secondary" style={{ display: "block", marginBottom: 8 }}>
          Đã tìm thấy bản v{updateStatus.version} — đang tải…
        </Typography.Text>
      )}
      {updateStatus?.state === "not-available" && (
        <Typography.Text type="secondary" style={{ display: "block", marginBottom: 8 }}>
          Bạn đang dùng bản mới nhất.
        </Typography.Text>
      )}
      {updateStatus?.state === "error" && (
        <Typography.Text type="danger" style={{ display: "block", marginBottom: 8 }}>
          {updateStatus.message}
        </Typography.Text>
      )}

      <Space>
        {updateStatus?.state === "downloaded" ? (
          <Button type="primary" onClick={() => window.api.updater.quitAndInstall()}>
            Khởi động lại để cài đặt v{updateStatus.version}
          </Button>
        ) : (
          <Button
            icon={<SyncOutlined />}
            loading={updateStatus?.state === "checking"}
            onClick={() => window.api.updater.checkNow()}
          >
            Kiểm tra cập nhật
          </Button>
        )}
      </Space>
    </PageShell>
  );
}
