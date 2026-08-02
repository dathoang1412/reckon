import { useEffect, useState } from "react";
import { CheckOutlined, CloseOutlined } from "@ant-design/icons";
import { Button, Card, Empty, Progress, Space, Tag, Typography } from "antd";
import type { DueEntryRow } from "../../preload/index";

export default function Review() {
  const [queue, setQueue] = useState<DueEntryRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [rating, setRating] = useState(false);

  useEffect(() => {
    window.api.review.due().then((due) => {
      setQueue(due);
      setTotal(due.length);
    });
  }, []);

  async function rate(remembered: boolean) {
    if (!queue || queue.length === 0) return;
    setRating(true);
    try {
      await window.api.review.rate(queue[0].id, remembered);
      setQueue(queue.slice(1));
      setRevealed(false);
    } finally {
      setRating(false);
    }
  }

  if (queue === null) return null;

  if (queue.length === 0) {
    return (
      <div style={{ maxWidth: 480, margin: "4rem auto", padding: "0 1rem", textAlign: "center" }}>
        <Empty description={total === 0 ? "Không có từ nào cần ôn" : "Đã ôn xong hết lượt này"} />
      </div>
    );
  }

  const current = queue[0];
  const reviewed = total - queue.length;

  return (
    <div style={{ maxWidth: 480, margin: "2rem auto", padding: "0 1rem" }}>
      <Progress percent={Math.round((reviewed / total) * 100)} showInfo={false} />
      <Typography.Text type="secondary">
        {reviewed}/{total}
      </Typography.Text>
      <Card style={{ marginTop: 16, minHeight: 180, textAlign: "center" }}>
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Tag color="blue">{current.sourceLang}</Tag>
          <Typography.Title level={3} style={{ margin: 0 }}>
            {current.sourceText}
          </Typography.Title>
          {revealed ? (
            <>
              <Tag color="green">{current.targetLang}</Tag>
              <Typography.Title level={4} style={{ margin: 0 }}>
                {current.targetText}
              </Typography.Title>
            </>
          ) : (
            <Button onClick={() => setRevealed(true)}>Hiện đáp án</Button>
          )}
        </Space>
      </Card>
      {revealed && (
        <Space style={{ width: "100%", justifyContent: "center", marginTop: 16 }} size="large">
          <Button danger icon={<CloseOutlined />} loading={rating} onClick={() => rate(false)}>
            Chưa nhớ
          </Button>
          <Button type="primary" icon={<CheckOutlined />} loading={rating} onClick={() => rate(true)}>
            Đã nhớ
          </Button>
        </Space>
      )}
    </div>
  );
}
