import { AtSign, Bot, CheckCircle2, Download, HardDrive, LockKeyhole, MessageCircle, Monitor, Send, ShieldCheck, Smartphone, Sparkles, Users } from 'lucide-react'
import './landing.css'
import './landing-hero-actions.css'

const windowsDownload='https://github.com/thanh324-hash/sportxauth/releases/download/v0.15.1/BOT-68-Setup-0.15.1.exe'
const androidDownload='https://github.com/thanh324-hash/sportxauth/releases/download/v0.15.1/BOT-68-Android-0.15.1.apk'

export default function LandingPage({onLogin}:{onLogin:()=>void}){
 return <div className="landing">
  <header className="landing-header">
   <a className="landing-brand" href="#top"><span><Bot/></span><b>BOT 68</b></a>
   <nav><a href="#loi-ich">Lợi ích</a><a href="#huong-dan">Hướng dẫn</a><a href="#tai-app">Tải app</a></nav>
   <button className="landing-login" onClick={onLogin}>Đăng nhập</button>
  </header>
  <main className="landing-main" id="top">
   <section className="landing-hero">
    <div className="landing-kicker"><ShieldCheck/> Chăm sóc khách hàng đa kênh</div>
    <h1>Một hộp thư.<br/><strong>Mọi khách hàng.</strong></h1>
    <p>Dùng đầy đủ ngay trên web hoặc cài app Windows ổn định hơn. Một tài khoản BOT 68 đồng bộ cửa hàng, nhân viên, khách hàng và các kênh mạng xã hội.</p>
    <div className="hero-actions">
     <button onClick={onLogin}><Bot/><span className="desktop-label">Dùng BOT 68 trên web</span><span className="mobile-label">Dùng web</span></button>
     <a href={windowsDownload}><Download/><span className="desktop-label">Tải app Windows</span><span className="mobile-label">Windows</span></a>
     <a href={androidDownload}><Smartphone/><span className="desktop-label">Tải app Android</span><span className="mobile-label">Android</span></a>
    </div>
    <div className="landing-channels"><span><MessageCircle/> Facebook</span><span><AtSign/> Instagram</span><span><MessageCircle/> Zalo OA</span><span><Send/> Telegram</span><span><MessageCircle/> TikTok</span></div>
   </section>

   <section className="benefits" id="loi-ich">
    <div className="section-heading"><small>VÌ SAO CHỌN BOT 68</small><h2>Làm việc ở đâu cũng được</h2><p>Web tiện khi di chuyển, app Windows phù hợp cho máy trực tổng đài chạy liên tục.</p></div>
    <div className="benefit-grid">
     <article><MessageCircle/><h3>Hộp thư hợp nhất</h3><p>Đọc và trả lời nhiều Page, Instagram, Zalo OA và Telegram tại một nơi.</p></article>
     <article><Users/><h3>Chung một dữ liệu</h3><p>Tài khoản thật dùng trên web và app; nhân viên thấy đúng cửa hàng được phân quyền.</p></article>
     <article><Sparkles/><h3>AI riêng từng shop</h3><p>Huấn luyện bằng sản phẩm, chính sách và giọng tư vấn riêng trước khi tự động hóa.</p></article>
     <article><HardDrive/><h3>App ổn định hơn</h3><p>App có bộ nhớ đệm cục bộ và phiên đăng nhập được Windows mã hóa để làm việc bền bỉ.</p></article>
    </div>
   </section>

   <section className="guide-section" id="huong-dan">
    <div className="section-heading"><small>BẮT ĐẦU TRONG 3 BƯỚC</small><h2>Cách dùng BOT 68</h2><p>Không đăng nhập Facebook bằng mật khẩu bên trong BOT 68. Bạn đăng nhập trên cửa sổ Facebook chính thức rồi cấp quyền cho Page.</p></div>
    <div className="guide-row"><div className="guide-copy"><b>01</b><h3>Tạo tài khoản cửa hàng</h3><p>Nhấn “Đăng nhập”, chọn đăng ký, nhập tên cửa hàng, họ tên, email và mật khẩu. Tài khoản này dùng chung trên web và app.</p><span><CheckCircle2/> Không cần tạo lại tài khoản khi cài Windows</span></div><img src="/screenshots/guide-login.png" alt="Màn hình đăng nhập và đăng ký BOT 68"/></div>
    <div className="guide-row reverse"><div className="guide-copy"><b>02</b><h3>Vào Kết nối kênh</h3><p>Mở mục “Kết nối kênh”, chọn Facebook Page hoặc Instagram Professional rồi bấm Kết nối.</p><span><CheckCircle2/> BOT 68 chỉ dùng API chính thức</span></div><img src="/screenshots/guide-connections.png" alt="Màn hình kết nối Facebook và Instagram"/></div>
    <div className="guide-row"><div className="guide-copy"><b>03</b><h3>Cấp quyền và chọn Page</h3><p>Facebook mở trong trình duyệt. Đăng nhập Facebook, chọn doanh nghiệp/Page cho phép, sau đó quay lại BOT 68 để hoàn tất.</p><span><LockKeyhole/> BOT 68 không lưu mật khẩu Facebook</span></div><img src="/screenshots/guide-inbox.png" alt="Hộp thư đa kênh BOT 68"/></div>
    <div className="meta-note"><ShieldCheck/><div><b>Điều kiện để nhận tin nhắn Facebook/Instagram thật</b><p>Cần Meta Business Portfolio, Facebook Page, Instagram Professional liên kết với Page và ứng dụng Meta Developer đã được cấp quyền. Bản thử nghiệm chỉ dùng được với tài khoản có vai trò trong Meta App; bán cho cửa hàng khác cần App Review.</p></div></div>
   </section>

   <section className="download-section" id="tai-app">
    <div className="download-heading"><small>TẢI ỨNG DỤNG</small><h2>Chọn cách làm việc của bạn</h2><p>Bản web dùng ngay; bản Windows có bộ nhớ đệm cục bộ và phù hợp để trực chat liên tục.</p></div>
    <div className="download-grid">
     <a className="download-card windows" href={windowsDownload}><span className="download-icon"><Monitor/></span><div><small>MÁY TÍNH</small><h3>BOT 68 cho Windows</h3><p>Windows 10/11 · 64-bit</p><b><Download/> Tải BOT 68 v0.15.1</b></div></a>
     <button className="download-card web" onClick={onLogin}><span className="download-icon"><Bot/></span><div><small>TRÌNH DUYỆT</small><h3>Dùng BOT 68 trên web</h3><p>Chrome, Edge, Safari · Không cần cài đặt</p><b><CheckCircle2/> Đăng nhập để bắt đầu</b></div></button>
     <a className="download-card android" href={androidDownload}><span className="download-icon"><Smartphone/></span><div><small>ĐIỆN THOẠI</small><h3>BOT 68 cho Android</h3><p>Android 9 trở lên</p><b><Download/> Tải APK v0.15.1</b></div></a>
    </div>
   </section>
  </main>
  <footer><span>© 2026 BOT 68</span><span>Dùng API chính thức · Bảo vệ tài khoản · Đồng bộ web và Windows</span></footer>
 </div>
}
