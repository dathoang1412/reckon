# Reckon — Tổng quan & Roadmap tính năng

> Tài liệu này mô tả kiến trúc/DB hiện tại của Reckon và đề xuất các tính năng
> có thể phát triển tiếp. Đây là tài liệu sống — cập nhật khi hướng sản phẩm
> thay đổi. Cập nhật gần nhất: 2026-08-03.

## 1. App là gì

Reckon là app desktop (Electron) chạy nền, cho phép **tra từ vựng nhanh bằng
phím tắt** (chọn text → hotkey tuỳ biến → popup dịch hiện ngay tại vị trí con
trỏ, kèm định nghĩa/phiên âm/phát âm), lưu lại từ đã tra thành sổ từ vựng có
thể phân loại theo bộ (set), và **ôn tập theo spaced repetition** để không
quên. Dữ liệu lưu **local-first** (SQLite trong app), đồng bộ 2 chiều lên
server (Postgres) để dùng nhiều máy.

## 2. Kiến trúc hiện tại

```
reckoff/ (pnpm monorepo)
├── apps/
│   ├── desktop/          Electron app (main + renderer)
│   │   ├── src/main/      process chính: db, sync, tray, hotkey, popup, tts
│   │   ├── src/preload/   IPC bridge
│   │   ├── src/renderer/  React UI (Ant Design)
│   │   └── prisma/        schema SQLite (local)
│   └── server/            NestJS API (sync backend)
│       ├── src/sync/       push/pull endpoint
│       ├── src/health/     healthcheck
│       └── prisma/         schema Postgres
├── packages/
│   └── shared/            zod schemas + logic dùng chung (entities, sync)
├── assets/logo/           logo nguồn (SVG/PNG, icon + lockup)
└── infra/docker/          docker-compose (postgres + server)
```

**Luồng dữ liệu chính:**
1. User chọn text, bấm hotkey → `translate.ts` gọi Google Translate (endpoint
   không chính thức, free) → fallback MyMemory nếu lỗi/rate-limit →
   `dictionary.ts` (Free Dictionary API) enrich thêm định nghĩa/IPA/audio nếu
   một chiều là tiếng Anh → lưu `VocabEntry` vào SQLite local → hiện popup.
2. User bấm nút loa → `tts.ts` gọi Google TTS (endpoint không chính thức,
   free, cùng họ với `translate.ts`) → fallback về giọng OS
   (`speechSynthesis`) nếu offline/lỗi.
3. User bấm "Sync now" → `sync.ts` push **toàn bộ** local records lên
   `/sync/push`, rồi pull thay đổi mới từ server qua `/sync/pull`
   (last-write-wins, tie-break theo `deviceId`).
4. Server lưu mọi loại record vào 1 bảng generic `SyncRecord` (kind-agnostic)
   — thêm entity mới ở client không cần migrate server.
5. User ôn tập (`Review.tsx`) → thuật toán SM-2 đơn giản (`srs.ts`) tính lại
   `dueAt`/`easeFactor` mỗi lần đánh giá nhớ/không nhớ.

## 3. Database hiện tại

### 3.1 Desktop (SQLite, local-first — `apps/desktop/prisma/schema.prisma`)

| Model | Field | Ghi chú |
|---|---|---|
| `VocabEntry` | `id, sourceText, sourceLang, targetText, targetMeanings, targetLang, definition, note, tags, setId, createdAt, updatedAt, deviceId, deletedAt` | soft-delete qua `deletedAt`. **`definition`/`note`/`tags` đã có cột nhưng chưa có UI đọc/ghi** — xem mục 5.A. |
| `VocabSet` | `id, name, updatedAt, deviceId, deletedAt` | folder/nhóm từ, 1 entry chỉ thuộc 1 set |
| `ReviewState` | `vocabId, easeFactor, intervalDays, repetitions, dueAt, lastReviewedAt` | trạng thái SRS, 1 dòng/entry, chỉ tồn tại sau khi ôn lần đầu |
| `SyncState` | `id (=1), lastPulledAt` | singleton, đánh dấu lần pull cuối |

### 3.2 Server (Postgres — `apps/server/prisma/schema.prisma`)

| Model | Field | Ghi chú |
|---|---|---|
| `SyncRecord` | `kind, recordId, userId, deviceId, updatedAt, deletedAt, data (Json)` | PK `(kind, recordId)`, index `updatedAt` + `userId`. Kho chứa **mọi** loại entity đồng bộ được, generic theo thiết kế. |
| `User` | `id, email, createdAt` | **đã có bảng**, nhưng chưa có luồng đăng nhập nào gán vào nó |
| `Device` | `id (=deviceId), userId, label, lastSeenAt` | **đã có bảng**, chưa được ghi/đọc ở đâu trong code hiện tại |

