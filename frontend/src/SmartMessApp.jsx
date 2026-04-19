import { useState, useEffect, useContext, createContext } from "react";
import { api } from "./api";
import { motion, AnimatePresence } from "framer-motion";
import { UtensilsCrossed, CalendarDays, LayoutDashboard, LogOut, ChefHat, BarChart3, Clock, CheckCircle2, AlertCircle, ChevronLeft, ChevronRight, Star, Users, Eye, EyeOff, ArrowRight, Coffee, Sun, Moon, Edit3, Trash2, GripVertical, Plus, Bell } from "lucide-react";

const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const MEALS = ["Breakfast","Lunch","Dinner"];
const MENU_DATA = {
  Mon:{ Breakfast:{veg:["Poha","Upma","Idli"],nonVeg:["Egg Bhurji","Omelette"]}, Lunch:{veg:["Dal Rice","Rajma Rice"],nonVeg:["Chicken Curry","Egg Rice"]}, Dinner:{veg:["Roti + Sabzi","Paneer Curry"],nonVeg:["Chicken Biryani","Fish Fry"]} },
  Tue:{ Breakfast:{veg:["Paratha","Dosa","Cornflakes"],nonVeg:["Egg Paratha","Boiled Eggs"]}, Lunch:{veg:["Kadhi Rice","Jeera Rice"],nonVeg:["Mutton Curry","Chicken Fried Rice"]}, Dinner:{veg:["Dal Makhani","Khichdi"],nonVeg:["Chicken Noodles","Egg Curry"]} },
  Wed:{ Breakfast:{veg:["Bread Butter","Poha","Upma"],nonVeg:["Egg Toast","Omelette"]}, Lunch:{veg:["Sambar Rice","Pulao"],nonVeg:["Chicken Pulao","Egg Masala"]}, Dinner:{veg:["Paneer Butter Masala","Roti"],nonVeg:["Butter Chicken","Fish Curry"]} },
  Thu:{ Breakfast:{veg:["Idli","Vada","Sprouts"],nonVeg:["Egg Dosa","Boiled Eggs"]}, Lunch:{veg:["Dal Fry","Aloo Matar"],nonVeg:["Chicken Biryani","Mutton Keema"]}, Dinner:{veg:["Mix Veg","Chapati"],nonVeg:["Chicken Curry","Egg Fried Rice"]} },
  Fri:{ Breakfast:{veg:["Poha","Dosa","Upma"],nonVeg:["Egg Bhurji","Omelette"]}, Lunch:{veg:["Rajma","Dal Rice"],nonVeg:["Fish Curry","Chicken Rice"]}, Dinner:{veg:["Special Thali","Pasta"],nonVeg:["Chicken Tikka","Egg Curry"]} },
  Sat:{ Breakfast:{veg:["Chole Bhature","Paratha"],nonVeg:["Egg Paratha","Chicken Sandwich"]}, Lunch:{veg:["Kadhi","Rice"],nonVeg:["Mutton Biryani","Chicken Curry"]}, Dinner:{veg:["Paneer","Naan","Kheer"],nonVeg:["Butter Chicken","Egg Naan"]} },
  Sun:{ Breakfast:{veg:["Puri Sabzi","Halwa","Dosa"],nonVeg:["Egg Puri","Omelette"]}, Lunch:{veg:["Special Dal","Rice","Gulab Jamun"],nonVeg:["Chicken Special","Mutton Curry"]}, Dinner:{veg:["Veg Biryani","Raita"],nonVeg:["Chicken Biryani","Ice Cream"]} },
};

