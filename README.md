# BOT 68

Ứng dụng chăm sóc khách hàng đa kênh dành cho Windows. Mã nguồn hiện gồm ứng dụng Electron/React, cơ sở dữ liệu cục bộ IndexedDB và máy chủ webhook thử nghiệm.

## Chạy phát triển

```powershell
npm.cmd install
npm.cmd run dev
```

## Máy chủ webhook

```powershell
npm.cmd run dev:server
```

Kiểm tra tại `http://127.0.0.1:6868/health`.

## Đóng gói Windows

```powershell
npm.cmd run build:win
```

File cài đặt được tạo trong `release/`.

## Trạng thái tích hợp

- Giao diện desktop, inbox, CRM, đơn hàng, AI, phân quyền và kết nối kênh: nền tảng ban đầu.
- Facebook/Instagram OAuth: cần `META_APP_ID`, `META_APP_SECRET` và URL HTTPS cố định.
- Zalo OA, Telegram, TikTok: mô-đun kế tiếp sau khi có tài khoản nhà phát triển tương ứng.
