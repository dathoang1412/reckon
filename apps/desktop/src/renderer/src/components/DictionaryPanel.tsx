import { SoundOutlined } from "@ant-design/icons";
import { Button, Divider, Space, Tag, Typography } from "antd";
import type { DictionaryInfo } from "../../../preload/index";

export default function DictionaryPanel({ dictionary }: { dictionary: DictionaryInfo }) {
  return (
    <>
      <Divider style={{ margin: "10px 0" }} />
      {dictionary.phonetic && (
        <Typography.Text type="secondary" style={{ display: "block", marginBottom: 6 }}>
          /{dictionary.phonetic}/
          {dictionary.audioUrl && (
            <Button
              type="text"
              size="small"
              icon={<SoundOutlined />}
              onClick={() => new Audio(dictionary.audioUrl).play()}
            />
          )}
        </Typography.Text>
      )}
      <Space direction="vertical" size={6} style={{ width: "100%" }}>
        {dictionary.definitions.map((d, i) => (
          <div key={i}>
            <Tag color="default">{d.partOfSpeech}</Tag>
            <Typography.Text style={{ display: "block", marginTop: 2 }}>{d.definition}</Typography.Text>
            {d.example && (
              <Typography.Text italic type="secondary" style={{ display: "block" }}>
                “{d.example}”
              </Typography.Text>
            )}
          </div>
        ))}
      </Space>
    </>
  );
}