const AppContext = createContext();
const AppProvider = ({ children }) => {
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem("ll_user")); } catch { return null; } });
  const [preferences, setPreferences] = useState({});
  const [leaveDates, setLeaveDates] = useState([]);
  const [menu, setMenu] = useState(MENU_DATA);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [notifications, setNotifications] = useState(0);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState(null);
  // Student's chosen diet for the week — persisted in localStorage
  const [weekDiet, setWeekDiet] = useState(() => localStorage.getItem("ll_diet") || null);
  const [selectionOpen, setSelectionOpen] = useState(true);
  const [currentWeekId, setCurrentWeekId] = useState("");
  useEffect(() => {
    if (!user) return;
    Promise.all([api.getMenu(), api.getPreferences(), api.getLeave(), api.getNotifications(), api.getWindow()])
      .then(([m, p, l, n, w]) => {
        if (Object.keys(m).length) setMenu(m);
        setPreferences(p);
        setLeaveDates(l);
        setNotifications(n.count||0);
        setSelectionOpen(w.open);
        setCurrentWeekId(w.weekId);
      })
      .catch(console.error);
  }, [user]);
  const login = async (type, creds) => {
    setLoading(true); setApiError(null);
    try { const { token, user: u } = await api.login(creds.id, creds.pass); localStorage.setItem("ll_token", token); localStorage.setItem("ll_user", JSON.stringify({...u, type: u.role})); setUser({...u, type: u.role}); }
    catch (e) { setApiError(e.message); } finally { setLoading(false); }
  };
  const updateMenu = async (day, meals) => { setMenu(m => ({...m, [day]: meals})); try { await api.updateMenu(day, meals); } catch(e) { console.error(e); } };
  const setPreference = async (day, meal, index, diet="veg") => {
    setPreferences(p => ({...p, [day]: {...(p[day]||{}), [meal]: {choiceIndex: index, diet}}}));
    try {
      const result = await api.setPreference(day, meal, index, diet);
      if (result.success) api.getNotifications().then(d => setNotifications(d.count||0)).catch(()=>{});
    } catch(e) {
      console.error(e);
      // Revert on error (e.g. window closed)
      setPreferences(p => { const n={...p}; if(n[day]) delete n[day][meal]; return n; });
      alert(e.message || "Could not save preference");
    }
  };
  const toggleLeave = async (dateStr) => {
    setLeaveDates(d => d.includes(dateStr) ? d.filter(x => x !== dateStr) : [...d, dateStr]);
    try { await api.toggleLeave(dateStr); api.getNotifications().then(d => setNotifications(d.count||0)).catch(()=>{}); }
    catch(e) { console.error(e); setLeaveDates(d => d.includes(dateStr) ? d.filter(x => x !== dateStr) : [...d, dateStr]); }
  };
  const chooseDiet = (d) => { localStorage.setItem("ll_diet", d); setWeekDiet(d); };
  const clearDiet = () => { localStorage.removeItem("ll_diet"); setWeekDiet(null); };
  const logout = () => {
    localStorage.removeItem("ll_token"); localStorage.removeItem("ll_user"); localStorage.removeItem("ll_diet");
    setUser(null); setPreferences({}); setLeaveDates([]); setWeekDiet(null); setActiveTab("dashboard");
  };
  return (
    <AppContext.Provider value={{user, login, logout, loading, apiError, preferences, setPreference, leaveDates, toggleLeave, menu, setMenu: updateMenu, setMenuRaw: setMenu, activeTab, setActiveTab, notifications, weekDiet, chooseDiet, clearDiet, selectionOpen, currentWeekId}}>
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
    --b1:rgba(155,63,168,0.1); --b2:rgba(155,63,168,0.18); --b3:rgba(155,63,168,0.3);
    --pu:#9b3fa8; --pk:#e05c8a; --or:#f4845f; --am:#f9b234; --yw:#ffd700;
    --vg:#16a34a; --nv:#ea580c; --vd:rgba(22,163,74,0.1); --nd:rgba(234,88,12,0.1);
    --dn:#dc2626; --wn:#d97706;
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
  .nav-item{display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px 16px;border-radius:12px;cursor:pointer;transition:all 0.2s;border:1px solid transparent;background:none;color:var(--t3);font-family:var(--fn);font-size:10px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;}
  .nav-item.active{color:var(--pk);background:rgba(224,92,138,0.1);border-color:rgba(224,92,138,0.25);box-shadow:0 0 12px rgba(224,92,138,0.15);}
  .nav-item:hover:not(.active){color:var(--t2);background:var(--s3);}
  .day-card{background:var(--s2);border:1.5px solid var(--b1);border-radius:16px;padding:14px 8px;cursor:pointer;transition:all 0.25s;text-align:center;position:relative;overflow:hidden;}
  .day-card:hover{transform:translateY(-4px) scale(1.03);border-color:var(--pk);box-shadow:0 8px 24px rgba(224,92,138,0.2);}
  .day-card.done{border-color:rgba(249,178,52,0.5);background:linear-gradient(160deg,rgba(155,63,168,0.06),rgba(224,92,138,0.05),rgba(249,178,52,0.04));}
  .day-card.active-day{border-color:var(--am);box-shadow:0 0 0 2px var(--am),0 0 24px rgba(249,178,52,0.35);}
  .meal-opt{display:inline-flex;align-items:center;gap:8px;padding:10px 18px;border-radius:50px;cursor:pointer;font-size:13px;font-weight:600;font-family:var(--fn);transition:all 0.22s cubic-bezier(0.34,1.56,0.64,1);border:1.5px solid var(--b2);background:var(--s3);color:var(--t2);position:relative;overflow:hidden;}
  .meal-opt:hover{transform:translateY(-2px) scale(1.04);border-color:var(--pk);color:var(--t1);box-shadow:0 6px 18px rgba(224,92,138,0.2);}
  .meal-opt:active{transform:scale(0.97);}
  .meal-opt.sel{background:${SG};border-color:transparent;color:#fff;font-weight:700;box-shadow:0 6px 20px rgba(224,92,138,0.4);transform:translateY(-1px);}
  .vc{display:inline-flex;align-items:center;gap:6px;padding:9px 18px;border-radius:50px;cursor:pointer;font-size:13px;font-weight:600;font-family:var(--fn);transition:all 0.22s cubic-bezier(0.34,1.56,0.64,1);border:1.5px solid var(--b2);background:var(--s3);color:var(--t2);}
  .vc.on{background:linear-gradient(135deg,#16a34a,#15803d);border-color:transparent;color:#fff;font-weight:700;box-shadow:0 6px 18px rgba(22,163,74,0.35);transform:translateY(-1px);}
  .vc:hover:not(.on){border-color:var(--vg);color:var(--t1);transform:translateY(-2px);}
  .nc{display:inline-flex;align-items:center;gap:6px;padding:9px 18px;border-radius:50px;cursor:pointer;font-size:13px;font-weight:600;font-family:var(--fn);transition:all 0.22s cubic-bezier(0.34,1.56,0.64,1);border:1.5px solid var(--b2);background:var(--s3);color:var(--t2);}
  .nc.on{background:linear-gradient(135deg,#ea580c,#c2410c);border-color:transparent;color:#fff;font-weight:700;box-shadow:0 6px 18px rgba(234,88,12,0.35);transform:translateY(-1px);}
  .nc:hover:not(.on){border-color:var(--nv);color:var(--t1);transform:translateY(-2px);}
  .pt{height:7px;background:var(--s4);border-radius:4px;overflow:hidden;}
  .pb{height:100%;border-radius:4px;background:${SG};}
  @keyframes checkIn{from{transform:scale(0) rotate(-45deg);opacity:0;}to{transform:scale(1) rotate(0);opacity:1;}}
  .check-anim{animation:checkIn 0.35s cubic-bezier(0.34,1.56,0.64,1);}
  @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.4;}}
  .missed-dot{width:4px;height:4px;border-radius:50%;background:var(--dn);animation:pulse 2s infinite;}
`;

const getIcon = m => ({Breakfast:Coffee,Lunch:Sun,Dinner:Moon}[m]);
const getDIM = (y,m) => new Date(y,m+1,0).getDate();
const getFD = (y,m) => new Date(y,m,1).getDay();

const AuthScreen = () => {
  const { login, loading, apiError } = useContext(AppContext);
  const [mode, setMode] = useState("student");
  const [showPass, setShowPass] = useState(false);
  const [form, setForm] = useState({ id: "", pass: "" });
  const [errors, setErrors] = useState({});
  const validate = () => { const e = {}; if (!form.id) e.id = "Required"; if (!form.pass || form.pass.length < 4) e.pass = "Min 4 chars"; return e; };
  const handleSubmit = async () => { const e = validate(); if (Object.keys(e).length) { setErrors(e); return; } await login(mode, form); };
  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:"24px",background:"linear-gradient(160deg,#fdf4ff 0%,#fff5f8 50%,#fffbf0 100%)"}}>
      <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{duration:0.4}} style={{width:"100%",maxWidth:380}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <img src="/logo.png" alt="LumiLuna" style={{width:72,height:72,borderRadius:16,objectFit:"cover",margin:"0 auto 12px",display:"block",boxShadow:"0 8px 24px rgba(155,63,168,0.2)"}} />
          <h1 style={{fontSize:26,fontWeight:900,color:"var(--t1)",letterSpacing:"-0.5px"}}>LumiLuna</h1>
          <p style={{color:"var(--t3)",fontSize:13,marginTop:4}}>Smart Mess Preference System</p>
        </div>
        <div className="card-strong" style={{boxShadow:"0 8px 40px rgba(155,63,168,0.1)"}}>
          <div style={{display:"flex",background:"var(--s3)",borderRadius:50,padding:4,marginBottom:22}}>
            {["student","manager"].map(t => (
              <button key={t} onClick={() => { setMode(t); setErrors({}); setForm({id:"",pass:""}); }}
                style={{flex:1,padding:"10px",borderRadius:50,border:"none",cursor:"pointer",fontFamily:"var(--fn)",fontWeight:700,fontSize:13,transition:"all 0.2s",background:mode===t?"linear-gradient(135deg,#9b3fa8,#e05c8a)":"transparent",color:mode===t?"#fff":"var(--t3)",boxShadow:mode===t?"0 4px 14px rgba(155,63,168,0.35)":"none"}}>
                {t === "student" ? "Student" : "Manager"}
              </button>
            ))}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div>
              <label style={{fontSize:12,color:"var(--t2)",fontWeight:600,display:"block",marginBottom:6}}>{mode==="student"?"Roll Number":"Employee ID"}</label>
              <input className="inp" placeholder={mode==="student"?"e.g. CS2021001":"e.g. MGR001"} value={form.id} onChange={e => setForm(f => ({...f,id:e.target.value}))} />
              {errors.id && <p style={{color:"var(--dn)",fontSize:12,marginTop:4}}>{errors.id}</p>}
            </div>
            <div>
              <label style={{fontSize:12,color:"var(--t2)",fontWeight:600,display:"block",marginBottom:6}}>Password</label>
              <div style={{position:"relative"}}>
                <input className="inp" type={showPass?"text":"password"} placeholder="Enter password" style={{paddingRight:42}} value={form.pass} onChange={e => setForm(f => ({...f,pass:e.target.value}))} onKeyDown={e => e.key==="Enter" && handleSubmit()} />
                <button onClick={() => setShowPass(s => !s)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"var(--t3)"}}>
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
          <p style={{textAlign:"center",marginTop:16,fontSize:11,color:"var(--t3)"}}>Student: CS2021001 / pass1234 &nbsp;·&nbsp; Manager: MGR001 / pass1234</p>
        </div>
      </motion.div>
    </div>
  );
};

const DietSelectionScreen = () => {
  const { chooseDiet, user } = useContext(AppContext);
  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:"24px",background:"linear-gradient(160deg,#fdf4ff 0%,#fff5f8 50%,#fffbf0 100%)"}}>
      <div style={{width:"100%",maxWidth:400,textAlign:"center"}}>
        <div style={{width:64,height:64,borderRadius:20,background:"linear-gradient(135deg,#9b3fa8,#e05c8a)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",boxShadow:"0 8px 24px rgba(155,63,168,0.25)"}}>
          <UtensilsCrossed size={28} color="#fff"/>
        </div>
        <h2 style={{fontSize:24,fontWeight:900,color:"var(--t1)",letterSpacing:"-0.5px",marginBottom:8}}>Welcome, {user?.name?.split(" ")[0]}!</h2>
        <p style={{fontSize:14,color:"var(--t2)",marginBottom:32,lineHeight:1.6}}>Before you start selecting meals, please choose your dietary preference for this week. <strong>This cannot be changed once you begin selecting meals.</strong></p>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <motion.button whileHover={{scale:1.03,y:-2}} whileTap={{scale:0.97}} onClick={()=>chooseDiet("veg")}
            style={{padding:"20px 24px",borderRadius:16,border:"2px solid rgba(22,163,74,0.3)",background:"rgba(22,163,74,0.06)",cursor:"pointer",fontFamily:"var(--fn)",textAlign:"left",display:"flex",alignItems:"center",gap:16,transition:"all 0.2s"}}>
            <div style={{width:48,height:48,borderRadius:14,background:"rgba(22,163,74,0.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0}}>🥦</div>
            <div>
              <p style={{fontWeight:800,fontSize:16,color:"#15803d",marginBottom:3}}>Vegetarian</p>
              <p style={{fontSize:12,color:"var(--t3)"}}>Only vegetarian meals will be shown for selection</p>
            </div>
          </motion.button>
          <motion.button whileHover={{scale:1.03,y:-2}} whileTap={{scale:0.97}} onClick={()=>chooseDiet("nonVeg")}
            style={{padding:"20px 24px",borderRadius:16,border:"2px solid rgba(234,88,12,0.3)",background:"rgba(234,88,12,0.06)",cursor:"pointer",fontFamily:"var(--fn)",textAlign:"left",display:"flex",alignItems:"center",gap:16,transition:"all 0.2s"}}>
            <div style={{width:48,height:48,borderRadius:14,background:"rgba(234,88,12,0.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0}}>🍗</div>
            <div>
              <p style={{fontWeight:800,fontSize:16,color:"#c2410c",marginBottom:3}}>Non-Vegetarian</p>
              <p style={{fontSize:12,color:"var(--t3)"}}>Both veg and non-veg meals will be available</p>
            </div>
          </motion.button>
        </div>
        <p style={{fontSize:11,color:"var(--t3)",marginTop:20}}>You can reset this by logging out and back in</p>
      </div>
    </motion.div>
  );
};

const Header = () => {
  const { user, logout, notifications } = useContext(AppContext);
  return (
    <div style={{position:"sticky",top:0,zIndex:100,padding:"12px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",background:"rgba(255,255,255,0.92)",backdropFilter:"blur(12px)",borderBottom:"1px solid rgba(155,63,168,0.1)",boxShadow:"0 2px 12px rgba(155,63,168,0.06)"}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <img src="/logo.png" alt="LumiLuna" style={{width:34,height:34,borderRadius:8,objectFit:"cover"}} />
        <span style={{fontWeight:900,fontSize:17,color:"var(--t1)",letterSpacing:"-0.3px"}}>LumiLuna</span>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{position:"relative"}}>
          <Bell size={18} color="var(--t3)"/>
          {notifications > 0 && <div style={{position:"absolute",top:-4,right:-4,width:15,height:15,borderRadius:"50%",background:"linear-gradient(135deg,#e05c8a,#f4845f)",fontSize:8,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>{notifications>9?"9+":notifications}</div>}
        </div>
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
    <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:100,padding:"8px 12px 20px",display:"flex",justifyContent:"space-around",background:"rgba(255,255,255,0.95)",backdropFilter:"blur(12px)",borderTop:"1px solid rgba(155,63,168,0.1)",boxShadow:"0 -4px 20px rgba(155,63,168,0.08)"}}>
      {tabs.map(({ id, label, icon: Icon }) => (
        <button key={id} className={`nav-item ${activeTab===id?"active":""}`} onClick={() => setActiveTab(id)}>
          <Icon size={19}/><span>{label}</span>
        </button>
      ))}
    </div>
  );
};

const MealDrawer = ({ day, onClose }) => {
  const { preferences, setPreference, menu, weekDiet } = useContext(AppContext);
  const diet = weekDiet || "veg"; // always use the week-level diet choice
  const mealDefs = [
    { name:"Breakfast", icon:Coffee, time:"7:00 - 9:00 AM",  accent:"#f9b234", bg:"rgba(249,178,52,0.08)"  },
    { name:"Lunch",     icon:Sun,    time:"12:00 - 2:00 PM", accent:"#f4845f", bg:"rgba(244,132,95,0.08)"  },
    { name:"Dinner",    icon:Moon,   time:"7:30 - 9:30 PM",  accent:"#e05c8a", bg:"rgba(224,92,138,0.08)" },
  ];
  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={onClose}
      style={{position:"fixed",inset:0,zIndex:300,background:"rgba(26,10,46,0.5)",backdropFilter:"blur(10px)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <motion.div initial={{y:"100%"}} animate={{y:0}} exit={{y:"100%"}} transition={{type:"spring",damping:28,stiffness:300}}
        onClick={e=>e.stopPropagation()}
        style={{width:"100%",maxWidth:520,maxHeight:"90vh",overflowY:"auto",background:"#fff",borderRadius:"24px 24px 0 0",border:"1px solid rgba(155,63,168,0.15)",boxShadow:"0 -12px 50px rgba(155,63,168,0.15)"}}>
        <div style={{display:"flex",justifyContent:"center",padding:"14px 0 0"}}>
          <div style={{width:40,height:4,borderRadius:2,background:"rgba(155,63,168,0.2)"}}/>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 22px 14px"}}>
          <div>
            <p style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"1.5px",background:"linear-gradient(90deg,#9b3fa8,#e05c8a)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",marginBottom:3}}>Meal Preferences</p>
            <h3 style={{fontSize:22,fontWeight:900,color:"var(--t1)",letterSpacing:"-0.5px"}}>{day}</h3>
          </div>
          <button onClick={onClose} style={{width:36,height:36,borderRadius:10,background:"var(--s3)",border:"1px solid var(--b1)",cursor:"pointer",color:"var(--t2)",fontSize:20,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
        </div>
        {/* Diet badge — fixed for the week */}
        <div style={{margin:"0 22px 18px",padding:"10px 16px",borderRadius:12,background:diet==="veg"?"rgba(22,163,74,0.08)":"rgba(234,88,12,0.08)",border:`1px solid ${diet==="veg"?"rgba(22,163,74,0.2)":"rgba(234,88,12,0.2)"}`,display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:20}}>{diet==="veg"?"🥦":"🍗"}</span>
          <div>
            <p style={{fontWeight:700,fontSize:13,color:diet==="veg"?"#15803d":"#c2410c"}}>{diet==="veg"?"Vegetarian":"Non-Vegetarian"} — Week preference 🔒</p>
            <p style={{fontSize:11,color:"var(--t3)"}}>Showing {diet==="veg"?"vegetarian":"non-vegetarian"} options only</p>
          </div>
        </div>
        <div style={{padding:"0 22px 32px",display:"flex",flexDirection:"column",gap:14}}>
          {mealDefs.map(({name,icon:Icon,time,accent,bg})=>{
            const dayMenu = menu[day]?.[name];
            const options = dayMenu?.[diet]||(Array.isArray(dayMenu)?dayMenu:[]);
            const pref = preferences[day]?.[name];
            const sel = pref?.choiceIndex??(typeof pref==="number"?pref:undefined);
            const selDiet = pref?.diet||"veg";
            const isDone = sel!==undefined && selDiet===diet;
            return (
              <div key={name} style={{background:bg,borderRadius:16,overflow:"hidden",border:`1px solid ${accent}25`}}>
                <div style={{padding:"14px 16px",display:"flex",alignItems:"center",gap:12,borderBottom:`1px solid ${accent}15`}}>
                  <div style={{width:40,height:40,borderRadius:12,background:`${accent}18`,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 4px 12px ${accent}25`}}>
                    <Icon size={18} color={accent}/>
                  </div>
                  <div style={{flex:1}}>
                    <p style={{fontWeight:800,fontSize:15,color:"var(--t1)"}}>{name}</p>
                    <p style={{fontSize:11,color:"var(--t3)",marginTop:1}}>{time}</p>
                  </div>
                  {isDone
                    ? <motion.div initial={{scale:0}} animate={{scale:1}} className="check-anim" style={{background:`linear-gradient(135deg,${accent},${accent}cc)`,borderRadius:50,padding:"5px 12px",fontSize:12,color:"#fff",fontWeight:700}}>Selected</motion.div>
                    : <div style={{background:"rgba(220,38,38,0.08)",border:"1px solid rgba(220,38,38,0.15)",borderRadius:50,padding:"5px 12px",fontSize:12,color:"var(--dn)",fontWeight:600}}>Not set</div>
                  }
                </div>
                <div style={{padding:"14px 16px",display:"flex",flexWrap:"wrap",gap:10}}>
                  {options.length===0
                    ? <p style={{color:"var(--t3)",fontSize:13}}>No options available</p>
                    : options.map((opt,oi)=>(
                        <motion.button key={oi} whileHover={{scale:1.05,y:-2}} whileTap={{scale:0.96}}
                          className={`meal-opt ${sel===oi&&selDiet===diet?"sel":""}`}
                          onClick={()=>setPreference(day,name,oi,diet)}>
                          {sel===oi&&selDiet===diet&&<CheckCircle2 size={13} style={{marginRight:4}}/>}{opt}
                        </motion.button>
                      ))
                  }
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
};

const StudentDashboard = () => {
  const { preferences, leaveDates, user, menu, weekDiet } = useContext(AppContext);
  const [activeDay, setActiveDay] = useState(null);
  const diet = weekDiet || "veg";
  const total = Object.values(preferences).reduce((a,d)=>a+Object.keys(d).length,0);
  const hour = new Date().getHours();
  const greeting = hour<12?"Good Morning":hour<17?"Good Afternoon":"Good Evening";
  const todayAbbr = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][new Date().getDay()];
  const pct = Math.min((total/21)*100,100);

  // Build dynamic meal summary for today
  const todayPrefs = preferences[todayAbbr] || {};
  const todayMeals = MEALS.map(meal => {
    const pref = todayPrefs[meal];
    const sel = pref?.choiceIndex ?? (typeof pref === "number" ? pref : undefined);
    const mealMenu = menu[todayAbbr]?.[meal];
    const options = mealMenu?.[diet] || (Array.isArray(mealMenu) ? mealMenu : []);
    const itemName = sel !== undefined ? options[sel] : null;
    return { meal, itemName, selected: sel !== undefined };
  });

  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} style={{padding:"20px 16px 100px"}}>
      <AnimatePresence>{activeDay&&<MealDrawer day={activeDay} onClose={()=>setActiveDay(null)}/>}</AnimatePresence>

      {/* Greeting + progress */}
      <div style={{marginBottom:20,padding:"20px 22px",borderRadius:20,background:"linear-gradient(135deg,rgba(155,63,168,0.07),rgba(224,92,138,0.05),rgba(249,178,52,0.03))",border:"1px solid rgba(224,92,138,0.12)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
          <div>
            <p style={{fontSize:12,fontWeight:600,color:"var(--am)",marginBottom:3}}>{greeting}</p>
            <h2 style={{fontSize:22,fontWeight:900,color:"var(--t1)",letterSpacing:"-0.5px"}}>{user?.name?.split(" ")[0] || "Student"}</h2>
          </div>
          <div style={{textAlign:"right"}}>
            <p style={{fontSize:11,color:"var(--t3)",marginBottom:2}}>This week</p>
            <p style={{fontSize:20,fontWeight:900,background:"linear-gradient(135deg,#9b3fa8,#e05c8a,#f9b234)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{total}<span style={{fontSize:13,fontWeight:600}}>/21</span></p>
          </div>
        </div>
        <div className="pt" style={{marginBottom:6}}><motion.div className="pb" initial={{width:0}} animate={{width:`${pct}%`}} transition={{duration:1.2,delay:0.3,ease:[0.22,1,0.36,1]}}/></div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <p style={{fontSize:11,color:"var(--t3)"}}>Meals selected</p>
          {total===21 ? <p style={{fontSize:11,color:"var(--vg)",fontWeight:700}}>All meals set ✓</p> : <p style={{fontSize:11,color:"var(--t3)"}}>{21-total} remaining</p>}
        </div>
      </div>

      {/* Stats row */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:20}}>
        {[
          {label:"Meals Set",value:total,icon:"🍽️",color:"#9b3fa8"},
          {label:"Leave Days",value:leaveDates.length,icon:"📅",color:"#e05c8a"},
          {label:"Diet",value:diet==="veg"?"Veg":"Non-Veg",icon:diet==="veg"?"🥦":"🍗",color:diet==="veg"?"#15803d":"#c2410c"},
        ].map((s,i)=>(
          <motion.div key={i} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:0.1+i*0.07}}
            style={{background:"var(--s1)",borderRadius:14,padding:"14px 12px",border:"1px solid var(--b1)",textAlign:"center",boxShadow:"0 2px 8px rgba(155,63,168,0.05)"}}>
            <span style={{fontSize:20,display:"block",marginBottom:6}}>{s.icon}</span>
            <p style={{fontSize:18,fontWeight:900,color:s.color,letterSpacing:"-0.5px",marginBottom:2}}>{s.value}</p>
            <p style={{fontSize:10,color:"var(--t3)",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.5px"}}>{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Today's meals — dynamic */}
      <div style={{marginBottom:20,background:"var(--s1)",borderRadius:16,border:"1px solid var(--b1)",overflow:"hidden",boxShadow:"0 2px 8px rgba(155,63,168,0.05)"}}>
        <div style={{padding:"14px 18px",borderBottom:"1px solid var(--b1)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <p style={{fontSize:13,fontWeight:800,color:"var(--t1)"}}>Today — {todayAbbr}</p>
          <button onClick={()=>setActiveDay(todayAbbr)} style={{background:"linear-gradient(135deg,#9b3fa8,#e05c8a)",border:"none",borderRadius:50,padding:"5px 14px",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"var(--fn)"}}>Edit</button>
        </div>
        {todayMeals.map(({meal,itemName,selected},i)=>{
          const icons = {Breakfast:Coffee,Lunch:Sun,Dinner:Moon};
          const Icon = icons[meal];
          const accents = ["#f9b234","#f4845f","#e05c8a"];
          return (
            <div key={meal} style={{padding:"12px 18px",display:"flex",alignItems:"center",gap:12,borderBottom:i<2?"1px solid var(--b1)":"none"}}>
              <div style={{width:34,height:34,borderRadius:10,background:`${accents[i]}12`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <Icon size={15} color={accents[i]}/>
              </div>
              <div style={{flex:1}}>
                <p style={{fontSize:12,color:"var(--t3)",fontWeight:600,marginBottom:1}}>{meal}</p>
                <p style={{fontSize:14,fontWeight:700,color:selected?"var(--t1)":"var(--t3)"}}>{itemName || "Not selected"}</p>
              </div>
              {selected
                ? <div style={{width:22,height:22,borderRadius:"50%",background:"rgba(22,163,74,0.12)",display:"flex",alignItems:"center",justifyContent:"center"}}><CheckCircle2 size={13} color="#15803d"/></div>
                : <div style={{width:22,height:22,borderRadius:"50%",background:"rgba(220,38,38,0.08)",display:"flex",alignItems:"center",justifyContent:"center"}}><AlertCircle size={13} color="var(--dn)"/></div>
              }
            </div>
          );
        })}
      </div>

      {/* Weekly schedule */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <p style={{fontSize:12,fontWeight:700,color:"var(--t2)",textTransform:"uppercase",letterSpacing:"0.8px"}}>Weekly Schedule</p>
        <p style={{fontSize:11,color:"var(--t3)"}}>Tap to manage</p>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:6}}>
        {DAYS.map(day=>{
          const dp = preferences[day]||{};
          const count = Object.keys(dp).length;
          const done = count===3;
          const isToday = day===todayAbbr;
          const isActive = activeDay===day;
          return (
            <motion.div key={day} className={`day-card ${done?"done":""} ${isActive?"active-day":""}`}
              whileHover={{y:-3}} whileTap={{scale:0.95}} onClick={()=>setActiveDay(day)}>
              {isToday&&<div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,#9b3fa8,#e05c8a,#f9b234)"}}/>}
              <p style={{fontSize:9,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.5px",color:isToday?"var(--pk)":done?"var(--am)":"var(--t3)",marginBottom:4}}>{day}</p>
              <p style={{fontSize:18,fontWeight:900,letterSpacing:"-1px",
                background:done?"linear-gradient(135deg,#9b3fa8,#e05c8a,#f9b234)":"none",
                WebkitBackgroundClip:done?"text":"unset",WebkitTextFillColor:done?"transparent":"var(--t3)",
                color:done?"transparent":"var(--t3)",marginBottom:5}}>{count}</p>
              <div style={{display:"flex",flexDirection:"column",gap:2,alignItems:"center"}}>
                {[{key:"Breakfast",icon:Coffee},{key:"Lunch",icon:Sun},{key:"Dinner",icon:Moon}].map(({key,icon:Icon})=>{
                  const has = dp[key]!==undefined;
                  return (
                    <div key={key} style={{display:"flex",alignItems:"center",gap:2}}>
                      <Icon size={7} color={has?"var(--am)":"var(--t3)"} style={{opacity:has?1:0.3}}/>
                      {has
                        ? <div style={{width:4,height:4,borderRadius:"50%",background:"var(--vg)"}}/>
                        : <div className="missed-dot" style={{width:3,height:3}}/>
                      }
                    </div>
                  );
                })}
              </div>
              {done&&<div style={{position:"absolute",top:3,right:3,width:14,height:14,borderRadius:"50%",background:"rgba(22,163,74,0.15)",display:"flex",alignItems:"center",justifyContent:"center"}}><CheckCircle2 size={8} color="#15803d"/></div>}
            </motion.div>
          );
        })}
      </div>

      {total===0&&(
        <motion.div initial={{opacity:0}} animate={{opacity:1}} style={{marginTop:16,padding:"20px",borderRadius:14,background:"var(--s1)",border:"1px solid var(--b1)",textAlign:"center"}}>
          <p style={{fontSize:14,color:"var(--t1)",fontWeight:700,marginBottom:4}}>No meals selected yet</p>
          <p style={{fontSize:12,color:"var(--t3)"}}>Tap any day card above to get started</p>
        </motion.div>
      )}
    </motion.div>
  );
};

const MealSelection = () => {
  const { preferences, setPreference, menu, weekDiet } = useContext(AppContext);
  const [selectedDay, setSelectedDay] = useState("Mon");
  const diet = weekDiet || "veg";
  const mealDefs = [
    { name:"Breakfast", icon:Coffee, time:"7:00 - 9:00 AM",  accent:"#f9b234", bg:"rgba(249,178,52,0.06)"  },
    { name:"Lunch",     icon:Sun,    time:"12:00 - 2:00 PM", accent:"#f4845f", bg:"rgba(244,132,95,0.06)"  },
    { name:"Dinner",    icon:Moon,   time:"7:30 - 9:30 PM",  accent:"#e05c8a", bg:"rgba(224,92,138,0.06)" },
  ];
  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} style={{padding:"20px 16px 100px"}}>
      <p style={{fontSize:12,fontWeight:700,color:"var(--pk)",textTransform:"uppercase",letterSpacing:"1px",marginBottom:4}}>Meal Selection</p>
      <h2 style={{fontSize:22,fontWeight:900,color:"var(--t1)",marginBottom:16,letterSpacing:"-0.5px"}}>Choose Your Meals</h2>
      <div style={{padding:"12px 16px",borderRadius:12,marginBottom:20,background:diet==="veg"?"rgba(22,163,74,0.08)":"rgba(234,88,12,0.08)",border:`1px solid ${diet==="veg"?"rgba(22,163,74,0.2)":"rgba(234,88,12,0.2)"}`,display:"flex",alignItems:"center",gap:12}}>
        <span style={{fontSize:22}}>{diet==="veg"?"🥦":"🍗"}</span>
        <div style={{flex:1}}>
          <p style={{fontWeight:700,fontSize:13,color:diet==="veg"?"#15803d":"#c2410c"}}>{diet==="veg"?"Vegetarian":"Non-Vegetarian"} — Week preference 🔒</p>
          <p style={{fontSize:11,color:"var(--t3)"}}>Showing {diet==="veg"?"vegetarian":"non-vegetarian"} options only</p>
        </div>
      </div>
      <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:8,marginBottom:22}}>
        {DAYS.map(day=>{
          const hasSel = preferences[day]&&Object.keys(preferences[day]).length>0;
          const isActive = selectedDay===day;
          return (
            <button key={day} onClick={()=>setSelectedDay(day)}
              style={{flex:"0 0 auto",padding:"9px 18px",borderRadius:50,border:"none",cursor:"pointer",fontFamily:"var(--fn)",fontWeight:700,fontSize:13,transition:"all 0.2s",position:"relative",
                background:isActive?"linear-gradient(135deg,#9b3fa8,#e05c8a)":"var(--s3)",
                color:isActive?"#fff":"var(--t3)",
                boxShadow:isActive?"0 4px 16px rgba(155,63,168,0.3)":"none",
                transform:isActive?"translateY(-1px)":"none"}}>
              {day}
              {hasSel&&!isActive&&<div style={{position:"absolute",top:3,right:3,width:6,height:6,borderRadius:"50%",background:"var(--vg)",boxShadow:"0 0 6px rgba(22,163,74,0.5)"}}/>}
            </button>
          );
        })}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        {mealDefs.map(({name,icon:Icon,time,accent,bg},mi)=>{
          const dayMenu = menu[selectedDay]?.[name];
          const options = dayMenu?.[diet]||(Array.isArray(dayMenu)?dayMenu:[]);
          const pref = preferences[selectedDay]?.[name];
          const sel = pref?.choiceIndex??(typeof pref==="number"?pref:undefined);
          const selDiet = pref?.diet||"veg";
          const isDone = sel!==undefined&&selDiet===diet;
          return (
            <motion.div key={name} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:mi*0.08}}
              style={{background:bg,borderRadius:20,overflow:"hidden",border:`1px solid ${accent}20`,boxShadow:`0 4px 16px ${accent}0d`}}>
              <div style={{padding:"16px 20px",display:"flex",alignItems:"center",gap:14,borderBottom:`1px solid ${accent}15`}}>
                <div style={{width:44,height:44,borderRadius:14,background:`${accent}15`,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 4px 12px ${accent}25`}}>
                  <Icon size={20} color={accent}/>
                </div>
                <div style={{flex:1}}>
                  <p style={{fontWeight:800,fontSize:16,color:"var(--t1)",marginBottom:2}}>{name}</p>
                  <p style={{fontSize:11,color:"var(--t3)",fontWeight:500}}>{time}</p>
                </div>
                {isDone
                  ? <motion.div initial={{scale:0}} animate={{scale:1}} className="check-anim" style={{background:`linear-gradient(135deg,${accent},${accent}cc)`,borderRadius:50,padding:"5px 14px",fontSize:12,color:"#fff",fontWeight:700,boxShadow:`0 4px 12px ${accent}35`}}>Selected</motion.div>
                  : <div style={{background:"rgba(220,38,38,0.06)",border:"1px solid rgba(220,38,38,0.15)",borderRadius:50,padding:"5px 14px",fontSize:12,color:"var(--dn)",fontWeight:600}}>Not set</div>
                }
              </div>
              <div style={{padding:"16px 20px",display:"flex",flexWrap:"wrap",gap:10}}>
                {options.length===0
                  ? <p style={{color:"var(--t3)",fontSize:13}}>No options available</p>
                  : options.map((opt,oi)=>{
                      const isSelected = sel===oi&&selDiet===diet;
                      return (
                        <motion.button key={oi} whileHover={{scale:1.05,y:-2}} whileTap={{scale:0.96}}
                          className={`meal-opt ${isSelected?"sel":""}`}
                          onClick={()=>setPreference(selectedDay,name,oi,diet)}>
                          {isSelected&&<CheckCircle2 size={13} style={{marginRight:4}}/>}{opt}
                        </motion.button>
                      );
                    })
                }
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};

const LeaveCalendar = () => {
  const { leaveDates, toggleLeave } = useContext(AppContext);
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const mNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const dim = getDIM(viewYear,viewMonth);
  const fd = getFD(viewYear,viewMonth);
  const mkD = d => `${viewYear}-${String(viewMonth+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  const nav = dir => { let m=viewMonth+dir,y=viewYear; if(m<0){m=11;y--;}else if(m>11){m=0;y++;} setViewMonth(m);setViewYear(y); };
  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} style={{padding:"20px 16px 100px"}}>
      <p style={{fontSize:12,fontWeight:700,color:"var(--pk)",textTransform:"uppercase",letterSpacing:"1px",marginBottom:4}}>Leave Calendar</p>
      <h2 style={{fontSize:22,fontWeight:900,color:"var(--t1)",marginBottom:4,letterSpacing:"-0.5px"}}>Mark Absences</h2>
      <p style={{color:"var(--t3)",fontSize:13,marginBottom:18}}>Tap a date to mark leave</p>
      {leaveDates.length>0&&<div style={{marginBottom:14,padding:"10px 14px",borderRadius:50,background:"rgba(220,38,38,0.06)",border:"1px solid rgba(220,38,38,0.15)",display:"inline-flex",alignItems:"center",gap:8}}><AlertCircle size={14} color="var(--dn)"/><span style={{fontSize:13,color:"var(--dn)",fontWeight:600}}>{leaveDates.length} leave day{leaveDates.length>1?"s":""} marked</span></div>}
      <div style={{background:"var(--s1)",borderRadius:20,overflow:"hidden",border:"1px solid var(--b1)",boxShadow:"0 4px 20px rgba(155,63,168,0.08)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 18px",borderBottom:"1px solid var(--b1)",background:"linear-gradient(135deg,rgba(155,63,168,0.06),rgba(224,92,138,0.04))"}}>
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
              const isL=leaveDates.includes(ds),isT=d===today.getDate()&&viewMonth===today.getMonth()&&viewYear===today.getFullYear(),isP=new Date(viewYear,viewMonth,d)<new Date(today.toDateString());
              return <motion.button key={d} whileTap={{scale:0.85}} onClick={()=>!isP&&toggleLeave(ds)}
                style={{aspectRatio:"1",borderRadius:50,border:"none",fontFamily:"var(--fn)",fontSize:13,fontWeight:isT||isL?700:400,cursor:isP?"default":"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.12s",opacity:isP?0.3:1,
                  background:isL?"linear-gradient(135deg,#e05c8a,#f4845f)":isT?"linear-gradient(135deg,#9b3fa8,#e05c8a)":"transparent",
                  color:isL||isT?"#fff":"var(--t1)",
                  boxShadow:isT&&!isL?"0 0 0 2px var(--pk)":"none"}}>{d}</motion.button>;
            })}
          </div>
        </div>
        <div style={{padding:"10px 16px",borderTop:"1px solid var(--b1)",display:"flex",gap:14}}>
          <div style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:10,height:10,borderRadius:"50%",background:"linear-gradient(135deg,#9b3fa8,#e05c8a)"}}/><span style={{fontSize:11,color:"var(--t3)"}}>Today</span></div>
          <div style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:10,height:10,borderRadius:"50%",background:"linear-gradient(135deg,#e05c8a,#f4845f)"}}/><span style={{fontSize:11,color:"var(--t3)"}}>On Leave</span></div>
        </div>
      </div>
      {leaveDates.length>0&&(
        <div style={{marginTop:18}}>
          <p style={{fontSize:12,color:"var(--t3)",fontWeight:600,marginBottom:10,textTransform:"uppercase",letterSpacing:"0.8px"}}>Marked Absences</p>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {[...leaveDates].sort().map(d=>(
              <div key={d} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"var(--s1)",border:"1px solid var(--b1)",borderRadius:14,padding:"12px 16px",boxShadow:"0 2px 8px rgba(155,63,168,0.06)"}}>
                <span style={{fontSize:13,color:"var(--t1)",fontWeight:500}}>{new Date(d+"T00:00:00").toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long"})}</span>
                <button onClick={()=>toggleLeave(d)} style={{background:"rgba(220,38,38,0.06)",border:"1px solid rgba(220,38,38,0.15)",borderRadius:50,color:"var(--dn)",cursor:"pointer",padding:"5px 14px",fontSize:12,fontWeight:600,fontFamily:"var(--fn)"}}>Remove</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};

const MenuBuilder = ({ dietFilter = "veg" }) => {
  const { menu, setMenu, setMenuRaw } = useContext(AppContext);

  const [selectedDay, setSelectedDay] = useState("Mon");

  const [defaults, setDefaults] = useState({});
  const [savingDefault, setSavingDefault] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editVal, setEditVal] = useState("");

  // Always fetch fresh menu+defaults from API on mount and after any default change
  const loadDefaults = () => {
    api.getMenu().then(freshMenu => {
      if (Object.keys(freshMenu).length) {
        setMenuRaw(freshMenu);  // update local state only, no API call
        const d = {};
        Object.entries(freshMenu).forEach(([day, data]) => {
          d[day] = d[day] || {};
          MEALS.forEach(meal => {
            const defVeg    = data.defaults?.[meal]?.veg;
            const defNonVeg = data.defaults?.[meal]?.nonVeg;
            d[day][meal + "_veg"]    = (defVeg    != null) ? Number(defVeg)    : null;
            d[day][meal + "_nonVeg"] = (defNonVeg != null) ? Number(defNonVeg) : null;
          });
        });
        setDefaults(d);
      }
    }).catch(console.error);
  };

  useEffect(() => { loadDefaults(); }, []); // eslint-disable-line

  const getOptions = (meal, diet) => {

    const m = menu[selectedDay]?.[meal];

    if (!m) return [];

    return Array.isArray(m) ? m : (m[diet] || []);

  };

  const updateOptions = (meal, diet, newArr) => {

    const current = menu[selectedDay]?.[meal];

    let updated;

    if (Array.isArray(current)) {

      // migrate flat array to veg/nonVeg structure

      updated = { veg: diet === "veg" ? newArr : current, nonVeg: diet === "nonVeg" ? newArr : [] };

    } else {

      updated = { ...(current || { veg: [], nonVeg: [] }), [diet]: newArr };

    }

    setMenu(selectedDay, { ...menu[selectedDay], [meal]: updated });

  };

  const addOption = (meal, diet) => updateOptions(meal, diet, [...getOptions(meal, diet), "New Item"]);

  const removeOption = (meal, diet, idx) => updateOptions(meal, diet, getOptions(meal, diet).filter((_, i) => i !== idx));

  const handleEdit = (meal, diet, idx, val) => { updateOptions(meal, diet, getOptions(meal, diet).map((o, i) => i === idx ? val : o)); setEditing(null); };

  const setDefault = async (meal, diet, idx) => {
    const defKey = meal + '_' + diet;
    const cur = defaults[selectedDay]?.[defKey];
    const nv = cur === idx ? null : idx;
    setSavingDefault(defKey);
    try {
      await api.setDefaultFood(selectedDay, meal, diet, nv);
      // Reload from API to ensure persistence
      loadDefaults();
    }
    catch (e) { console.error(e); } finally { setSavingDefault(null); }
  };

  const mC = ["#f9b234", "#f4845f", "#e05c8a"];

  const dietSections = [

    { id: "veg",    label: "Vegetarian",     emoji: "ðŸ¥¦", color: "#16a34a", bg: "rgba(22,163,74,0.06)",  border: "rgba(22,163,74,0.2)"  },

    { id: "nonVeg", label: "Non-Vegetarian", emoji: "ðŸ—", color: "#ea580c", bg: "rgba(234,88,12,0.06)",  border: "rgba(234,88,12,0.2)"  },

  ];
  const filteredSections = dietSections.filter(s => s.id === dietFilter);

  return (

    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: "20px 16px 100px" }}>

      <p style={{ fontSize: 12, fontWeight: 700, color: "var(--pk)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 4 }}>Menu Builder</p>

      <h2 style={{ fontSize: 22, fontWeight: 900, color: "var(--t1)", marginBottom: 16, letterSpacing: "-0.5px" }}>{dietFilter === "veg" ? "Vegetarian Menu" : "Non-Vegetarian Menu"}</h2>

      {/* Day selector */}

      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 22 }}>

        {DAYS.map(day => (

          <button key={day} onClick={() => setSelectedDay(day)}

            style={{ flex: "0 0 auto", padding: "9px 18px", borderRadius: 50, border: "none", cursor: "pointer", fontFamily: "var(--fn)", fontWeight: 700, fontSize: 13, transition: "all 0.2s",

              background: selectedDay === day ? "linear-gradient(135deg,#9b3fa8,#e05c8a)" : "var(--s3)",

              color: selectedDay === day ? "#fff" : "var(--t3)",

              boxShadow: selectedDay === day ? "0 4px 14px rgba(155,63,168,0.3)" : "none" }}>

            {day}

          </button>

        ))}

      </div>

      {/* Meal sections */}

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {MEALS.map((meal, mi) => {

          const Icon = getIcon(meal);

          const curDef = defaults[selectedDay]?.[meal];

          return (

            <div key={meal} style={{ background: "var(--s1)", borderRadius: 20, overflow: "hidden", border: `1px solid ${mC[mi]}20`, boxShadow: "0 2px 12px rgba(155,63,168,0.06)" }}>

              {/* Meal header */}

              <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 12, background: `rgba(${mi===0?"249,178,52":mi===1?"244,132,95":"224,92,138"},0.06)`, borderBottom: `1px solid ${mC[mi]}15` }}>

                <div style={{ width: 40, height: 40, borderRadius: 12, background: `${mC[mi]}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>

                  <Icon size={18} color={mC[mi]} />

                </div>

                <h3 style={{ fontWeight: 800, fontSize: 16, color: "var(--t1)", flex: 1 }}>{meal}</h3>

                {(defaults[selectedDay]?.[meal+"_"+dietFilter] != null) && <span style={{ fontSize: 11, color: mC[mi], fontWeight: 700, background: `${mC[mi]}12`, padding: "3px 10px", borderRadius: 50 }}>Default set</span>}

              </div>

              {/* Veg / Non-Veg sections */}

              <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 14 }}>

                {filteredSections.map(({ id, label, emoji, color, bg, border }) => {

                  const options = getOptions(meal, id);

                  return (

                    <div key={id} style={{ background: bg, borderRadius: 14, border: `1px solid ${border}`, overflow: "hidden" }}>

                      {/* Diet section header */}

                      <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${border}` }}>

                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>

                          <span style={{ fontWeight: 700, fontSize: 14, color }}>{label}</span>

                          <span style={{ fontSize: 11, color: "var(--t3)", background: "rgba(0,0,0,0.05)", padding: "2px 8px", borderRadius: 50 }}>{options.length} items</span>

                        </div>

                        <button onClick={() => addOption(meal, id)}

                          style={{ background: color, border: "none", borderRadius: 50, padding: "5px 14px", color: "#fff", cursor: "pointer", fontSize: 12, fontFamily: "var(--fn)", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>

                          <Plus size={11} /> Add

                        </button>

                      </div>

                      {/* Items */}

                      <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>

                        {options.length === 0

                          ? <p style={{ color: "var(--t3)", fontSize: 13, fontStyle: "italic" }}>No items yet. Click Add to create one.</p>

                          : options.map((opt, oi) => {

                              const eKey = `${meal}|${id}|${oi}`;

                              const defKey = meal + "_" + id;
                              const storedDef = defaults[selectedDay]?.[defKey];
                              const isDef = storedDef != null && Number(storedDef) === oi;

                              return (

                                <div key={oi} style={{ display: "flex", alignItems: "center", gap: 10, background: isDef ? `${color}10` : "rgba(255,255,255,0.7)", borderRadius: 10, padding: "9px 12px", border: `1px solid ${isDef ? color + "30" : "rgba(0,0,0,0.06)"}` }}>

                                  <GripVertical size={13} color="var(--t3)" style={{ cursor: "grab" }} />

                                  {editing === eKey

                                    ? <input value={editVal} onChange={e => setEditVal(e.target.value)} onBlur={() => handleEdit(meal, id, oi, editVal)} onKeyDown={e => e.key === "Enter" && handleEdit(meal, id, oi, editVal)} autoFocus style={{ flex: 1, background: "transparent", border: "none", color: "var(--t1)", fontFamily: "var(--fn)", fontSize: 14, outline: "none" }} />

                                    : <span style={{ flex: 1, fontSize: 14, color: "var(--t1)", fontWeight: 500 }}>{opt}</span>

                                  }

                                  {

                                    <button onClick={() => setDefault(meal, id, oi)} disabled={savingDefault === meal + "_" + id} title={isDef ? "Remove default" : "Set as default"}

                                      style={{ background: isDef ? `${color}15` : "none", border: isDef ? `1px solid ${color}30` : "none", borderRadius: 50, cursor: "pointer", color: isDef ? color : "var(--t3)", padding: "3px 10px", fontSize: 11, fontFamily: "var(--fn)", fontWeight: 700, display: "flex", alignItems: "center", gap: 3 }}>

                                      <Star size={11} fill={isDef ? color : "none"} />{isDef ? "Default" : "Set default"}

                                    </button>

                                  }

                                  <button onClick={() => { setEditing(eKey); setEditVal(opt); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t3)", padding: 3 }}><Edit3 size={13} /></button>

                                  <button onClick={() => removeOption(meal, id, oi)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--dn)", padding: 3 }}><Trash2 size={13} /></button>

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

          );

        })}

      </div>

    </motion.div>

  );

};

const Analytics = () => {
  const [selDay, setSelDay] = useState("Mon");
  const [dietTab, setDietTab] = useState("veg");
  const [data, setData] = useState({});
  const [stats, setStats] = useState({totalStudents:0,responded:0,onLeaveToday:0});
  const [dietSummary, setDietSummary] = useState({veg:0,nonVeg:0,noChoice:0,total:0});
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    api.getAnalytics().then(d=>{if(Object.keys(d).length)setData(d);}).catch(console.error);
    api.getStats().then(s=>setStats(s)).catch(console.error);
    api.getDietSummary().then(s=>setDietSummary(s)).catch(console.error);
  }, [selDay, dietTab]);

  const dayData = data[selDay]||{};
  const mC=["#9b3fa8","#e05c8a","#f4845f"];

  // Data is now pre-bucketed by diet from the backend — no keyword guessing
  const getMealData = (meal) => {
    const mealData = dayData?.[meal];
    if (!mealData) return {};
    // New format: { veg: { item: count }, nonVeg: { item: count } }
    if (mealData[dietTab] && typeof mealData[dietTab] === "object") return mealData[dietTab];
    // If it's a flat object (old format), return empty — don't mix diets
    return {};
  };

  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} style={{padding:"20px 16px 100px"}}>
      <p style={{fontSize:12,fontWeight:700,color:"var(--pk)",textTransform:"uppercase",letterSpacing:"1px",marginBottom:4}}>Analytics</p>
      <h2 style={{fontSize:22,fontWeight:900,color:"var(--t1)",marginBottom:16,letterSpacing:"-0.5px"}}>Preference Breakdown</h2>

      {/* Summary stats */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>
        {[{label:"Students",value:stats.totalStudents,color:"#9b3fa8"},{label:"Responded",value:stats.responded,color:"#e05c8a"},{label:"On Leave",value:stats.onLeaveToday,color:"#f9b234"}].map((s,i)=>(
          <div key={i} style={{background:"var(--s1)",border:`1px solid ${s.color}20`,borderRadius:14,padding:"14px 12px",textAlign:"center",boxShadow:"0 2px 8px rgba(155,63,168,0.05)"}}>
            <p style={{fontSize:24,fontWeight:900,color:s.color,letterSpacing:"-1px"}}>{s.value}</p>
            <p style={{fontSize:10,color:"var(--t3)",fontWeight:600,marginTop:2,textTransform:"uppercase",letterSpacing:"0.5px"}}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Veg vs Non-Veg student count */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:18}}>
        <div style={{background:"rgba(22,163,74,0.06)",border:"1px solid rgba(22,163,74,0.2)",borderRadius:14,padding:"14px 16px",display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:40,height:40,borderRadius:12,background:"rgba(22,163,74,0.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>V</div>
          <div>
            <p style={{fontSize:22,fontWeight:900,color:"#15803d",letterSpacing:"-1px"}}>{dietSummary.veg}</p>
            <p style={{fontSize:11,color:"var(--t3)",fontWeight:600}}>Vegetarian students</p>
          </div>
        </div>
        <div style={{background:"rgba(234,88,12,0.06)",border:"1px solid rgba(234,88,12,0.2)",borderRadius:14,padding:"14px 16px",display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:40,height:40,borderRadius:12,background:"rgba(234,88,12,0.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>N</div>
          <div>
            <p style={{fontSize:22,fontWeight:900,color:"#c2410c",letterSpacing:"-1px"}}>{dietSummary.nonVeg}</p>
            <p style={{fontSize:11,color:"var(--t3)",fontWeight:600}}>Non-Veg students</p>
          </div>
        </div>
      </div>

      {/* Veg / Non-Veg tab */}
      <div style={{display:"flex",background:"var(--s3)",borderRadius:50,padding:3,marginBottom:16,border:"1px solid var(--b1)"}}>
        {[{id:"veg",label:"Vegetarian",color:"#15803d"},{id:"nonVeg",label:"Non-Vegetarian",color:"#c2410c"}].map(t=>(
          <button key={t.id} onClick={()=>{setDietTab(t.id);setExpanded(null);}}
            style={{flex:1,padding:"10px",borderRadius:50,border:"none",cursor:"pointer",fontFamily:"var(--fn)",fontWeight:700,fontSize:13,transition:"all 0.2s",
              background:dietTab===t.id?`linear-gradient(135deg,${t.color},${t.color}cc)`:"transparent",
              color:dietTab===t.id?"#fff":"var(--t3)",
              boxShadow:dietTab===t.id?`0 4px 14px ${t.color}40`:"none"}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Day selector */}
      <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:8,marginBottom:16}}>
        {DAYS.map(day=>(
          <button key={day} onClick={()=>setSelDay(day)}
            style={{flex:"0 0 auto",padding:"8px 16px",borderRadius:50,border:"none",background:selDay===day?"linear-gradient(135deg,#9b3fa8,#e05c8a)":"var(--s3)",color:selDay===day?"#fff":"var(--t3)",fontFamily:"var(--fn)",fontWeight:700,fontSize:13,cursor:"pointer",boxShadow:selDay===day?"0 4px 14px rgba(155,63,168,0.3)":"none"}}>
            {day}
          </button>
        ))}
      </div>

      {/* Meal breakdown */}
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {MEALS.map((meal,mi)=>{
          const Icon=getIcon(meal);
          const mdata = getMealData(meal);
          const total = Object.values(mdata).reduce((a,b)=>a+b,0);
          const sorted = Object.entries(mdata).sort((a,b)=>b[1]-a[1]);
          const isExp = expanded===`${meal}-${dietTab}`;
          return (
            <div key={meal} style={{background:"var(--s1)",border:`1px solid ${mC[mi]}18`,borderRadius:14,overflow:"hidden",boxShadow:"0 2px 8px rgba(155,63,168,0.05)"}}>
              <button onClick={()=>setExpanded(isExp?null:`${meal}-${dietTab}`)}
                style={{width:"100%",background:`linear-gradient(135deg,${mC[mi]}06,transparent)`,border:"none",cursor:"pointer",padding:"13px 16px",display:"flex",alignItems:"center",gap:10,fontFamily:"var(--fn)"}}>
                <div style={{width:34,height:34,borderRadius:10,background:`${mC[mi]}10`,display:"flex",alignItems:"center",justifyContent:"center"}}><Icon size={15} color={mC[mi]}/></div>
                <span style={{fontWeight:800,fontSize:14,color:"var(--t1)",flex:1,textAlign:"left"}}>{meal}</span>
                <span style={{fontSize:12,fontWeight:700,color:mC[mi],background:`${mC[mi]}10`,padding:"3px 10px",borderRadius:50}}>{total} students</span>
                <span style={{fontSize:11,color:"var(--t3)",marginLeft:4}}>{isExp?"▲":"▼"}</span>
              </button>
              <AnimatePresence>
                {isExp&&(
                  <motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} transition={{duration:0.2}}
                    style={{padding:"0 16px 14px",overflow:"hidden"}}>
                    {sorted.length===0
                      ? <p style={{color:"var(--t3)",fontSize:13,paddingTop:8}}>No {dietTab==="veg"?"vegetarian":"non-vegetarian"} data for {selDay}</p>
                      : sorted.map(([name,count],i)=>{
                          const pct = total>0?Math.round((count/total)*100):0;
                          return (
                            <div key={name} style={{marginTop:10}}>
                              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                                <div style={{display:"flex",alignItems:"center",gap:6}}>
                                  {i===0&&<span style={{fontSize:11}}>🏆</span>}
                                  <span style={{fontSize:13,fontWeight:i===0?700:500,color:i===0?"var(--t1)":"var(--t2)"}}>{name}</span>
                                </div>
                                <div style={{display:"flex",alignItems:"center",gap:8}}>
                                  <span style={{fontSize:13,fontWeight:700,color:mC[mi]}}>{count}</span>
                                  <span style={{fontSize:11,color:"var(--t3)",background:"var(--s3)",padding:"2px 8px",borderRadius:50}}>{pct}%</span>
                                </div>
                              </div>
                              <div className="pt">
                                <motion.div className="pb" initial={{width:0}} animate={{width:`${pct}%`}} transition={{delay:i*0.05,duration:0.5}}
                                  style={{background:`linear-gradient(90deg,${mC[mi]},#f9b234)`}}/>
                              </div>
                            </div>
                          );
                        })
                    }
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};

const ManagerDashboard = () => {
  const [stats, setStats] = useState({totalStudents:0,onLeaveToday:0,responded:0,pending:0});
  const [analyticsData, setAnalyticsData] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeCard, setActiveCard] = useState(null);
  useEffect(() => { Promise.all([api.getStats(),api.getAnalytics()]).then(([s,a])=>{setStats(s);setAnalyticsData(a);}).catch(console.error).finally(()=>setLoading(false)); }, []);
  const todayKey=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][new Date().getDay()];
  const todayData=analyticsData[todayKey]||{};
  const topPicks=Object.entries(todayData).map(([meal,mealData])=>{
    // New format: { veg: {...}, nonVeg: {...} } — combine both for top picks
    let items = {};
    if (mealData && typeof mealData === "object") {
      if (mealData.veg) Object.entries(mealData.veg).forEach(([k,v])=>{ items[k]=(items[k]||0)+v; });
      if (mealData.nonVeg) Object.entries(mealData.nonVeg).forEach(([k,v])=>{ items[k]=(items[k]||0)+v; });
      // Fallback flat format
      if (!mealData.veg && !mealData.nonVeg) items = mealData;
    }
    const sorted=Object.entries(items).sort((a,b)=>b[1]-a[1]);
    if(!sorted.length)return null;
    const total=Object.values(items).reduce((a,b)=>a+b,0);
    return{meal,item:sorted[0][0],count:sorted[0][1],total};
  }).filter(Boolean);
  const rPct=stats.totalStudents>0?Math.round((stats.responded/stats.totalStudents)*100):0;
  const cards=[{label:"Total Students",value:stats.totalStudents,icon:Users,color:"#9b3fa8"},{label:"Responded",value:stats.responded,icon:CheckCircle2,color:"#e05c8a"},{label:"On Leave",value:stats.onLeaveToday,icon:AlertCircle,color:"#f9b234"},{label:"Pending",value:stats.pending,icon:Clock,color:"#f4845f"}];
  const mC=["#9b3fa8","#e05c8a","#f4845f"];
  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} style={{padding:"20px 16px 100px"}}>
      <div style={{background:"linear-gradient(135deg,rgba(155,63,168,0.08),rgba(224,92,138,0.06),rgba(249,178,52,0.04))",border:"1px solid rgba(224,92,138,0.15)",borderRadius:20,padding:"20px",marginBottom:20}}>
        <p style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:"var(--pk)",marginBottom:4}}>Live Overview</p>
        <h2 style={{fontSize:22,fontWeight:900,color:"var(--t1)",letterSpacing:"-0.5px",marginBottom:10}}>Today's Mess Summary</h2>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
          <span style={{fontSize:13,color:"var(--t2)"}}>Response rate</span>
          <span style={{fontSize:15,fontWeight:900,background:"linear-gradient(135deg,#9b3fa8,#e05c8a)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{rPct}%</span>
          <span style={{fontSize:12,color:"var(--t3)"}}>({stats.responded} of {stats.totalStudents})</span>
        </div>
        <div className="pt" style={{height:8,borderRadius:4}}><motion.div className="pb" initial={{width:0}} animate={{width:`${rPct}%`}} transition={{duration:1,delay:0.2}} style={{borderRadius:4}}/></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
        {cards.map((s,i)=>(
          <motion.div key={i} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:i*0.07}} whileHover={{scale:1.02}} whileTap={{scale:0.98}} onClick={()=>setActiveCard(activeCard===i?null:i)}
            style={{background:"var(--s1)",border:`1px solid ${s.color}20`,borderRadius:16,padding:"16px",cursor:"pointer",boxShadow:"0 2px 12px rgba(155,63,168,0.06)",transition:"border-color 0.2s",borderColor:activeCard===i?s.color+"50":""}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div><p style={{fontSize:11,color:"var(--t3)",fontWeight:600,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.8px"}}>{s.label}</p><p style={{fontSize:30,fontWeight:900,color:s.color,letterSpacing:"-1.5px"}}>{loading?"—":s.value}</p></div>
              <div style={{width:38,height:38,borderRadius:12,background:`${s.color}12`,display:"flex",alignItems:"center",justifyContent:"center"}}><s.icon size={19} color={s.color}/></div>
            </div>
            <AnimatePresence>{activeCard===i&&<motion.p initial={{opacity:0,height:0}} animate={{opacity:1,height:"auto"}} exit={{opacity:0,height:0}} style={{fontSize:12,color:s.color,fontWeight:600,marginTop:8}}>Tap to view details</motion.p>}</AnimatePresence>
          </motion.div>
        ))}
      </div>
      <div style={{background:"var(--s1)",borderRadius:16,padding:"18px",border:"1px solid var(--b1)",boxShadow:"0 2px 12px rgba(155,63,168,0.06)"}}>
        <p style={{fontSize:12,color:"var(--t3)",fontWeight:700,marginBottom:14,textTransform:"uppercase",letterSpacing:"0.8px"}}>Today's Top Picks</p>
        {loading?<p style={{color:"var(--t3)",fontSize:13}}>Loading...</p>:topPicks.length===0?<p style={{color:"var(--t3)",fontSize:13}}>No preference data yet for today.</p>:topPicks.map((t,i)=>{
          const pct=t.total>0?Math.round((t.count/t.total)*100):0;
          return (
            <div key={i} style={{marginBottom:i<topPicks.length-1?16:0}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:8,height:8,borderRadius:"50%",background:mC[i]}}/><span style={{fontSize:11,color:"var(--t3)",fontWeight:600}}>{t.meal}</span><span style={{fontSize:14,color:"var(--t1)",fontWeight:700}}>{t.item}</span></div>
                <span style={{fontSize:13,fontWeight:800,color:mC[i]}}>{t.count} students</span>
              </div>
              <div className="pt"><motion.div className="pb" initial={{width:0}} animate={{width:`${pct}%`}} transition={{delay:0.4+i*0.1,duration:0.7}} style={{background:`linear-gradient(90deg,${mC[i]},#f9b234)`}}/></div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};

const StudentApp = () => {
  const { activeTab, weekDiet, selectionOpen, currentWeekId } = useContext(AppContext);
  const tabs = [{id:"dashboard",label:"Home",icon:LayoutDashboard},{id:"meals",label:"Meals",icon:UtensilsCrossed},{id:"calendar",label:"Leave",icon:CalendarDays}];
  if (!weekDiet) return <DietSelectionScreen />;
  return (
    <div style={{minHeight:"100vh",paddingBottom:90,background:"var(--bg)"}}>
      <Header/>
      {/* Selection window banner */}
      {!selectionOpen && (
        <div style={{background:"rgba(234,88,12,0.08)",borderBottom:"1px solid rgba(234,88,12,0.2)",padding:"10px 20px",display:"flex",alignItems:"center",gap:10}}>
          <AlertCircle size={15} color="#c2410c"/>
          <p style={{fontSize:13,color:"#c2410c",fontWeight:600}}>Selection window is closed. Opens every Saturday 7:00 PM — Sunday 7:00 PM.</p>
        </div>
      )}
      {selectionOpen && (
        <div style={{background:"rgba(22,163,74,0.06)",borderBottom:"1px solid rgba(22,163,74,0.2)",padding:"10px 20px",display:"flex",alignItems:"center",gap:10}}>
          <CheckCircle2 size={15} color="#15803d"/>
          <p style={{fontSize:13,color:"#15803d",fontWeight:600}}>Selection window is open! Select your meals for week {currentWeekId}.</p>
        </div>
      )}
      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}} transition={{duration:0.2}}>
          {activeTab==="dashboard"&&<StudentDashboard/>}
          {activeTab==="meals"&&<MealSelection/>}
          {activeTab==="calendar"&&<LeaveCalendar/>}
        </motion.div>
      </AnimatePresence>
      <BottomNav tabs={tabs}/>
    </div>
  );
  return (
    <div style={{minHeight:"100vh",paddingBottom:90,background:"var(--bg)"}}>
      <Header/>
      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}} transition={{duration:0.2}}>
          {activeTab==="dashboard"&&<StudentDashboard/>}
          {activeTab==="meals"&&<MealSelection/>}
          {activeTab==="calendar"&&<LeaveCalendar/>}
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
    {id:"veg-menu",  label:"Veg Menu",  icon:ChefHat},
    {id:"nveg-menu", label:"Non-Veg",   icon:UtensilsCrossed},
    {id:"analytics", label:"Analytics", icon:BarChart3},
  ];
  return (
    <div style={{minHeight:"100vh",paddingBottom:90,background:"var(--bg)"}}>
      <Header/>
      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}} transition={{duration:0.2}}>
          {activeTab==="dashboard" && <ManagerDashboard/>}
          {activeTab==="veg-menu"  && <MenuBuilder dietFilter="veg"/>}
          {activeTab==="nveg-menu" && <MenuBuilder dietFilter="nonVeg"/>}
          {activeTab==="analytics" && <Analytics/>}
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
        {!user?(<motion.div key="auth" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><AuthScreen/></motion.div>)
        :user.type==="student"?(<motion.div key="student" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><StudentApp/></motion.div>)
        :(<motion.div key="manager" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><ManagerApp/></motion.div>)}
      </AnimatePresence>
    </div>
  );
}

export default function Root() {
  return (<><style>{S}</style><AppProvider><App/></AppProvider></>);
}
