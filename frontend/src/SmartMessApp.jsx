import { useState, useEffect, useContext, createContext, useRef, useCallback } from "react";
import { api } from "./api";
import { motion, AnimatePresence } from "framer-motion";
import {
  UtensilsCrossed, CalendarDays, LayoutDashboard, LogOut, ChefHat,
  BarChart3, Clock, CheckCircle2, AlertCircle, ChevronLeft, ChevronRight,
  Star, Users, Eye, EyeOff, ArrowRight, Coffee, Edit3, Trash2,
  GripVertical, Plus, Bell, FileDown, MessageSquare, Send, ThumbsUp,
  Package, Cpu, TrendingUp, Zap, Timer, X, Megaphone, Info, CheckCheck
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

const MENU_DATA = {
  Mon: { Breakfast: { veg: ["Idli Sambar","Poha","Upma"], nonVeg: ["Egg Bhurji","Omelette Wrap"] } },
  Tue: { Breakfast: { veg: ["Dosa Chutney","Paratha","Cornflakes"], nonVeg: ["Egg Paratha","Boiled Eggs"] } },
  Wed: { Breakfast: { veg: ["Bread Butter Jam","Poha","Upma"], nonVeg: ["Egg Toast","Omelette"] } },
  Thu: { Breakfast: { veg: ["Idli Vada","Sprouts Bowl","Pongal"], nonVeg: ["Egg Dosa","Boiled Eggs"] } },
  Fri: { Breakfast: { veg: ["Poha","Dosa Sambar","Upma"], nonVeg: ["Egg Bhurji","Omelette"] } },
  Sat: { Breakfast: { veg: ["Chole Bhature","Paratha Pickle"], nonVeg: ["Egg Paratha","Chicken Sandwich"] } },
  Sun: { Breakfast: { veg: ["Puri Sabzi","Halwa Poori"], nonVeg: ["Egg Puri","Omelette"] } },
};

const AppContext = createContext();

const AppProvider = ({ children }) => {
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem("ll_user")); } catch { return null; } });
  const [preferences, setPreferences] = useState({});
  const [leaveDates, setLeaveDates] = useState([]);
  const [menu, setMenuState] = useState(MENU_DATA);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [notifications, setNotifications] = useState(0);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [weekDiet, setWeekDiet] = useState(() => localStorage.getItem("ll_diet") || null);
  const [selectionOpen, setSelectionOpen] = useState(true);
  const [currentWeekId, setCurrentWeekId] = useState("");

  // ── NEW: real-time notifications list
  const [notifList, setNotifList] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);

  // ── NEW: deadline/countdown
  const [deadlineInfo, setDeadlineInfo] = useState(null);

  const sseRef = useRef(null);

  // ── SSE connection
  const connectSSE = useCallback((token) => {
    if (sseRef.current) sseRef.current.close();
    const url = api.getSSEUrl();
    const es = new EventSource(`${url}?token=${encodeURIComponent(token)}`);
    es.onmessage = (e) => {
      try {
        const evt = JSON.parse(e.data);
        if (evt.type === "connected") return;
        // Prepend new notification to list
        setNotifList(prev => [{ ...evt, read: false, id: evt.id || Date.now() }, ...prev.slice(0, 49)]);
        setUnreadCount(c => c + 1);
        // Browser notification if permitted
        if (Notification.permission === "granted") {
          new Notification(evt.title, { body: evt.message, icon: "/logo.png" });
        }
      } catch (_) {}
    };
    es.onerror = () => { es.close(); setTimeout(() => connectSSE(token), 5000); };
    sseRef.current = es;
  }, []);

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem("ll_token");
    // SSE needs token in query since EventSource can't set headers
    connectSSE(token);

    // Request browser notification permission
    if (Notification.permission === "default") Notification.requestPermission();

    // Load initial data
    Promise.all([
      api.getMenu(), api.getPreferences(), api.getLeave(),
      api.getWindow(), api.getNotifications(), api.getDeadline()
    ]).then(([m, p, l, w, notifs, dl]) => {
      if (Object.keys(m).length) setMenuState(m);
      setPreferences(p);
      setLeaveDates(l);
      setSelectionOpen(w.open);
      setCurrentWeekId(w.weekId);
      setNotifList(notifs.map(n => ({ ...n, timestamp: n.created_at })));
      setUnreadCount(notifs.filter(n => !n.read).length);
      setDeadlineInfo(dl);
    }).catch(console.error);

    // Refresh deadline every minute
    const dlInterval = setInterval(() => {
      api.getDeadline().then(setDeadlineInfo).catch(() => {});
    }, 60000);

    return () => {
      if (sseRef.current) sseRef.current.close();
      clearInterval(dlInterval);
    };
  }, [user, connectSSE]);

  const markNotifRead = async (id) => {
    setNotifList(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnreadCount(c => Math.max(0, c - 1));
    try { await api.markRead(id); } catch (_) {}
  };

  const markAllRead = async () => {
    setNotifList(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
    try { await api.markAllRead(); } catch (_) {}
  };

  const login = async (creds) => {
    setLoading(true); setApiError(null);
    try {
      const { token, user: u } = await api.login(creds.id, creds.pass);
      localStorage.setItem("ll_token", token);
      localStorage.setItem("ll_user", JSON.stringify({ ...u, type: u.role }));
      setUser({ ...u, type: u.role });
    } catch (e) { setApiError(e.message); } finally { setLoading(false); }
  };

  const updateMenu = async (day, breakfast) => {
    setMenuState(m => ({ ...m, [day]: { ...m[day], Breakfast: breakfast } }));
    try { await api.updateMenu(day, breakfast); } catch (e) { console.error(e); }
  };

  const setPreference = async (day, choiceIndex, diet = "veg") => {
    setPreferences(p => ({ ...p, [day]: { choiceIndex, diet } }));
    try {
      const result = await api.setPreference(day, choiceIndex, diet);
      if (result.success) api.getWindow().then(w => { setSelectionOpen(w.open); setCurrentWeekId(w.weekId); }).catch(() => {});
    } catch (e) {
      console.error(e);
      setPreferences(p => { const n = { ...p }; delete n[day]; return n; });
      alert(e.message || "Could not save preference");
    }
  };

  const toggleLeave = async (dateStr) => {
    setLeaveDates(d => d.includes(dateStr) ? d.filter(x => x !== dateStr) : [...d, dateStr]);
    try { await api.toggleLeave(dateStr); }
    catch (e) { console.error(e); setLeaveDates(d => d.includes(dateStr) ? d.filter(x => x !== dateStr) : [...d, dateStr]); }
  };

  const chooseDiet = (d) => { localStorage.setItem("ll_diet", d); setWeekDiet(d); };

  const logout = () => {
    if (sseRef.current) sseRef.current.close();
    localStorage.removeItem("ll_token"); localStorage.removeItem("ll_user"); localStorage.removeItem("ll_diet");
    setUser(null); setPreferences({}); setLeaveDates([]); setWeekDiet(null);
    setActiveTab("dashboard"); setNotifList([]); setUnreadCount(0);
  };

  return (
    <AppContext.Provider value={{
      user, login, logout, loading, apiError,
      preferences, setPreference,
      leaveDates, toggleLeave,
      menu, setMenu: updateMenu, setMenuRaw: setMenuState,
      activeTab, setActiveTab,
      notifications: unreadCount,
      notifList, unreadCount, notifPanelOpen, setNotifPanelOpen,
      markNotifRead, markAllRead,
      weekDiet, chooseDiet,
      selectionOpen, currentWeekId,
      deadlineInfo,
    }}>
      {children}
    </AppContext.Provider>
  );
};

const SG = "linear-gradient(135deg,#9b3fa8 0%,#e05c8a 30%,#f4845f 60%,#f9b234 85%,#ffd700 100%)";

const S = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  :root{
    --bg:#ffffff; --s1:#f9f9fb; --s2:#f2f2f8; --s3:#eaeaf2; --s4:#e0e0ec;
    --b1:rgba(155,63,168,0.1); --b2:rgba(155,63,168,0.18);
    --pu:#9b3fa8; --pk:#e05c8a; --or:#f4845f; --am:#f9b234;
    --vg:#16a34a; --nv:#ea580c; --dn:#dc2626; --wn:#d97706;
    --t1:#1a0a2e; --t2:#6b4c5e; --t3:#9a7a8a;
    --fn:'Inter',sans-serif; --r:16px;
  }
  body{background:var(--bg);color:var(--t1);font-family:var(--fn);-webkit-font-smoothing:antialiased;overflow-x:hidden;}
  ::-webkit-scrollbar{width:3px;}::-webkit-scrollbar-thumb{background:var(--pk);border-radius:4px;}
  .card{background:var(--s2);border:1px solid var(--b1);border-radius:var(--r);padding:18px;}
  .card-strong{background:var(--s1);border:1px solid var(--b2);border-radius:20px;padding:24px;}
  .btn-p{background:${SG};border:none;border-radius:12px;padding:13px 24px;color:#fff;font-family:var(--fn);font-weight:800;font-size:14px;cursor:pointer;transition:all 0.2s;width:100%;box-shadow:0 4px 20px rgba(224,92,138,0.3);}
  .btn-p:hover{transform:translateY(-2px);box-shadow:0 8px 30px rgba(224,92,138,0.45);}
  .btn-p:disabled{opacity:0.5;cursor:not-allowed;transform:none;}
  .inp{width:100%;background:var(--s3);border:1.5px solid var(--b2);border-radius:10px;padding:12px 14px;color:var(--t1);font-family:var(--fn);font-size:14px;outline:none;transition:border-color 0.15s,box-shadow 0.15s;}
  .inp:focus{border-color:var(--pk);box-shadow:0 0 0 3px rgba(224,92,138,0.15);}
  .inp::placeholder{color:var(--t3);}
  .nav-item{display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px 12px;border-radius:12px;cursor:pointer;transition:all 0.2s;border:1px solid transparent;background:none;color:var(--t3);font-family:var(--fn);font-size:10px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;}
  .nav-item.active{color:var(--pk);background:rgba(224,92,138,0.1);border-color:rgba(224,92,138,0.25);box-shadow:0 0 12px rgba(224,92,138,0.15);}
  .nav-item:hover:not(.active){color:var(--t2);background:var(--s3);}
  .day-card{background:var(--s2);border:1.5px solid var(--b1);border-radius:16px;padding:14px 8px;cursor:pointer;transition:all 0.25s;text-align:center;position:relative;overflow:hidden;}
  .day-card:hover{transform:translateY(-4px) scale(1.03);border-color:var(--pk);box-shadow:0 8px 24px rgba(224,92,138,0.2);}
  .day-card.done{border-color:rgba(249,178,52,0.5);background:linear-gradient(160deg,rgba(155,63,168,0.06),rgba(224,92,138,0.05),rgba(249,178,52,0.04));}
  .meal-opt{display:inline-flex;align-items:center;gap:8px;padding:10px 18px;border-radius:50px;cursor:pointer;font-size:13px;font-weight:600;font-family:var(--fn);transition:all 0.22s cubic-bezier(0.34,1.56,0.64,1);border:1.5px solid var(--b2);background:var(--s3);color:var(--t2);}
  .meal-opt:hover{transform:translateY(-2px) scale(1.04);border-color:var(--pk);color:var(--t1);box-shadow:0 6px 18px rgba(224,92,138,0.2);}
  .meal-opt.sel{background:${SG};border-color:transparent;color:#fff;font-weight:700;box-shadow:0 6px 20px rgba(224,92,138,0.4);transform:translateY(-1px);}
  .pt{height:7px;background:var(--s4);border-radius:4px;overflow:hidden;}
  .pb{height:100%;border-radius:4px;background:${SG};}
  @keyframes checkIn{from{transform:scale(0) rotate(-45deg);opacity:0;}to{transform:scale(1) rotate(0);opacity:1;}}
  .check-anim{animation:checkIn 0.35s cubic-bezier(0.34,1.56,0.64,1);}
  @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.4;}}
  .slot-badge{display:inline-flex;align-items:center;gap:5px;padding:4px 12px;border-radius:50px;font-size:12px;font-weight:800;background:linear-gradient(135deg,#1a0a2e,#3d1a5a);color:#f9b234;}
`;

const getDIM = (y,m) => new Date(y,m+1,0).getDate();
const getFD  = (y,m) => new Date(y,m,1).getDay();

// ─── COUNTDOWN TIMER ─────────────────────────────────────────────────────────
const CountdownTimer = () => {
  const { deadlineInfo, selectionOpen, currentWeekId } = useContext(AppContext);
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    if (!deadlineInfo) return;
    const tick = () => {
      const diff = deadlineInfo.deadlineMs - Date.now();
      if (diff <= 0) { setTimeLeft(null); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft({ d, h, m, s, diff });
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [deadlineInfo]);

  if (!timeLeft) return null;

  const isUrgent = timeLeft.diff < 2 * 3600000; // less than 2 hours
  const isOpen   = deadlineInfo?.windowOpen;

  const bg     = isOpen
    ? isUrgent ? "linear-gradient(135deg,#dc2626,#ea580c)" : "linear-gradient(135deg,#16a34a,#15803d)"
    : "linear-gradient(135deg,#6b4c5e,#9a7a8a)";

  const parts = timeLeft.d > 0
    ? [{ v: timeLeft.d, l: "D" }, { v: timeLeft.h, l: "H" }, { v: timeLeft.m, l: "M" }]
    : [{ v: timeLeft.h, l: "H" }, { v: timeLeft.m, l: "M" }, { v: timeLeft.s, l: "S" }];

  return (
    <div style={{
      margin:"0 16px 16px",
      borderRadius:16,
      background:bg,
      padding:"12px 16px",
      display:"flex",
      alignItems:"center",
      gap:12,
      boxShadow: isOpen && isUrgent ? "0 4px 20px rgba(220,38,38,0.4)" : "0 4px 14px rgba(0,0,0,0.15)",
    }}>
      <div style={{width:36,height:36,borderRadius:10,background:"rgba(255,255,255,0.15)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
        <Timer size={18} color="#fff"/>
      </div>
      <div style={{flex:1}}>
        <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.75)",textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:1}}>
          {deadlineInfo?.deadlineLabel} — Week {currentWeekId}
        </p>
        <div style={{display:"flex",gap:6,alignItems:"baseline"}}>
          {parts.map(({ v, l }) => (
            <div key={l} style={{display:"flex",alignItems:"baseline",gap:1}}>
              <span style={{fontSize:20,fontWeight:900,color:"#fff",letterSpacing:"-1px",fontVariantNumeric:"tabular-nums"}}>
                {String(v).padStart(2, "0")}
              </span>
              <span style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.65)"}}>{l}</span>
            </div>
          ))}
        </div>
      </div>
      {isOpen ? (
        <div style={{background:"rgba(255,255,255,0.2)",borderRadius:50,padding:"4px 10px",fontSize:11,color:"#fff",fontWeight:700}}>
          {isUrgent ? "⚠️ Closing soon!" : "✓ Open"}
        </div>
      ) : (
        <div style={{background:"rgba(255,255,255,0.15)",borderRadius:50,padding:"4px 10px",fontSize:11,color:"rgba(255,255,255,0.8)",fontWeight:600}}>Closed</div>
      )}
    </div>
  );
};

// ─── NOTIFICATION PANEL ───────────────────────────────────────────────────────
const typeIcon = (type) => {
  const icons = {
    window_open:  { icon: "🟢", color: "#16a34a" },
    window_close: { icon: "🔴", color: "#dc2626" },
    menu_update:  { icon: "🍳", color: "#f9b234" },
    collection:   { icon: "✅", color: "#16a34a" },
    broadcast:    { icon: "📢", color: "#9b3fa8" },
    connected:    { icon: "🔗", color: "#6b7280" },
  };
  return icons[type] || { icon: "🔔", color: "#9b3fa8" };
};

const NotificationPanel = () => {
  const { notifList, unreadCount, notifPanelOpen, setNotifPanelOpen, markNotifRead, markAllRead, user } = useContext(AppContext);
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastMsg,   setBroadcastMsg]   = useState("");
  const [broadcastTarget, setBroadcastTarget] = useState("all");
  const [sending, setSending] = useState(false);
  const [sent,    setSent]    = useState(false);

  const handleBroadcast = async () => {
    if (!broadcastTitle || !broadcastMsg) return;
    setSending(true);
    try {
      await api.broadcastNotification(broadcastTitle, broadcastMsg, broadcastTarget);
      setSent(true); setBroadcastTitle(""); setBroadcastMsg("");
      setTimeout(() => setSent(false), 3000);
    } catch (e) { console.error(e); } finally { setSending(false); }
  };

  if (!notifPanelOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => setNotifPanelOpen(false)}
        style={{ position:"fixed",inset:0,zIndex:400,background:"rgba(26,10,46,0.5)",backdropFilter:"blur(8px)" }}>
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type:"spring",damping:28,stiffness:300 }}
          onClick={e => e.stopPropagation()}
          style={{ position:"fixed",top:0,right:0,bottom:0,width:"min(380px,100vw)",background:"#fff",boxShadow:"-8px 0 40px rgba(155,63,168,0.15)",display:"flex",flexDirection:"column",zIndex:401 }}>

          {/* Panel header */}
          <div style={{ padding:"16px 20px",borderBottom:"1px solid var(--b1)",display:"flex",alignItems:"center",justifyContent:"space-between",background:"linear-gradient(135deg,rgba(155,63,168,0.06),rgba(224,92,138,0.04))" }}>
            <div style={{ display:"flex",alignItems:"center",gap:10 }}>
              <Bell size={18} color="var(--pk)"/>
              <div>
                <p style={{ fontWeight:800,fontSize:15,color:"var(--t1)" }}>Notifications</p>
                {unreadCount > 0 && <p style={{ fontSize:11,color:"var(--pk)",fontWeight:600 }}>{unreadCount} unread</p>}
              </div>
            </div>
            <div style={{ display:"flex",gap:8 }}>
              {unreadCount > 0 && (
                <button onClick={markAllRead} style={{ background:"var(--s3)",border:"1px solid var(--b1)",borderRadius:50,padding:"5px 12px",fontSize:11,fontWeight:700,color:"var(--t2)",cursor:"pointer",fontFamily:"var(--fn)",display:"flex",alignItems:"center",gap:4 }}>
                  <CheckCheck size={12}/>All read
                </button>
              )}
              <button onClick={() => setNotifPanelOpen(false)} style={{ background:"var(--s3)",border:"1px solid var(--b1)",borderRadius:8,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"var(--t2)" }}>
                <X size={15}/>
              </button>
            </div>
          </div>

          {/* Manager broadcast form */}
          {user?.role === "manager" && (
            <div style={{ padding:"14px 18px",borderBottom:"1px solid var(--b1)",background:"rgba(155,63,168,0.03)" }}>
              <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:10 }}>
                <Megaphone size={13} color="var(--pu)"/>
                <p style={{ fontSize:12,fontWeight:700,color:"var(--pu)",textTransform:"uppercase",letterSpacing:"0.8px" }}>Send Announcement</p>
              </div>
              <input value={broadcastTitle} onChange={e => setBroadcastTitle(e.target.value)} placeholder="Title"
                style={{ width:"100%",background:"var(--s3)",border:"1.5px solid var(--b2)",borderRadius:8,padding:"8px 12px",color:"var(--t1)",fontFamily:"var(--fn)",fontSize:13,outline:"none",marginBottom:8,boxSizing:"border-box" }}/>
              <textarea value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)} placeholder="Message..."
                style={{ width:"100%",minHeight:60,background:"var(--s3)",border:"1.5px solid var(--b2)",borderRadius:8,padding:"8px 12px",color:"var(--t1)",fontFamily:"var(--fn)",fontSize:13,outline:"none",resize:"none",boxSizing:"border-box",marginBottom:8 }}/>
              <div style={{ display:"flex",gap:8 }}>
                <select value={broadcastTarget} onChange={e => setBroadcastTarget(e.target.value)}
                  style={{ flex:1,background:"var(--s3)",border:"1.5px solid var(--b2)",borderRadius:8,padding:"7px 10px",color:"var(--t1)",fontFamily:"var(--fn)",fontSize:13,outline:"none" }}>
                  <option value="all">Everyone</option>
                  <option value="student">Students only</option>
                  <option value="manager">Managers only</option>
                </select>
                <button onClick={handleBroadcast} disabled={sending || !broadcastTitle || !broadcastMsg}
                  style={{ flex:2,background:"linear-gradient(135deg,#9b3fa8,#e05c8a)",border:"none",borderRadius:8,padding:"7px 14px",color:"#fff",fontFamily:"var(--fn)",fontWeight:700,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,opacity:sending||!broadcastTitle||!broadcastMsg?0.6:1 }}>
                  {sent ? <><CheckCircle2 size={13}/>Sent!</> : <><Send size={13}/>{sending?"Sending...":"Send"}</>}
                </button>
              </div>
            </div>
          )}

          {/* Notifications list */}
          <div style={{ flex:1,overflowY:"auto",padding:"12px 18px",display:"flex",flexDirection:"column",gap:8 }}>
            {notifList.length === 0 ? (
              <div style={{ textAlign:"center",padding:"40px 20px" }}>
                <Bell size={32} color="var(--t3)" style={{ margin:"0 auto 12px",display:"block" }}/>
                <p style={{ color:"var(--t3)",fontSize:13 }}>No notifications yet</p>
              </div>
            ) : notifList.map((n, i) => {
              const { icon, color } = typeIcon(n.type);
              return (
                <motion.div key={n.id || i}
                  initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }} transition={{ delay:i*0.03 }}
                  onClick={() => !n.read && markNotifRead(n.id)}
                  style={{ padding:"12px 14px",borderRadius:12,background:n.read?"var(--s1)":"rgba(155,63,168,0.05)",border:`1px solid ${n.read?"var(--b1)":"rgba(155,63,168,0.2)"}`,cursor:n.read?"default":"pointer",position:"relative" }}>
                  {!n.read && <div style={{ position:"absolute",top:10,right:10,width:7,height:7,borderRadius:"50%",background:"var(--pk)" }}/>}
                  <div style={{ display:"flex",gap:10,alignItems:"flex-start" }}>
                    <span style={{ fontSize:18,flexShrink:0 }}>{icon}</span>
                    <div style={{ flex:1,minWidth:0 }}>
                      <p style={{ fontWeight:700,fontSize:13,color:"var(--t1)",marginBottom:2 }}>{n.title}</p>
                      <p style={{ fontSize:12,color:"var(--t2)",lineHeight:1.4 }}>{n.message}</p>
                      <p style={{ fontSize:10,color:"var(--t3)",marginTop:4 }}>
                        {n.timestamp ? new Date(n.timestamp).toLocaleString("en-IN",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}) : "Just now"}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// ─── AUTH ───────────────────────────────────────────────────────────────────
const AuthScreen = () => {
  const { login, loading, apiError } = useContext(AppContext);
  const [showPass, setShowPass] = useState(false);
  const [form, setForm] = useState({ id: "", pass: "" });
  const [errors, setErrors] = useState({});
  const validate = () => {
    const e = {};
    if (!form.id) e.id = "Required";
    else if (!form.id.includes("@")) e.id = "Enter a valid institutional email";
    if (!form.pass || form.pass.length < 4) e.pass = "Min 4 characters";
    return e;
  };
  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    await login(form);
  };
  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:"24px",background:"linear-gradient(160deg,#fdf4ff 0%,#fff5f8 50%,#fffbf0 100%)"}}>
      <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{duration:0.4}} style={{width:"100%",maxWidth:380}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <img src="/logo.png" alt="LumiLuna" style={{width:72,height:72,borderRadius:16,objectFit:"cover",margin:"0 auto 12px",display:"block",boxShadow:"0 8px 24px rgba(155,63,168,0.2)"}} />
          <h1 style={{fontSize:26,fontWeight:900,color:"var(--t1)",letterSpacing:"-0.5px"}}>LumiLuna</h1>
          <p style={{color:"var(--t3)",fontSize:13,marginTop:4}}>Smart Breakfast Automation System</p>
        </div>
        <div className="card-strong" style={{boxShadow:"0 8px 40px rgba(155,63,168,0.1)"}}>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div>
              <label style={{fontSize:12,color:"var(--t2)",fontWeight:600,display:"block",marginBottom:6}}>Institutional Mail ID</label>
              <input className="inp" type="email" placeholder="yourname@college.edu" value={form.id}
                onChange={e => { setForm(f => ({...f,id:e.target.value})); setErrors({}); }}
                onKeyDown={e => e.key==="Enter" && handleSubmit()} />
              {errors.id && <p style={{color:"var(--dn)",fontSize:12,marginTop:4}}>{errors.id}</p>}
            </div>
            <div>
              <label style={{fontSize:12,color:"var(--t2)",fontWeight:600,display:"block",marginBottom:6}}>Register Number</label>
              <div style={{position:"relative"}}>
                <input className="inp" type={showPass?"text":"password"} placeholder="e.g. URK25CS1195"
                  style={{paddingRight:42}} value={form.pass}
                  onChange={e => { setForm(f => ({...f,pass:e.target.value})); setErrors({}); }}
                  onKeyDown={e => e.key==="Enter" && handleSubmit()} />
                <button onClick={() => setShowPass(s=>!s)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"var(--t3)"}}>
                  {showPass ? <EyeOff size={15}/> : <Eye size={15}/>}
                </button>
              </div>
              {errors.pass && <p style={{color:"var(--dn)",fontSize:12,marginTop:4}}>{errors.pass}</p>}
            </div>
            {apiError && <div style={{background:"rgba(220,38,38,0.06)",border:"1px solid rgba(220,38,38,0.2)",borderRadius:10,padding:"10px 12px",color:"var(--dn)",fontSize:13}}>{apiError}</div>}
            <button className="btn-p" onClick={handleSubmit} disabled={loading} style={{marginTop:4,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
              {loading ? <motion.div animate={{rotate:360}} transition={{repeat:Infinity,duration:0.7,ease:"linear"}} style={{width:16,height:16,border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"#fff",borderRadius:"50%"}}/> : <><span>Sign In</span><ArrowRight size={15}/></>}
            </button>
          </div>
          <p style={{textAlign:"center",marginTop:16,fontSize:11,color:"var(--t3)"}}>Contact your mess manager if you need access</p>
        </div>
      </motion.div>
    </div>
  );
};

// ─── DIET SELECTION ─────────────────────────────────────────────────────────
const DietSelectionScreen = () => {
  const { chooseDiet, user } = useContext(AppContext);
  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:"24px",background:"linear-gradient(160deg,#fdf4ff 0%,#fff5f8 50%,#fffbf0 100%)"}}>
      <div style={{width:"100%",maxWidth:400,textAlign:"center"}}>
        <div style={{width:64,height:64,borderRadius:20,background:"linear-gradient(135deg,#9b3fa8,#e05c8a)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",boxShadow:"0 8px 24px rgba(155,63,168,0.25)"}}>
          <Coffee size={28} color="#fff"/>
        </div>
        <h2 style={{fontSize:24,fontWeight:900,color:"var(--t1)",letterSpacing:"-0.5px",marginBottom:8}}>Welcome, {user?.name?.split(" ")[0]}!</h2>
        <p style={{fontSize:14,color:"var(--t2)",marginBottom:32,lineHeight:1.6}}>Choose your dietary preference for this week's breakfast. <strong>This cannot be changed once you begin selecting.</strong></p>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <motion.button whileHover={{scale:1.03,y:-2}} whileTap={{scale:0.97}} onClick={()=>chooseDiet("veg")}
            style={{padding:"20px 24px",borderRadius:16,border:"2px solid rgba(22,163,74,0.3)",background:"rgba(22,163,74,0.06)",cursor:"pointer",fontFamily:"var(--fn)",textAlign:"left",display:"flex",alignItems:"center",gap:16}}>
            <div style={{width:48,height:48,borderRadius:14,background:"rgba(22,163,74,0.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0}}>🥦</div>
            <div>
              <p style={{fontWeight:800,fontSize:16,color:"#15803d",marginBottom:3}}>Vegetarian</p>
              <p style={{fontSize:12,color:"var(--t3)"}}>Only vegetarian breakfast options</p>
            </div>
          </motion.button>
          <motion.button whileHover={{scale:1.03,y:-2}} whileTap={{scale:0.97}} onClick={()=>chooseDiet("nonVeg")}
            style={{padding:"20px 24px",borderRadius:16,border:"2px solid rgba(234,88,12,0.3)",background:"rgba(234,88,12,0.06)",cursor:"pointer",fontFamily:"var(--fn)",textAlign:"left",display:"flex",alignItems:"center",gap:16}}>
            <div style={{width:48,height:48,borderRadius:14,background:"rgba(234,88,12,0.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0}}>🍗</div>
            <div>
              <p style={{fontWeight:800,fontSize:16,color:"#c2410c",marginBottom:3}}>Non-Vegetarian</p>
              <p style={{fontSize:12,color:"var(--t3)"}}>Both veg and non-veg breakfast options</p>
            </div>
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

// ─── HEADER & NAV ────────────────────────────────────────────────────────────
const Header = () => {
  const { user, logout, unreadCount, setNotifPanelOpen } = useContext(AppContext);
  return (
    <div style={{position:"sticky",top:0,zIndex:100,padding:"12px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",background:"rgba(255,255,255,0.92)",backdropFilter:"blur(12px)",borderBottom:"1px solid rgba(155,63,168,0.1)",boxShadow:"0 2px 12px rgba(155,63,168,0.06)"}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <img src="/logo.png" alt="LumiLuna" style={{width:34,height:34,borderRadius:8,objectFit:"cover"}} />
        <div>
          <span style={{fontWeight:900,fontSize:16,color:"var(--t1)",letterSpacing:"-0.3px"}}>LumiLuna</span>
          <p style={{fontSize:9,color:"var(--t3)",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.8px"}}>Smart Breakfast System</p>
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        {/* Notification bell */}
        <button onClick={() => setNotifPanelOpen(true)}
          style={{position:"relative",background:"var(--s2)",border:"1px solid var(--b1)",borderRadius:50,width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
          <Bell size={16} color="var(--t2)"/>
          {unreadCount > 0 && (
            <motion.div initial={{scale:0}} animate={{scale:1}}
              style={{position:"absolute",top:-3,right:-3,minWidth:16,height:16,borderRadius:50,background:"linear-gradient(135deg,#e05c8a,#f4845f)",fontSize:9,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,padding:"0 4px"}}>
              {unreadCount > 9 ? "9+" : unreadCount}
            </motion.div>
          )}
        </button>
        <div style={{display:"flex",alignItems:"center",gap:7,padding:"5px 10px",borderRadius:50,background:"var(--s2)",border:"1px solid var(--b1)"}}>
          <div style={{width:26,height:26,borderRadius:"50%",background:"linear-gradient(135deg,#9b3fa8,#e05c8a)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:"#fff"}}>{user?.avatar}</div>
          <span style={{fontSize:13,fontWeight:600,color:"var(--t2)"}}>{user?.name?.split(" ")[0]}</span>
        </div>
        <button onClick={logout} style={{background:"none",border:"1px solid rgba(220,38,38,0.2)",borderRadius:50,padding:"6px 14px",cursor:"pointer",color:"var(--dn)",fontSize:12,fontFamily:"var(--fn)",fontWeight:600,display:"flex",alignItems:"center",gap:4}}>
          <LogOut size={13}/> Sign Out
        </button>
      </div>
    </div>
  );
};

const BottomNav = ({ tabs }) => {
  const { activeTab, setActiveTab } = useContext(AppContext);
  return (
    <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:100,padding:"8px 8px 20px",display:"flex",justifyContent:"space-around",background:"rgba(255,255,255,0.95)",backdropFilter:"blur(12px)",borderTop:"1px solid rgba(155,63,168,0.1)",boxShadow:"0 -4px 20px rgba(155,63,168,0.08)"}}>
      {tabs.map(({ id, label, icon: Icon }) => (
        <button key={id} className={`nav-item ${activeTab===id?"active":""}`} onClick={() => setActiveTab(id)}>
          <Icon size={19}/><span>{label}</span>
        </button>
      ))}
    </div>
  );
};

// ─── STUDENT DASHBOARD ───────────────────────────────────────────────────────
const StudentDashboard = () => {
  const { preferences, leaveDates, user, menu, weekDiet, setActiveTab } = useContext(AppContext);
  const diet = weekDiet || "veg";
  const total = Object.keys(preferences).length;
  const collected = Object.values(preferences).filter(p => p.collected).length;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  const todayAbbr = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][new Date().getDay()];
  const pct = Math.min((total / 7) * 100, 100);
  const todayPref = preferences[todayAbbr];
  const todayMenu = menu[todayAbbr]?.Breakfast;
  const todayOptions = todayMenu?.[diet] || [];
  const todayItem = todayPref ? todayOptions[todayPref.choiceIndex] : null;
  const todaySlot = menu[todayAbbr]?.slots?.[diet];

  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} style={{padding:"20px 16px 100px"}}>
      {/* Greeting + progress */}
      <div style={{marginBottom:20,padding:"20px 22px",borderRadius:20,background:"linear-gradient(135deg,rgba(155,63,168,0.07),rgba(224,92,138,0.05),rgba(249,178,52,0.03))",border:"1px solid rgba(224,92,138,0.12)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
          <div>
            <p style={{fontSize:12,fontWeight:600,color:"var(--am)",marginBottom:3}}>{greeting}</p>
            <h2 style={{fontSize:22,fontWeight:900,color:"var(--t1)",letterSpacing:"-0.5px"}}>{user?.name?.split(" ")[0]}</h2>
          </div>
          <div style={{textAlign:"right"}}>
            <p style={{fontSize:11,color:"var(--t3)",marginBottom:2}}>This week</p>
            <p style={{fontSize:20,fontWeight:900,background:"linear-gradient(135deg,#9b3fa8,#e05c8a,#f9b234)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{total}<span style={{fontSize:13,fontWeight:600}}>/7</span></p>
          </div>
        </div>
        <div className="pt" style={{marginBottom:6}}><motion.div className="pb" initial={{width:0}} animate={{width:`${pct}%`}} transition={{duration:1.2,delay:0.3}}/></div>
        <div style={{display:"flex",justifyContent:"space-between"}}>
          <p style={{fontSize:11,color:"var(--t3)"}}>Breakfasts selected</p>
          {total===7 ? <p style={{fontSize:11,color:"var(--vg)",fontWeight:700}}>All 7 days set ✓</p> : <p style={{fontSize:11,color:"var(--t3)"}}>{7-total} days remaining</p>}
        </div>
      </div>

      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:20}}>
        {[
          {label:"Selected",value:total,icon:"🍳",color:"#9b3fa8"},
          {label:"Collected",value:collected,icon:"✅",color:"#16a34a"},
          {label:"Diet",value:diet==="veg"?"Veg":"Non-Veg",icon:diet==="veg"?"🥦":"🍗",color:diet==="veg"?"#15803d":"#c2410c"},
        ].map((s,i) => (
          <motion.div key={i} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:0.1+i*0.07}}
            style={{background:"var(--s1)",borderRadius:14,padding:"14px 12px",border:"1px solid var(--b1)",textAlign:"center"}}>
            <span style={{fontSize:20,display:"block",marginBottom:6}}>{s.icon}</span>
            <p style={{fontSize:18,fontWeight:900,color:s.color,letterSpacing:"-0.5px",marginBottom:2}}>{s.value}</p>
            <p style={{fontSize:10,color:"var(--t3)",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.5px"}}>{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Today's breakfast card */}
      <div style={{marginBottom:20,background:"var(--s1)",borderRadius:16,border:"1px solid var(--b1)",overflow:"hidden"}}>
        <div style={{padding:"14px 18px",borderBottom:"1px solid var(--b1)",display:"flex",justifyContent:"space-between",alignItems:"center",background:"rgba(249,178,52,0.05)"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <Coffee size={18} color="#f9b234"/>
            <p style={{fontSize:14,fontWeight:800,color:"var(--t1)"}}>Today's Breakfast — {todayAbbr}</p>
          </div>
          <button onClick={()=>setActiveTab("meals")} style={{background:"linear-gradient(135deg,#9b3fa8,#e05c8a)",border:"none",borderRadius:50,padding:"5px 14px",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"var(--fn)"}}>
            {todayPref ? "Change" : "Select"}
          </button>
        </div>
        <div style={{padding:"16px 18px"}}>
          {todayItem ? (
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div>
                <p style={{fontSize:16,fontWeight:800,color:"var(--t1)",marginBottom:4}}>{todayItem}</p>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <span style={{fontSize:11,background:diet==="veg"?"rgba(22,163,74,0.1)":"rgba(234,88,12,0.1)",color:diet==="veg"?"#15803d":"#c2410c",padding:"2px 10px",borderRadius:50,fontWeight:700}}>{diet==="veg"?"Veg":"Non-Veg"}</span>
                  {todaySlot && <span className="slot-badge"><Cpu size={10}/>Slot {todaySlot}</span>}
                </div>
              </div>
              {todayPref?.collected
                ? <div style={{textAlign:"center"}}><CheckCircle2 size={28} color="#16a34a"/><p style={{fontSize:10,color:"#16a34a",fontWeight:700,marginTop:2}}>Collected</p></div>
                : <div style={{textAlign:"center"}}><Coffee size={28} color="#f9b234"/><p style={{fontSize:10,color:"var(--wn)",fontWeight:700,marginTop:2}}>Ready</p></div>
              }
            </div>
          ) : (
            <p style={{color:"var(--t3)",fontSize:13}}>No breakfast selected for today. Tap Select above.</p>
          )}
        </div>
      </div>

      {/* Weekly grid */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <p style={{fontSize:12,fontWeight:700,color:"var(--t2)",textTransform:"uppercase",letterSpacing:"0.8px"}}>Weekly Breakfast Plan</p>
        <p style={{fontSize:11,color:"var(--t3)"}}>Tap to manage</p>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:6}}>
        {DAYS.map(day => {
          const pref = preferences[day];
          const done = !!pref;
          const isToday = day === todayAbbr;
          const dayOpts = menu[day]?.Breakfast?.[diet] || [];
          const itemName = pref ? dayOpts[pref.choiceIndex] : null;
          return (
            <motion.div key={day} className={`day-card ${done?"done":""}`}
              whileHover={{y:-3}} whileTap={{scale:0.95}} onClick={()=>setActiveTab("meals")}>
              {isToday && <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,#9b3fa8,#e05c8a,#f9b234)"}}/>}
              <p style={{fontSize:9,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.5px",color:isToday?"var(--pk)":done?"var(--am)":"var(--t3)",marginBottom:4}}>{day}</p>
              <div style={{fontSize:18,marginBottom:4}}>{done ? (pref.collected ? "✅" : "☕") : "—"}</div>
              {done && itemName && <p style={{fontSize:8,color:"var(--t2)",fontWeight:600,lineHeight:1.2,wordBreak:"break-word"}}>{itemName.split(" ")[0]}</p>}
              {!done && <p style={{fontSize:9,color:"var(--t3)"}}>No pick</p>}
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};

// ─── MEAL SELECTION (Breakfast only) ────────────────────────────────────────
const BreakfastSelection = () => {
  const { preferences, setPreference, menu, weekDiet } = useContext(AppContext);
  const [selectedDay, setSelectedDay] = useState("Mon");
  const diet = weekDiet || "veg";
  const dayMenu = menu[selectedDay]?.Breakfast;
  const options = dayMenu?.[diet] || [];
  const pref = preferences[selectedDay];
  const sel = pref?.choiceIndex;
  const isDone = sel !== undefined;
  const slot = menu[selectedDay]?.slots?.[diet];

  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} style={{padding:"20px 16px 100px"}}>
      <p style={{fontSize:12,fontWeight:700,color:"var(--pk)",textTransform:"uppercase",letterSpacing:"1px",marginBottom:4}}>Breakfast Selection</p>
      <h2 style={{fontSize:22,fontWeight:900,color:"var(--t1)",marginBottom:16,letterSpacing:"-0.5px"}}>Choose Your Breakfast</h2>

      {/* Diet badge */}
      <div style={{padding:"12px 16px",borderRadius:12,marginBottom:20,background:diet==="veg"?"rgba(22,163,74,0.08)":"rgba(234,88,12,0.08)",border:`1px solid ${diet==="veg"?"rgba(22,163,74,0.2)":"rgba(234,88,12,0.2)"}`,display:"flex",alignItems:"center",gap:12}}>
        <span style={{fontSize:22}}>{diet==="veg"?"🥦":"🍗"}</span>
        <div style={{flex:1}}>
          <p style={{fontWeight:700,fontSize:13,color:diet==="veg"?"#15803d":"#c2410c"}}>{diet==="veg"?"Vegetarian":"Non-Vegetarian"} — Week preference 🔒</p>
          <p style={{fontSize:11,color:"var(--t3)"}}>Showing {diet==="veg"?"vegetarian":"non-vegetarian"} breakfast options</p>
        </div>
      </div>

      {/* Day selector */}
      <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:8,marginBottom:22}}>
        {DAYS.map(day => {
          const hasSel = !!preferences[day];
          const isActive = selectedDay === day;
          return (
            <button key={day} onClick={() => setSelectedDay(day)}
              style={{flex:"0 0 auto",padding:"9px 18px",borderRadius:50,border:"none",cursor:"pointer",fontFamily:"var(--fn)",fontWeight:700,fontSize:13,transition:"all 0.2s",position:"relative",
                background:isActive?"linear-gradient(135deg,#9b3fa8,#e05c8a)":"var(--s3)",
                color:isActive?"#fff":"var(--t3)",
                boxShadow:isActive?"0 4px 16px rgba(155,63,168,0.3)":"none"}}>
              {day}
              {hasSel && !isActive && <div style={{position:"absolute",top:3,right:3,width:6,height:6,borderRadius:"50%",background:"var(--vg)"}}/>}
            </button>
          );
        })}
      </div>

      {/* Breakfast card */}
      <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}}
        style={{background:"rgba(249,178,52,0.06)",borderRadius:20,overflow:"hidden",border:"1px solid rgba(249,178,52,0.2)",boxShadow:"0 4px 16px rgba(249,178,52,0.08)"}}>
        <div style={{padding:"16px 20px",display:"flex",alignItems:"center",gap:14,borderBottom:"1px solid rgba(249,178,52,0.15)",background:"rgba(249,178,52,0.04)"}}>
          <div style={{width:48,height:48,borderRadius:14,background:"rgba(249,178,52,0.15)",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <Coffee size={22} color="#f9b234"/>
          </div>
          <div style={{flex:1}}>
            <p style={{fontWeight:800,fontSize:17,color:"var(--t1)",marginBottom:2}}>Breakfast</p>
            <p style={{fontSize:11,color:"var(--t3)"}}>7:00 AM – 9:00 AM</p>
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
            {isDone
              ? <motion.div initial={{scale:0}} animate={{scale:1}} className="check-anim" style={{background:"linear-gradient(135deg,#f9b234,#f4845f)",borderRadius:50,padding:"5px 14px",fontSize:12,color:"#fff",fontWeight:700}}>Selected ✓</motion.div>
              : <div style={{background:"rgba(220,38,38,0.06)",border:"1px solid rgba(220,38,38,0.15)",borderRadius:50,padding:"5px 14px",fontSize:12,color:"var(--dn)",fontWeight:600}}>Not set</div>
            }
            {slot && <span className="slot-badge"><Cpu size={10}/>Slot {slot}</span>}
          </div>
        </div>
        <div style={{padding:"16px 20px",display:"flex",flexWrap:"wrap",gap:10}}>
          {options.length === 0
            ? <p style={{color:"var(--t3)",fontSize:13}}>No breakfast options set for this day yet.</p>
            : options.map((opt, oi) => {
                const isSelected = sel === oi;
                return (
                  <motion.button key={oi} whileHover={{scale:1.05,y:-2}} whileTap={{scale:0.96}}
                    className={`meal-opt ${isSelected?"sel":""}`}
                    onClick={() => setPreference(selectedDay, oi, diet)}>
                    {isSelected && <CheckCircle2 size={13} style={{marginRight:4}}/>}{opt}
                  </motion.button>
                );
              })
          }
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─── LEAVE CALENDAR ──────────────────────────────────────────────────────────
const LeaveCalendar = () => {
  const { leaveDates, toggleLeave } = useContext(AppContext);
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const mNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const dim = getDIM(viewYear,viewMonth);
  const fd  = getFD(viewYear,viewMonth);
  const mkD = d => `${viewYear}-${String(viewMonth+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  const nav = dir => { let m=viewMonth+dir,y=viewYear; if(m<0){m=11;y--;}else if(m>11){m=0;y++;} setViewMonth(m);setViewYear(y); };

  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} style={{padding:"20px 16px 100px"}}>
      <p style={{fontSize:12,fontWeight:700,color:"var(--pk)",textTransform:"uppercase",letterSpacing:"1px",marginBottom:4}}>Leave Calendar</p>
      <h2 style={{fontSize:22,fontWeight:900,color:"var(--t1)",marginBottom:4,letterSpacing:"-0.5px"}}>Mark Absences</h2>
      <p style={{color:"var(--t3)",fontSize:13,marginBottom:18}}>Tap a date to mark / unmark leave. No breakfast will be assigned on leave days.</p>
      {leaveDates.length > 0 && <div style={{marginBottom:14,padding:"10px 14px",borderRadius:50,background:"rgba(220,38,38,0.06)",border:"1px solid rgba(220,38,38,0.15)",display:"inline-flex",alignItems:"center",gap:8}}><AlertCircle size={14} color="var(--dn)"/><span style={{fontSize:13,color:"var(--dn)",fontWeight:600}}>{leaveDates.length} leave day{leaveDates.length>1?"s":""} marked</span></div>}
      <div style={{background:"var(--s1)",borderRadius:20,overflow:"hidden",border:"1px solid var(--b1)",boxShadow:"0 4px 20px rgba(155,63,168,0.08)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 18px",borderBottom:"1px solid var(--b1)"}}>
          <button onClick={()=>nav(-1)} style={{background:"var(--s3)",border:"1px solid var(--b1)",borderRadius:50,width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"var(--t2)"}}><ChevronLeft size={15}/></button>
          <div style={{textAlign:"center"}}><p style={{fontSize:11,color:"var(--pu)",fontWeight:700}}>{viewYear}</p><p style={{fontSize:17,fontWeight:800,color:"var(--t1)"}}>{mNames[viewMonth]}</p></div>
          <button onClick={()=>nav(1)} style={{background:"var(--s3)",border:"1px solid var(--b1)",borderRadius:50,width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"var(--t2)"}}><ChevronRight size={15}/></button>
        </div>
        <div style={{padding:"14px 16px"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4,marginBottom:6}}>
            {["Su","Mo","Tu","We","Th","Fr","Sa"].map((d,i)=><div key={i} style={{textAlign:"center",fontSize:10,color:i===0||i===6?"var(--pk)":"var(--t3)",fontWeight:700,padding:"3px 0"}}>{d}</div>)}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4}}>
            {Array(fd).fill(null).map((_,i)=><div key={`e${i}`}/>)}
            {Array(dim).fill(null).map((_,i)=>{
              const d=i+1,ds=mkD(d);
              const isL=leaveDates.includes(ds),isT=d===today.getDate()&&viewMonth===today.getMonth()&&viewYear===today.getFullYear();
              const isP=new Date(viewYear,viewMonth,d)<new Date(today.toDateString());
              return <motion.button key={d} whileTap={{scale:0.85}} onClick={()=>!isP&&toggleLeave(ds)}
                style={{aspectRatio:"1",borderRadius:50,border:"none",fontFamily:"var(--fn)",fontSize:13,fontWeight:isT||isL?700:400,cursor:isP?"default":"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.12s",opacity:isP?0.3:1,
                  background:isL?"linear-gradient(135deg,#e05c8a,#f4845f)":isT?"linear-gradient(135deg,#9b3fa8,#e05c8a)":"transparent",
                  color:isL||isT?"#fff":"var(--t1)",
                  boxShadow:isT&&!isL?"0 0 0 2px var(--pk)":"none"}}>{d}</motion.button>;
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// ─── FEEDBACK (Student) ──────────────────────────────────────────────────────
const FeedbackPage = () => {
  const [meal, setMeal] = useState("Breakfast");
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const handleSubmit = async () => {
    if (!rating) { setError("Please select a rating"); return; }
    setSubmitting(true); setError("");
    try {
      await api.submitFeedback(meal, rating, comment);
      setSubmitted(true); setRating(0); setComment(""); setMeal("Breakfast");
      setTimeout(() => setSubmitted(false), 3000);
    } catch (e) { setError(e.message); } finally { setSubmitting(false); }
  };
  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} style={{padding:"20px 16px 100px"}}>
      <p style={{fontSize:12,fontWeight:700,color:"var(--pk)",textTransform:"uppercase",letterSpacing:"1px",marginBottom:4}}>Feedback</p>
      <h2 style={{fontSize:22,fontWeight:900,color:"var(--t1)",marginBottom:4,letterSpacing:"-0.5px"}}>Rate Your Breakfast</h2>
      <p style={{color:"var(--t3)",fontSize:13,marginBottom:20}}>Help us improve the breakfast quality and vending experience</p>
      <div className="card-strong" style={{marginBottom:16}}>
        <p style={{fontSize:12,fontWeight:700,color:"var(--t2)",marginBottom:10,textTransform:"uppercase",letterSpacing:"0.8px"}}>Category</p>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:20}}>
          {["Breakfast","General"].map(m => (
            <button key={m} onClick={() => setMeal(m)}
              style={{padding:"8px 18px",borderRadius:50,border:"none",cursor:"pointer",fontFamily:"var(--fn)",fontWeight:700,fontSize:13,transition:"all 0.2s",
                background:meal===m?"linear-gradient(135deg,#f9b234,#f4845f)":"var(--s3)",
                color:meal===m?"#fff":"var(--t3)",boxShadow:meal===m?"0 4px 14px rgba(249,178,52,0.4)":"none"}}>{m}</button>
          ))}
        </div>
        <p style={{fontSize:12,fontWeight:700,color:"var(--t2)",marginBottom:10,textTransform:"uppercase",letterSpacing:"0.8px"}}>Rating</p>
        <div style={{display:"flex",gap:8,marginBottom:20}}>
          {[1,2,3,4,5].map(s => (
            <button key={s} onClick={() => setRating(s)} onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(0)}
              style={{background:"none",border:"none",cursor:"pointer",padding:4,transition:"transform 0.15s",transform:(hover||rating)>=s?"scale(1.2)":"scale(1)"}}>
              <Star size={32} fill={(hover||rating)>=s?"#f9b234":"none"} color={(hover||rating)>=s?"#f9b234":"var(--t3)"}/>
            </button>
          ))}
          {rating > 0 && <span style={{fontSize:13,color:"var(--t3)",alignSelf:"center",marginLeft:4}}>{["","Poor","Fair","Good","Great","Excellent"][rating]}</span>}
        </div>
        <p style={{fontSize:12,fontWeight:700,color:"var(--t2)",marginBottom:8,textTransform:"uppercase",letterSpacing:"0.8px"}}>Comment (optional)</p>
        <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Tell us what you think about today's breakfast..." maxLength={500}
          style={{width:"100%",minHeight:90,background:"var(--s3)",border:"1.5px solid var(--b2)",borderRadius:12,padding:"12px 14px",color:"var(--t1)",fontFamily:"var(--fn)",fontSize:14,outline:"none",resize:"vertical",boxSizing:"border-box"}}/>
        <p style={{fontSize:11,color:"var(--t3)",textAlign:"right",marginTop:4}}>{comment.length}/500</p>
        {error && <p style={{color:"var(--dn)",fontSize:13,marginBottom:8}}>{error}</p>}
        {submitted && (
          <motion.div initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}} style={{background:"rgba(22,163,74,0.08)",border:"1px solid rgba(22,163,74,0.2)",borderRadius:12,padding:"12px 16px",marginBottom:12,display:"flex",alignItems:"center",gap:10}}>
            <ThumbsUp size={16} color="#15803d"/>
            <p style={{fontSize:13,color:"#15803d",fontWeight:600}}>Thanks for your feedback!</p>
          </motion.div>
        )}
        <button className="btn-p" onClick={handleSubmit} disabled={submitting} style={{marginTop:8,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          {submitting ? <motion.div animate={{rotate:360}} transition={{repeat:Infinity,duration:0.7,ease:"linear"}} style={{width:16,height:16,border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"#fff",borderRadius:"50%"}}/> : <><Send size={14}/><span>Submit Feedback</span></>}
        </button>
      </div>
    </motion.div>
  );
};

