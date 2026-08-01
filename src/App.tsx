import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowLeft,
  AtSign,
  BarChart3,
  Bot,
  Boxes,
  Camera,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  ContactRound,
  ExternalLink,
  GraduationCap,
  ImagePlus,
  Images,
  Inbox,
  KeyRound,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Menu,
  MessageCircle,
  MessagesSquare,
  MoreHorizontal,
  Package,
  Palette,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Store,
  Tag,
  Trash2,
  Upload,
  Users,
  Wifi,
  X,
} from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import {
  db,
  seedDatabase,
  type Channel,
  type Conversation,
  type MediaAsset,
  type Message,
} from "./db";
import AuthScreen from "./AuthScreen";
import {
  apiRequest,
  clearSession,
  loadSession,
  type ServerSession,
} from "./api";
import { useServerSync, type SyncState } from "./useServerSync";
import {
  CustomersPage,
  OrdersPage,
  ProductsPage,
  ReportsPage,
  TeamPage,
} from "./BusinessPages";
import "./topbar-fix.css";
import "./responsive.css";
import "./mobile-app.css";
import "./account-menu.css";
import SettingsPage from "./SettingsPage";
import LandingPage from "./LandingPage";

type Page =
  | "dashboard"
  | "inbox"
  | "customers"
  | "orders"
  | "products"
  | "ai"
  | "team"
  | "reports"
  | "connections"
  | "settings"
  | "support";
const nav: Array<[Page, string, any]> = [
  ["dashboard", "Tổng quan", LayoutDashboard],
  ["inbox", "Hộp thư", Inbox],
  ["customers", "Khách hàng", ContactRound],
  ["orders", "Đơn hàng", ClipboardList],
  ["products", "Sản phẩm", Package],
  ["ai", "Huấn luyện AI", GraduationCap],
  ["team", "Nhân viên", Users],
  ["reports", "Báo cáo", BarChart3],
  ["connections", "Kết nối kênh", Wifi],
  ["settings", "Cài đặt", Settings],
  ["support", "Hỗ trợ BOT 68", CircleHelp],
];
const channelIcon = (c: Channel) =>
  c === "facebook" ? (
    <MessagesSquare />
  ) : c === "instagram" ? (
    <AtSign />
  ) : c === "telegram" ? (
    <Send />
  ) : (
    <MessageCircle />
  );
const channelName: Record<Channel, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  zalo: "Zalo OA",
  telegram: "Telegram",
  tiktok: "TikTok",
};

function App() {
  const [session, setSession] = useState<ServerSession | null | undefined>(
    undefined,
  );
  const [webAuthOpen, setWebAuthOpen] = useState(false);
  useEffect(() => {
    loadSession().then((saved) => {
      if (!window.bot68 && saved && (!saved.serverUrl || saved.offline)) {
        clearSession();
        setSession(null);
        return;
      }
      if (saved) {
        setSession(saved);
        return;
      }
      setSession(null);
    });
  }, []);
  if (session === undefined)
    return (
      <div className="app-loading">
        <Bot />
        <span>Đang mở BOT 68...</span>
      </div>
    );
  if (
    !session &&
    !window.bot68 &&
    !Capacitor.isNativePlatform() &&
    !webAuthOpen
  )
    return <LandingPage onLogin={() => setWebAuthOpen(true)} />;
  if (!session) return <AuthScreen onAuthenticated={setSession} />;
  const logout = async () => {
    await clearSession();
    setSession(null);
    setWebAuthOpen(false);
  };
  return <AuthenticatedApp session={session} onLogout={logout} />;
}
function AuthenticatedApp({
  session,
  onLogout,
}: {
  session: ServerSession;
  onLogout: () => void;
}) {
  const requested = location.hash.slice(1);
  const initialPage = nav.some(([id]) => id === requested)
    ? (requested as Page)
    : "inbox";
  const [page, setPage] = useState<Page>(initialPage);
  const [selected, setSelected] = useState("v1");
  const [draft, setDraft] = useState("");
  const [aiOpen, setAiOpen] = useState(true);
  const [mobileNav, setMobileNav] = useState(false);
  const sync = useServerSync(session);
  useEffect(() => {
    if (session.offline) seedDatabase(session.tenant.id);
  }, [session.offline, session.tenant.id]);
  const navigate = (next: Page) => {
    setPage(next);
    location.hash = next;
    setMobileNav(false);
  };
  return (
    <div className={"app-shell " + (mobileNav ? "nav-open" : "")}>
      <button
        className="mobile-menu"
        onClick={() => setMobileNav(!mobileNav)}
        aria-label="Mở trình đơn"
      >
        {mobileNav ? <X /> : <Menu />}
      </button>
      {mobileNav && (
        <button
          className="nav-backdrop"
          onClick={() => setMobileNav(false)}
          aria-label="Đóng trình đơn"
        />
      )}
      <Sidebar page={page} setPage={navigate} session={session} />
      <main>
        <Topbar
          page={page}
          session={session}
          syncState={sync.state}
          refreshing={sync.refreshing}
          onRefresh={sync.refresh}
          onLogout={onLogout}
        />
        {page === "inbox" ? (
          <InboxPage
            session={session}
            selected={selected}
            setSelected={setSelected}
            draft={draft}
            setDraft={setDraft}
            aiOpen={aiOpen}
            setAiOpen={setAiOpen}
          />
        ) : (
          <ModulePage page={page} session={session} />
        )}
      </main>
    </div>
  );
}

