# Reckon — Tổng quan & Roadmap tính năng

> Tài liệu này mô tả kiến trúc/DB hiện tại của Reckon và đề xuất các tính năng
> có thể phát triển tiếp. Đây là tài liệu sống — cập nhật khi hướng sản phẩm
> thay đổi.

## 1. App là gì

Reckon là app desktop (Electron) chạy nền, cho phép **tra từ vựng nhanh bằng
phím tắt** (copy text → `Ctrl+Shift+D` → popup dịch hiện ngay tại vị trí con
trỏ) và lưu lại lịch sử tra cứu. Dữ liệu lưu **local-first** (SQLite trong
app), có thể **đồng bộ lên server** (Postgres) để dùng nhiều máy.

## 2. Kiến trúc hiện tại

```
reckoff/ (pnpm monorepo)
├── apps/
│   ├── desktop/          Electron app (main + renderer)
│   │   ├── src/main/      process chính: db, sync, tray, hotkey, popup
│   │   ├── src/preload/   IPC bridge
│   │   ├── src/renderer/  React UI (Ant Design)
│   │   └── prisma/        schema SQLite (local)
│   └── server/            NestJS API (sync backend)
│       ├── src/sync/       push/pull endpoint
│       ├── src/health/     healthcheck
│       └── prisma/         schema Postgres
├── packages/
│   └── shared/            zod schemas + logic dùng chung (entities, sync)
└── infra/docker/          docker-compose (postgres + server)
```

**Luồng dữ liệu chính:**
1. User copy text, bấm hotkey → `translate.ts` gọi MyMemory API (free, không cần key) → lưu `VocabEntry` vào SQLite local → hiện popup.
2. User bấm "Sync now" → `sync.ts` push toàn bộ local records lên `/sync/push`, rồi pull thay đổi mới từ server qua `/sync/pull` (last-write-wins, tie-break theo `deviceId`).
3. Server lưu mọi loại record vào 1 bảng generic `SyncRecord` (kind-agnostic) — thêm entity mới ở client không cần migrate server.

## 3. Database hiện tại

### 3.1 Desktop (SQLite, local-first — `apps/desktop/prisma/schema.prisma`)

| Model | Field | Ghi chú |
|---|---|---|
| `VocabEntry` | `id, sourceText, sourceLang, targetText, targetLang, updatedAt, deviceId, deletedAt` | soft-delete qua `deletedAt` |
| `SyncState` | `id (=1), lastPulledAt` | singleton, đánh dấu lần pull cuối |

### 3.2 Server (Postgres — `apps/server/prisma/schema.prisma`)

| Model | Field | Ghi chú |
|---|---|---|
| `SyncRecord` | `kind, recordId, deviceId, updatedAt, deletedAt, data (Json)` | PK `(kind, recordId)`, index `updatedAt`. Kho chứa **mọi** loại entity đồng bộ được, generic theo thiết kế. |

Đáng chú ý: **chưa có bảng User/Account** — mọi record đang chia sẻ chung 1
"không gian" trên server, phân biệt duy nhất bằng `deviceId`. Đây là điểm cần
giải quyết đầu tiên nếu muốn nhiều người dùng thật sự tách biệt dữ liệu.

## 4. Tính năng hiện có

- [x] Global hotkey tra từ từ clipboard, popup kết quả gần con trỏ chuột
- [x] Tự nhận diện chiều dịch vi↔en dựa trên ký tự tiếng Việt
- [x] Lưu lịch sử tra cứu, xem/xoá trong cửa sổ chính
- [x] Chạy nền qua system tray (không thoát khi đóng cửa sổ)
- [x] Đồng bộ 2 chiều thủ công (nút "Sync now") qua NestJS + Postgres
- [x] Conflict resolution last-write-wins dùng chung giữa client/server (`packages/shared`)

## 5. Đề xuất tính năng phát triển

### A. Tra cứu & Từ vựng (core)
- **Đa nguồn dịch**: fallback nếu MyMemory rate-limit/lỗi (vd. LibreTranslate, Google Translate API có key). Cho user cấu hình provider + API key.
- **Phát âm (TTS)**: nút nghe phát âm từ, dùng Web Speech API hoặc provider TTS.
- **Ví dụ câu / định nghĩa đầy đủ**: tích hợp dictionary API (vd. Free Dictionary API) để có định nghĩa, loại từ, ví dụ — không chỉ dịch máy.
- **Tra từ không cần copy**: hook chọn text trực tiếp (select + hotkey) thay vì phải copy trước.
- **Tra offline**: cache kết quả dịch phổ biến hoặc bundle 1 từ điển offline nhỏ để dùng khi mất mạng.
- **Sửa/ghi chú thủ công**: cho phép user sửa bản dịch tự động hoặc thêm ghi chú cá nhân vào 1 entry.
- **Tags/nhóm từ**: gắn nhãn (vd. "công việc", "IELTS") để lọc theo chủ đề.

