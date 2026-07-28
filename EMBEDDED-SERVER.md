# Máy chủ cục bộ trong BOT 68

Từ bản 0.7, ứng dụng Windows tự khởi động máy chủ cục bộ trên cổng khả dụng từ `6868` đến `6878`. Màn hình đăng ký tự nhận đúng địa chỉ nên người dùng thử nghiệm không cần cài Node.js, SQLite hay cấu hình VPS.

Dữ liệu máy chủ nằm trong thư mục dữ liệu người dùng của ứng dụng. Cơ sở dữ liệu được lưu tại `server/bot68.sqlite`. Khóa ký phiên và khóa mã hóa token được tạo ngẫu nhiên, sau đó lưu trong `server-secrets.bin` bằng Windows Safe Storage; chúng không được ghi dưới dạng văn bản thuần.

Máy chủ nhúng chỉ lắng nghe trên `127.0.0.1`. Chế độ này phù hợp để thử nghiệm, quản lý dữ liệu và AI cục bộ trên một máy. Để nhận OAuth/webhook thật từ Facebook, Instagram, Telegram hoặc Zalo OA, BOT 68 vẫn cần máy chủ production với tên miền HTTPS công khai và tài khoản nhà phát triển tương ứng.
