import { useState } from "react";
import { Button, ConfigProvider, Form, Input, Typography, message } from "antd";

export default function Login({ onSuccess }: { onSuccess: () => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [submitting, setSubmitting] = useState(false);

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
      message.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ConfigProvider theme={{ token: { colorPrimary: "#1677ff" } }}>
      <div style={{ maxWidth: 360, margin: "4rem auto", padding: "0 1.5rem" }}>
        <Typography.Title level={2} style={{ marginBottom: 0 }}>
          Reckon
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          {mode === "login" ? "Đăng nhập để tiếp tục" : "Tạo tài khoản mới"}
        </Typography.Paragraph>

        <Form layout="vertical" onFinish={handleSubmit} requiredMark={false}>
          <Form.Item
            name="email"
            label="Email"
            rules={[{ required: true, message: "Nhập email" }, { type: "email", message: "Email không hợp lệ" }]}
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

        <Typography.Paragraph style={{ marginTop: 16, textAlign: "center" }}>
          {mode === "login" ? (
            <>
              Chưa có tài khoản?{" "}
              <a onClick={() => setMode("signup")}>Đăng ký</a>
            </>
          ) : (
            <>
              Đã có tài khoản? <a onClick={() => setMode("login")}>Đăng nhập</a>
            </>
          )}
        </Typography.Paragraph>
      </div>
    </ConfigProvider>
  );
}
