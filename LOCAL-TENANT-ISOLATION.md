# Cách ly dữ liệu desktop theo cửa hàng

Schema IndexedDB phiên bản 3 gắn `tenantId` vào liên hệ, hội thoại, tin nhắn, đơn hàng cục bộ và sự kiện đồng bộ. Khóa ID nhận từ mạng xã hội cũng có tiền tố tenant để hai cửa hàng kết nối cùng một người dùng/kênh không thể ghi đè dữ liệu của nhau.

Mọi truy vấn giao diện, đồng bộ và sao lưu/khôi phục đều giới hạn theo tenant đang đăng nhập. Bản ghi từ schema cũ không có tenant được đánh dấu `legacy` và không tự hiển thị cho một cửa hàng mới, tránh suy đoán sai quyền sở hữu dữ liệu.
