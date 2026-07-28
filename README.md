# BOT 68

Ứng dụng chăm sóc khách hàng đa kênh dành cho Windows. Mã nguồn hiện gồm ứng dụng Electron/React, cơ sở dữ liệu cục bộ IndexedDB và máy chủ đa cửa hàng.

Ứng dụng desktop hỗ trợ đăng ký/đăng nhập với máy chủ, lưu phiên bằng Windows Safe Storage, chạy ngoại tuyến và tự đồng bộ hàng đợi webhook về cơ sở dữ liệu trên máy. Khi sự kiện đã ghi cục bộ thành công, ứng dụng mới xác nhận để máy chủ đánh dấu đã giao.

## Chạy phát triển

```powershell
npm.cmd install
npm.cmd run dev
```

## Máy chủ webhook

```powershell
npm.cmd run dev:server
```

Kiểm tra tại `http://127.0.0.1:6868/health`. Máy chủ sử dụng SQLite trong `server-data/`, hỗ trợ đăng ký/đăng nhập, phân tách dữ liệu theo cửa hàng, hồ sơ AI, kết nối kênh được mã hóa và hàng đợi đồng bộ.

Biến môi trường production bắt buộc:

- `BOT68_AUTH_SECRET`: khóa ký phiên đăng nhập.
- `BOT68_ENCRYPTION_SECRET`: khóa mã hóa token mạng xã hội.
- `BOT68_PUBLIC_URL`: URL HTTPS cố định.
- `META_APP_ID`, `META_APP_SECRET`, `META_VERIFY_TOKEN`: cấu hình ứng dụng Meta.

Chạy kiểm thử máy chủ:

```powershell
npm.cmd run test:server
```

## Đóng gói Windows

```powershell
npm.cmd run build:win
```

File cài đặt được tạo trong `release/`.

## Trạng thái tích hợp

- Giao diện desktop, inbox, CRM, đơn hàng, AI, phân quyền và kết nối kênh: nền tảng ban đầu.
- Facebook/Instagram OAuth: cần `META_APP_ID`, `META_APP_SECRET` và URL HTTPS cố định.
- Zalo OA, Telegram, TikTok: mô-đun kế tiếp sau khi có tài khoản nhà phát triển tương ứng.
