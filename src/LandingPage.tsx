import { AtSign, Bot, CheckCircle2, Download, MessageCircle, Monitor, Send, ShieldCheck, Smartphone } from 'lucide-react'
import './landing.css'

export default function LandingPage({onLogin}:{onLogin:()=>void}){
 return <div className="landing">
  <header className="landing-header">
   <a className="landing-brand" href="/"><span><Bot/></span><b>BOT 68</b></a>
   <button className="landing-login" onClick={onLogin}>Đăng nhập</button>
  </header>
  <main className="landing-main">
   <section className="landing-hero">
    <div className="landing-kicker"><ShieldCheck/> Chăm sóc khách hàng đa kênh</div>
    <h1>Một hộp thư.<br/><strong>Mọi khách hàng.</strong></h1>
    <p>Quản lý tin nhắn, khách hàng và đơn hàng từ Facebook, Instagram, Zalo OA, Telegram và TikTok trong một ứng dụng duy nhất.</p>
    <div className="landing-channels">
     <span><MessageCircle/> Facebook</span><span><AtSign/> Instagram</span><span><MessageCircle/> Zalo OA</span><span><Send/> Telegram</span><span><MessageCircle/> TikTok</span>
    </div>
   </section>
   <section className="download-section" id="tai-app">
    <div className="download-heading"><small>TẢI ỨNG DỤNG</small><h2>Chọn thiết bị của bạn</h2><p>Dữ liệu cửa hàng được lưu riêng trên thiết bị và có thể sao lưu khi cần.</p></div>
    <div className="download-grid">
     <a className="download-card windows" href="https://github.com/thanh324-hash/sportxauth/releases/latest" target="_blank" rel="noreferrer">
      <span className="download-icon"><Monitor/></span><div><small>MÁY TÍNH</small><h3>BOT 68 cho Windows</h3><p>Windows 10/11 · 64-bit</p><b><Download/> Tải ứng dụng Windows</b></div>
     </a>
     <div className="download-card android pending">
      <span className="download-icon"><Smartphone/></span><div><small>ĐIỆN THOẠI</small><h3>BOT 68 cho Android</h3><p>Android 9 trở lên</p><b><CheckCircle2/> Đang hoàn thiện</b></div>
     </div>
    </div>
   </section>
  </main>
  <footer><span>© 2026 BOT 68</span><span>Dữ liệu riêng tư · Kết nối API chính thức</span></footer>
 </div>
}
