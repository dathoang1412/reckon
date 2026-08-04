import { useState } from "react";
import { GoogleOutlined } from "@ant-design/icons";
import { Button, Divider, Form, Input, Typography } from "antd";
import toast from "react-hot-toast";
import PageShell from "../components/PageShell";
import { COLOR_PRIMARY } from "../theme";

export default function Login({ onSuccess }: { onSuccess: () => void }) {
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
      // see main/services/googleAuth.ts.
      await window.api.auth.loginWithGoogle();
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setGoogleSubmitting(false);
    }
  }

  return (
    <PageShell maxWidth={360} margin="4rem auto" padding="0 1.5rem">
      <Typography.Title level={2} style={{ marginBottom: 0, color: COLOR_PRIMARY }}>
        Reckon
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        {mode === "login" ? "Đăng nhập để tiếp tục" : "Tạo tài khoản mới"}
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
    </PageShell>
  );
}
