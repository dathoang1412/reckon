import { useState } from "react";
import { GoogleOutlined } from "@ant-design/icons";
import { Button, Divider, Form, Input, Modal, Typography } from "antd";
import toast from "react-hot-toast";
import { COLOR_PRIMARY } from "../theme";

// Login is opt-in, not a gate the whole app sits behind — everything here
// works entirely offline against the local SQLite database (see
// main/services/vocab/vocab.ts and friends), so there's nothing to require an
// account for. This modal only ever pops up when something that actually
// needs the shared account (right now: Sync, and the profile section in
// Settings) is used without one — see App.tsx/Settings.tsx.
export default function LoginModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  async function handleSubmit(values: { email: string; password: string }) {
    setSubmitting(true);
    try {
      if (mode === "signup") {
        await window.api.auth.signup(values.email, values.password);
      } else {
        await window.api.auth.login(values.email, values.password);
      }
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleLogin() {
    setGoogleSubmitting(true);
    try {
      // Opens the system browser (not an in-app window — Google blocks
      // OAuth inside embedded webviews) and waits for that flow to finish;
      // see main/services/auth/googleAuth.ts.
      await window.api.auth.loginWithGoogle();
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setGoogleSubmitting(false);
    }
  }

  return (
    <Modal open={open} onCancel={onClose} footer={null} destroyOnHidden centered width={360}>
      <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 0, color: COLOR_PRIMARY }}>
        Reckon
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        {mode === "login" ? "Đăng nhập để đồng bộ & quản lý tài khoản" : "Tạo tài khoản mới"}
      </Typography.Paragraph>

      <Form layout="vertical" onFinish={handleSubmit} requiredMark={false}>
        <Form.Item
          name="email"
          label="Email"
          rules={[
            { required: true, message: "Nhập email" },
            { type: "email", message: "Email không hợp lệ" },
          ]}
        >
          <Input autoFocus placeholder="you@example.com" />
        </Form.Item>
        <Form.Item
          name="password"
          label="Mật khẩu"
          rules={[
            { required: true, message: "Nhập mật khẩu" },
            { min: 8, message: "Mật khẩu tối thiểu 8 ký tự" },
          ]}
        >
          <Input.Password placeholder="••••••••" />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={submitting} block>
          {mode === "login" ? "Đăng nhập" : "Đăng ký"}
        </Button>
      </Form>

      <Divider style={{ margin: "16px 0" }}>hoặc</Divider>

      <Button
        icon={<GoogleOutlined />}
        loading={googleSubmitting}
        onClick={handleGoogleLogin}
        block
        disabled={submitting}
      >
        Đăng nhập với Google
      </Button>

      <Typography.Paragraph style={{ marginTop: 16, textAlign: "center" }}>
        {mode === "login" ? (
          <>
            Chưa có tài khoản? <a onClick={() => setMode("signup")}>Đăng ký</a>
          </>
        ) : (
          <>
            Đã có tài khoản? <a onClick={() => setMode("login")}>Đăng nhập</a>
          </>
        )}
      </Typography.Paragraph>
    </Modal>
  );
}
