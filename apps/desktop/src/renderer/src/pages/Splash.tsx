import { Spin, Typography } from "antd";

export default function Splash() {
  return (
    <div
      style={{
        height: "100vh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        fontFamily: "system-ui, sans-serif",
        background: "#ffffff",
      }}
    >
      <Typography.Title level={3} style={{ margin: 0 }}>
        Reckon
      </Typography.Title>
      <Spin size="large" />
      <Typography.Text type="secondary">Đang khởi động…</Typography.Text>
    </div>
  );
}
