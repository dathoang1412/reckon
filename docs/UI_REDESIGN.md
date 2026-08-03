# Reckon — Kế hoạch cải tạo UI

> Kế hoạch, chưa triển khai. Viết dựa trên khảo sát code thực tế
> (2026-08-03) sau khi Phần 1 (note/tags/search/ôn theo set) và Phần 2
> (auth) đã xong.

## 1. Vấn đề hiện tại (khảo sát thực tế)

### 1.1 Theme không khớp thương hiệu
Logo mới (`assets/logo/`) là **nền đen, chữ trắng**, phong cách tối giản kiểu
Raycast/Linear. Nhưng UI thật thì:
```
apps/desktop/src/renderer/src/pages/App.tsx:140   colorPrimary: "#1677ff"
apps/desktop/src/renderer/src/pages/App.tsx:185   colorPrimary: "#1677ff"
apps/desktop/src/renderer/src/pages/Login.tsx:25  colorPrimary: "#1677ff"
apps/desktop/src/renderer/src/pages/Popup.tsx:40  colorPrimary: "#1677ff"
apps/desktop/src/renderer/src/pages/Popup.tsx:51  colorPrimary: "#1677ff"
apps/desktop/src/renderer/src/pages/Settings.tsx:178 colorPrimary: "#1677ff"
apps/desktop/src/renderer/src/pages/Splash.tsx:5  colorPrimary: "#1677ff"
```
**7 chỗ**, mỗi trang tự khai `<ConfigProvider theme={{ token: { colorPrimary: "#1677ff" } }}>` — màu xanh mặc định của antd, không liên quan gì đến logo đen/trắng vừa làm. Không có dark mode, không có theme token nào khác được set (background, border radius, font...).

### 1.2 Không có theme dùng chung
7 trang (`App`, `Popup`, `Splash`, `Settings`, `Review`, `Login`, và modal
`VocabDetailModal`) đều tự bọc `ConfigProvider` riêng, copy-paste cùng một
dòng. Sửa màu thương hiệu bây giờ phải sửa 7 chỗ — dễ sót.

### 1.3 100% inline style, không style-token nào tái sử dụng
Không có 1 file CSS/theme-constants nào. Mọi khoảng cách, màu sắc, border
đều là số/hex viết tay lặp lại khắp nơi, ví dụ riêng "#f0f0f0" (border xám
nhạt) xuất hiện rời rạc ở `VocabDetailModal.tsx`, cỡ chữ `12`/`fontSize: 12`
lặp lại nhiều nơi cho phần "secondary text" (ngày giờ, badge)... không có
một nguồn duy nhất để đổi "khoảng cách chuẩn" hay "màu secondary chuẩn".

### 1.4 Trải nghiệm rời rạc giữa các cửa sổ
`App` (cửa sổ chính), `Popup` (hotkey), `Settings`, `Review`, `Login` là 5
màn hình độc lập, style gần giống nhau nhưng viết tay riêng lẻ mỗi lần
(header + nút back, khối card...). Không có layout/component dùng chung
kiểu `<PageShell title="..." onBack={...}>`.

## 2. Định hướng

Giữ nguyên antd (đã đủ tốt, không cần đổi framework — xem trao đổi trước:
Tailwind sẽ xung đột hệ style của antd). Việc cần làm là **thiết lập theme
nhất quán khớp thương hiệu + gom style dùng chung**, không phải viết lại UI
từ đầu.

## 3. Kế hoạch theo giai đoạn

### Giai đoạn A — Theme token khớp thương hiệu (nền tảng, làm trước)
- Tạo 1 file `apps/desktop/src/renderer/src/theme.ts` export 1 object
  `themeConfig` (kiểu `ThemeConfig` của antd) làm nguồn duy nhất:
  - `colorPrimary`: đổi từ `#1677ff` sang màu khớp logo (đen `#000000`/
    `#0A0A0A` cho light mode giống chữ "R" trên logo, hoặc giữ 1 accent màu
    trung tính thay vì xanh mặc định — cần chốt cụ thể khi làm, đây chỉ là
    kế hoạch).
  - `borderRadius`, `fontFamily` khớp phong cách tối giản của logo (hiện
    đang dùng mặc định của antd/`system-ui`).
  - Thêm `algorithm: theme.darkAlgorithm` có điều kiện (đọc
    `prefers-color-scheme` hoặc setting riêng) — hợp lý vì brand vốn là nền
    đen, dark mode sẽ tự nhiên hơn light mode mặc định hiện tại.
