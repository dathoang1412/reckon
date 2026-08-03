import { useEffect, useState } from "react";
import { CheckOutlined, CloseOutlined, SoundOutlined } from "@ant-design/icons";
import { Button, Card, Empty, Progress, Select, Space, Tag, Typography } from "antd";
import type { DueEntryRow, VocabSetRow } from "../../../preload/index";
import { speak } from "../lib/speak";

// Mirrors App.tsx's activeSet convention (null = "Tất cả") — unlike the
// service layer's setId param, this UI never exposes an "unassigned only"
// option, so null is unambiguous here.
const ALL_SETS = "__all__";

export default function Review() {
  const [queue, setQueue] = useState<DueEntryRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [rating, setRating] = useState(false);
  const [sets, setSets] = useState<VocabSetRow[]>([]);
  const [setId, setSetId] = useState<string | null>(null);

  useEffect(() => {
    window.api.vocabSet.list().then(setSets);
  }, []);

  useEffect(() => {
    setQueue(null);
    window.api.review.due(20, setId ?? undefined).then((due) => {
      setQueue(due);
      setTotal(due.length);
    });
  }, [setId]);

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

  const setSelector = (
    <Select
      value={setId ?? ALL_SETS}
      onChange={(value) => setSetId(value === ALL_SETS ? null : value)}
      style={{ width: "100%", marginBottom: 16 }}
      options={[{ value: ALL_SETS, label: "Tất cả" }, ...sets.map((s) => ({ value: s.id, label: s.name }))]}
    />
  );

  if (queue === null) {
    return (
      <div style={{ maxWidth: 480, margin: "2rem auto", padding: "0 1rem" }}>
        {setSelector}
      </div>
    );
  }

  if (queue.length === 0) {
    return (
      <div style={{ maxWidth: 480, margin: "2rem auto", padding: "0 1rem" }}>
        {setSelector}
        <div style={{ margin: "4rem 0", textAlign: "center" }}>
          <Empty description={total === 0 ? "Không có từ nào cần ôn" : "Đã ôn xong hết lượt này"} />
        </div>
      </div>
    );
  }

  const current = queue[0];
  const reviewed = total - queue.length;

  return (
    <div style={{ maxWidth: 480, margin: "2rem auto", padding: "0 1rem" }}>
      {setSelector}
      <Progress percent={Math.round((reviewed / total) * 100)} showInfo={false} />
      <Typography.Text type="secondary">
        {reviewed}/{total}
      </Typography.Text>
      <Card style={{ marginTop: 16, minHeight: 180, textAlign: "center" }}>
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Tag color="blue">{current.sourceLang}</Tag>
          <Space align="center">
            <Typography.Title level={3} style={{ margin: 0 }}>
              {current.sourceText}
            </Typography.Title>
            {current.sourceLang !== "vi" && (
              <Button icon={<SoundOutlined />} onClick={() => speak(current.sourceText, current.sourceLang)} />
            )}
          </Space>
          {revealed ? (
            <>
              <Tag color="green">{current.targetLang}</Tag>
              <Space align="center">
                <Typography.Title level={4} style={{ margin: 0 }}>
                  {current.targetText}
                </Typography.Title>
                {current.targetLang !== "vi" && (
                  <Button icon={<SoundOutlined />} onClick={() => speak(current.targetText, current.targetLang)} />
                )}
              </Space>
              {current.targetMeanings.length > 1 && (
                <Space size={[4, 4]} wrap style={{ justifyContent: "center" }}>
                  {current.targetMeanings.slice(1).map((meaning) => (
                    <Tag key={meaning} color="default">
                      {meaning}
                    </Tag>
                  ))}
                </Space>
              )}
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
