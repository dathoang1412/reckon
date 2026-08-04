import { useState, type FormEvent } from "react";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import toast from "react-hot-toast";
import PageShell from "../components/PageShell";
import { COLOR_PRIMARY } from "../theme";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login({ onSuccess }: { onSuccess: () => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  function validate() {
    const next: { email?: string; password?: string } = {};
    if (!email) next.email = "Nhập email";
    else if (!EMAIL_RE.test(email)) next.email = "Email không hợp lệ";
    if (!password) next.password = "Nhập mật khẩu";
    else if (password.length < 8) next.password = "Mật khẩu tối thiểu 8 ký tự";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      if (mode === "signup") {
        await window.api.auth.signup(email, password);
      } else {
        await window.api.auth.login(email, password);
      }
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageShell maxWidth={360} margin="4rem auto" padding="0 1.5rem">
      <Typography variant="h4" sx={{ marginBottom: 0, color: COLOR_PRIMARY }}>
        Reckon
      </Typography>
      <Typography color="text.secondary" sx={{ marginBottom: 2 }}>
        {mode === "login" ? "Đăng nhập để tiếp tục" : "Tạo tài khoản mới"}
      </Typography>

      <form onSubmit={handleSubmit} noValidate>
        <Stack spacing={2}>
          <TextField
            autoFocus
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={!!errors.email}
            helperText={errors.email}
            fullWidth
          />
          <TextField
            type="password"
            label="Mật khẩu"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={!!errors.password}
            helperText={errors.password}
            fullWidth
          />
          <Button type="submit" variant="contained" loading={submitting} fullWidth>
            {mode === "login" ? "Đăng nhập" : "Đăng ký"}
          </Button>
        </Stack>
      </form>

      <Typography sx={{ marginTop: 2, textAlign: "center" }}>
        {mode === "login" ? (
          <>
            Chưa có tài khoản? <Link onClick={() => setMode("signup")}>Đăng ký</Link>
          </>
        ) : (
          <>
            Đã có tài khoản? <Link onClick={() => setMode("login")}>Đăng nhập</Link>
          </>
        )}
      </Typography>
    </PageShell>
  );
}