### B. Học tập / Ôn tập (biến từ "lookup log" thành "vocab learning app")
- **Spaced repetition (SRS)**: lịch ôn tập kiểu Anki/SM-2, đánh dấu "nhớ/không nhớ" mỗi lần ôn.
- **Flashcard mode**: cửa sổ ôn tập nhanh, có thể trigger bằng hotkey khác.
- **Thống kê học tập**: số từ tra mỗi ngày, streak, biểu đồ tiến độ.
- **Nhắc ôn tập định kỳ**: notification hệ thống nhắc ôn từ sắp quên (theo SRS).
- **Quiz/kiểm tra**: trắc nghiệm nhanh từ các entry đã lưu.

### C. Đồng bộ & Tài khoản
- **Auth thật sự** (email/OAuth) — hiện tại mọi thiết bị share chung dữ liệu server, không có khái niệm user. Cần `User` + gắn `userId` vào `SyncRecord` để cô lập dữ liệu từng người.
- **Auto-sync nền** (interval hoặc theo sự kiện) thay vì chỉ bấm tay.
- **Quản lý thiết bị**: xem danh sách device đã đồng bộ, revoke 1 device.
- **Sync qua nhiều loại entity** khác ngoài vocab (tận dụng thiết kế `kind`-agnostic sẵn có), vd. settings, learning progress.
- **Xử lý conflict tốt hơn**: hiện tại last-write-wins đơn giản có thể mất dữ liệu khi sửa đồng thời — cân nhắc merge theo field hoặc giữ lịch sử version.

### D. UI/UX
- **Trang Settings**: đổi hotkey, chọn provider dịch, bật/tắt auto-sync, theme sáng/tối.
- **Tìm kiếm & lọc lịch sử**: search theo text, filter theo ngôn ngữ/tag/ngày.
- **Export/Import**: xuất CSV/Anki deck, import từ file có sẵn.
- **Đa ngôn ngữ giao diện** (không chỉ vi↔en cho nội dung tra cứu).
- **Popup tuỳ biến**: vị trí, thời gian tự ẩn, kích thước, thêm nút "lưu"/"bỏ qua" ngay trên popup.
- **Onboarding**: hướng dẫn hotkey lần đầu mở app.

### E. Hạ tầng & vận hành
- **Rate limiting & retry** cho API dịch (tránh bị chặn khi dùng nhiều).
- **Logging/monitoring** phía server (hiện chỉ có healthcheck endpoint trơ).
- **Auto-update** cho desktop app (electron-updater).
- **CI**: test + lint + build tự động (repo hiện có `test`/`lint` script nhưng chưa thấy workflow CI).
- **Migration chiến lược** cho SQLite khi schema local thay đổi giữa các version app đã cài.

## 6. Đề xuất mở rộng DB schema

Nếu triển khai các mục ưu tiên cao (SRS + Auth), schema có thể mở rộng như sau:

### Desktop (SQLite)
```prisma
model VocabEntry {
  id         String    @id
  sourceText String
  sourceLang String
  targetText String
  targetLang String
  definition String?           // + định nghĩa/loại từ từ dictionary API
  note       String?           // + ghi chú cá nhân
  tags       String?           // + CSV hoặc JSON string đơn giản
  updatedAt  DateTime
  deviceId   String
  deletedAt  DateTime?
}

// + Bảng mới cho spaced repetition
model ReviewState {
  vocabId       String   @id
  easeFactor    Float    @default(2.5)
  intervalDays  Int      @default(0)
  repetitions   Int      @default(0)
  dueAt         DateTime
  lastReviewedAt DateTime?
}
```

### Server (Postgres)
```prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  createdAt DateTime @default(now())
  devices   Device[]
}

model Device {
  id       String @id            // = deviceId hiện tại đang dùng local
  userId   String
  user     User   @relation(fields: [userId], references: [id])
  label    String?
  lastSeenAt DateTime?
}

model SyncRecord {
  kind      String
  recordId  String
  userId    String        // + cô lập dữ liệu theo user thay vì global
  deviceId  String
  updatedAt DateTime
  deletedAt DateTime?
  data      Json

  @@id([kind, recordId])
  @@index([userId, updatedAt])
}
```

`SyncRecord` vẫn giữ nguyên triết lý "generic, kind-agnostic" — chỉ thêm
`userId` để multi-tenant, không cần đổi cấu trúc mỗi khi thêm entity mới.

## 7. Gợi ý thứ tự triển khai

1. **Nền tảng dùng thật**: Settings page, auto-sync nền, export/import — chi phí thấp, giá trị ngay.
2. **Học tập**: SRS + flashcard mode — đây là bước biến app từ "sổ tra từ" thành "app học từ vựng" thật sự, đúng hướng tên gọi "vocabulary lookup app".
3. **Đa người dùng**: Auth + tách dữ liệu theo `userId` — cần thiết trước khi phát hành cho nhiều người dùng cùng server.
4. **Mở rộng nguồn dữ liệu**: dictionary API, TTS, đa provider dịch.
5. **Vận hành**: CI, auto-update, logging — làm song song khi app bắt đầu có người dùng thật.