Đáng chú ý: `SyncRecord.userId` đã tồn tại nhưng **nullable và không được
enforce** — mọi record vẫn đang chia sẻ chung 1 "không gian" trên server,
phân biệt duy nhất bằng `deviceId`. Khung sườn multi-tenant (`User`/`Device`)
đã có sẵn, chỉ thiếu auth thật để kích hoạt nó — đây vẫn là điểm cần giải
quyết đầu tiên nếu muốn phát hành cho nhiều người dùng thật.

## 4. Tính năng hiện có

- [x] Global hotkey tra từ, popup kết quả gần con trỏ chuột, hotkey tuỳ biến trong Settings
- [x] Tự nhận diện chiều dịch vi↔en dựa trên ký tự tiếng Việt
- [x] Dịch qua Google Translate (không key) với fallback MyMemory
- [x] Enrich định nghĩa/loại từ/phiên âm/audio qua Free Dictionary API cho phía tiếng Anh
- [x] Text-to-speech: Google TTS (giọng tự nhiên) với fallback giọng OS khi offline/lỗi, bỏ qua tiếng Việt
- [x] Lưu lịch sử tra cứu, xem/xoá/gộp theo set trong cửa sổ chính, xem chi tiết trong modal
- [x] Danh sách từ đã lưu **nhóm theo ngày lưu** (Hôm nay/Hôm qua/ngày cụ thể), có giờ lưu
- [x] Vocabulary sets (folder), gán/đổi set cho từng entry
- [x] Spaced repetition (SM-2 đơn giản) + flashcard review queue
- [x] Chạy nền qua system tray (không thoát khi đóng cửa sổ), icon/logo riêng
- [x] Đồng bộ 2 chiều thủ công (nút "Sync now") qua NestJS + Postgres, `createdAt` đã được đồng bộ đầy đủ (không chỉ local)
- [x] Conflict resolution last-write-wins dùng chung giữa client/server (`packages/shared`)
- [x] CI (build+test trên mỗi PR) và Release workflow (build + publish GitHub Release theo tag `v*.*.*`)

## 5. Đề xuất tính năng phát triển

### A. Tra cứu & Từ vựng (core)
- **Bật UI cho `definition`/`note`/`tags`** — cột đã có sẵn trong DB (kể cả
  đã đồng bộ qua `vocabEntrySchema` nếu thêm vào), chỉ thiếu form sửa trong
  `VocabDetailModal`. Chi phí thấp, giá trị cao — nên làm trước các mục khác.
- **Search/lọc theo text** trong danh sách chính — hiện chỉ lọc được theo
  set (`SetsBar`), chưa có ô tìm kiếm theo `sourceText`/`targetText`.
- **Tra từ trực tiếp không cần copy trước** — kiểm tra `readSelectedText`
  hiện dùng cơ chế gì (clipboard trick hay accessibility API), cân nhắc
  chuyển sang lấy selection trực tiếp nếu đang phải copy.
- **Cache kết quả tra/TTS đã có** để xem lại không cần mạng — khác với "dịch
  offline hoàn toàn", chỉ cần không phải gọi lại API cho từ đã tra rồi.
- **Đa nguồn dịch có cấu hình**: cho user chọn provider/API key riêng (vd.
  DeepL, Google Cloud có key) khi cần chất lượng cao hơn bản free hiện tại.
- **Export/Import**: CSV hoặc Anki `.apkg`, để mang dữ liệu ra ngoài hoặc
  nhập từ nguồn khác.

### B. Học tập / Ôn tập
- **Ôn theo set** — `Review.tsx` hiện ôn toàn bộ due entries, chưa lọc được
  theo set đang chọn như `App.tsx` đã hỗ trợ.
- **Thống kê học tập**: heatmap kiểu GitHub contributions dùng luôn
  `createdAt` mới thêm, streak, số từ ôn/ngày.
- **Nhắc ôn tập qua system notification** (Electron `Notification`) khi có
  thẻ due, tận dụng `ReviewState.dueAt` đã có sẵn — hiện chỉ hiện khi user tự
  mở app.
- **Quiz đa dạng hơn**: trắc nghiệm 4 đáp án lấy nhiễu từ `targetMeanings`
  của các entry khác trong cùng set, thay vì chỉ "nhớ/không nhớ".

