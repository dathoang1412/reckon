import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { UserOutlined } from "@ant-design/icons";
import { Avatar, Button, Input, Space, Typography } from "antd";
import toast from "react-hot-toast";
import ActivityChart from "../components/ActivityChart";
import PageShell from "../components/PageShell";
import type { UserProfile, VocabEntryRow } from "../../../preload/index";

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

export default function Profile({
  authed,
  onLogout,
  onRequireLogin,
  onProfileUpdated,
}: {
  authed: boolean | null;
  onLogout: () => void;
  onRequireLogin: () => void;
  // Lets the header (see AppHeader/App.tsx) pick up a saved avatar/name
  // immediately instead of waiting for its own next fetch.
  onProfileUpdated: (profile: UserProfile) => void;
}) {
  const [email, setEmail] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [avatarBase64, setAvatarBase64] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<VocabEntryRow[]>([]);

  useEffect(() => {
    window.api.auth.getSession().then((session) => setEmail(session?.email ?? null));
  }, []);

  // Entirely local (SQLite via vocab.list) — unlike the rest of this page,
  // the activity chart doesn't need an account, so it's fetched
  // unconditionally rather than gated behind `authed`.
  useEffect(() => {
    window.api.vocab.list().then(setEntries);
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
      onProfileUpdated(await window.api.auth.updateProfile({ name: name.trim() || null, avatarBase64 }));
      toast.success("Đã lưu hồ sơ");
    } catch (err) {
      toast.error(`Lưu thất bại: ${errorMessage(err)}`);
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleLogout() {
    await window.api.auth.logout();
    onLogout();
  }

  return (
    <PageShell>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        Hồ sơ
      </Typography.Title>

      <ActivityChart entries={entries} />

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
    </PageShell>
  );
}
