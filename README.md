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
- `META_GRAPH_VERSION`: phiên bản Graph API, mặc định `v21.0` và có thể nâng mà không sửa mã nguồn.

Trong Meta App, URL callback OAuth phải là `${BOT68_PUBLIC_URL}/oauth/meta/callback` và webhook là `${BOT68_PUBLIC_URL}/webhooks/meta`. Luồng kết nối dùng `state` một lần có hạn 10 phút, kiểm tra chữ ký webhook `X-Hub-Signature-256`, phát hiện Facebook Page cùng Instagram Professional liên kết và chỉ lưu các tài khoản do chủ cửa hàng chọn.

## Telegram và channel adapters

Chủ cửa hàng nhập Bot Token lấy từ `@BotFather`. Máy chủ xác minh token bằng `getMe`, tạo webhook `${BOT68_PUBLIC_URL}/webhooks/telegram/:connectionId` với secret riêng, chống update trùng và hỗ trợ gửi văn bản bằng `sendMessage`. `BOT68_PUBLIC_URL` phải là HTTPS công khai để Telegram gọi webhook.

`server/channels/registry.mjs` mô tả khả năng của Facebook, Instagram, Telegram, Zalo OA và TikTok. Facebook, Instagram, Telegram và Zalo đã có adapter nhận/gửi; TikTok giữ scaffold cùng danh sách credential/quyền cần thiết để tiếp tục mà không thay đổi lõi inbox.

## Zalo Official Account

Chủ cửa hàng nhập OA Access Token. Máy chủ xác minh bằng `GET /v3.0/oa/getoa`, tạo URL webhook có secret ngẫu nhiên riêng và hỗ trợ gửi tin chăm sóc khách hàng qua `POST /v3.0/oa/message/cs`. URL webhook trả về phải được sao chép vào cấu hình webhook của ứng dụng Zalo Developer. Các sự kiện `user_send_*` được chuẩn hóa và chống lưu trùng.

## Đồng bộ inbox cục bộ

Sự kiện từ Meta, Telegram và Zalo được chuyển thành cùng một định dạng. Ứng dụng Windows ghi sự kiện, khách hàng, cuộc trò chuyện và tin nhắn trong một transaction IndexedDB trước khi xác nhận với máy chủ. Các cuộc trò chuyện đồng bộ giữ `connectionId` và ID người nhận để nút gửi trong inbox gọi đúng adapter mạng xã hội.

## AI riêng theo cửa hàng

Mỗi tenant có hồ sơ AI và kho kiến thức độc lập. Chủ cửa hàng cấu hình tên, giọng điệu, quy tắc và chế độ an toàn; tài liệu có thể thêm, tắt hoặc xóa. API `/api/ai/suggest` tìm các tài liệu liên quan, tạo prompt có lịch sử gần nhất và trả về câu gợi ý cùng ID nguồn.

Nếu chưa cấu hình nhà cung cấp AI, máy chủ dùng chế độ `local-fallback` dựa trên kiến thức và luôn yêu cầu nhân viên duyệt. Để dùng một dịch vụ hỗ trợ Chat Completions API, đặt:

- `BOT68_AI_BASE_URL`: URL gốc của nhà cung cấp hỗ trợ Chat Completions API.
- `BOT68_AI_API_KEY`.
- `BOT68_AI_MODEL`: model do nhà cung cấp cấp quyền cho tài khoản của bạn.

API key chỉ nằm trong biến môi trường máy chủ, không được gửi xuống ứng dụng Windows hoặc lưu trong lịch sử hội thoại.

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
