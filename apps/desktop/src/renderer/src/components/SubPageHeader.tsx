import { Button, Space, Typography } from "antd";

// The "title + back button" row repeated by hand at the top of every
// sub-page (Settings, the Review view).
export default function SubPageHeader({ title, onBack }: { title?: string; onBack: () => void }) {
  return (
    <Space align="center" style={{ width: "100%", justifyContent: "space-between", marginBottom: title ? 0 : 16 }}>
      {title ? (
        <Typography.Title level={2} style={{ margin: 0 }}>
          {title}
        </Typography.Title>
      ) : (
        <span />
      )}
      <Button onClick={onBack}>← Quay lại</Button>
    </Space>
  );
}