- Tạo 1 component `<AppThemeProvider>` bọc `ConfigProvider` với
  `themeConfig` này, dùng ở **1 chỗ duy nhất** tại `main.tsx` (bọc ngoài
  cùng, trước khi chọn `Splash`/`Popup`/`App`) thay vì mỗi trang tự bọc
  riêng.
- Xoá 7 dòng `<ConfigProvider theme={{ token: { colorPrimary: "#1677ff" } }}>`
  lặp lại, để mỗi trang chỉ còn `<div>`/nội dung, không tự quản theme nữa.

### Giai đoạn B — Style tokens dùng chung (spacing/màu phụ)
- Thêm vào `theme.ts` (hoặc file `styleTokens.ts` riêng) vài hằng số dùng
  lặp lại nhiều nơi: màu border nhạt (`#f0f0f0`), cỡ chữ phụ (`12`), màu
  text secondary — thay cho việc gõ tay từng chỗ như hiện tại
  (`VocabDetailModal.tsx`, `App.tsx` đều tự viết `fontSize: 12` rời rạc).
- Không cần CSS-in-JS mới hay CSS Modules — object hằng số TS đơn giản là
  đủ, giữ đúng cách làm hiện tại (inline style), chỉ gom nguồn giá trị.

### Giai đoạn C — Component layout dùng chung
- Rút phần lặp "header có tiêu đề + nút back" (xuất hiện ở `Settings.tsx`,
  `Review.tsx` qua `App.tsx`) thành 1 component nhỏ, ví dụ
  `<SubPageHeader title="Cài đặt" onBack={...} />`.
- Cân nhắc 1 `<PageShell maxWidth={480|720}>` chung cho các trang dạng
  "cột giữa màn hình" (`Settings`, `Login`, `Review`) — hiện mỗi trang tự
  viết `style={{ maxWidth: 480, margin: "2rem auto", padding: "0 1rem" }}`
  giống hệt nhau.

### Giai đoạn D — Đánh bóng từng màn hình cụ thể
- **Login.tsx** (mới thêm): hiện dùng antd Form mặc định, chưa có logo/icon
  thương hiệu trên màn hình — thêm icon từ `assets/logo/icon-black-bg.svg`
  phía trên form cho đúng nhận diện khi mở app lần đầu.
- **Popup.tsx**: cửa sổ quan trọng nhất về tần suất dùng (hotkey) — đáng
  đầu tư animation/transition mượt khi hiện/ẩn (hiện chưa có).
- **App.tsx list**: đã nhóm theo ngày (mới làm) — có thể thêm micro-polish
  (hover state cho từng dòng, empty-state minh hoạ thay vì chỉ text).

## 4. Thứ tự khuyến nghị

1. **Giai đoạn A trước tiên** — tác động lớn nhất/chi phí thấp nhất: chỉ
   cần 1 file theme + xoá 7 chỗ lặp, đổi ngay cảm nhận thương hiệu toàn app.
2. **Giai đoạn B+C** — dọn nợ kỹ thuật, làm các thay đổi sau này (thêm màn
   hình mới) nhất quán hơn, không bắt buộc phải làm ngay.
3. **Giai đoạn D** — làm dần từng màn hình khi có thời gian, không chặn gì
   khác.

## 5. Không nằm trong phạm vi
Đổi UI framework (Tailwind/CSS Modules/styled-components) — antd hiện đủ
dùng, đổi framework sẽ tốn công không cần thiết. Redesign lại toàn bộ layout
(vd. đổi cấu trúc trang, thêm sidebar...) — đây là việc *thống nhất theme*,
không phải *thiết kế lại trải nghiệm*.
