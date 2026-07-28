# Phân phối BOT 68 trên Windows

Bản 0.10 sử dụng `build/icon.svg` làm nguồn vector. Electron-builder tự tạo ICO nhiều kích thước cho file ứng dụng, taskbar, Start Menu, shortcut và trình cài NSIS. App User Model ID cố định là `vn.bot68.desktop` để Windows liên kết đúng cửa sổ với shortcut.

Metadata PE được kiểm tra sau build bằng `scripts/verify-windows-package.ps1`: ProductName, FileDescription, CompanyName và LegalTrademarks đều là `BOT 68`; FileVersion khớp phiên bản package. Script cũng có thể trích icon thật từ EXE để kiểm tra trực quan.

Hiện bản thử nghiệm chưa có chứng thư Authenticode thương mại nên `SignatureStatus` là `NotSigned`. Không dùng chứng thư tự ký để giả trạng thái tin cậy. Trước khi bán rộng rãi, chủ sở hữu cần mua chứng thư code-signing phù hợp, cấu hình bí mật ký trong CI/build machine và chạy verifier với `-RequireSignature`.