function Sidebar({
  page,
  setPage,
  session,
}: {
  page: Page;
  setPage: (p: Page) => void;
  session: ServerSession;
}) {
  const unread =
    useLiveQuery(async () => {
      const rows = await db.conversations
        .where("tenantId")
        .equals(session.tenant.id)
        .toArray();
      return rows.reduce(
        (sum, item) => sum + Math.max(0, Number(item.unread) || 0),
        0,
      );
    }, [session.tenant.id]) || 0;
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <Bot />
        </div>
        <div>
          <b>BOT 68</b>
          <small>Omnichannel AI</small>
        </div>
      </div>
      <button className="workspace">
        <span className="store-logo">
          <Store />
        </span>
        <span>
          <small>Cửa hàng</small>
          <b>{session.tenant.name}</b>
        </span>
        <ChevronDown />
      </button>
      <nav>
        {nav
          .filter(([id]) => id !== "support" && (id !== "team" || session.user.role === "owner"))
          .map(([id, label, Icon]) => (
            <button
              key={id}
              className={page === id ? "active" : ""}
              onClick={() => setPage(id)}
            >
              <Icon />
              <span>{label}</span>
              {id === "inbox" && unread > 0 && (
                <em>{unread > 99 ? "99+" : unread}</em>
              )}
            </button>
          ))}
      </nav>
      <div className="sidebar-foot">
        <div className="plan">
          <Sparkles />
          <div>
            <b>Gói thử nghiệm</b>
            <small>Dữ liệu riêng biệt</small>
          </div>
        </div>
        <button className={page === "support" ? "active" : ""} onClick={() => setPage("support")}>
          <CircleHelp />
          <span>Trợ giúp</span>
        </button>
      </div>
    </aside>
  );
}
function Topbar({
  page,
  session,
  syncState,
  refreshing,
  onRefresh,
  onLogout,
}: {
  page: Page;
  session: ServerSession;
  syncState: SyncState;
  refreshing: boolean;
  onRefresh: () => void;
  onLogout: () => void;
}) {
  const title = nav.find((n) => n[0] === page)?.[1],
    label =
      syncState === "offline" && !window.bot68
        ? "Bản demo web"
        : {
            offline: "Ngoại tuyến",
            connecting: "Đang kết nối",
            online: "Đã đồng bộ",
            error: "Mất kết nối",
          }[syncState];
  const [open, setOpen] = useState(false),
    [passwordOpen, setPasswordOpen] = useState(false),
    [currentPassword, setCurrentPassword] = useState(""),
    [newPassword, setNewPassword] = useState(""),
    [notice, setNotice] = useState("");
  const colors = ["#ff7136", "#2f80ed", "#8b5cf6", "#16a085", "#e84393"];
  useEffect(() => {
    const color = localStorage.getItem("bot68-accent");
    if (color) document.documentElement.style.setProperty("--accent", color);
  }, []);
  const chooseColor = (color: string) => {
    localStorage.setItem("bot68-accent", color);
    document.documentElement.style.setProperty("--accent", color);
  };
  const changePassword = async () => {
    try {
      await apiRequest(
        session.serverUrl,
        "/api/me/password",
        {
          method: "PATCH",
          body: JSON.stringify({ currentPassword, newPassword }),
        },
        session.token,
      );
      setNotice("Đổi mật khẩu thành công");
      setCurrentPassword("");
      setNewPassword("");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Không đổi được mật khẩu");
    }
  };
  return (
    <header className="topbar">
      <div>
        <h1>{title}</h1>
        <p>
          {page === "inbox"
            ? "Quản lý tất cả cuộc trò chuyện tại một nơi"
            : "Trung tâm quản lý BOT 68"}
        </p>
      </div>
      <div className="top-actions">
        {!session.offline && (
          <button className="refresh-sync" type="button" onClick={onRefresh} disabled={refreshing} title="Làm mới tin nhắn và trạng thái kênh">
            <RefreshCw className={refreshing ? "spin" : ""} />
            <span>Làm mới</span>
          </button>
        )}
        <button className={"connection " + syncState}>
          <span className="sync-dot" />
          {label}
        </button>
        <div className="account-wrap">
          <button
            className="avatar"
            title={`Tài khoản ${session.user.name}`}
            onClick={() => setOpen(!open)}
          >
            {session.user.name
              .trim()
              .split(/\s+/)
              .slice(-1)[0]
              ?.slice(0, 2)
              .toUpperCase() || "68"}
          </button>
          {open && (
            <div className="account-menu">
              <div className="account-name">
                <b>{session.user.name}</b>
                <small>
                  {session.user.role === "owner"
                    ? "Chủ cửa hàng"
                    : session.user.email}
                </small>
              </div>
              <button onClick={() => setPasswordOpen(!passwordOpen)}>
                <KeyRound /> Đổi mật khẩu
              </button>
              {passwordOpen && (
                <div className="password-form">
                  <input
                    type="password"
                    placeholder="Mật khẩu hiện tại"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                  <input
                    type="password"
                    placeholder="Mật khẩu mới (8 ký tự)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <button
                    disabled={
                      session.offline ||
                      currentPassword.length < 8 ||
                      newPassword.length < 8
                    }
                    onClick={changePassword}
                  >
                    Lưu mật khẩu
                  </button>
                  {notice && <small>{notice}</small>}
                </div>
              )}
              <div className="theme-row">
                <span>
                  <Palette /> Màu giao diện
                </span>
                <div>
                  {colors.map((color) => (
                    <button
                      key={color}
                      aria-label={`Chọn màu ${color}`}
                      style={{ background: color }}
                      onClick={() => chooseColor(color)}
                    />
                  ))}
                </div>
              </div>
              <button className="logout" onClick={onLogout}>
                <LogOut /> Đăng xuất
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function InboxPage({
  session,
  selected,
  setSelected,
  draft,
  setDraft,
  aiOpen,
  setAiOpen,
}: {
  session: ServerSession;
  selected: string;
  setSelected: (s: string) => void;
  draft: string;
  setDraft: (s: string) => void;
  aiOpen: boolean;
  setAiOpen: (b: boolean) => void;
}) {
  const [mobileChatOpen, setMobileChatOpen] = useState(false),
    [tab, setTab] = useState<"all" | "unread" | "open">("all"),
    [channelFilter, setChannelFilter] = useState<Channel | "all">("all"),
    [query, setQuery] = useState("");
  const conversations =
    useLiveQuery(
      async () =>
        (
          await db.conversations
            .where("tenantId")
            .equals(session.tenant.id)
            .sortBy("updatedAt")
        ).reverse(),
      [session.tenant.id],
    ) || [];
  const contacts =
    useLiveQuery(
      () => db.contacts.where("tenantId").equals(session.tenant.id).toArray(),
      [session.tenant.id],
    ) || [];
  const visibleConversations = conversations.filter((conversation) => {
    const person = contacts.find((item) => item.id === conversation.contactId);
    const normalized = query.trim().toLocaleLowerCase();
    const matchesQuery =
      !normalized ||
      `${person?.name || ""} ${person?.phone || ""} ${conversation.preview}`
        .toLocaleLowerCase()
        .includes(normalized);
    const matchesTab =
      tab === "all" ||
      (tab === "unread" ? conversation.unread > 0 : conversation.status === "open");
    return (
      matchesQuery &&
      matchesTab &&
      (channelFilter === "all" || conversation.channel === channelFilter)
    );
  });
  const active =
    conversations.find((c) => c.id === selected) || conversations[0];
  const contact = contacts.find((c) => c.id === active?.contactId);
  const unreadTotal = conversations.reduce(
    (sum, item) => sum + Math.max(0, Number(item.unread) || 0),
    0,
  );
  const choose = (id: string) => {
    setSelected(id);
    setMobileChatOpen(true);
    db.conversations.update(id, { unread: 0 });
  };
  return (
    <div
      className={
        "inbox-grid " +
        (mobileChatOpen ? "mobile-chat-open" : "mobile-thread-open")
      }
    >
      <section className="thread-list">
        <div className="filters">
          <div className="search">
            <Search />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên, số điện thoại..." />
          </div>
          <button>
            <MoreHorizontal />
          </button>
        </div>
        <div className="tabs">
          <button className={tab === "all" ? "active" : ""} onClick={() => setTab("all")}>
            Tất cả <b>{conversations.length}</b>
          </button>
          <button className={tab === "unread" ? "active" : ""} onClick={() => setTab("unread")}>
            Chưa đọc{" "}
            {unreadTotal > 0 && <b>{unreadTotal > 99 ? "99+" : unreadTotal}</b>}
          </button>
          <button className={tab === "open" ? "active" : ""} onClick={() => setTab("open")}>Đang mở</button>
        </div>
        <div className="channel-chips">
          <button className={channelFilter === "all" ? "active" : ""} onClick={() => setChannelFilter("all")}>Tất cả</button>
          {(["facebook", "instagram", "zalo", "telegram"] as Channel[]).map(
            (c) => (
              <button className={channelFilter === c ? "active" : ""} onClick={() => setChannelFilter(c)} title={channelName[c]} key={c}>
                {channelIcon(c)}
              </button>
            ),
          )}
        </div>
        <div className="threads">
          {visibleConversations.map((c) => (
            <ThreadItem
              key={c.id}
              item={c}
              contact={contacts.find((x) => x.id === c.contactId)}
              active={c.id === active?.id}
              onClick={() => choose(c.id)}
            />
          ))}
          {!visibleConversations.length && <div className="empty-threads">Không có cuộc trò chuyện phù hợp.</div>}
        </div>
      </section>
      {active && contact && (
        <Chat
          session={session}
          active={active}
          contact={contact}
          draft={draft}
          setDraft={setDraft}
          aiOpen={aiOpen}
          setAiOpen={setAiOpen}
          onMobileBack={() => setMobileChatOpen(false)}
        />
      )}{" "}
      {contact && <CustomerPanel contact={contact} />}
    </div>
  );
}
function ThreadItem({ item, contact, active, onClick }: any) {
  return (
    <button className={"thread " + (active ? "active" : "")} onClick={onClick}>
      <span className="contact-avatar">
        {contact?.avatar}
        <i className={item.channel} />
      </span>
      <span className="thread-copy">
        <span>
          <b>{contact?.name}</b>
          <time>
            {item.updatedAt > Date.now() - 600000 ? "Vừa xong" : "Hôm nay"}
          </time>
        </span>
        <p>{item.preview}</p>
        <small>{item.assignee}</small>
      </span>
      {item.unread > 0 && <em>{item.unread}</em>}
    </button>
  );
}
function Chat({
  session,
  active,
  contact,
  draft,
  setDraft,
  aiOpen,
  setAiOpen,
  onMobileBack,
}: any) {
  const messages =
      useLiveQuery(
        () =>
          db.messages
            .where("[tenantId+conversationId]")
            .equals([session.tenant.id, active.id])
            .sortBy("createdAt"),
        [session.tenant.id, active.id],
      ) || [],
    [aiSuggestion, setAiSuggestion] = useState(""),
    [aiMeta, setAiMeta] = useState(""),
    [aiLoading, setAiLoading] = useState(false),
    [mediaOpen, setMediaOpen] = useState(false);
  async function send(from: "agent" | "ai" = "agent") {
    const text = draft.trim();
    if (!text) return;
    try {
      if (active.connectionId && !session.offline)
        await apiRequest(
          session.serverUrl,
          "/api/messages/send",
          {
            method: "POST",
            body: JSON.stringify({
              connectionId: active.connectionId,
              recipientId: active.externalConversationId,
              text,
            }),
          },
          session.token,
        );
      await db.messages.add({
        id: crypto.randomUUID(),
        tenantId: session.tenant.id,
        conversationId: active.id,
        from,
        text,
        createdAt: Date.now(),
      });
      await db.conversations.update(active.id, {
        preview: text,
        updatedAt: Date.now(),
        unread: 0,
      });
      setDraft("");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Không gửi được tin nhắn");
    }
  }
  async function suggest() {
    setAiOpen(true);
    if (session.offline) {
      setAiSuggestion(
        "Hãy đăng nhập máy chủ để sử dụng AI riêng của cửa hàng.",
      );
      setAiMeta("Ngoại tuyến");
      return;
    }
    const question =
      [...messages]
        .reverse()
        .find((message: Message) => message.from === "customer")?.text ||
      active.preview;
    setAiLoading(true);
    try {
      const result = await apiRequest<{
        draft: string;
        provider: string;
        sourceIds: string[];
        requiresReview: boolean;
      }>(
        session.serverUrl,
        "/api/ai/suggest",
        {
          method: "POST",
          body: JSON.stringify({
            question,
            customerName: contact.name,
            messages: messages
              .slice(-12)
              .map((message: Message) => ({
                from: message.from,
                text: message.text,
              })),
          }),
        },
        session.token,
      );
      setAiSuggestion(result.draft);
      setAiMeta(
        `${result.provider === "remote" ? "AI trực tuyến" : "Kiến thức cục bộ"} · ${result.sourceIds.length} nguồn · ${result.requiresReview ? "Cần duyệt" : "Tự động"}`,
      );
    } catch (error) {
      setAiSuggestion(
        error instanceof Error ? error.message : "Không tạo được gợi ý",
      );
      setAiMeta("Lỗi AI");
    } finally {
      setAiLoading(false);
    }
  }
  async function sendImage(asset: {
    name: string;
    mimeType: string;
    dataUrl?: string;
    url?: string;
    localId?: string;
  }) {
    try {
      if (!active.connectionId || session.offline)
        throw new Error("Hãy kết nối máy chủ và kênh trước khi gửi ảnh");
      const result = await apiRequest<{
        externalMessageId: string;
        sentAt: number;
      }>(
        session.serverUrl,
        "/api/messages/send-image",
        {
          method: "POST",
          body: JSON.stringify({
            connectionId: active.connectionId,
            recipientId: active.externalConversationId,
            name: asset.name,
            mimeType: asset.mimeType,
            dataUrl: asset.dataUrl,
            imageUrl: asset.url,
          }),
        },
        session.token,
      );
      const imageUrl = asset.dataUrl || asset.url,
        messageId = `${session.tenant.id}:${active.channel}:${result.externalMessageId || crypto.randomUUID()}`;
      await db.messages.put({
        id: messageId,
        tenantId: session.tenant.id,
        conversationId: active.id,
        from: "agent",
        text: "",
        imageUrl,
        imageName: asset.name,
        createdAt: result.sentAt || Date.now(),
      });
      await db.conversations.update(active.id, {
        preview: "[Ảnh]",
        updatedAt: Date.now(),
        unread: 0,
      });
      if (asset.localId)
        await db.mediaAssets.update(asset.localId, { lastUsedAt: Date.now() });
      setMediaOpen(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Không gửi được ảnh");
    }
  }
  async function sendPickedFile(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) {
      alert("Chỉ nhận ảnh nhỏ hơn 8 MB");
      return;
    }
    await sendImage({
      name: file.name || `camera-${Date.now()}.jpg`,
      mimeType: file.type || "image/jpeg",
      dataUrl: await fileToDataUrl(file),
    });
  }
  return (
    <section className="chat">
      <div className="chat-head">
        <button
          className="mobile-chat-back"
          onClick={onMobileBack}
          aria-label="Quay lại danh sách"
        >
          <ArrowLeft />
        </button>
        <div className="contact-avatar large">
          {contact.avatar}
          <i className={active.channel} />
        </div>
        <div className="chat-contact">
          <b>{contact.name}</b>
          <small>
            <span className="online" /> {channelName[active.channel as Channel]}{" "}
            · Đang hoạt động
          </small>
        </div>
        <div className="chat-actions">
          <button title="Gắn nhãn">
            <Tag />
          </button>
          <button title="Tạo đơn">
            <Boxes />
          </button>
          <button>
            <MoreHorizontal />
          </button>
        </div>
      </div>
      <div className="messages">
        <div className="day">Hôm nay</div>
        {messages.length ? (
          messages.map((m: Message) => (
            <div key={m.id} className={"bubble-row " + m.from}>
              <div className={"bubble " + (m.imageUrl ? "image-bubble" : "")}>
                {m.from === "ai" && (
                  <small>
                    <Bot /> AI BOT 68
                  </small>
                )}
                {m.imageUrl && (
                  <img src={m.imageUrl} alt={m.imageName || "Ảnh trò chuyện"} />
                )}{" "}
                {m.text && <span>{m.text}</span>}
                <time>
                  {new Date(m.createdAt).toLocaleTimeString("vi-VN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-chat">
            <MessageCircle />
            <b>Bắt đầu cuộc trò chuyện</b>
          </div>
        )}
      </div>
      {mediaOpen && (
        <MediaPicker
          session={session}
          onSend={sendImage}
          onClose={() => setMediaOpen(false)}
        />
      )}{" "}
      {aiOpen && (
        <div className="ai-suggest">
          <span>
            {aiLoading ? <LoaderCircle className="spin" /> : <Sparkles />}
          </span>
          <div>
            <b>AI đề xuất</b>
            <p>
              {aiLoading
                ? "Đang tìm trong kiến thức cửa hàng và soạn câu trả lời..."
                : aiSuggestion ||
                  "Bấm “AI gợi ý” để tạo câu trả lời dựa trên kiến thức riêng của cửa hàng."}
            </p>
            {aiMeta && <small>{aiMeta}</small>}
            {aiSuggestion && !aiLoading && (
              <button onClick={() => setDraft(aiSuggestion)}>
                Dùng câu trả lời
              </button>
            )}
          </div>
          <button className="close" onClick={() => setAiOpen(false)}>
            <X />
          </button>
        </div>
      )}
      <div className="composer">
        <div className="quick">
          <label className="quick-file">
            <ImagePlus /> Chọn ảnh
            <input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                await sendPickedFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          <label className="quick-file camera-file">
            <Camera /> Chụp ảnh
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={async (e) => {
                await sendPickedFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          <button onClick={() => setMediaOpen(!mediaOpen)}>
            <Images /> Kho ảnh
          </button>
          <button onClick={suggest}>
            <Sparkles /> AI gợi ý
          </button>
        </div>
        <div className="compose-box">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(
                  aiSuggestion && draft.trim() === aiSuggestion
                    ? "ai"
                    : "agent",
                );
              }
            }}
            placeholder="Nhập tin nhắn..."
          />
          <button
            className="send"
            onClick={() =>
              send(
                aiSuggestion && draft.trim() === aiSuggestion ? "ai" : "agent",
              )
            }
          >
            <Send />
          </button>
        </div>
        <small>Enter để gửi · Shift + Enter để xuống dòng</small>
      </div>
    </section>
  );
}

function MediaPicker({
  session,
  onSend,
  onClose,
}: {
  session: ServerSession;
  onSend: (asset: any) => Promise<void>;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"recent" | "library">("library"),
    [webAssets, setWebAssets] = useState<any[]>([]),
    [loading, setLoading] = useState(false),
    [webLoaded, setWebLoaded] = useState(false),
    [syncStarted, setSyncStarted] = useState(false),
    [sendingId, setSendingId] = useState("");
  const localAssets =
    useLiveQuery(
      () =>
        db.mediaAssets
          .where("tenantId")
          .equals(session.tenant.id)
          .reverse()
          .sortBy("createdAt"),
      [session.tenant.id],
    ) || [];
  const recent =
    useLiveQuery(async () => {
      const rows = await db.messages
        .where("tenantId")
        .equals(session.tenant.id)
        .toArray();
      return rows
        .filter((item) => item.imageUrl)
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 60);
    }, [session.tenant.id]) || [];
  useEffect(() => {
    if (session.offline) {
      setWebLoaded(true);
      return;
    }
    apiRequest<any[]>(
      session.serverUrl,
      "/api/media/library",
      {},
      session.token,
    )
      .then(setWebAssets)
      .catch(() => {})
      .finally(() => setWebLoaded(true));
  }, [session.serverUrl, session.token, session.offline]);
  useEffect(() => {
    if (
      !window.bot68 ||
      session.offline ||
      !webLoaded ||
      syncStarted ||
      !localAssets.length
    )
      return;
    setSyncStarted(true);
    let cancelled = false;
    (async () => {
      let current = [...webAssets];
      for (const local of localAssets) {
        if (cancelled || current.length >= 50) break;
        if (
          current.some(
            (item) =>
              item.name === local.name && item.mimeType === local.mimeType,
          )
        )
          continue;
        try {
          const uploaded = await apiRequest<any>(
            session.serverUrl,
            "/api/media/library",
            {
              method: "POST",
              body: JSON.stringify({
                name: local.name,
                dataUrl: local.dataUrl,
              }),
            },
            session.token,
          );
          current = [uploaded, ...current];
          setWebAssets([...current]);
        } catch {
          break;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    webLoaded,
    localAssets.length,
    session.offline,
    session.serverUrl,
    session.token,
    syncStarted,
  ]);
  async function upload(file: File) {
    if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) {
      alert("Chỉ nhận ảnh JPG, PNG, WEBP, GIF nhỏ hơn 8 MB");
      return;
    }
    setLoading(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      if (window.bot68) {
        const asset: MediaAsset = {
          id: crypto.randomUUID(),
          tenantId: session.tenant.id,
          name: file.name,
          mimeType: file.type,
          dataUrl,
          createdAt: Date.now(),
          lastUsedAt: 0,
        };
        await db.mediaAssets.add(asset);
        if (!session.offline && webAssets.length < 50) {
          try {
            const shared = await apiRequest<any>(
              session.serverUrl,
              "/api/media/library",
              {
                method: "POST",
                body: JSON.stringify({ name: file.name, dataUrl }),
              },
              session.token,
            );
            setWebAssets((current) => [shared, ...current]);
          } catch {}
        }
      } else {
        const asset = await apiRequest<any>(
          session.serverUrl,
          "/api/media/library",
          {
            method: "POST",
            body: JSON.stringify({ name: file.name, dataUrl }),
          },
          session.token,
        );
        setWebAssets((current) => [asset, ...current]);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Không tải được ảnh");
    } finally {
      setLoading(false);
    }
  }
  async function remove(asset: any) {
    if (window.bot68) await db.mediaAssets.delete(asset.id);
    else {
      await apiRequest(
        session.serverUrl,
        `/api/media/library/${asset.id}`,
        { method: "DELETE" },
        session.token,
      );
      setWebAssets((items) => items.filter((item) => item.id !== asset.id));
    }
  }
  const library = window.bot68 ? localAssets : webAssets;
  async function select(id: string, asset: any) {
    if (sendingId) return;
    setSendingId(id);
    try {
      await onSend(asset);
    } finally {
      setSendingId("");
    }
  }
  return (
    <div className="media-picker">
      <div className="media-title">
        <div>
          <Images />
          <b>Gửi ảnh sản phẩm</b>
          <small>
            {window.bot68
              ? "Kho ảnh PC không giới hạn · tự chia sẻ 50 ảnh lên web"
              : "Kho ảnh web · tối đa 50 ảnh"}
          </small>
        </div>
        <button onClick={onClose}>
          <X />
        </button>
      </div>
      <div className="media-tabs">
        <button
          className={tab === "recent" ? "active" : ""}
          onClick={() => setTab("recent")}
        >
          Ảnh gần đây <em>{recent.length}</em>
        </button>
        <button
          className={tab === "library" ? "active" : ""}
          onClick={() => setTab("library")}
        >
          Ảnh cửa hàng{" "}
          <em>
            {library.length}
            {!window.bot68 && "/50"}
          </em>
        </button>
        <label className={loading ? "disabled" : ""}>
          <Upload />
          {loading ? "Đang tải..." : "Tải ảnh lên"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            disabled={loading}
            onChange={async (e) => {
              for (const file of Array.from(e.target.files || []))
                await upload(file);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      <div className="media-grid">
        {tab === "recent"
          ? recent.map((item) => (
              <button
                disabled={Boolean(sendingId)}
                className="media-item"
                key={item.id}
                onClick={() =>
                  select(item.id, {
                    name: item.imageName || "Ảnh gần đây",
                    mimeType: guessMime(item.imageUrl!),
                    dataUrl: item.imageUrl?.startsWith("data:")
                      ? item.imageUrl
                      : undefined,
                    url: item.imageUrl?.startsWith("http")
                      ? item.imageUrl
                      : undefined,
                  })
                }
              >
                <img src={item.imageUrl} />
                <span>{sendingId === item.id ? "Đang gửi..." : "Gần đây"}</span>
              </button>
            ))
          : library.map((asset: any) => (
              <div className="media-item-wrap" key={asset.id}>
                <button
                  disabled={Boolean(sendingId)}
                  className="media-item"
                  onClick={() =>
                    select(asset.id, {
                      name: asset.name,
                      mimeType: asset.mimeType,
                      dataUrl: asset.dataUrl,
                      url: asset.url,
                      localId: window.bot68 ? asset.id : undefined,
                    })
                  }
                >
                  <img src={asset.dataUrl || asset.url} />
                  <span title={asset.name}>
                    {sendingId === asset.id ? "Đang gửi..." : asset.name}
                  </span>
                </button>
                <button
                  className="media-remove"
                  title="Xóa ảnh"
                  onClick={() => remove(asset)}
                >
                  <Trash2 />
                </button>
              </div>
            ))}
        {(tab === "recent" ? recent : library).length === 0 && (
          <div className="media-empty">
            <ImagePlus />
            <b>Chưa có ảnh</b>
            <span>Hãy tải ảnh sản phẩm lên kho cửa hàng.</span>
          </div>
        )}
      </div>
    </div>
  );
}
function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
function guessMime(value: string) {
  return value.startsWith("data:")
    ? value.slice(5, value.indexOf(";"))
    : "image/jpeg";
}
function CustomerPanel({ contact }: any) {
  return (
    <aside className="customer-panel">
      <div className="profile">
        <div className="profile-avatar">{contact.avatar}</div>
        <h3>{contact.name}</h3>
        <p>{contact.phone || "Chưa có số điện thoại"}</p>
        <span className="source">
          <MessagesSquare /> Khách hàng Facebook
        </span>
      </div>
      <div className="panel-section">
        <div className="section-title">
          <b>Thông tin khách hàng</b>
          <button>Chỉnh sửa</button>
        </div>
        <dl>
          <dt>Số điện thoại</dt>
          <dd>{contact.phone || "Chưa cập nhật"}</dd>
          <dt>Địa chỉ</dt>
          <dd>{contact.address || "Chưa cập nhật"}</dd>
          <dt>Người phụ trách</dt>
          <dd>Nguyễn Thành</dd>
        </dl>
      </div>
      <div className="panel-section">
        <div className="section-title">
          <b>Nhãn khách hàng</b>
          <button>
            <Plus />
          </button>
        </div>
        <div className="tags">
          {contact.tags.map((t: string) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      </div>
      <div className="panel-section">
        <div className="section-title">
          <b>Đơn hàng gần đây</b>
          <button>Xem tất cả</button>
        </div>
        <div className="empty-order">
          <ClipboardList />
          <p>Chưa có đơn hàng</p>
          <button>
            <Plus /> Tạo đơn mới
          </button>
        </div>
      </div>
    </aside>
  );
}

type SupportMessage = {id:string;sender:"user"|"support";category:string;message:string;metadata:Record<string,unknown>;userName:string;createdAt:number};
function SupportPage({session}:{session:ServerSession}) {
  const [messages,setMessages]=useState<SupportMessage[]>([]),[draft,setDraft]=useState(""),[category,setCategory]=useState("general"),[loading,setLoading]=useState(false),[notice,setNotice]=useState("");
  async function load(){if(session.offline)return;try{setMessages(await apiRequest<SupportMessage[]>(session.serverUrl,"/api/support/messages",{},session.token));setNotice("")}catch(error){setNotice(error instanceof Error?error.message:"Không tải được trò chuyện hỗ trợ")}}
  useEffect(()=>{void load();if(session.offline)return;const timer=window.setInterval(()=>void load(),5000);return()=>clearInterval(timer)},[session.serverUrl,session.token,session.offline]);
  async function sendSupport(){const message=draft.trim();if(!message||session.offline)return;setLoading(true);try{const created=await apiRequest<SupportMessage[]>(session.serverUrl,"/api/support/messages",{method:"POST",body:JSON.stringify({message,category,platform:window.bot68?"Windows":Capacitor.isNativePlatform()?"Android":"Web",appVersion:"0.15.5",userAgent:navigator.userAgent})},session.token);setMessages(current=>[...current,...created]);setDraft("");setNotice("")}catch(error){setNotice(error instanceof Error?error.message:"Không gửi được yêu cầu hỗ trợ")}finally{setLoading(false)}}
  return <div className="support-page">
    <section className="support-intro"><span><CircleHelp/></span><div><h2>Hỗ trợ trực tiếp BOT 68</h2><p>Gửi lỗi ngay tại đây. BOT 68 tự đính kèm nền tảng đang dùng và giữ riêng lịch sử của cửa hàng.</p></div><button onClick={()=>void load()}><RefreshCw/> Làm mới</button></section>
    <section className="support-chat">
      <div className="support-messages">{messages.map(item=><div className={`support-row ${item.sender}`} key={item.id}><div><b>{item.sender==="support"?"BOT 68 Hỗ trợ":item.userName||session.user.name}</b><p>{item.message}</p><time>{new Date(item.createdAt).toLocaleString("vi-VN")}</time></div></div>)}{!messages.length&&<div className="support-empty"><CircleHelp/><b>Bạn cần BOT 68 hỗ trợ gì?</b><span>Hãy mô tả thao tác, màn hình và thông báo lỗi nhìn thấy.</span></div>}</div>
      <div className="support-compose"><select value={category} onChange={event=>setCategory(event.target.value)}><option value="general">Hỗ trợ chung</option><option value="login">Đăng nhập</option><option value="channel">Kết nối Facebook/Instagram</option><option value="message">Gửi/nhận tin nhắn</option><option value="ai">AI trả lời</option><option value="billing">Tài khoản/gói dịch vụ</option><option value="other">Lỗi khác</option></select><textarea value={draft} onChange={event=>setDraft(event.target.value)} placeholder="Mô tả lỗi bạn đang gặp..." onKeyDown={event=>{if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();void sendSupport()}}}/><button disabled={loading||!draft.trim()||session.offline} onClick={()=>void sendSupport()}><Send/>{loading?"Đang gửi":"Gửi hỗ trợ"}</button></div>
      {session.offline&&<div className="support-notice">Cần đăng nhập máy chủ để gửi yêu cầu hỗ trợ.</div>}{notice&&<div className="support-notice error">{notice}</div>}
    </section>
  </div>
}

const moduleCopy: Record<
  Exclude<Page, "inbox" | "support">,
  { icon: any; title: string; desc: string; stats?: string[] }
> = {
  dashboard: {
    icon: LayoutDashboard,
    title: "Tổng quan hoạt động",
    desc: "Theo dõi tin nhắn, khách hàng, đơn hàng và hiệu suất nhân viên.",
    stats: ["148 hội thoại", "36 khách mới", "12 đơn hàng", "92% phản hồi"],
  },
  customers: {
    icon: ContactRound,
    title: "Quản lý khách hàng",
    desc: "Hồ sơ hợp nhất, nhãn, ghi chú và toàn bộ lịch sử tương tác.",
    stats: ["1.248 khách hàng", "86 khách mới", "214 khách quay lại"],
  },
  orders: {
    icon: ClipboardList,
    title: "Quản lý đơn hàng",
    desc: "Tạo đơn ngay trong hội thoại và theo dõi quá trình giao hàng.",
    stats: ["12 đơn mới", "8 đang giao", "126 hoàn thành"],
  },
  products: {
    icon: Package,
    title: "Sản phẩm và tồn kho",
    desc: "Quản lý sản phẩm, biến thể, giá bán và số lượng tồn kho.",
  },
  ai: {
    icon: GraduationCap,
    title: "Trung tâm huấn luyện AI",
    desc: "Dạy AI phong cách tư vấn, kiến thức sản phẩm và các quy tắc an toàn.",
  },
  team: {
    icon: Users,
    title: "Nhân viên và phân quyền",
    desc: "Mời nhân viên, chia hội thoại và quản lý quyền truy cập.",
  },
  reports: {
    icon: BarChart3,
    title: "Báo cáo kinh doanh",
    desc: "Đo tốc độ phản hồi, hiệu suất tư vấn và tỷ lệ chốt đơn.",
  },
  connections: {
    icon: Wifi,
    title: "Kết nối các kênh",
    desc: "Kết nối tài khoản mạng xã hội bằng API chính thức.",
  },
  settings: {
    icon: Settings,
    title: "Cài đặt hệ thống",
    desc: "Dữ liệu cục bộ, sao lưu, bảo mật và thông tin cửa hàng.",
  },
};
function ModulePage({
  page,
  session,
}: {
  page: Exclude<Page, "inbox">;
  session: ServerSession;
}) {
  if (page === "support") return <SupportPage session={session} />;
  const m = moduleCopy[page];
  const Icon = m.icon;
  let content: React.ReactNode;
  if (page === "connections") content = <Connections session={session} />;
  else if (page === "ai") content = <AITraining session={session} />;
  else if (page === "customers") content = <CustomersPage session={session} />;
  else if (page === "products") content = <ProductsPage session={session} />;
  else if (page === "orders") content = <OrdersPage session={session} />;
  else if (page === "team")
    content =
      session.user.role === "owner" ? (
        <TeamPage session={session} />
      ) : (
        <div className="business-notice">
          <ShieldCheck />
          Chỉ chủ cửa hàng được truy cập phân quyền nhân viên.
        </div>
      );
  else if (page === "reports") content = <ReportsPage session={session} />;
  else if (page === "dashboard")
    content = <ReportsPage session={session} dashboard />;
  else content = <SettingsPage session={session} />;
  return (
    <div className="module-page">
      <div className="module-hero">
        <div className="hero-icon">
          <Icon />
        </div>
        <div>
          <h2>{m.title}</h2>
          <p>{m.desc}</p>
        </div>
      </div>
      {["connections", "ai"].includes(page) ? (
        content
      ) : (
        <div className="module-card">{content}</div>
      )}
    </div>
  );
}
type RemoteChannel = {
  id: string;
  provider: Channel;
  externalId: string;
  displayName: string;
  status: string;
};
type OAuthAsset = {
  id: string;
  provider: "facebook" | "instagram";
  externalId: string;
  displayName: string;
  parentExternalId?: string;
};
function Connections({ session }: { session: ServerSession }) {
  const definitions: [Channel, string, string][] = [
    ["facebook", "Facebook Page", "Tin nhắn và bình luận Fanpage"],
    ["instagram", "Instagram Professional", "Tin nhắn và tương tác Instagram"],
    ["zalo", "Zalo Official Account", "Chăm sóc khách hàng qua Zalo OA"],
    ["telegram", "Telegram Bot", "Tin nhắn từ Telegram Bot"],
    ["tiktok", "TikTok Business", "Phụ thuộc quyền API TikTok"],
  ];
  const webDemo = session.offline && !window.bot68;
  const [connected, setConnected] = useState<RemoteChannel[]>([]),
    [assets, setAssets] = useState<OAuthAsset[]>([]),
    [selected, setSelected] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [telegramOpen, setTelegramOpen] = useState(false),
    [telegramToken, setTelegramToken] = useState(""),
    [zaloOpen, setZaloOpen] = useState(false),
    [zaloToken, setZaloToken] = useState(""),
    [zaloWebhook, setZaloWebhook] = useState("");
  async function load() {
    if (session.offline) return;
    try {
      setConnected(
        await apiRequest<RemoteChannel[]>(
          session.serverUrl,
          "/api/channels",
          {},
          session.token,
        ),
      );
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Không tải được kết nối");
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function startMeta(provider: "facebook" | "instagram") {
    if (session.offline) {
      setNotice(`Hãy đăng nhập máy chủ để kết nối ${provider === "facebook" ? "Facebook Page" : "Instagram Professional"}.`);
      return;
    }
    setBusy(true);
    setNotice(provider === "facebook" ? "Đang mở đăng nhập Facebook..." : "Đang mở Meta để cấp quyền riêng cho Instagram Professional...");
    try {
      const flow = await apiRequest<{ flowId: string; authorizeUrl: string }>(
        session.serverUrl,
        "/api/oauth/meta/start",
        { method: "POST", body: JSON.stringify({ provider }) },
        session.token,
      );
      if (window.bot68) await window.bot68.openExternal(flow.authorizeUrl);
      else if (Capacitor.isNativePlatform())
        await Browser.open({ url: flow.authorizeUrl });
      else window.open(flow.authorizeUrl, "_blank");
      for (let i = 0; i < 150; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const status = await apiRequest<{
          status: string;
          error?: string;
          assets: OAuthAsset[];
        }>(
          session.serverUrl,
          `/api/oauth/meta/status/${flow.flowId}`,
          {},
          session.token,
        );
        if (status.status === "ready") {
          if (Capacitor.isNativePlatform())
            await Browser.close().catch(() => {});
          setAssets(status.assets);
          setSelected(status.assets.map((a) => a.id));
          setNotice(provider === "facebook" ? "Đã xác thực Facebook. Chọn các Page muốn thêm." : "Đã xác thực Instagram. Chọn các tài khoản Professional muốn thêm.");
          sessionStorage.setItem("bot68-meta-flow", flow.flowId);
          return;
        }
        if (["failed", "expired"].includes(status.status))
          throw new Error(status.error || "Phiên kết nối hết hạn");
      }
      throw new Error(`Quá thời gian chờ ${provider === "facebook" ? "Facebook" : "Instagram"}`);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Không thể kết nối Meta");
    } finally {
      setBusy(false);
    }
  }
  async function complete() {
    const flowId = sessionStorage.getItem("bot68-meta-flow");
    if (!flowId) return;
    setBusy(true);
    try {
      const result = await apiRequest<{ connected: number }>(
        session.serverUrl,
        "/api/oauth/meta/complete",
        {
          method: "POST",
          body: JSON.stringify({ flowId, assetIds: selected }),
        },
        session.token,
      );
      setAssets([]);
      sessionStorage.removeItem("bot68-meta-flow");
      setNotice(`Đã kết nối ${result.connected} kênh.`);
      await load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Không lưu được kết nối");
    } finally {
      setBusy(false);
    }
  }
  async function disconnect(channel: RemoteChannel) {
    if (
      !window.confirm(
        `Ngắt kết nối ${channel.displayName}? BOT 68 sẽ xóa token đã lưu và ngừng nhận tin nhắn mới từ kênh này.`,
      )
    )
      return;
    setBusy(true);
    try {
      const result = await apiRequest<{ warning?: string }>(
        session.serverUrl,
        `/api/channels/${channel.id}`,
        { method: "DELETE" },
        session.token,
      );
      setNotice(
        result.warning ||
          `Đã ngắt kết nối ${channel.displayName} và xóa token khỏi BOT 68.`,
      );
      await load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Không ngắt được kết nối");
    } finally {
      setBusy(false);
    }
  }
  async function connectTelegram() {
    if (session.offline) {
      setNotice("Hãy đăng nhập máy chủ trước.");
      return;
    }
    setBusy(true);
    try {
      const channel = await apiRequest<RemoteChannel>(
        session.serverUrl,
        "/api/channels/telegram/connect",
        { method: "POST", body: JSON.stringify({ token: telegramToken }) },
        session.token,
      );
      setTelegramOpen(false);
      setTelegramToken("");
      setNotice(`Đã kết nối ${channel.displayName}.`);
      await load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Không kết nối được Telegram");
    } finally {
      setBusy(false);
    }
  }
  async function connectZalo() {
    if (session.offline) {
      setNotice("Hãy đăng nhập máy chủ trước.");
      return;
    }
    setBusy(true);
    try {
      const result = await apiRequest<RemoteChannel & { webhookUrl: string }>(
        session.serverUrl,
        "/api/channels/zalo/connect",
        { method: "POST", body: JSON.stringify({ token: zaloToken }) },
        session.token,
      );
      setZaloWebhook(result.webhookUrl);
      setZaloToken("");
      setNotice(
        `Đã xác minh ${result.displayName}. Hãy sao chép URL webhook vào Zalo Developer.`,
      );
      await load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Không kết nối được Zalo OA");
    } finally {
      setBusy(false);
    }
  }
  function channelAction(provider: Channel, name: string) {
    if (provider === "facebook" || provider === "instagram") return () => startMeta(provider);
    if (provider === "telegram") return () => setTelegramOpen(true);
    if (provider === "zalo") return () => setZaloOpen(true);
    return () =>
      setNotice(`${name} cần quyền đối tác API trước khi bật nhắn tin.`);
  }
  return (
    <>
      {webDemo && (
        <div className="web-demo-warning">
          <ShieldCheck />
          <div>
            <b>Đây là bản demo giao diện trên web</b>
            <p>
              Bản web không có máy chủ webhook nên không thể nhận tin nhắn thật.
              Hãy cài BOT 68 Windows để tạo cửa hàng cục bộ; Facebook/Instagram
              cần thêm máy chủ HTTPS và Meta App.
            </p>
          </div>
          <a href="https://github.com/thanh324-hash/sportxauth/releases/latest/download/BOT-68-Setup-latest.exe">
            Tải BOT 68 Windows
          </a>
        </div>
      )}
      <div className="connections">
        {definitions.map(([provider, name, desc], i) => {
          const matches = connected.filter((c) => c.provider === provider),
            implemented =
              i < 2 || provider === "telegram" || provider === "zalo";
          return (
            <div className="connection-card" key={provider}>
              <span className={"channel-logo " + provider}>
                {channelIcon(provider)}
              </span>
              <div>
                <b>{name}</b>
                <p>{desc}</p>
                <small>
                  {matches.length
                    ? `${matches.length} tài khoản đang hoạt động`
                    : implemented
                      ? "Kết nối bằng API chính thức"
                      : "Mô-đun mở rộng"}
                </small>
                {matches.map((c) => (
                  <em className="connected-account" key={c.id}>
                    <CheckCircle2 />
                    <span>{c.displayName}</span>
                    <button
                      type="button"
                      title={`Ngắt kết nối ${c.displayName}`}
                      aria-label={`Ngắt kết nối ${c.displayName}`}
                      disabled={busy}
                      onClick={() => disconnect(c)}
                    >
                      <Trash2 />
                      <span>Ngắt kết nối</span>
                    </button>
                  </em>
                ))}
              </div>
              <button disabled={busy} onClick={channelAction(provider, name)}>
                {busy && implemented ? (
                  <LoaderCircle className="spin" />
                ) : implemented ? (
                  <>
                    <ExternalLink /> Kết nối
                    {provider === "facebook" ? " Facebook" : provider === "instagram" ? " Instagram" : ""}
                  </>
                ) : (
                  <>Tìm hiểu</>
                )}
              </button>
            </div>
          );
        })}
      </div>
      {notice && (
        <div className="connection-notice">
          <RefreshCw />
          {notice}
        </div>
      )}
      {telegramOpen && (
        <div className="token-connect">
          <button
            className="token-close"
            onClick={() => setTelegramOpen(false)}
          >
            <X />
          </button>
          <span className="channel-logo telegram">
            <Send />
          </span>
          <div>
            <h3>Kết nối Telegram Bot</h3>
            <p>
              Mở <b>@BotFather</b>, tạo bot và dán Bot Token vào đây. Token sẽ
              được mã hóa trước khi lưu.
            </p>
            <input
              type="password"
              value={telegramToken}
              onChange={(e) => setTelegramToken(e.target.value)}
              placeholder="123456789:AA..."
            />
            <small>
              BOT 68 sẽ gọi getMe để xác minh và tự cài webhook bảo mật.
            </small>
            <button
              className="primary"
              disabled={busy || telegramToken.length < 25}
              onClick={connectTelegram}
            >
              {busy ? <LoaderCircle className="spin" /> : <ShieldCheck />} Xác
              minh và kết nối
            </button>
          </div>
        </div>
      )}
      {zaloOpen && (
        <div className="token-connect zalo-connect">
          <button className="token-close" onClick={() => setZaloOpen(false)}>
            <X />
          </button>
          <span className="channel-logo zalo">
            <MessageCircle />
          </span>
          <div>
            <h3>Kết nối Zalo Official Account</h3>
            <p>
              Lấy OA Access Token trong Zalo Developer và dán vào đây. BOT 68 sẽ
              gọi <b>getoa</b> để xác minh.
            </p>
            {!zaloWebhook ? (
              <>
                <input
                  type="password"
                  value={zaloToken}
                  onChange={(e) => setZaloToken(e.target.value)}
                  placeholder="Zalo OA Access Token"
                />
                <small>Token được mã hóa và không hiển thị lại.</small>
                <button
                  className="primary"
                  disabled={busy || zaloToken.length < 20}
                  onClick={connectZalo}
                >
                  {busy ? <LoaderCircle className="spin" /> : <ShieldCheck />}{" "}
                  Xác minh OA
                </button>
              </>
            ) : (
              <>
                <label className="webhook-result">
                  <span>URL webhook cần khai báo</span>
                  <input readOnly value={zaloWebhook} />
                </label>
                <button
                  className="primary"
                  onClick={() => navigator.clipboard.writeText(zaloWebhook)}
                >
                  <ClipboardList /> Sao chép URL webhook
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {assets.length > 0 && (
        <div className="asset-picker">
          <div>
            <h3>Chọn tài khoản muốn kết nối</h3>
            <p>
              BOT 68 chỉ lưu những Page bạn chọn. Token được mã hóa trên máy
              chủ.
            </p>
          </div>
          {assets.map((asset) => (
            <label key={asset.id}>
              <input
                type="checkbox"
                checked={selected.includes(asset.id)}
                onChange={(e) =>
                  setSelected(
                    e.target.checked
                      ? [...selected, asset.id]
                      : selected.filter((x) => x !== asset.id),
                  )
                }
              />
              <span className={"channel-logo " + asset.provider}>
                {channelIcon(asset.provider)}
              </span>
              <span>
                <b>{asset.displayName}</b>
                <small>
                  {asset.provider === "facebook"
                    ? "Facebook Page"
                    : "Instagram Professional"}
                </small>
              </span>
            </label>
          ))}
          <button
            className="primary"
            disabled={!selected.length || busy}
            onClick={complete}
          >
            <CheckCircle2 /> Hoàn tất kết nối ({selected.length})
          </button>
        </div>
      )}
    </>
  );
}
type Knowledge = {
  id: string;
  title: string;
  content: string;
  tags: string[];
  enabled: boolean;
  updatedAt: number;
};
type AIProfile = {
  businessName: string;
  tone: string;
  instructions: string;
  safetyMode: "suggest" | "supervised" | "automatic";
};
function AITraining({ session }: { session: ServerSession }) {
  const [documents, setDocuments] = useState<Knowledge[]>([]),
    [profile, setProfile] = useState<AIProfile>({
      businessName: session.tenant.name,
      tone: "thân thiện",
      instructions: "",
      safetyMode: "suggest",
    }),
    [adding, setAdding] = useState(false),
    [title, setTitle] = useState(""),
    [content, setContent] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    if (session.offline) {
      setNotice("Đăng nhập máy chủ để quản lý AI riêng của cửa hàng.");
      return;
    }
    try {
      const [p, d] = await Promise.all([
        apiRequest<AIProfile>(
          session.serverUrl,
          "/api/ai-profile",
          {},
          session.token,
        ),
        apiRequest<Knowledge[]>(
          session.serverUrl,
          "/api/ai/knowledge",
          {},
          session.token,
        ),
      ]);
      setProfile(p);
      setDocuments(d);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Không tải được cấu hình AI");
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function saveProfile() {
    setBusy(true);
    try {
      const value = await apiRequest<AIProfile>(
        session.serverUrl,
        "/api/ai-profile",
        { method: "PATCH", body: JSON.stringify(profile) },
        session.token,
      );
      setProfile(value);
      setNotice("Đã lưu phong cách và quy tắc AI.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Không lưu được");
    } finally {
      setBusy(false);
    }
  }
  async function addDocument() {
    setBusy(true);
    try {
      const doc = await apiRequest<Knowledge>(
        session.serverUrl,
        "/api/ai/knowledge",
        { method: "POST", body: JSON.stringify({ title, content, tags: [] }) },
        session.token,
      );
      setDocuments([doc, ...documents]);
      setTitle("");
      setContent("");
      setAdding(false);
      setNotice(
        "Đã thêm tài liệu vào bộ kiến thức. Bây giờ AI có thể dùng nội dung này để gợi ý.",
      );
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Không thêm được tài liệu");
    } finally {
      setBusy(false);
    }
  }
  async function addStarterPack() {
    const samples = [
      {
        title: "Sản phẩm áo bóng đá",
        tags: ["áo bóng đá", "size", "giá", "in áo"],
        content:
          "Cửa hàng bán áo bóng đá câu lạc bộ, đội tuyển và áo thiết kế theo yêu cầu. Khi tư vấn size phải hỏi chiều cao, cân nặng và sở thích mặc ôm hay rộng. Chỉ báo giá và tồn kho theo dữ liệu cửa hàng đã cập nhật; nếu chưa có dữ liệu phải chuyển nhân viên kiểm tra. Có thể nhận in tên, số và logo khi cửa hàng xác nhận mẫu.",
      },
      {
        title: "Quy trình tư vấn và chốt đơn",
        tags: ["tư vấn", "đặt hàng", "chốt đơn"],
        content:
          "Khi khách hỏi mua áo, cần xác nhận mẫu áo, size, số lượng, tên và số muốn in. Trước khi tạo đơn phải nhắc lại họ tên, số điện thoại, địa chỉ nhận hàng, sản phẩm, size, số lượng và yêu cầu in để khách xác nhận. Không tự ý hứa giảm giá, quà tặng, tồn kho hoặc ngày giao hàng.",
      },
      {
        title: "Đổi trả và an toàn",
        tags: ["đổi trả", "an toàn", "thanh toán"],
        content:
          "Chỉ áp dụng đổi trả theo chính sách cửa hàng đã xác nhận. Hàng in tên, in số hoặc thiết kế riêng có thể không được đổi nếu không có lỗi từ cửa hàng. Không yêu cầu mật khẩu, mã OTP, thông tin thẻ ngân hàng hoặc giấy tờ tùy thân. Khiếu nại, thanh toán lỗi, hoàn tiền và khách hàng tức giận phải chuyển nhân viên xử lý.",
      },
    ];
    setBusy(true);
    try {
      const created = [] as Knowledge[];
      for (const sample of samples)
        created.push(
          await apiRequest<Knowledge>(
            session.serverUrl,
            "/api/ai/knowledge",
            { method: "POST", body: JSON.stringify(sample) },
            session.token,
          ),
        );
      setDocuments([...created, ...documents]);
      setNotice(
        `Đã tạo ${created.length} tài liệu mẫu. Hãy sửa giá, size và chính sách theo đúng cửa hàng trước khi dùng.`,
      );
    } catch (e) {
      setNotice(
        e instanceof Error ? e.message : "Không tạo được bộ kiến thức mẫu",
      );
    } finally {
      setBusy(false);
    }
  }
  async function toggle(doc: Knowledge) {
    const updated = await apiRequest<Knowledge>(
      session.serverUrl,
      `/api/ai/knowledge/${doc.id}`,
      { method: "PATCH", body: JSON.stringify({ enabled: !doc.enabled }) },
      session.token,
    );
    setDocuments(
      documents.map((item) => (item.id === doc.id ? updated : item)),
    );
  }
  async function remove(doc: Knowledge) {
    await apiRequest(
      session.serverUrl,
      `/api/ai/knowledge/${doc.id}`,
      { method: "DELETE" },
      session.token,
    );
    setDocuments(documents.filter((item) => item.id !== doc.id));
  }
  return (
    <>
      <div className="ai-grid">
        <div className="module-card">
          <div className="card-head">
            <b>Bộ kiến thức cửa hàng ({documents.length})</b>
            <button
              className="primary small"
              onClick={() => setAdding(!adding)}
            >
              <Plus /> Thêm tài liệu
            </button>
          </div>
          {adding && (
            <div className="knowledge-form">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Tên tài liệu, ví dụ: Chính sách đổi trả"
              />
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Nhập thông tin chính xác để AI sử dụng khi trả lời..."
              />
              <div>
                <button onClick={() => setAdding(false)}>Hủy</button>
                <button
                  className="primary"
                  disabled={busy || !title.trim() || !content.trim()}
                  onClick={addDocument}
                >
                  <Save /> Lưu tài liệu
                </button>
              </div>
            </div>
          )}
          {documents.length ? (
            documents.map((doc) => (
              <div
                className={"knowledge " + (!doc.enabled ? "disabled" : "")}
                key={doc.id}
              >
                <span>
                  <ClipboardList />
                </span>
                <div>
                  <b>{doc.title}</b>
                  <p>
                    {doc.content.slice(0, 100)}
                    {doc.content.length > 100 ? "…" : ""}
                  </p>
                </div>
                <button className="knowledge-state" onClick={() => toggle(doc)}>
                  {doc.enabled ? "Hoạt động" : "Đã tắt"}
                </button>
                <button
                  className="knowledge-delete"
                  onClick={() => remove(doc)}
                >
                  <Trash2 />
                </button>
              </div>
            ))
          ) : (
            <div className="knowledge-empty">
              <GraduationCap />
              <p>
                <b>AI chưa có nguồn kiến thức nên chưa thể tư vấn sản phẩm.</b>
                <br />
                “Phong cách và an toàn” chỉ là quy tắc hành xử, không thay thế
                tài liệu sản phẩm và chính sách.
              </p>
              <button
                className="primary"
                disabled={busy || session.offline}
                onClick={addStarterPack}
              >
                <Sparkles /> Tạo bộ mẫu áo bóng đá
              </button>
            </div>
          )}
        </div>
        <div className="module-card ai-policy">
          <ShieldCheck />
          <h3>Phong cách và an toàn</h3>
          <label>
            Tên cửa hàng
            <input
              value={profile.businessName}
              onChange={(e) =>
                setProfile({ ...profile, businessName: e.target.value })
              }
            />
          </label>
          <label>
            Giọng điệu
            <select
              value={profile.tone}
              onChange={(e) => setProfile({ ...profile, tone: e.target.value })}
            >
              <option>thân thiện</option>
              <option>chuyên nghiệp</option>
              <option>ngắn gọn</option>
              <option>nhiệt tình</option>
            </select>
          </label>
          <label>
            Quy tắc riêng
            <textarea
              value={profile.instructions}
              onChange={(e) =>
                setProfile({ ...profile, instructions: e.target.value })
              }
              placeholder="Ví dụ: xưng shop, không tự ý giảm giá..."
            />
          </label>
          <small>
            Quy tắc này điều khiển cách trả lời. Muốn AI biết sản phẩm, giá và
            chính sách, hãy thêm tài liệu ở cột bên trái.
          </small>
          <label>
            Chế độ
            <select
              value={profile.safetyMode}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  safetyMode: e.target.value as AIProfile["safetyMode"],
                })
              }
            >
              <option value="suggest">Chỉ gợi ý, nhân viên duyệt</option>
              <option value="supervised">
                Tự động trong tình huống an toàn
              </option>
              <option value="automatic">Tự động trả lời</option>
            </select>
          </label>
          <button
            className="primary"
            disabled={busy || session.offline}
            onClick={saveProfile}
          >
            <Save /> Lưu cấu hình AI
          </button>
        </div>
      </div>
      {notice && (
        <div className="connection-notice">
          <Sparkles />
          {notice}
        </div>
      )}
    </>
  );
}
export default App;