// ─── MANAGER DASHBOARD ───────────────────────────────────────────────────────
const ManagerDashboard = () => {
  const [stats, setStats] = useState({totalStudents:0,onLeaveToday:0,responded:0,pending:0,collectedToday:0,selectedToday:0,pendingCollection:0});
  const [analyticsData, setAnalyticsData] = useState({});
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const load = () => Promise.all([api.getStats(), api.getAnalytics()])
      .then(([s,a]) => { setStats(s); setAnalyticsData(a); })
      .catch(console.error).finally(() => setLoading(false));
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, []);
  const IST_OFFSET = 5.5*60*60*1000;
  const todayKey = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][new Date(Date.now()+IST_OFFSET).getUTCDay()];
  const todayData = analyticsData[todayKey] || {};
  const rPct = stats.totalStudents > 0 ? Math.round((stats.responded/stats.totalStudents)*100) : 0;
  const cPct = stats.selectedToday > 0 ? Math.round((stats.collectedToday/stats.selectedToday)*100) : 0;
  const cards = [
    {label:"Total Students",value:stats.totalStudents,icon:Users,color:"#9b3fa8"},
    {label:"Selected Breakfast",value:stats.responded,icon:Coffee,color:"#e05c8a"},
    {label:"Collected Today",value:stats.collectedToday,icon:CheckCircle2,color:"#16a34a"},
    {label:"Pending Collection",value:stats.pendingCollection,icon:Clock,color:"#f4845f"},
  ];

  // Today's top items
  const topItems = [];
  ["veg","nonVeg"].forEach(diet => {
    const items = todayData[diet] || {};
    Object.entries(items).forEach(([item,cnt]) => topItems.push({item,cnt,diet}));
  });
  topItems.sort((a,b) => b.cnt-a.cnt);

  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} style={{padding:"20px 16px 100px"}}>
      {/* Header banner */}
      <div style={{background:"linear-gradient(135deg,rgba(155,63,168,0.08),rgba(224,92,138,0.06),rgba(249,178,52,0.04))",border:"1px solid rgba(224,92,138,0.15)",borderRadius:20,padding:"20px",marginBottom:20}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
          <Cpu size={16} color="var(--pk)"/>
          <p style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:"var(--pk)"}}>Live Overview</p>
        </div>
        <h2 style={{fontSize:22,fontWeight:900,color:"var(--t1)",letterSpacing:"-0.5px",marginBottom:14}}>Smart Breakfast Dashboard</h2>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div>
            <p style={{fontSize:11,color:"var(--t3)",marginBottom:4}}>Selection rate</p>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
              <span style={{fontSize:18,fontWeight:900,background:"linear-gradient(135deg,#9b3fa8,#e05c8a)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{rPct}%</span>
              <span style={{fontSize:12,color:"var(--t3)"}}>({stats.responded}/{stats.totalStudents})</span>
            </div>
            <div className="pt"><motion.div className="pb" initial={{width:0}} animate={{width:`${rPct}%`}} transition={{duration:1,delay:0.2}}/></div>
          </div>
          <div>
            <p style={{fontSize:11,color:"var(--t3)",marginBottom:4}}>Today collection</p>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
              <span style={{fontSize:18,fontWeight:900,color:"#16a34a"}}>{cPct}%</span>
              <span style={{fontSize:12,color:"var(--t3)"}}>({stats.collectedToday}/{stats.selectedToday})</span>
            </div>
            <div className="pt"><motion.div className="pb" initial={{width:0}} animate={{width:`${cPct}%`}} transition={{duration:1,delay:0.3}} style={{background:"linear-gradient(90deg,#16a34a,#15803d)"}}/></div>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
        {cards.map((s,i) => (
          <motion.div key={i} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:i*0.07}}
            style={{background:"var(--s1)",border:`1px solid ${s.color}20`,borderRadius:16,padding:"16px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div>
                <p style={{fontSize:11,color:"var(--t3)",fontWeight:600,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.8px"}}>{s.label}</p>
                <p style={{fontSize:30,fontWeight:900,color:s.color,letterSpacing:"-1.5px"}}>{loading?"—":s.value}</p>
              </div>
              <div style={{width:38,height:38,borderRadius:12,background:`${s.color}12`,display:"flex",alignItems:"center",justifyContent:"center"}}><s.icon size={19} color={s.color}/></div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Today's top breakfast picks */}
      <div style={{background:"var(--s1)",borderRadius:16,padding:"18px",border:"1px solid var(--b1)"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
          <TrendingUp size={15} color="var(--pk)"/>
          <p style={{fontSize:12,color:"var(--t3)",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.8px"}}>Today's Most Chosen — {todayKey}</p>
        </div>
        {loading ? <p style={{color:"var(--t3)",fontSize:13}}>Loading...</p>
          : topItems.length === 0 ? <p style={{color:"var(--t3)",fontSize:13}}>No breakfast selections for today yet.</p>
          : topItems.slice(0,5).map(({item,cnt,diet},i) => {
            const total = topItems.reduce((a,x) => a+x.cnt,0);
            const pct = total>0 ? Math.round((cnt/total)*100) : 0;
            const color = diet==="veg"?"#16a34a":"#ea580c";
            return (
              <div key={i} style={{marginBottom:i<topItems.length-1?14:0}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    {i===0 && <span style={{fontSize:12}}>🏆</span>}
                    <span style={{fontSize:13,fontWeight:i===0?700:500,color:"var(--t1)"}}>{item}</span>
                    <span style={{fontSize:10,background:diet==="veg"?"rgba(22,163,74,0.1)":"rgba(234,88,12,0.1)",color,padding:"2px 8px",borderRadius:50,fontWeight:700}}>{diet==="veg"?"Veg":"Non-Veg"}</span>
                  </div>
                  <span style={{fontSize:13,fontWeight:700,color}}>{cnt}</span>
                </div>
                <div className="pt"><motion.div className="pb" initial={{width:0}} animate={{width:`${pct}%`}} transition={{delay:i*0.08,duration:0.5}} style={{background:`linear-gradient(90deg,${color},#f9b234)`}}/></div>
              </div>
            );
          })
        }
        {/* Slot & stock info */}
        {analyticsData[todayKey] && (analyticsData[todayKey].slotVeg || analyticsData[todayKey].slotNonVeg) && (
          <div style={{marginTop:16,padding:"12px 14px",borderRadius:12,background:"rgba(26,10,46,0.04)",border:"1px solid rgba(155,63,168,0.1)",display:"flex",gap:16}}>
            {analyticsData[todayKey].slotVeg && <div style={{display:"flex",alignItems:"center",gap:6}}><span className="slot-badge"><Cpu size={10}/>Veg Slot {analyticsData[todayKey].slotVeg}</span></div>}
            {analyticsData[todayKey].slotNonVeg && <div style={{display:"flex",alignItems:"center",gap:6}}><span className="slot-badge"><Cpu size={10}/>Non-Veg Slot {analyticsData[todayKey].slotNonVeg}</span></div>}
          </div>
        )}
      </div>
    </motion.div>
  );
};

// ─── MENU BUILDER (Manager) ──────────────────────────────────────────────────
const MenuBuilder = () => {
  const { menu, setMenu, setMenuRaw } = useContext(AppContext);
  const [selectedDay, setSelectedDay] = useState("Mon");
  const [defaults, setDefaults] = useState({});
  const [slots, setSlots] = useState({});
  const [stock, setStock] = useState({});
  const [editing, setEditing] = useState(null);
  const [editVal, setEditVal] = useState("");
  const [savingSlot, setSavingSlot] = useState(false);
  const [slotInput, setSlotInput] = useState({veg:"",nonVeg:""});
  const [stockInput, setStockInput] = useState({veg:"",nonVeg:""});

  const loadMenu = () => {
    api.getMenu().then(freshMenu => {
      if (!Object.keys(freshMenu).length) return;
      const cleanMenu={}, d={}, sl={}, st={};
      Object.entries(freshMenu).forEach(([day,data]) => {
        const { defaults: defs, slots: sls, stock: stk, ...meals } = data;
        cleanMenu[day] = meals;
        d[day] = { veg: defs?.Breakfast?.veg ?? null, nonVeg: defs?.Breakfast?.nonVeg ?? null };
        sl[day] = { veg: sls?.veg ?? "", nonVeg: sls?.nonVeg ?? "" };
        st[day] = { veg: stk?.veg ?? 0, nonVeg: stk?.nonVeg ?? 0 };
      });
      setMenuRaw(prev => ({...prev,...cleanMenu}));
      setDefaults(d); setSlots(sl); setStock(st);
      setSlotInput(sl[selectedDay] || {veg:"",nonVeg:""});
      setStockInput(st[selectedDay] || {veg:0,nonVeg:0});
    }).catch(console.error);
  };

  useEffect(() => { loadMenu(); }, []);
  useEffect(() => {
    setSlotInput(slots[selectedDay] || {veg:"",nonVeg:""});
    setStockInput(stock[selectedDay] || {veg:0,nonVeg:0});
  }, [selectedDay, slots, stock]);

  const getOptions = (diet) => {
    const m = menu[selectedDay]?.Breakfast;
    if (!m) return [];
    return Array.isArray(m) ? m : (m[diet] || []);
  };
  const updateOptions = (diet, newArr) => {
    const current = menu[selectedDay]?.Breakfast || {veg:[],nonVeg:[]};
    setMenu(selectedDay, { ...current, [diet]: newArr });
  };
  const addOption = (diet) => updateOptions(diet, [...getOptions(diet), "New Item"]);
  const removeOption = (diet, idx) => updateOptions(diet, getOptions(diet).filter((_,i) => i!==idx));
  const handleEdit = (diet, idx, val) => { updateOptions(diet, getOptions(diet).map((o,i) => i===idx?val:o)); setEditing(null); };
  const setDefault = async (diet, idx) => {
    const cur = defaults[selectedDay]?.[diet];
    const nv = cur===idx ? null : idx;
    try { await api.setDefaultFood(selectedDay, diet, nv); loadMenu(); } catch(e) { console.error(e); }
  };
  const saveSlots = async () => {
    setSavingSlot(true);
    try {
      await api.setSlot(selectedDay, slotInput.veg ? parseInt(slotInput.veg) : null, slotInput.nonVeg ? parseInt(slotInput.nonVeg) : null);
      await api.setStock(selectedDay, parseInt(stockInput.veg)||0, parseInt(stockInput.nonVeg)||0);
      loadMenu();
    } catch(e) { console.error(e); } finally { setSavingSlot(false); }
  };

  const dietSections = [
    {id:"veg",    label:"Vegetarian",     color:"#16a34a", bg:"rgba(22,163,74,0.05)",   border:"rgba(22,163,74,0.2)"},
    {id:"nonVeg", label:"Non-Vegetarian", color:"#ea580c", bg:"rgba(234,88,12,0.05)",   border:"rgba(234,88,12,0.2)"},
  ];

  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} style={{padding:"20px 16px 100px"}}>
      <p style={{fontSize:12,fontWeight:700,color:"var(--pk)",textTransform:"uppercase",letterSpacing:"1px",marginBottom:4}}>Menu Builder</p>
      <h2 style={{fontSize:22,fontWeight:900,color:"var(--t1)",marginBottom:16,letterSpacing:"-0.5px"}}>Weekly Breakfast Menu</h2>

      {/* Day selector */}
      <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:8,marginBottom:20}}>
        {DAYS.map(day => (
          <button key={day} onClick={() => setSelectedDay(day)}
            style={{flex:"0 0 auto",padding:"9px 18px",borderRadius:50,border:"none",cursor:"pointer",fontFamily:"var(--fn)",fontWeight:700,fontSize:13,transition:"all 0.2s",
              background:selectedDay===day?"linear-gradient(135deg,#9b3fa8,#e05c8a)":"var(--s3)",
              color:selectedDay===day?"#fff":"var(--t3)",
              boxShadow:selectedDay===day?"0 4px 14px rgba(155,63,168,0.3)":"none"}}>{day}</button>
        ))}
      </div>

      {/* Slot & Stock config */}
      <div style={{background:"linear-gradient(135deg,rgba(26,10,46,0.04),rgba(155,63,168,0.04))",borderRadius:16,padding:"16px",marginBottom:20,border:"1px solid rgba(155,63,168,0.12)"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
          <Cpu size={15} color="var(--pu)"/>
          <p style={{fontWeight:800,fontSize:14,color:"var(--t1)"}}>Vending Machine Config — {selectedDay}</p>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
          {["veg","nonVeg"].map(diet => (
            <div key={diet}>
              <label style={{fontSize:11,color:"var(--t2)",fontWeight:700,display:"block",marginBottom:4,textTransform:"uppercase"}}>{diet==="veg"?"Veg":"Non-Veg"} Slot #</label>
              <input type="number" min="1" max="20" value={slotInput[diet]} placeholder="e.g. 1"
                onChange={e => setSlotInput(s => ({...s,[diet]:e.target.value}))}
                style={{width:"100%",background:"var(--s3)",border:"1.5px solid var(--b2)",borderRadius:8,padding:"8px 12px",color:"var(--t1)",fontFamily:"var(--fn)",fontSize:14,outline:"none"}}/>
            </div>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
          {["veg","nonVeg"].map(diet => (
            <div key={diet}>
              <label style={{fontSize:11,color:"var(--t2)",fontWeight:700,display:"block",marginBottom:4,textTransform:"uppercase"}}>{diet==="veg"?"Veg":"Non-Veg"} Stock</label>
              <input type="number" min="0" value={stockInput[diet]} placeholder="Qty"
                onChange={e => setStockInput(s => ({...s,[diet]:e.target.value}))}
                style={{width:"100%",background:"var(--s3)",border:"1.5px solid var(--b2)",borderRadius:8,padding:"8px 12px",color:"var(--t1)",fontFamily:"var(--fn)",fontSize:14,outline:"none"}}/>
            </div>
          ))}
        </div>
        <button onClick={saveSlots} disabled={savingSlot}
          style={{background:"linear-gradient(135deg,#1a0a2e,#3d1a5a)",border:"none",borderRadius:10,padding:"10px 20px",color:"#f9b234",fontFamily:"var(--fn)",fontWeight:700,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:6,width:"100%",justifyContent:"center"}}>
          <Zap size={13}/>{savingSlot?"Saving...":"Save Slot & Stock Config"}
        </button>
      </div>

      {/* Menu items */}
      <div style={{background:"var(--s1)",borderRadius:20,overflow:"hidden",border:"1px solid rgba(249,178,52,0.2)"}}>
        <div style={{padding:"14px 18px",display:"flex",alignItems:"center",gap:12,background:"rgba(249,178,52,0.06)",borderBottom:"1px solid rgba(249,178,52,0.15)"}}>
          <div style={{width:40,height:40,borderRadius:12,background:"rgba(249,178,52,0.15)",display:"flex",alignItems:"center",justifyContent:"center"}}><Coffee size={18} color="#f9b234"/></div>
          <h3 style={{fontWeight:800,fontSize:16,color:"var(--t1)",flex:1}}>Breakfast Items</h3>
        </div>
        <div style={{padding:"14px 18px",display:"flex",flexDirection:"column",gap:14}}>
          {dietSections.map(({id,label,color,bg,border}) => {
            const options = getOptions(id);
            return (
              <div key={id} style={{background:bg,borderRadius:14,border:`1px solid ${border}`,overflow:"hidden"}}>
                <div style={{padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:`1px solid ${border}`}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontWeight:700,fontSize:14,color}}>{label}</span>
                    <span style={{fontSize:11,color:"var(--t3)",background:"rgba(0,0,0,0.05)",padding:"2px 8px",borderRadius:50}}>{options.length} items</span>
                    {defaults[selectedDay]?.[id] != null && <span style={{fontSize:10,color,fontWeight:700,background:`${color}12`,padding:"2px 8px",borderRadius:50}}>Default set</span>}
                  </div>
                  <button onClick={() => addOption(id)} style={{background:color,border:"none",borderRadius:50,padding:"5px 14px",color:"#fff",cursor:"pointer",fontSize:12,fontFamily:"var(--fn)",fontWeight:700,display:"flex",alignItems:"center",gap:4}}>
                    <Plus size={11}/> Add
                  </button>
                </div>
                <div style={{padding:"10px 14px",display:"flex",flexDirection:"column",gap:8}}>
                  {options.length===0
                    ? <p style={{color:"var(--t3)",fontSize:13,fontStyle:"italic"}}>No items yet. Click Add to create one.</p>
                    : options.map((opt,oi) => {
                        const eKey=`${id}|${oi}`;
                        const isDef = defaults[selectedDay]?.[id] != null && Number(defaults[selectedDay]?.[id])===oi;
                        return (
                          <div key={oi} style={{display:"flex",alignItems:"center",gap:10,background:isDef?`${color}10`:"rgba(255,255,255,0.7)",borderRadius:10,padding:"9px 12px",border:`1px solid ${isDef?color+"30":"rgba(0,0,0,0.06)"}`}}>
                            <GripVertical size={13} color="var(--t3)" style={{cursor:"grab"}}/>
                            {editing===eKey
                              ? <input value={editVal} onChange={e => setEditVal(e.target.value)} onBlur={() => handleEdit(id,oi,editVal)} onKeyDown={e => e.key==="Enter"&&handleEdit(id,oi,editVal)} autoFocus style={{flex:1,background:"transparent",border:"none",color:"var(--t1)",fontFamily:"var(--fn)",fontSize:14,outline:"none"}}/>
                              : <span style={{flex:1,fontSize:14,color:"var(--t1)",fontWeight:500}}>{opt}</span>
                            }
                            <button onClick={() => setDefault(id,oi)} title={isDef?"Remove default":"Set as default"}
                              style={{background:isDef?`${color}15`:"none",border:isDef?`1px solid ${color}30`:"none",borderRadius:50,cursor:"pointer",color:isDef?color:"var(--t3)",padding:"3px 10px",fontSize:11,fontFamily:"var(--fn)",fontWeight:700,display:"flex",alignItems:"center",gap:3}}>
                              <Star size={11} fill={isDef?color:"none"}/>{isDef?"Default":"Set default"}
                            </button>
                            <button onClick={() => {setEditing(eKey);setEditVal(opt);}} style={{background:"none",border:"none",cursor:"pointer",color:"var(--t3)",padding:3}}><Edit3 size={13}/></button>
                            <button onClick={() => removeOption(id,oi)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--dn)",padding:3}}><Trash2 size={13}/></button>
                          </div>
                        );
                      })
                  }
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};

// ─── ANALYTICS (Manager) ────────────────────────────────────────────────────
const Analytics = () => {
  const [selDay, setSelDay] = useState("Mon");
  const [dietTab, setDietTab] = useState("veg");
  const [data, setData] = useState({});
  const [stats, setStats] = useState({totalStudents:0,responded:0,onLeaveToday:0,weekId:""});
  const [dietSummary, setDietSummary] = useState({veg:0,nonVeg:0,noChoice:0,total:0});
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchAll = () => {
    setRefreshing(true);
    Promise.all([api.getAnalytics(), api.getStats(), api.getDietSummary()])
      .then(([d,s,ds]) => { setData(d); setStats(s); setDietSummary(ds); setLastUpdated(new Date()); })
      .catch(console.error).finally(() => setRefreshing(false));
  };

  useEffect(() => { fetchAll(); const iv = setInterval(fetchAll,30000); return () => clearInterval(iv); }, []);

  const generatePDF = () => {
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    const weekId = stats.weekId || "Current Week";
    const generatedAt = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

    const FULL_DAY = { Mon: "MONDAY", Tue: "TUESDAY", Wed: "WEDNESDAY", Thu: "THURSDAY", Fri: "FRIDAY", Sat: "SATURDAY", Sun: "SUNDAY" };

    // ── Cover header ──────────────────────────────────────────────────────
    // Purple header band
    doc.setFillColor(155, 63, 168);
    doc.rect(0, 0, pageW, 36, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("LumiLuna", 14, 14);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Smart Hostel Breakfast Automation System", 14, 21);
    doc.text("Weekly Breakfast Demand Report", 14, 28);

    // Right-align week label
    doc.setFontSize(9);
    doc.text(`Week: ${weekId}`, pageW - 14, 14, { align: "right" });
    doc.text(`Generated: ${generatedAt}`, pageW - 14, 21, { align: "right" });

    // ── Summary strip ─────────────────────────────────────────────────────
    doc.setFillColor(245, 240, 250);
    doc.rect(0, 36, pageW, 18, "F");

    doc.setTextColor(80, 40, 100);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    const summaryItems = [
      `Total Students: ${stats.totalStudents}`,
      `Submitted Selection: ${stats.responded}`,
      `Vegetarian: ${dietSummary.veg}`,
      `Non-Vegetarian: ${dietSummary.nonVeg}`,
      `No Choice: ${dietSummary.noChoice}`,
    ];
    const colW = (pageW - 28) / summaryItems.length;
    summaryItems.forEach((txt, i) => {
      doc.text(txt, 14 + i * colW, 48);
    });

    let yPos = 62;

    // ── Day sections ──────────────────────────────────────────────────────
    DAYS.forEach(day => {
      const dayData = data[day] || {};
      const hasVeg    = dayData.veg    && Object.keys(dayData.veg).length > 0;
      const hasNonVeg = dayData.nonVeg && Object.keys(dayData.nonVeg).length > 0;
      if (!hasVeg && !hasNonVeg) return;

      // Day heading bar
      if (yPos > 245) { doc.addPage(); yPos = 20; }

      doc.setFillColor(224, 92, 138);
      doc.rect(14, yPos - 5, pageW - 28, 9, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(FULL_DAY[day] || day.toUpperCase(), 18, yPos + 1);

      // Slot info on right side of heading
      const slotInfo = [];
      if (dayData.slotVeg)    slotInfo.push(`Veg Slot: ${dayData.slotVeg}`);
      if (dayData.slotNonVeg) slotInfo.push(`Non-Veg Slot: ${dayData.slotNonVeg}`);
      if (slotInfo.length) {
        doc.setFontSize(8);
        doc.text(slotInfo.join("   "), pageW - 16, yPos + 1, { align: "right" });
      }

      yPos += 10;

      // Build table rows — Vegetarian first, then Non-Vegetarian
      const rows = [];

      if (hasVeg) {
        const vegEntries = Object.entries(dayData.veg).sort((a,b) => b[1] - a[1]);
        vegEntries.forEach(([item, cnt], idx) => {
          rows.push([
            idx === 0 ? "Vegetarian" : "",
            item,
            String(cnt),
            `${cnt} portion${cnt > 1 ? "s" : ""}`,
            dayData.slotVeg ? `Slot ${dayData.slotVeg}` : "-",
          ]);
        });
      }

      if (hasNonVeg) {
        const nvEntries = Object.entries(dayData.nonVeg).sort((a,b) => b[1] - a[1]);
        nvEntries.forEach(([item, cnt], idx) => {
          rows.push([
            idx === 0 ? "Non-Vegetarian" : "",
            item,
            String(cnt),
            `${cnt} portion${cnt > 1 ? "s" : ""}`,
            dayData.slotNonVeg ? `Slot ${dayData.slotNonVeg}` : "-",
          ]);
        });
      }

      if (rows.length) {
        autoTable(doc, {
          startY: yPos,
          head: [["Diet Type", "Breakfast Item", "Students", "Quantity", "Vending Slot"]],
          body: rows,
          theme: "grid",
          headStyles: {
            fillColor: [80, 40, 100],
            textColor: 255,
            fontSize: 9,
            fontStyle: "bold",
            halign: "center",
          },
          bodyStyles: {
            fontSize: 9,
            textColor: [40, 20, 60],
          },
          columnStyles: {
            0: { fontStyle: "bold", cellWidth: 36, fillColor: [250, 245, 255] },
            1: { cellWidth: "auto" },
            2: { halign: "center", cellWidth: 22 },
            3: { halign: "center", cellWidth: 28 },
            4: { halign: "center", cellWidth: 28, textColor: [155, 63, 168], fontStyle: "bold" },
          },
          alternateRowStyles: { fillColor: [252, 249, 255] },
          margin: { left: 14, right: 14 },
          didDrawCell: (hookData) => {
            // Green tint for Vegetarian rows, orange for Non-Veg
            if (hookData.column.index === 0 && hookData.cell.raw === "Vegetarian") {
              hookData.doc.setFillColor(220, 252, 231);
            }
            if (hookData.column.index === 0 && hookData.cell.raw === "Non-Vegetarian") {
              hookData.doc.setFillColor(255, 237, 213);
            }
          },
        });
        yPos = doc.lastAutoTable.finalY + 12;
      }
    });

    // ── Footer on every page ──────────────────────────────────────────────
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFillColor(245, 240, 250);
      doc.rect(0, doc.internal.pageSize.getHeight() - 10, pageW, 10, "F");
      doc.setTextColor(155, 63, 168);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text("LumiLuna - Smart Hostel Breakfast Automation System | Confidential", 14, doc.internal.pageSize.getHeight() - 3);
      doc.text(`Page ${i} of ${totalPages}`, pageW - 14, doc.internal.pageSize.getHeight() - 3, { align: "right" });
    }

    doc.save(`breakfast-report-${weekId}.pdf`);
  };

  const dayData = data[selDay] || {};
  const items = Object.entries(dayData[dietTab]||{}).sort((a,b)=>b[1]-a[1]);
  const total = items.reduce((a,[,b])=>a+b,0);
  const mC = ["#9b3fa8","#e05c8a","#f4845f"];

  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} style={{padding:"20px 16px 100px"}}>
      <p style={{fontSize:12,fontWeight:700,color:"var(--pk)",textTransform:"uppercase",letterSpacing:"1px",marginBottom:4}}>Analytics</p>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div>
          <h2 style={{fontSize:22,fontWeight:900,color:"var(--t1)",letterSpacing:"-0.5px"}}>Breakfast Demand</h2>
          {lastUpdated && <p style={{fontSize:11,color:"var(--t3)",marginTop:2}}>Updated {lastUpdated.toLocaleTimeString()}</p>}
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={fetchAll} disabled={refreshing}
            style={{background:"var(--s3)",border:"1px solid var(--b2)",borderRadius:50,padding:"7px 16px",fontSize:12,fontWeight:700,color:"var(--pu)",cursor:"pointer",fontFamily:"var(--fn)",display:"flex",alignItems:"center",gap:6}}>
            <motion.span animate={refreshing?{rotate:360}:{rotate:0}} transition={refreshing?{repeat:Infinity,duration:0.7,ease:"linear"}:{}} style={{display:"inline-block"}}>↻</motion.span>
            {refreshing?"...":"Refresh"}
          </button>
          <button onClick={generatePDF}
            style={{background:"linear-gradient(135deg,#9b3fa8,#e05c8a)",border:"none",borderRadius:50,padding:"7px 16px",fontSize:12,fontWeight:700,color:"#fff",cursor:"pointer",fontFamily:"var(--fn)",display:"flex",alignItems:"center",gap:6,boxShadow:"0 4px 14px rgba(155,63,168,0.3)"}}>
            <FileDown size={13}/>PDF
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>
        {[{label:"Students",value:stats.totalStudents,color:"#9b3fa8"},{label:"Selected",value:stats.responded,color:"#e05c8a"},{label:"On Leave",value:stats.onLeaveToday,color:"#f9b234"}].map((s,i) => (
          <div key={i} style={{background:"var(--s1)",border:`1px solid ${s.color}20`,borderRadius:14,padding:"14px 12px",textAlign:"center"}}>
            <p style={{fontSize:24,fontWeight:900,color:s.color,letterSpacing:"-1px"}}>{s.value}</p>
            <p style={{fontSize:10,color:"var(--t3)",fontWeight:600,marginTop:2,textTransform:"uppercase",letterSpacing:"0.5px"}}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Veg vs NonVeg */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:18}}>
        <div style={{background:"rgba(22,163,74,0.06)",border:"1px solid rgba(22,163,74,0.2)",borderRadius:14,padding:"14px 16px",display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:24}}>🥦</span>
          <div><p style={{fontSize:22,fontWeight:900,color:"#15803d"}}>{dietSummary.veg}</p><p style={{fontSize:11,color:"var(--t3)",fontWeight:600}}>Veg students</p></div>
        </div>
        <div style={{background:"rgba(234,88,12,0.06)",border:"1px solid rgba(234,88,12,0.2)",borderRadius:14,padding:"14px 16px",display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:24}}>🍗</span>
          <div><p style={{fontSize:22,fontWeight:900,color:"#c2410c"}}>{dietSummary.nonVeg}</p><p style={{fontSize:11,color:"var(--t3)",fontWeight:600}}>Non-Veg students</p></div>
        </div>
      </div>

      {/* Diet tab + day selector */}
      <div style={{display:"flex",background:"var(--s3)",borderRadius:50,padding:3,marginBottom:14,border:"1px solid var(--b1)"}}>
        {[{id:"veg",label:"Vegetarian",color:"#15803d"},{id:"nonVeg",label:"Non-Vegetarian",color:"#c2410c"}].map(t => (
          <button key={t.id} onClick={()=>setDietTab(t.id)} style={{flex:1,padding:"10px",borderRadius:50,border:"none",cursor:"pointer",fontFamily:"var(--fn)",fontWeight:700,fontSize:13,transition:"all 0.2s",background:dietTab===t.id?`linear-gradient(135deg,${t.color},${t.color}cc)`:"transparent",color:dietTab===t.id?"#fff":"var(--t3)",boxShadow:dietTab===t.id?`0 4px 14px ${t.color}40`:"none"}}>{t.label}</button>
        ))}
      </div>
      <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:8,marginBottom:16}}>
        {DAYS.map(day => (
          <button key={day} onClick={()=>setSelDay(day)} style={{flex:"0 0 auto",padding:"8px 16px",borderRadius:50,border:"none",background:selDay===day?"linear-gradient(135deg,#9b3fa8,#e05c8a)":"var(--s3)",color:selDay===day?"#fff":"var(--t3)",fontFamily:"var(--fn)",fontWeight:700,fontSize:13,cursor:"pointer",boxShadow:selDay===day?"0 4px 14px rgba(155,63,168,0.3)":"none"}}>{day}</button>
        ))}
      </div>

      {/* Breakdown */}
      <div style={{background:"var(--s1)",borderRadius:14,overflow:"hidden",border:"1px solid rgba(249,178,52,0.18)"}}>
        <div style={{padding:"14px 18px",display:"flex",alignItems:"center",gap:10,borderBottom:"1px solid var(--b1)",background:"rgba(249,178,52,0.04)"}}>
          <Coffee size={16} color="#f9b234"/>
          <span style={{fontWeight:800,fontSize:14,color:"var(--t1)",flex:1}}>Breakfast — {selDay}</span>
          <span style={{fontSize:12,fontWeight:700,color:"#f9b234",background:"rgba(249,178,52,0.1)",padding:"3px 10px",borderRadius:50}}>{total} students</span>
          {dayData.slotVeg && dietTab==="veg" && <span className="slot-badge"><Cpu size={10}/>Slot {dayData.slotVeg}</span>}
          {dayData.slotNonVeg && dietTab==="nonVeg" && <span className="slot-badge"><Cpu size={10}/>Slot {dayData.slotNonVeg}</span>}
        </div>
        <div style={{padding:"14px 18px"}}>
          {items.length===0
            ? <p style={{color:"var(--t3)",fontSize:13}}>No {dietTab==="veg"?"vegetarian":"non-vegetarian"} selections for {selDay}</p>
            : items.map(([name,cnt],i) => {
                const pct = total>0 ? Math.round((cnt/total)*100) : 0;
                return (
                  <div key={name} style={{marginBottom:i<items.length-1?14:0}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        {i===0 && <span style={{fontSize:11}}>🏆</span>}
                        <span style={{fontSize:13,fontWeight:i===0?700:500,color:i===0?"var(--t1)":"var(--t2)"}}>{name}</span>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <span style={{fontSize:13,fontWeight:700,color:mC[i%3]}}>{cnt}</span>
                        <span style={{fontSize:11,color:"var(--t3)",background:"var(--s3)",padding:"2px 8px",borderRadius:50}}>{pct}%</span>
                      </div>
                    </div>
                    <div className="pt"><motion.div className="pb" initial={{width:0}} animate={{width:`${pct}%`}} transition={{delay:i*0.05,duration:0.5}} style={{background:`linear-gradient(90deg,${mC[i%3]},#f9b234)`}}/></div>
                  </div>
                );
              })
          }
        </div>
      </div>
    </motion.div>
  );
};

// ─── FEEDBACK MANAGER ───────────────────────────────────────────────────────
const FeedbackManager = () => {
  const [feedbacks, setFeedbacks] = useState([]);
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    Promise.all([api.getFeedback(), api.getFeedbackSummary()])
      .then(([fb,sm]) => { setFeedbacks(fb); setSummary(sm); })
      .catch(console.error).finally(() => setLoading(false));
  }, []);
  const mealColor = { Breakfast:"#f9b234", General:"#9b3fa8" };
  const renderStars = r => "★".repeat(r) + "☆".repeat(5-r);
  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} style={{padding:"20px 16px 100px"}}>
      <p style={{fontSize:12,fontWeight:700,color:"var(--pk)",textTransform:"uppercase",letterSpacing:"1px",marginBottom:4}}>Feedback</p>
      <h2 style={{fontSize:22,fontWeight:900,color:"var(--t1)",marginBottom:16,letterSpacing:"-0.5px"}}>Student Feedback</h2>
      {summary.length > 0 && (
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:20}}>
          {summary.map(s => (
            <div key={s._id} style={{background:"var(--s1)",border:`1px solid ${mealColor[s._id]||"var(--b1)"}20`,borderRadius:14,padding:"14px 16px"}}>
              <p style={{fontSize:11,color:"var(--t3)",fontWeight:600,marginBottom:4,textTransform:"uppercase"}}>{s._id}</p>
              <p style={{fontSize:22,fontWeight:900,color:mealColor[s._id]||"var(--pu)"}}>{s.avg.toFixed(1)} <span style={{fontSize:14,color:"#f9b234"}}>★</span></p>
              <p style={{fontSize:11,color:"var(--t3)"}}>{s.count} review{s.count!==1?"s":""}</p>
            </div>
          ))}
        </div>
      )}
      {loading ? <p style={{color:"var(--t3)",fontSize:13}}>Loading...</p>
        : feedbacks.length===0 ? <p style={{color:"var(--t3)",fontSize:13}}>No feedback yet.</p>
        : feedbacks.map(fb => (
          <div key={fb.id||fb._id} style={{background:"var(--s1)",border:"1px solid var(--b1)",borderRadius:14,padding:"14px 16px",marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:32,height:32,borderRadius:"50%",background:"linear-gradient(135deg,#9b3fa8,#e05c8a)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:"#fff"}}>{fb.name?.[0]||"?"}</div>
                <div>
                  <p style={{fontSize:13,fontWeight:700,color:"var(--t1)"}}>{fb.name}</p>
                  <p style={{fontSize:11,color:"var(--t3)"}}>{new Date(fb.created_at||fb.createdAt).toLocaleDateString("en-IN",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</p>
                </div>
              </div>
              <div style={{textAlign:"right"}}>
                <span style={{fontSize:11,fontWeight:700,color:mealColor[fb.meal]||"var(--pu)",background:`${mealColor[fb.meal]||"#9b3fa8"}12`,padding:"3px 10px",borderRadius:50}}>{fb.meal}</span>
                <p style={{fontSize:16,color:"#f9b234",marginTop:4,letterSpacing:1}}>{renderStars(fb.rating)}</p>
              </div>
            </div>
            {fb.comment && <p style={{fontSize:13,color:"var(--t2)",lineHeight:1.5,borderTop:"1px solid var(--b1)",paddingTop:8,marginTop:4}}>{fb.comment}</p>}
          </div>
        ))
      }
    </motion.div>
  );
};

// ─── APP SHELLS ──────────────────────────────────────────────────────────────
const StudentApp = () => {
  const { activeTab, weekDiet, selectionOpen, currentWeekId, notifPanelOpen } = useContext(AppContext);
  const tabs = [
    {id:"dashboard", label:"Home",      icon:LayoutDashboard},
    {id:"meals",     label:"Breakfast", icon:Coffee},
    {id:"calendar",  label:"Leave",     icon:CalendarDays},
    {id:"feedback",  label:"Feedback",  icon:MessageSquare},
  ];
  if (!weekDiet) return <DietSelectionScreen />;
  return (
    <div style={{minHeight:"100vh",paddingBottom:90,background:"var(--bg)"}}>
      <Header/>
      <NotificationPanel/>
      {/* Countdown timer — always visible for students */}
      <CountdownTimer/>
      {!selectionOpen && (
        <div style={{background:"rgba(234,88,12,0.08)",borderBottom:"1px solid rgba(234,88,12,0.2)",padding:"10px 20px",display:"flex",alignItems:"center",gap:10}}>
          <AlertCircle size={15} color="#c2410c"/>
          <p style={{fontSize:13,color:"#c2410c",fontWeight:600}}>Selection window is closed. Opens every Saturday 7:00 PM — Sunday 11:59 PM.</p>
        </div>
      )}
      {selectionOpen && (
        <div style={{background:"rgba(22,163,74,0.06)",borderBottom:"1px solid rgba(22,163,74,0.2)",padding:"10px 20px",display:"flex",alignItems:"center",gap:10}}>
          <CheckCircle2 size={15} color="#15803d"/>
          <p style={{fontSize:13,color:"#15803d",fontWeight:600}}>Selection open! Choose your breakfasts for week {currentWeekId}.</p>
        </div>
      )}
      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}} transition={{duration:0.2}}>
          {activeTab==="dashboard" && <StudentDashboard/>}
          {activeTab==="meals"     && <BreakfastSelection/>}
          {activeTab==="calendar"  && <LeaveCalendar/>}
          {activeTab==="feedback"  && <FeedbackPage/>}
        </motion.div>
      </AnimatePresence>
      <BottomNav tabs={tabs}/>
    </div>
  );
};

const ManagerApp = () => {
  const { activeTab } = useContext(AppContext);
  const tabs = [
    {id:"dashboard", label:"Overview",  icon:LayoutDashboard},
    {id:"menu",      label:"Menu",      icon:ChefHat},
    {id:"analytics", label:"Analytics", icon:BarChart3},
    {id:"feedback",  label:"Feedback",  icon:MessageSquare},
  ];
  return (
    <div style={{minHeight:"100vh",paddingBottom:90,background:"var(--bg)"}}>
      <Header/>
      <NotificationPanel/>
      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}} transition={{duration:0.2}}>
          {activeTab==="dashboard" && <ManagerDashboard/>}
          {activeTab==="menu"      && <MenuBuilder/>}
          {activeTab==="analytics" && <Analytics/>}
          {activeTab==="feedback"  && <FeedbackManager/>}
        </motion.div>
      </AnimatePresence>
      <BottomNav tabs={tabs}/>
    </div>
  );
};

function App() {
  const { user } = useContext(AppContext);
  return (
    <div>
      <AnimatePresence mode="wait">
        {!user
          ? <motion.div key="auth"    initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><AuthScreen/></motion.div>
          : user.type==="student"
            ? <motion.div key="stu"  initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><StudentApp/></motion.div>
            : <motion.div key="mgr"  initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><ManagerApp/></motion.div>
        }
      </AnimatePresence>
    </div>
  );
}

export default function Root() {
  return (<><style>{S}</style><AppProvider><App/></AppProvider></>);
}