### C. Đồng bộ & Tài khoản
- **Auth thật** (email hoặc OAuth) — khung `User`/`Device` đã có ở server,
  chỉ thiếu: luồng đăng nhập, gán `userId` khi push/pull, và đổi PK
  `SyncRecord` thành `(userId, kind, recordId)` để tránh id trùng giữa các
  user (ghi chú sẵn trong schema).
- **Đồng bộ incremental thay vì full push** — `runSync` hiện
  `prisma.vocabEntry.findMany()` toàn bộ mỗi lần chạy, không lọc theo thời
  điểm sync trước; sẽ chậm dần khi số từ tăng lên. Nên lọc theo
  `updatedAt > lastPushedAt` (cần thêm field tương tự `lastPulledAt` nhưng
  cho chiều push).
- **Auto-sync nền** (interval hoặc theo sự kiện save/delete) thay vì chỉ nút
  bấm tay.
- **Quản lý thiết bị**: UI xem danh sách device đã đồng bộ (`Device.label`,
  `lastSeenAt`), revoke 1 device — bảng đã có, chưa được dùng.

### D. UI/UX
- **Mở rộng Settings**: theme sáng/tối, bật/tắt fallback TTS, chọn provider
  dịch — hiện Settings chỉ có mỗi phần đổi hotkey.
- **Đa ngôn ngữ giao diện** (label/nút hiện đang trộn Anh-Việt tuỳ chỗ).
- **Onboarding lần đầu mở app** — hướng dẫn hotkey, không có gì hiện tại.
- **Popup tuỳ biến**: thời gian tự ẩn, nút lưu nhanh riêng thay vì phải mở
  cửa sổ chính.

### E. Hạ tầng & vận hành
- **Auto-update trong app** (`electron-updater`) — repo đã build & publish
  GitHub Release theo tag, nhưng app không tự kiểm tra bản mới, user phải tự
  tải lại.
- **Giảm rủi ro rate-limit** cho Google Translate + Google TTS: cả hai đều
  là endpoint không chính thức (đã ghi rõ trong code), dùng nhiều có thể bị
  chặn IP bất ngờ — nên có cache + backoff/retry thay vì fail cứng.
- **Logging/monitoring** phía server thực (hiện chỉ có `/health` endpoint trơ).
- **Migration chiến lược cho SQLite** khi schema local đổi giữa các bản app
  đã cài (hiện dựa hoàn toàn vào Prisma migrate chạy lúc mở app — cần đảm
  bảo không lỗi khi user bỏ lỡ vài bản).

### F. Sẵn sàng cho web/mobile client trong tương lai
Vì `SyncRecord` được thiết kế kind-agnostic + `createdAt` giờ đã đồng bộ đầy
đủ (không chỉ tồn tại local), phần dữ liệu đã khá sẵn sàng để thêm 1 client
mới (web hoặc mobile) đọc chung server này. Còn thiếu trước khi làm được:
1. **Auth thật** (mục C) — bắt buộc trước tiên, vì web/mobile không có khái
   niệm "1 máy = 1 user" ngầm định như desktop hiện tại.
2. **API đọc trực tiếp** (không chỉ sync push/pull dạng batch) — client
   web cần endpoint kiểu REST/GraphQL thông thường để hiển thị danh sách,
   không hợp lý nếu phải mô phỏng lại toàn bộ logic `sync.ts` phía client.
3. **Tách rõ "domain schema" khỏi "sync envelope"** — hiện `vocabEntrySchema`
   trong `packages/shared` đã là nguồn chân lý tốt cho hình dạng 1
   `VocabEntry`, có thể tái dùng thẳng cho response API của client mới.

## 6. Gợi ý thứ tự triển khai

1. **Hoàn thiện cái đang có**: bật UI cho `note`/`tags`/`definition`, search
   theo text, ôn theo set — chi phí thấp, giá trị ngay, không cần thiết kế
   mới.
2. **Auth + multi-user**: khung DB đã có sẵn (`User`/`Device`), đây là việc
   "nối dây" hơn là thiết kế lại — nên làm trước khi mời người khác dùng
   chung server, và là điều kiện tiên quyết cho mục F (web/mobile).
3. **Vận hành**: auto-update, incremental sync, cache/backoff cho 2 endpoint
   không chính thức — làm khi bắt đầu có người dùng thật ngoài bản thân bạn.
4. **Học tập nâng cao**: thống kê, notification nhắc ôn, quiz đa dạng — mở
   rộng chiều sâu sau khi phần nền tảng ổn định.
5. **Web/mobile client**: chỉ nên bắt đầu sau bước 2, tái dùng
   `packages/shared` cho schema thay vì định nghĩa lại từ đầu.
