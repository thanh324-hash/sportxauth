# Mô-đun kinh doanh BOT 68

Bản 0.8 thay dữ liệu giao diện mẫu bằng các mô-đun thực, được lưu trong SQLite và tách biệt bằng `tenant_id`:

- CRM: tạo, cập nhật và xóa hồ sơ khách hàng; lưu nguồn, nhãn và ghi chú.
- Sản phẩm: SKU duy nhất trong từng cửa hàng, giá bán, tồn kho và trạng thái.
- Đơn hàng: khách hàng, các dòng sản phẩm, tổng tiền và quy trình nháp, xác nhận, giao hàng, hoàn thành hoặc hủy.
- Đội ngũ: chủ cửa hàng tạo tài khoản quản lý/nhân viên và thay đổi vai trò.
- Báo cáo: tổng khách hàng, sản phẩm, đơn hàng, doanh thu hoàn thành, trạng thái đơn và nguồn khách.

API kiểm tra quyền trên mọi truy vấn. ID khách hàng hoặc sản phẩm của cửa hàng khác không thể được dùng để tạo đơn hàng, và tài khoản cửa hàng khác không thể đọc hoặc sửa bản ghi.
