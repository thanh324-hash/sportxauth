# Triển khai BOT 68 production

Bộ này chạy máy chủ Node 24 và SQLite trong volume riêng, phía trước là Caddy tự quản lý HTTPS. Máy chủ ứng dụng không mở cổng trực tiếp ra Internet; chỉ Caddy nhận cổng 80/443.

## Điều kiện

- VPS Linux x64 với Docker Engine và Docker Compose V2.
- Tên miền hoặc subdomain có bản ghi A/AAAA trỏ về VPS.
- Cổng TCP 80, TCP 443 và UDP 443 được phép đi vào VPS.
- Tài khoản nhà phát triển Meta/Zalo/Telegram tương ứng khi bật kênh thật.

## Cài đặt

```bash
git clone https://github.com/thanh324-hash/sportxauth.git bot68
cd bot68/deploy
cp .env.example .env
openssl rand -base64 48
openssl rand -base64 48
openssl rand -hex 32
```

Dán ba giá trị ngẫu nhiên lần lượt vào `BOT68_AUTH_SECRET`, `BOT68_ENCRYPTION_SECRET` và `META_VERIFY_TOKEN`; đổi `BOT68_DOMAIN` thành domain thật. Hai khóa BOT 68 phải khác nhau và không được commit `.env`.

Khởi động:

```bash
docker compose config
docker compose up -d --build
docker compose ps
docker compose logs --tail=200 server caddy
curl https://TEN-MIEN-CUA-BAN/health
```

Kết quả health hợp lệ có `"ok":true` và `"database":"sqlite"`.

## URL khai báo với nền tảng

- Meta OAuth callback: `https://TEN-MIEN/oauth/meta/callback`
- Meta webhook: `https://TEN-MIEN/webhooks/meta`
- Telegram webhook được BOT 68 tự đặt khi kết nối Bot Token.
- Zalo webhook được màn Kết nối kênh trả về sau khi xác minh OA.

## Cập nhật và vận hành

```bash
git pull --ff-only
cd deploy
docker compose up -d --build
docker compose ps
```

SQLite nằm trong volume `bot68_data`; chứng chỉ Caddy nằm trong `caddy_data`. Không xóa các volume khi cập nhật. Ngoài snapshot volume định kỳ, chủ cửa hàng nên tạo `.bot68backup` trong màn Cài đặt của ứng dụng Windows.

Xem log:

```bash
docker compose logs -f --tail=200 server caddy
```

Khôi phục khi container lỗi không cần tạo lại database: sửa mã/cấu hình rồi chạy lại `docker compose up -d --build`; volume dữ liệu vẫn được gắn vào container mới.
