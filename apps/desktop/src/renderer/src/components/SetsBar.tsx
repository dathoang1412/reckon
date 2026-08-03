import { useState } from "react";
import { MoreOutlined, PlusOutlined } from "@ant-design/icons";
import { Card, Dropdown, Input, Modal, Space, Typography, type MenuProps } from "antd";
import type { VocabSetRow } from "../../../preload/index";

interface DeckCardProps {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  onRename?: () => void;
  onDelete?: () => void;
}

function DeckCard({ label, count, active, onClick, onRename, onDelete }: DeckCardProps) {
  const menuItems: MenuProps["items"] = [
    onRename && { key: "rename", label: "Đổi tên" },
    onDelete && { key: "delete", label: "Xoá", danger: true },
  ].filter(Boolean) as MenuProps["items"];

  return (
    <Card
      size="small"
      hoverable
      onClick={onClick}
      style={{
        minWidth: 108,
        cursor: "pointer",
        borderColor: active ? "#1677ff" : undefined,
        background: active ? "#e6f4ff" : undefined,
      }}
      styles={{ body: { padding: "8px 12px" } }}
    >
      <Space align="start" style={{ justifyContent: "space-between", width: "100%" }}>
        <Space direction="vertical" size={0}>
          <Typography.Text strong={active}>{label}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {count} từ
          </Typography.Text>
        </Space>
        {menuItems && menuItems.length > 0 && (
          <Dropdown
            trigger={["click"]}
            menu={{
              items: menuItems,
              onClick: ({ key, domEvent }) => {
                domEvent.stopPropagation();
                if (key === "rename") onRename?.();
                if (key === "delete") onDelete?.();
              },
            }}
          >
            <MoreOutlined onClick={(e) => e.stopPropagation()} />
          </Dropdown>
        )}
      </Space>
    </Card>
  );
}

export interface SetsBarProps {
  sets: VocabSetRow[];
  countAll: number;
  countFor: (setId: string) => number;
  activeSet: string | null;
  onSelect: (setId: string | null) => void;
  onCreate: (name: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export default function SetsBar({
  sets,
  countAll,
  countFor,
  activeSet,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: SetsBarProps) {
  const [dialog, setDialog] = useState<{ mode: "create" } | { mode: "rename"; id: string } | null>(null);
  const [name, setName] = useState("");

  async function handleOk() {
    const trimmed = name.trim();
    if (!trimmed || !dialog) return;
    if (dialog.mode === "create") {
      await onCreate(trimmed);
    } else {
      await onRename(dialog.id, trimmed);
    }
    setDialog(null);
  }

  return (
    <>
      <Space size={10} wrap style={{ marginBottom: 16 }}>
        <DeckCard label="Tất cả" count={countAll} active={activeSet === null} onClick={() => onSelect(null)} />
        {sets.map((s) => (
          <DeckCard
            key={s.id}
            label={s.name}
            count={countFor(s.id)}
            active={activeSet === s.id}
            onClick={() => onSelect(s.id)}
            onRename={() => {
              setName(s.name);
              setDialog({ mode: "rename", id: s.id });
            }}
            onDelete={() => onDelete(s.id)}
          />
        ))}
        <Card
          size="small"
          hoverable
          onClick={() => {
            setName("");
            setDialog({ mode: "create" });
          }}
          style={{ minWidth: 108, cursor: "pointer", borderStyle: "dashed" }}
          styles={{ body: { padding: "8px 12px", textAlign: "center" } }}
        >
          <PlusOutlined /> Bộ mới
        </Card>
      </Space>

      <Modal
        open={dialog !== null}
        title={dialog?.mode === "create" ? "Tạo bộ từ mới" : "Đổi tên bộ từ"}
        onCancel={() => setDialog(null)}
        onOk={handleOk}
        okButtonProps={{ disabled: !name.trim() }}
        destroyOnHidden
      >
        <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} onPressEnter={handleOk} placeholder="Tên bộ từ" />
      </Modal>
    </>
  );
}
