# Sao lưu và khôi phục BOT 68

Bản 0.9 tạo tệp `.bot68backup` di động giữa các máy Windows. Tệp dùng AES-256-GCM; khóa được dẫn xuất từ mật khẩu người dùng bằng scrypt. Mật khẩu sao lưu không được lưu trong ứng dụng và không thể lấy lại nếu bị quên.

Gói sao lưu chứa CRM, sản phẩm, tồn kho, đơn hàng, hồ sơ/kho kiến thức AI, hội thoại, tin nhắn và hàng đợi đồng bộ của cửa hàng đang đăng nhập. Gói không chứa mật khẩu tài khoản, khóa máy chủ hoặc token mạng xã hội. Sau khi khôi phục trên máy khác, người dùng phải kết nối lại Facebook, Instagram, Zalo OA và Telegram.

Khôi phục yêu cầu tài khoản chủ cửa hàng, mật khẩu của tệp và cụm xác nhận `KHOI PHUC`. Dữ liệu kinh doanh và dữ liệu cục bộ của đúng tenant hiện tại được thay thế trong transaction; tài khoản đăng nhập hiện tại được giữ lại.
