import { useState } from "react";
import { MoreOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Dropdown, Input, Modal, Typography, type MenuProps } from "antd";
import type { VocabSetRow } from "../../../preload/index";
import { COLOR_PRIMARY, styleTokens } from "../theme";

interface DeckRowProps {
  label: string;
  count: number;
  lastActivity: string | null;
  active: boolean;
  onClick: () => void;
  onRename?: () => void;
  onDelete?: () => void;
}

function DeckRow({ label, count, lastActivity, active, onClick, onRename, onDelete }: DeckRowProps) {
  const menuItems: MenuProps["items"] = [
    onRename && { key: "rename", label: "Đổi tên" },
    onDelete && { key: "delete", label: "Xoá", danger: true },
  ].filter(Boolean) as MenuProps["items"];

  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 8,
        cursor: "pointer",
        background: active ? `${COLOR_PRIMARY}14` : "transparent",
        borderLeft: `3px solid ${active ? COLOR_PRIMARY : "transparent"}`,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <Typography.Text strong={active} ellipsis style={{ display: "block" }}>
          {label}
        </Typography.Text>
        <Typography.Text type="secondary" style={{ fontSize: styleTokens.secondaryFontSize, whiteSpace: "nowrap" }}>
          {count} từ{lastActivity ? ` · ${lastActivity}` : ""}
        </Typography.Text>
      </div>
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
          <MoreOutlined onClick={(e) => e.stopPropagation()} style={{ flexShrink: 0, padding: "0 4px" }} />
        </Dropdown>
      )}
    </div>
  );
}

export interface SetsBarProps {
  sets: VocabSetRow[];
  countAll: number;
  countFor: (setId: string) => number;
  // Human-readable label for the most recent word saved into this set
  // (or across everything, for null) — e.g. "Hôm nay", null when empty.
  latestDateFor: (setId: string | null) => string | null;
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
  latestDateFor,
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <Typography.Text
          type="secondary"
          strong
          style={{ fontSize: styleTokens.secondaryFontSize, textTransform: "uppercase", letterSpacing: 0.4 }}
        >
          Bộ từ
        </Typography.Text>
        <Button
          type="text"
          size="small"
          icon={<PlusOutlined />}
          onClick={() => {
            setName("");
            setDialog({ mode: "create" });
          }}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <DeckRow
          label="Tất cả"
          count={countAll}
          lastActivity={latestDateFor(null)}
          active={activeSet === null}
          onClick={() => onSelect(null)}
        />
        {sets.map((s) => (
          <DeckRow
            key={s.id}
            label={s.name}
            count={countFor(s.id)}
            lastActivity={latestDateFor(s.id)}
            active={activeSet === s.id}
            onClick={() => onSelect(s.id)}
            onRename={() => {
              setName(s.name);
              setDialog({ mode: "rename", id: s.id });
            }}
            onDelete={() => onDelete(s.id)}
          />
        ))}
      </div>

      <Modal
        open={dialog !== null}
        title={dialog?.mode === "create" ? "Tạo bộ từ mới" : "Đổi tên bộ từ"}
        onCancel={() => setDialog(null)}
        onOk={handleOk}
        okButtonProps={{ disabled: !name.trim() }}
        destroyOnHidden
      >
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onPressEnter={handleOk}
          placeholder="Tên bộ từ"
        />
      </Modal>
    </>
  );
}
