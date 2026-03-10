import { useState, useRef, useEffect } from "react";

// ─── TOKENS ───────────────────────────────────────────────────────────────────
const C = {
  bg:"#080E1A", surface:"#0E1829", card:"#121F33", border:"#1E3050",
  borderLight:"#253A58",
  teal:"#00C896", tealDim:"#009E76",
  blue:"#2B7FFF", amber:"#FFB020", red:"#FF4D6A",
  green:"#00E5A0", purple:"#A66CFF", pink:"#FF6BB5",
  orange:"#FF7A40",
  textPrimary:"#E8F0FF", textSecondary:"#7A92B8", textMuted:"#4A6080",
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800;900&family=JetBrains+Mono:wght@400;600;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#030710;font-family:'Sora',sans-serif}
  ::-webkit-scrollbar{width:0;height:0}
  input::placeholder,textarea::placeholder{color:#4A6080}
  select option{background:#0E1829;color:#E8F0FF}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
  @keyframes ripple{0%{transform:translate(-50%,-50%) scale(1);opacity:0.6}100%{transform:translate(-50%,-50%) scale(3.5);opacity:0}}
  @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
  @keyframes slideDown{from{opacity:0;transform:translateY(-12px)}to{opacity:1;transform:translateY(0)}}
  @keyframes timerPulse{0%,100%{box-shadow:0 0 0 0 rgba(255,77,106,0.4)}50%{box-shadow:0 0 0 6px rgba(255,77,106,0)}}
`;

// ─── PRIMITIVES ───────────────────────────────────────────────────────────────
const Ic = ({ d, size=20, color=C.textSecondary, stroke=1.5, fill="none" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
    <path d={d}/>
  </svg>
);

const P = {
  home:"M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z",
  rounds:"M3 7v13M21 7v13M3 12h18M3 7h18M9 7V3M15 7V3",
  sparkle:"M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3zM5 3l.75 2.25L8 6l-2.25.75L5 9l-.75-2.25L2 6l2.25-.75L5 3z",
  brain:"M9.5 2A2.5 2.5 0 007 4.5A2.5 2.5 0 004.5 7H4a2 2 0 00-2 2v2c0 1.1.9 2 2 2h.5A2.5 2.5 0 007 15.5A2.5 2.5 0 009.5 18h5a2.5 2.5 0 002.5-2.5A2.5 2.5 0 0019.5 13H20a2 2 0 002-2V9a2 2 0 00-2-2h-.5A2.5 2.5 0 0017 4.5A2.5 2.5 0 0014.5 2h-5z",
  mic:"M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8",
  inbox:"M22 13V6a2 2 0 00-2-2H4a2 2 0 00-2 2v12c0 1.1.9 2 2 2h9M16 19h6M19 16v6",
  bell:"M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0",
  alert:"M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01",
  chat:"M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z",
  send:"M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z",
  check:"M20 6L9 17l-5-5",
  chevron:"M6 9l6 6 6-6",
  arrow:"M5 12h14M12 5l7 7-7 7",
  back:"M19 12H5M12 19l-7-7 7-7",
  pill:"M10.5 20H4a2 2 0 01-2-2V6a2 2 0 012-2h16a2 2 0 012 2v7.5M16 3v4M8 3v4M2 11h20M21.29 14.7a2.43 2.43 0 00-3.43 3.43L21 21l3.14-3.14-2.85-3.16z",
  card:"M1 4h22v16H1zM1 10h22",
  wallet:"M21 12V7H5a2 2 0 010-4h14v4M3 5v14a2 2 0 002 2h16v-5M16 13a2 2 0 100 4 2 2 0 000-4z",
  receipt:"M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8",
  escalate:"M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  pulse:"M22 12h-4l-3 9L9 3l-3 9H2",
  heart:"M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z",
  book:"M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 016.5 22H20V2H6.5A2.5 2.5 0 004 4.5v15z",
  shield:"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  sign:"M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
  lab:"M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v11l3 3 3-3V3M3 9h18",
  trending:"M23 6l-9.5 9.5-5-5L1 18",
  user:"M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8",
  refresh:"M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15",
  plus:"M12 5v14M5 12h14",
  telehealth:"M15 10l4.553-2.069A1 1 0 0121 8.868V15.13a1 1 0 01-1.447.899L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z",
  more:"M12 5v.01M12 12v.01M12 19v.01",
  close:"M18 6L6 18M6 6l12 12",
  upload:"M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12",
  calendar:"M3 4h18v18H3V4zM16 2v4M8 2v4M3 10h18",
  phone:"M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8 19.79 19.79 0 01.1 1.17 2 2 0 012.11 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.09a16 16 0 006 6l.45-.45a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z",
};

// ─── MICRO UI ─────────────────────────────────────────────────────────────────
const Badge = ({ children, color=C.teal }) => (
  <span style={{ background:`${color}22`, color, fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:99, letterSpacing:"0.04em", fontFamily:"'JetBrains Mono',monospace", whiteSpace:"nowrap" }}>
    {children}
  </span>
);

const AiBadge = ({ text="AI" }) => (
  <span style={{ background:"linear-gradient(135deg,#00C896,#2B7FFF)", color:"#fff", fontSize:9, fontWeight:800, padding:"2px 7px", borderRadius:6, letterSpacing:"0.05em" }}>{text}</span>
);

const Dot = ({ color=C.green, pulse }) => (
  <span style={{ position:"relative", display:"inline-flex", alignItems:"center", justifyContent:"center", width:10, height:10, flexShrink:0 }}>
    {pulse && <span style={{ position:"absolute", inset:-3, borderRadius:"50%", background:color, opacity:0.2, animation:"pulse 1.5s infinite" }}/>}
    <span style={{ width:7, height:7, borderRadius:"50%", background:color, display:"block" }}/>
  </span>
);

const Card = ({ children, style={}, onClick }) => (
  <div onClick={onClick} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:"13px 15px", cursor:onClick?"pointer":"default", transition:"all 0.2s", ...style }}>
    {children}
  </div>
);

const SH = ({ children, action, onAction }) => (
  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
    <span style={{ fontSize:11, fontWeight:700, color:C.textMuted, letterSpacing:"0.1em", textTransform:"uppercase" }}>{children}</span>
    {action && <span onClick={onAction} style={{ fontSize:12, color:C.teal, fontWeight:600, cursor:"pointer" }}>{action}</span>}
  </div>
);

const AiPulse = ({ size=40, active }) => (
  <div style={{ position:"relative", width:size, height:size, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
    {active && [1,2].map(i=>(
      <div key={i} style={{ position:"absolute", width:"100%", height:"100%", borderRadius:"50%", border:`1.5px solid ${C.teal}`, opacity:0.5/i, animation:`ripple 2s ${i*0.5}s infinite`, top:"50%", left:"50%", transform:"translate(-50%,-50%)" }}/>
    ))}
    <div style={{ width:size, height:size, borderRadius:"50%", background:active?`linear-gradient(135deg,${C.teal},${C.blue})`:C.surface, border:`2px solid ${active?C.teal:C.border}`, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <Ic d={P.sparkle} size={size*0.44} color="#fff" stroke={2}/>
    </div>
  </div>
);

const ScreenHeader = ({ title, sub, accent=C.teal, extra }) => (
  <div style={{ padding:"14px 16px 12px", background:C.surface, borderBottom:`1px solid ${C.border}` }}>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
      <div>
        {sub && <div style={{ fontSize:10, color:accent, fontWeight:700, letterSpacing:"0.12em", marginBottom:3, textTransform:"uppercase" }}>{sub}</div>}
        <div style={{ fontSize:19, fontWeight:900, color:C.textPrimary }}>{title}</div>
      </div>
      {extra}
    </div>
  </div>
);

// ─── SLA TIMER ────────────────────────────────────────────────────────────────
const SlaTimer = ({ minutes, critical }) => {
  const color = minutes <= 5 ? C.red : minutes <= 15 ? C.amber : C.green;
  return (
    <div style={{ background:`${color}18`, border:`1px solid ${color}44`, borderRadius:8, padding:"3px 9px", display:"flex", alignItems:"center", gap:5, animation: minutes <= 5 ? "timerPulse 1.5s infinite" : "none" }}>
      <Ic d={P.pulse} size={11} color={color}/>
      <span style={{ fontSize:11, fontWeight:800, color, fontFamily:"'JetBrains Mono',monospace" }}>{minutes}m</span>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION CENTRE (global overlay)
// ═══════════════════════════════════════════════════════════════════════════════
const NotificationCentre = ({ role, onClose, onNavigate }) => {
  const [filter, setFilter] = useState("all");

  const allNotifs = {
    doctor: [
      { id:1, type:"escalation", title:"Urgent Escalation", body:"Nurse Tariro: Tendai Moyo SpO₂ dropped to 88% — Bed C-12", time:"2 min ago", read:false, color:C.red, action:"escalations" },
      { id:2, type:"critical", title:"Critical Lab Result", body:"Felix Dube: Potassium 6.8 mEq/L — Bed G-08. Review required.", time:"8 min ago", read:false, color:C.red, action:"escalations" },
      { id:3, type:"message", title:"New Message", body:"Dr. Sithole (Cardiology): Re: Tendai Moyo referral — please confirm ASAP", time:"15 min ago", read:false, color:C.blue, action:"messages" },
      { id:4, type:"postvisit", title:"PostVisit AI Ready", body:"3 AI summaries generated and awaiting your signoff", time:"32 min ago", read:true, color:C.teal, action:"postvisit" },
      { id:5, type:"result", title:"Lab Results Back", body:"Ruth Sithole: CD4 count 312 cells/μL — Bed H-05", time:"1h ago", read:true, color:C.green, action:"escalations" },
      { id:6, type:"message", title:"New Message", body:"Nurse Blessing: Handoff notes ready for Ward C review", time:"2h ago", read:true, color:C.blue, action:"messages" },
    ],
    nurse: [
      { id:1, type:"critical", title:"Critical Alert", body:"BCMA: Insulin dose due NOW — Felix Dube Bed G-08", time:"1 min ago", read:false, color:C.red, action:"dashboard" },
      { id:2, type:"escalation", title:"Escalation Acknowledged", body:"Dr. Chinyama acknowledged: Tendai Moyo SpO₂ alert — responding", time:"5 min ago", read:false, color:C.green, action:"dashboard" },
      { id:3, type:"message", title:"New Message", body:"Dr. Chinyama: Can you recheck Chipo Ncube BP in 30 min?", time:"20 min ago", read:false, color:C.blue, action:"messages" },
      { id:4, type:"reminder", title:"Task Reminder", body:"Fetal monitoring strip due for Chipo Ncube — Bed M-03", time:"28 min ago", read:true, color:C.amber, action:"dashboard" },
      { id:5, type:"result", title:"Lab Result", body:"Ruth Sithole: CD4 result received — action may be required", time:"1h ago", read:true, color:C.teal, action:"dashboard" },
    ],
    patient: [
      { id:1, type:"reminder", title:"Medication Reminder", body:"Time to take Aspirin 75mg — with food", time:"Just now", read:false, color:C.teal, action:"meds" },
      { id:2, type:"reminder", title:"Medication Reminder", body:"Atorvastatin 40mg due tonight at 9:00 PM", time:"2h ago", read:false, color:C.teal, action:"meds" },
      { id:3, type:"message", title:"Doctor Update", body:"Dr. Chinyama left a follow-up note on your visit summary", time:"3h ago", read:false, color:C.blue, action:"visit" },
      { id:4, type:"result", title:"New Lab Result", body:"Your eGFR result is now available — tap to view", time:"4h ago", read:true, color:C.amber, action:"health" },
      { id:5, type:"bill", title:"Bill Ready", body:"Invoice INV-2024-0044: $42.00 — EcoCash payment available", time:"1d ago", read:true, color:C.orange, action:"bills" },
      { id:6, type:"appointment", title:"Appointment Reminder", body:"Follow-up with Dr. Chinyama tomorrow at 10:00 AM", time:"1d ago", read:true, color:C.purple, action:"home" },
    ],
  };

  const notifs = allNotifs[role] || [];
  const typeIcon = { escalation:P.escalate, critical:P.alert, message:P.chat, postvisit:P.sparkle, result:P.lab, reminder:P.bell, bill:P.receipt, appointment:P.calendar };
  const filters = ["all","escalation","message","result","reminder","bill"];
  const visible = filter==="all" ? notifs : notifs.filter(n=>n.type===filter);
  const unread = notifs.filter(n=>!n.read).length;

  return (
    <div style={{ position:"absolute", inset:0, background:C.bg, zIndex:100, display:"flex", flexDirection:"column", animation:"slideDown 0.25s ease" }}>
      {/* Header */}
      <div style={{ padding:"14px 16px 12px", background:C.surface, borderBottom:`1px solid ${C.border}` }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div onClick={onClose} style={{ width:32, height:32, borderRadius:10, background:C.card, border:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
              <Ic d={P.back} size={16} color={C.textSecondary}/>
            </div>
            <div>
              <div style={{ fontSize:18, fontWeight:900, color:C.textPrimary }}>Notifications</div>
              {unread>0 && <div style={{ fontSize:11, color:C.textMuted }}>{unread} unread</div>}
            </div>
          </div>
          <span style={{ fontSize:11, color:C.teal, fontWeight:600, cursor:"pointer" }}>Mark all read</span>
        </div>
        {/* Filter chips */}
        <div style={{ display:"flex", gap:6, overflowX:"auto" }}>
          {filters.map(f=>(
            <button key={f} onClick={()=>setFilter(f)} style={{ padding:"5px 12px", borderRadius:99, border:`1px solid ${filter===f?C.teal:C.border}`, background:filter===f?`${C.teal}22`:"transparent", color:filter===f?C.teal:C.textMuted, fontSize:11, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap", textTransform:"capitalize" }}>{f==="all"?"All":f}</button>
          ))}
        </div>
      </div>

      {/* List */}
      <div style={{ flex:1, overflowY:"auto", padding:"10px 14px" }}>
        {visible.length===0 && (
          <div style={{ textAlign:"center", padding:"50px 20px", color:C.textMuted }}>
            <div style={{ fontSize:28, marginBottom:8 }}>🔔</div>
            <div style={{ fontSize:14, color:C.textSecondary }}>No notifications here</div>
          </div>
        )}
        {visible.map(n=>(
          <div key={n.id} onClick={()=>{ onNavigate(n.action); onClose(); }} style={{
            background: n.read ? C.surface : C.card,
            border:`1px solid ${n.read?C.border:n.color+"33"}`,
            borderLeft:`3px solid ${n.read?C.textMuted:n.color}`,
            borderRadius:14, padding:"12px 14px", marginBottom:8, cursor:"pointer",
            animation:"fadeIn 0.2s ease",
          }}>
            <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
              <div style={{ width:34, height:34, borderRadius:10, background:`${n.color}18`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <Ic d={typeIcon[n.type]||P.bell} size={16} color={n.color}/>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:3 }}>
                  <span style={{ fontSize:13, fontWeight: n.read?600:800, color:C.textPrimary }}>{n.title}</span>
                  <span style={{ fontSize:10, color:C.textMuted, marginLeft:8, whiteSpace:"nowrap" }}>{n.time}</span>
                </div>
                <div style={{ fontSize:12, color:C.textSecondary, lineHeight:1.5 }}>{n.body}</div>
              </div>
              {!n.read && <div style={{ width:8, height:8, borderRadius:"50%", background:n.color, flexShrink:0, marginTop:4 }}/>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// DOCTOR — ESCALATION INBOX
// ═══════════════════════════════════════════════════════════════════════════════
const DoctorEscalationInbox = () => {
  const [tab, setTab] = useState("active");
  const [selected, setSelected] = useState(null);
  const [resolved, setResolved] = useState([]);

  const escalations = [
    { id:"ESC-001", patient:"Tendai Moyo", bed:"C-12", nurse:"Nurse Tariro", severity:"CRITICAL", finding:"SpO₂ dropped to 88% on room air. BP now 168/102. Patient anxious and diaphoretic.", time:"2 min ago", slaMin:3, actions:["Increase O₂ to 4L", "Review ABG"], vitals:{"SpO₂":"88%",BP:"168/102",HR:"118"}, aiSuggest:"Consider CPAP trial. Differential: flash pulmonary oedema vs NSTEMI progression. Request urgent CXR and ABG.", acked:false },
    { id:"ESC-002", patient:"Felix Dube", bed:"G-08", nurse:"Nurse Blessing", severity:"HIGH", finding:"Potassium result: 6.8 mEq/L. Patient on ACE inhibitor. No ECG changes yet but monitoring.", time:"8 min ago", slaMin:12, actions:["ECG 12-lead","Hold ACE-I","Calcium gluconate PRN"], vitals:{K:"6.8 mEq/L",HR:"78",BP:"132/80"}, aiSuggest:"Hyperkalaemia grade: severe. Immediate action: calcium gluconate 10ml IV if ECG changes. Stop ACE inhibitor and review diet/fluids.", acked:false },
    { id:"ESC-003", patient:"Chipo Ncube", bed:"M-03", nurse:"Nurse Rudo", severity:"MED", finding:"BP trending: 138/88 → 144/90 → 151/94 over 90 min. No headache yet. CTG normal.", time:"22 min ago", slaMin:38, actions:["Recheck BP in 15 min","Consider antihypertensive"], vitals:{BP:"151/94",HR:"86","SPO₂":"98%"}, aiSuggest:"Pre-eclampsia escalation pattern. If BP ≥160/110 initiate antihypertensive (Labetalol 20mg IV). WHO maternity guideline applied.", acked:true },
  ];

  const resolvedList = escalations.filter(e=>resolved.includes(e.id));
  const activeList = escalations.filter(e=>!resolved.includes(e.id));
  const displayed = tab==="active" ? activeList : resolvedList;

  const sCol = { CRITICAL:C.red, HIGH:C.amber, MED:C.blue, LOW:C.green };

  if(selected) {
    const e = escalations.find(x=>x.id===selected);
    return (
      <div style={{ paddingBottom:20 }}>
        <div style={{ padding:"14px 16px 12px", background:C.surface, borderBottom:`1px solid ${C.border}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div onClick={()=>setSelected(null)} style={{ width:32, height:32, borderRadius:10, background:C.card, border:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
              <Ic d={P.back} size={16} color={C.textSecondary}/>
            </div>
            <div>
              <div style={{ fontSize:16, fontWeight:800, color:C.textPrimary }}>{e.patient}</div>
              <div style={{ fontSize:11, color:C.textMuted }}>Bed {e.bed} · {e.id}</div>
            </div>
            <div style={{ marginLeft:"auto" }}><SlaTimer minutes={e.slaMin}/></div>
          </div>
        </div>
        <div style={{ padding:"14px 14px 0" }}>
          {/* Severity + source */}
          <div style={{ background:`${sCol[e.severity]}15`, border:`1px solid ${sCol[e.severity]}44`, borderRadius:14, padding:"12px 14px", marginBottom:12 }}>
            <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:6 }}>
              <Ic d={P.alert} size={18} color={sCol[e.severity]}/>
              <span style={{ fontSize:15, fontWeight:800, color:sCol[e.severity] }}>{e.severity} ESCALATION</span>
              <Badge color={sCol[e.severity]}>{e.time}</Badge>
            </div>
            <div style={{ fontSize:12, color:C.textMuted, marginBottom:4 }}>From: {e.nurse}</div>
            <div style={{ fontSize:13, color:C.textSecondary, lineHeight:1.65 }}>{e.finding}</div>
          </div>
          {/* Vitals at escalation */}
          <Card style={{ marginBottom:12 }}>
            <div style={{ fontSize:11, color:C.textMuted, fontWeight:700, textTransform:"uppercase", marginBottom:8 }}>Vitals at escalation</div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {Object.entries(e.vitals).map(([k,v])=>(
                <div key={k} style={{ background:C.surface, borderRadius:8, padding:"5px 10px" }}>
                  <div style={{ fontSize:9, color:C.textMuted, fontWeight:600 }}>{k}</div>
                  <div style={{ fontSize:15, fontWeight:800, color:C.textPrimary, fontFamily:"'JetBrains Mono',monospace" }}>{v}</div>
                </div>
              ))}
            </div>
          </Card>
          {/* AI suggestion */}
          <Card style={{ marginBottom:12, background:`${C.teal}08`, border:`1px solid ${C.teal}33` }}>
            <div style={{ display:"flex", gap:6, alignItems:"center", marginBottom:7 }}>
              <AiBadge text="CDSS SUGGEST"/>
              <span style={{ fontSize:10, color:C.textMuted }}>AI-assisted · citation-grounded</span>
            </div>
            <div style={{ fontSize:12, color:C.textSecondary, lineHeight:1.65 }}>{e.aiSuggest}</div>
          </Card>
          {/* Suggested actions */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:11, color:C.textMuted, fontWeight:700, textTransform:"uppercase", marginBottom:8 }}>Suggested Actions</div>
            {e.actions.map(a=>(
              <div key={a} style={{ display:"flex", gap:10, alignItems:"center", padding:"9px 0", borderBottom:`1px solid ${C.border}` }}>
                <div style={{ width:20, height:20, borderRadius:6, border:`2px solid ${C.border}`, flexShrink:0 }}/>
                <span style={{ fontSize:13, color:C.textSecondary }}>{a}</span>
              </div>
            ))}
          </div>
          {/* Action buttons */}
          {!resolved.includes(e.id) && (
            <div style={{ display:"flex", gap:8 }}>
              <button style={{ flex:1, padding:11, borderRadius:12, border:`1px solid ${C.amber}44`, background:`${C.amber}15`, color:C.amber, fontSize:13, fontWeight:700, cursor:"pointer" }}>
                Acknowledge
              </button>
              <button onClick={()=>{ setResolved(p=>[...p,e.id]); setSelected(null); }} style={{ flex:2, padding:11, borderRadius:12, border:"none", background:`linear-gradient(135deg,${C.teal},${C.blue})`, color:"#000", fontSize:13, fontWeight:800, cursor:"pointer" }}>
                Mark Resolved
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom:20 }}>
      <ScreenHeader title="Escalation Inbox" sub="Doctor" accent={C.red}
        extra={
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            {activeList.filter(e=>!e.acked).length > 0 && (
              <div style={{ background:`${C.red}22`, border:`1px solid ${C.red}44`, borderRadius:10, padding:"4px 10px", display:"flex", gap:5, alignItems:"center" }}>
                <Dot color={C.red} pulse/>
                <span style={{ fontSize:11, color:C.red, fontWeight:700 }}>{activeList.filter(e=>!e.acked).length} New</span>
              </div>
            )}
          </div>
        }
      />

      {/* Stat row */}
      <div style={{ padding:"10px 14px 0" }}>
        <div style={{ display:"flex", gap:8, marginBottom:14 }}>
          {[[activeList.filter(e=>e.severity==="CRITICAL"||e.severity==="HIGH").length,"Urgent",C.red],[activeList.filter(e=>e.severity==="MED").length,"Medium",C.amber],[resolved.length,"Resolved",C.green]].map(([v,l,c])=>(
            <div key={l} style={{ flex:1, background:`${c}12`, border:`1px solid ${c}33`, borderRadius:12, padding:"8px 10px", textAlign:"center" }}>
              <div style={{ fontSize:22, fontWeight:900, color:c }}>{v}</div>
              <div style={{ fontSize:10, color:C.textMuted }}>{l}</div>
            </div>
          ))}
        </div>

        <div style={{ display:"flex", gap:8, marginBottom:12 }}>
          {[["active","Active"],["resolved","Resolved"]].map(([k,l])=>(
            <button key={k} onClick={()=>setTab(k)} style={{ flex:1, padding:8, borderRadius:10, border:"none", cursor:"pointer", background:tab===k?C.red:C.card, color:tab===k?"#fff":C.textSecondary, fontSize:12, fontWeight:700 }}>{l}</button>
          ))}
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {displayed.length===0 && <div style={{ textAlign:"center", padding:"40px 20px", color:C.textMuted, fontSize:13 }}>No escalations here</div>}
          {displayed.map(e=>(
            <div key={e.id} onClick={()=>setSelected(e.id)} style={{
              background:C.card, border:`1px solid ${sCol[e.severity]}44`,
              borderLeft:`3px solid ${sCol[e.severity]}`, borderRadius:14, padding:14, cursor:"pointer",
              opacity: resolved.includes(e.id) ? 0.6 : 1,
            }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:7 }}>
                <div>
                  <div style={{ display:"flex", gap:7, alignItems:"center", marginBottom:3 }}>
                    <span style={{ fontSize:14, fontWeight:800, color:C.textPrimary }}>{e.patient}</span>
                    <Badge color={sCol[e.severity]}>{e.severity}</Badge>
                    {!e.acked && !resolved.includes(e.id) && <div style={{ width:7, height:7, borderRadius:"50%", background:C.red, animation:"pulse 1s infinite" }}/>}
                  </div>
                  <div style={{ fontSize:11, color:C.textMuted }}>Bed {e.bed} · {e.nurse} · {e.time}</div>
                </div>
                {!resolved.includes(e.id) && <SlaTimer minutes={e.slaMin}/>}
                {resolved.includes(e.id) && <Badge color={C.green}>RESOLVED</Badge>}
              </div>
              <div style={{ fontSize:12, color:C.textSecondary, lineHeight:1.5 }}>{e.finding}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SECURE MESSAGING (shared by doctor + nurse)
// ═══════════════════════════════════════════════════════════════════════════════
const SecureMessaging = ({ myRole }) => {
  const [thread, setThread] = useState(null);
  const [input, setInput] = useState("");
  const [compose, setCompose] = useState(false);

  const threads = [
    { id:1, with:"Dr. Chinyama", role:"Doctor", last:"Can you recheck Chipo Ncube BP?", time:"20 min", unread:1, avatar:"DC", type:"task", color:C.teal, priority:"HIGH" },
    { id:2, with:"Nurse Tariro", role:"Nurse", last:"SpO₂ escalation sent for Tendai Moyo", time:"2 min", unread:2, avatar:"NT", type:"escalation", color:C.red, priority:"URGENT" },
    { id:3, with:"Dr. Sithole", role:"Cardiologist", last:"Re: referral for Tendai Moyo — I can see him at 3pm", time:"1h", unread:0, avatar:"DS", type:"consultation", color:C.purple, priority:"MED" },
    { id:4, with:"Lab Team", role:"Laboratory", last:"CD4 result for Ruth Sithole is ready", time:"1h", unread:1, avatar:"LT", type:"alert", color:C.amber, priority:"MED" },
    { id:5, with:"Nurse Blessing", role:"Nurse", last:"Handoff notes for Ward G complete", time:"2h", unread:0, avatar:"NB", type:"message", color:C.blue, priority:"LOW" },
  ];

  const convo = {
    1:[ { r:"them", t:"Can you recheck Chipo Ncube BP in 30 min? She's at M-03 and my readings are trending up." }, { r:"me", t:"On it. I'll check and update you." }, { r:"them", t:"Thanks. Let me know if she needs antihypertensive." } ],
    2:[ { r:"them", t:"Dr. Chinyama — Tendai Moyo SpO₂ 88% on room air. BP 168/102. Escalation submitted." }, { r:"them", t:"Patient is anxious and diaphoretic. I've increased O₂ positioning. Awaiting orders." }, { r:"me", t:"Acknowledged. Ordering CXR and ABG stat. Keep 4L O₂ via NC." } ],
    3:[ { r:"me", t:"Hi Dr. Sithole — I've referred Tendai Moyo for urgent cardiology review. NSTEMI, post-DAPT initiation." }, { r:"them", t:"Got it. I can see him at 3pm today in CCU. Please ensure Echo request is in." } ],
    4:[ { r:"them", t:"CD4 result for Ruth Sithole now available: 312 cells/μL. VL report pending." } ],
    5:[ { r:"them", t:"Ward G handoff done. All tasks logged. Felix Dube insulin given at 12:30 as scheduled." } ],
  };

  const typeColor = { task:C.teal, escalation:C.red, consultation:C.purple, alert:C.amber, message:C.blue };
  const priorityColor = { URGENT:C.red, HIGH:C.amber, MED:C.blue, LOW:C.textMuted };

  const sendMsg = () => {
    if(!input.trim()) return;
    setInput("");
  };

  if(compose) return (
    <div style={{ paddingBottom:20 }}>
      <div style={{ padding:"14px 16px 12px", background:C.surface, borderBottom:`1px solid ${C.border}` }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div onClick={()=>setCompose(false)} style={{ width:32, height:32, borderRadius:10, background:C.card, border:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
            <Ic d={P.back} size={16} color={C.textSecondary}/>
          </div>
          <div style={{ fontSize:16, fontWeight:800, color:C.textPrimary }}>New Message</div>
        </div>
      </div>
      <div style={{ padding:"14px 14px 0" }}>
        {["To (recipient)","Patient context (optional)"].map(p=>(
          <div key={p} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"10px 13px", marginBottom:10 }}>
            <div style={{ fontSize:10, color:C.textMuted, fontWeight:700, marginBottom:4, textTransform:"uppercase" }}>{p}</div>
            <input placeholder={`Enter ${p.toLowerCase()}...`} style={{ background:"transparent", border:"none", outline:"none", fontSize:13, color:C.textPrimary, width:"100%", fontFamily:"inherit" }}/>
          </div>
        ))}
        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"10px 13px", marginBottom:10 }}>
          <div style={{ fontSize:10, color:C.textMuted, fontWeight:700, marginBottom:4, textTransform:"uppercase" }}>Type</div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {["Message","Task","Consultation","Alert","Referral"].map(t=>(
              <button key={t} style={{ padding:"5px 10px", borderRadius:8, border:`1px solid ${C.border}`, background:"transparent", color:C.textSecondary, fontSize:11, fontWeight:600, cursor:"pointer" }}>{t}</button>
            ))}
          </div>
        </div>
        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"10px 13px", marginBottom:14 }}>
          <textarea placeholder="Type your message..." rows={5} style={{ background:"transparent", border:"none", outline:"none", fontSize:13, color:C.textPrimary, width:"100%", fontFamily:"inherit", resize:"none", lineHeight:1.6 }}/>
        </div>
        <button style={{ width:"100%", padding:13, borderRadius:13, border:"none", background:`linear-gradient(135deg,${C.teal},${C.blue})`, color:"#000", fontWeight:800, fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
          <Ic d={P.send} size={16} color="#000" stroke={2}/> Send Secure Message
        </button>
        <div style={{ display:"flex", gap:5, alignItems:"center", justifyContent:"center", marginTop:8 }}>
          <Ic d={P.shield} size={11} color={C.green}/><span style={{ fontSize:10, color:C.textMuted }}>End-to-end encrypted · HIPAA audited</span>
        </div>
      </div>
    </div>
  );

  if(thread) {
    const t = threads.find(x=>x.id===thread);
    const msgs = convo[thread] || [];
    return (
      <div style={{ height:"100%", display:"flex", flexDirection:"column" }}>
        <div style={{ padding:"12px 14px 12px", background:C.surface, borderBottom:`1px solid ${C.border}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div onClick={()=>setThread(null)} style={{ width:32, height:32, borderRadius:10, background:C.card, border:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
              <Ic d={P.back} size={16} color={C.textSecondary}/>
            </div>
            <div style={{ width:36, height:36, borderRadius:12, background:`${typeColor[t.type]}22`, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <span style={{ fontSize:13, fontWeight:800, color:typeColor[t.type] }}>{t.avatar}</span>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14, fontWeight:800, color:C.textPrimary }}>{t.with}</div>
              <div style={{ fontSize:11, color:C.textMuted }}>{t.role}</div>
            </div>
            <Badge color={priorityColor[t.priority]}>{t.priority}</Badge>
          </div>
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:"14px 14px 0", display:"flex", flexDirection:"column", gap:10 }}>
          {msgs.map((m,i)=>(
            <div key={i} style={{ display:"flex", justifyContent:m.r==="me"?"flex-end":"flex-start" }}>
              <div style={{
                background: m.r==="me" ? `linear-gradient(135deg,${C.teal}33,${C.blue}33)` : C.card,
                border:`1px solid ${m.r==="me"?C.teal+"33":C.border}`,
                borderRadius: m.r==="me"?"14px 0 14px 14px":"0 14px 14px 14px",
                padding:"10px 12px", maxWidth:240, animation:"fadeIn 0.2s",
              }}>
                <div style={{ fontSize:13, color:m.r==="me"?C.textPrimary:C.textSecondary, lineHeight:1.6 }}>{m.t}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding:"10px 12px 12px", borderTop:`1px solid ${C.border}`, background:C.surface }}>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendMsg()} placeholder="Type a secure message..." style={{ flex:1, background:C.card, border:`1px solid ${C.border}`, borderRadius:20, padding:"9px 14px", color:C.textPrimary, fontSize:12, outline:"none", fontFamily:"inherit" }}/>
            <button onClick={sendMsg} style={{ width:38, height:38, borderRadius:"50%", background:`linear-gradient(135deg,${C.teal},${C.blue})`, border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <Ic d={P.send} size={16} color="#fff" stroke={2}/>
            </button>
          </div>
          <div style={{ fontSize:10, color:C.textMuted, textAlign:"center", marginTop:6, display:"flex", gap:4, alignItems:"center", justifyContent:"center" }}>
            <Ic d={P.shield} size={10} color={C.green}/> Encrypted · Audit-logged
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom:20 }}>
      <ScreenHeader title="Secure Messages" sub={myRole==="doctor"?"Doctor":"Nurse Copilot"} accent={C.blue}
        extra={
          <button onClick={()=>setCompose(true)} style={{ width:34, height:34, borderRadius:10, background:`${C.blue}22`, border:`1px solid ${C.blue}44`, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
            <Ic d={P.plus} size={16} color={C.blue}/>
          </button>
        }
      />
      <div style={{ padding:"10px 14px 0" }}>
        <div style={{ background:`${C.green}10`, border:`1px solid ${C.green}33`, borderRadius:12, padding:"8px 12px", marginBottom:12, display:"flex", gap:8, alignItems:"center" }}>
          <Ic d={P.shield} size={14} color={C.green}/>
          <span style={{ fontSize:11, color:C.green }}>End-to-end encrypted · HIPAA audit trail · MediCore provider network</span>
        </div>
        {threads.map(t=>(
          <div key={t.id} onClick={()=>setThread(t.id)} style={{ background:t.unread>0?C.card:C.surface, border:`1px solid ${t.unread>0?typeColor[t.type]+"33":C.border}`, borderRadius:14, padding:"12px 14px", marginBottom:8, cursor:"pointer", display:"flex", gap:12, alignItems:"center" }}>
            <div style={{ width:42, height:42, borderRadius:13, background:`${typeColor[t.type]}22`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, position:"relative" }}>
              <span style={{ fontSize:13, fontWeight:800, color:typeColor[t.type] }}>{t.avatar}</span>
              {t.unread>0 && <div style={{ position:"absolute", top:-3, right:-3, width:16, height:16, borderRadius:"50%", background:C.red, display:"flex", alignItems:"center", justifyContent:"center" }}><span style={{ fontSize:9, fontWeight:800, color:"#fff" }}>{t.unread}</span></div>}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:3 }}>
                <span style={{ fontSize:14, fontWeight: t.unread>0?800:600, color:C.textPrimary }}>{t.with}</span>
                <span style={{ fontSize:10, color:C.textMuted }}>{t.time}</span>
              </div>
              <div style={{ display:"flex", gap:6, alignItems:"center", marginBottom:3 }}>
                <span style={{ background:`${typeColor[t.type]}18`, color:typeColor[t.type], borderRadius:5, padding:"1px 6px", fontSize:9, fontWeight:700, textTransform:"capitalize" }}>{t.type}</span>
                <Badge color={priorityColor[t.priority]} >{t.priority}</Badge>
              </div>
              <div style={{ fontSize:12, color:C.textSecondary, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{t.last}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// NURSE — ESCALATE SEND (modal panel)
// ═══════════════════════════════════════════════════════════════════════════════
const NurseEscalatePanel = ({ patient, bed, onClose, onSent }) => {
  const [severity, setSeverity] = useState("HIGH");
  const [finding, setFinding] = useState("");
  const [doctor, setDoctor] = useState("Dr. Chinyama");
  const [sent, setSent] = useState(false);

  const send = () => {
    if(!finding.trim()) return;
    setSent(true);
    setTimeout(()=>{ onSent(); onClose(); }, 1800);
  };

  if(sent) return (
    <div style={{ position:"absolute", inset:0, background:"rgba(8,14,26,0.95)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:14, padding:24 }}>
      <div style={{ width:72, height:72, borderRadius:"50%", background:`${C.teal}22`, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <Ic d={P.check} size={36} color={C.teal} stroke={3}/>
      </div>
      <div style={{ fontSize:18, fontWeight:800, color:C.textPrimary, textAlign:"center" }}>Escalation Sent</div>
      <div style={{ fontSize:13, color:C.textSecondary, textAlign:"center", lineHeight:1.6 }}>{doctor} has been alerted with SLA timer. Audit trail recorded.</div>
    </div>
  );

  return (
    <div style={{ position:"absolute", inset:0, background:"rgba(8,14,26,0.92)", zIndex:200, display:"flex", alignItems:"flex-end" }}>
      <div style={{ width:"100%", background:C.surface, borderRadius:"24px 24px 0 0", border:`1px solid ${C.border}`, padding:"20px 16px 32px", animation:"slideDown 0.3s ease" }}>
        {/* Handle */}
        <div style={{ width:40, height:3, background:C.border, borderRadius:99, margin:"0 auto 16px" }}/>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div>
            <div style={{ fontSize:17, fontWeight:900, color:C.textPrimary }}>Escalate to Doctor</div>
            <div style={{ fontSize:12, color:C.textMuted }}>{patient} · Bed {bed}</div>
          </div>
          <div onClick={onClose} style={{ width:30, height:30, borderRadius:8, background:C.card, border:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
            <Ic d={P.close} size={14} color={C.textMuted}/>
          </div>
        </div>

        {/* Severity */}
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:11, color:C.textMuted, fontWeight:700, textTransform:"uppercase", marginBottom:8 }}>Severity</div>
          <div style={{ display:"flex", gap:8 }}>
            {[["CRITICAL",C.red],["HIGH",C.amber],["MED",C.blue]].map(([s,c])=>(
              <button key={s} onClick={()=>setSeverity(s)} style={{ flex:1, padding:"9px 0", borderRadius:10, border:`2px solid ${severity===s?c:C.border}`, background:severity===s?`${c}22`:"transparent", color:severity===s?c:C.textMuted, fontSize:12, fontWeight:800, cursor:"pointer" }}>{s}</button>
            ))}
          </div>
        </div>

        {/* Doctor */}
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:11, color:C.textMuted, fontWeight:700, textTransform:"uppercase", marginBottom:8 }}>Notify Doctor</div>
          <select value={doctor} onChange={e=>setDoctor(e.target.value)} style={{ width:"100%", background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 12px", color:C.textPrimary, fontSize:13, outline:"none" }}>
            {["Dr. Chinyama (Ward Lead)","Dr. Sithole (Cardiologist)","Dr. Ncube (On-call)"].map(d=><option key={d}>{d}</option>)}
          </select>
        </div>

        {/* Finding */}
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:11, color:C.textMuted, fontWeight:700, textTransform:"uppercase", marginBottom:8 }}>Clinical Finding</div>
          <textarea value={finding} onChange={e=>setFinding(e.target.value)} placeholder="Describe the finding requiring escalation..." rows={3} style={{ width:"100%", background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 12px", color:C.textPrimary, fontSize:13, outline:"none", fontFamily:"inherit", resize:"none", lineHeight:1.6 }}/>
        </div>

        <button onClick={send} disabled={!finding.trim()} style={{ width:"100%", padding:13, borderRadius:13, border:"none", background:!finding.trim()?"#1a2535":`linear-gradient(135deg,${C.red},${C.orange})`, color:!finding.trim()?C.textMuted:"#fff", fontWeight:800, fontSize:14, cursor:finding.trim()?"pointer":"default", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
          <Ic d={P.escalate} size={18} color={!finding.trim()?C.textMuted:"#fff"} stroke={2}/> Send Escalation
        </button>
        <div style={{ fontSize:10, color:C.textMuted, textAlign:"center", marginTop:8 }}>SLA timer starts immediately · Audit trail created</div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// NURSE DASHBOARD (updated with escalate buttons)
// ═══════════════════════════════════════════════════════════════════════════════
const NurseDashboard = () => {
  const [ntab, setNtab] = useState("worklist");
  const [escalateFor, setEscalateFor] = useState(null);
  const [tasks, setTasks] = useState([
    {id:1,patient:"Tendai Moyo",task:"BP recheck",bed:"C-12",pri:"URGENT",due:"Now",done:false,escalatable:true},
    {id:2,patient:"Felix Dube",task:"Insulin (BCMA scan)",bed:"G-08",pri:"HIGH",due:"12:30",done:false,escalatable:false},
    {id:3,patient:"Chipo Ncube",task:"Fetal monitoring strip",bed:"M-03",pri:"HIGH",due:"13:00",done:false,escalatable:true},
    {id:4,patient:"Ruth Sithole",task:"CD4 sample collection",bed:"H-05",pri:"MED",due:"14:00",done:true,escalatable:false},
    {id:5,patient:"James Mutasa",task:"Wound dressing",bed:"G-02",pri:"MED",due:"14:30",done:false,escalatable:false},
  ]);

  const pc={URGENT:C.red,HIGH:C.amber,MED:C.blue};
  const triage=[
    {name:"Male ~40y",complaint:"Chest pain, diaphoresis",esi:2,wait:"2 min",color:C.red},
    {name:"Female 28y",complaint:"Headache, BP 170/110",esi:2,wait:"6 min",color:C.red},
    {name:"Child 8y",complaint:"Fever 39.5°C, rash",esi:3,wait:"20 min",color:C.amber},
    {name:"Male 65y",complaint:"UTI symptoms, mild dysuria",esi:4,wait:"48 min",color:C.blue},
  ];

  return (
    <div style={{ paddingBottom:20, position:"relative" }}>
      {escalateFor && (
        <NurseEscalatePanel
          patient={escalateFor.patient} bed={escalateFor.bed}
          onClose={()=>setEscalateFor(null)}
          onSent={()=>setEscalateFor(null)}
        />
      )}

      <div style={{ padding:"14px 16px 12px", background:C.surface, borderBottom:`1px solid ${C.border}` }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
          <div>
            <div style={{ fontSize:10, color:C.textMuted, fontWeight:700, letterSpacing:"0.12em", marginBottom:2 }}>NURSE COPILOT</div>
            <div style={{ fontSize:19, fontWeight:900, color:C.textPrimary }}>My Shift</div>
          </div>
          <div style={{ display:"flex", gap:6 }}>
            <div style={{ background:`${C.red}18`, borderRadius:10, padding:"5px 9px", textAlign:"center" }}><div style={{ fontSize:16, fontWeight:900, color:C.red }}>2</div><div style={{ fontSize:9, color:C.textMuted }}>Urgent</div></div>
            <div style={{ background:`${C.amber}18`, borderRadius:10, padding:"5px 9px", textAlign:"center" }}><div style={{ fontSize:16, fontWeight:900, color:C.amber }}>3</div><div style={{ fontSize:9, color:C.textMuted }}>High</div></div>
          </div>
        </div>
        <div style={{ background:`linear-gradient(90deg,${C.teal}18,${C.purple}18)`, borderRadius:12, padding:"7px 12px", border:`1px solid ${C.teal}30`, display:"flex", gap:8, alignItems:"center", marginBottom:10 }}>
          <AiBadge text="COPILOT"/><span style={{ fontSize:11, color:C.teal }}>AI-assisted triage · vitals · escalation · handoff</span>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          {[["worklist","Worklist"],["triage","Triage"]].map(([k,l])=>(
            <button key={k} onClick={()=>setNtab(k)} style={{ flex:1, padding:7, borderRadius:10, border:"none", cursor:"pointer", background:ntab===k?C.purple:C.card, color:ntab===k?"#fff":C.textSecondary, fontSize:12, fontWeight:700 }}>{l}</button>
          ))}
        </div>
      </div>

      <div style={{ padding:"12px 14px 0" }}>
        {ntab==="worklist"&&(
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {tasks.map(t=>(
              <div key={t.id} style={{ background:t.done?C.surface:C.card, border:`1px solid ${t.done?C.border:pc[t.pri]+"44"}`, borderLeft:`3px solid ${t.done?C.textMuted:pc[t.pri]}`, borderRadius:13, padding:13, opacity:t.done?0.6:1 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", gap:7, alignItems:"center", marginBottom:3 }}>
                      <span style={{ fontSize:14, fontWeight:700, color:t.done?C.textMuted:C.textPrimary }}>{t.patient}</span>
                      {!t.done && <Badge color={pc[t.pri]}>{t.pri}</Badge>}
                    </div>
                    <div style={{ fontSize:12, color:C.textSecondary }}>{t.task}</div>
                    <div style={{ fontSize:11, color:C.textMuted, marginTop:2 }}>Bed {t.bed} · Due {t.due}</div>
                  </div>
                  <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                    {/* Escalate button */}
                    {!t.done && t.escalatable && (
                      <div onClick={()=>setEscalateFor(t)} style={{ background:`${C.red}22`, border:`1px solid ${C.red}44`, borderRadius:8, padding:"5px 8px", cursor:"pointer", display:"flex", gap:4, alignItems:"center" }}>
                        <Ic d={P.escalate} size={12} color={C.red}/>
                        <span style={{ fontSize:10, color:C.red, fontWeight:700 }}>Escalate</span>
                      </div>
                    )}
                    <div onClick={()=>setTasks(p=>p.map(x=>x.id===t.id?{...x,done:!x.done}:x))} style={{ width:28, height:28, borderRadius:8, background:t.done?C.green:"transparent", border:`2px solid ${t.done?C.green:C.border}`, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
                      {t.done && <Ic d={P.check} size={14} color="#000" stroke={3}/>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {/* AI Handoff */}
            <div style={{ background:"linear-gradient(135deg,#0D2040,#0D2535)", border:`1px solid ${C.blue}44`, borderRadius:16, padding:14, marginTop:4 }}>
              <div style={{ display:"flex", gap:7, alignItems:"center", marginBottom:7 }}><AiBadge text="AI HANDOFF"/><span style={{ fontSize:12, color:C.textSecondary, fontWeight:700 }}>End-of-Shift Summary</span></div>
              <div style={{ fontSize:12, color:C.textSecondary, lineHeight:1.65 }}>3 high-priority patients. C-12 (Moyo): SpO₂ escalation sent. M-03 (Ncube): BP trending — escalated. G-08 (Dube): insulin administered 12:30.</div>
              <button style={{ marginTop:10, width:"100%", padding:9, borderRadius:10, border:`1px solid ${C.blue}44`, background:`${C.blue}15`, color:C.blue, fontSize:12, fontWeight:700, cursor:"pointer" }}>Generate Full Handoff Report</button>
            </div>
          </div>
        )}
        {ntab==="triage"&&(
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <div style={{ display:"flex", gap:7, alignItems:"center", marginBottom:2 }}><AiBadge text="ESI TRIAGE"/><span style={{ fontSize:11, color:C.textSecondary }}>AI-assisted severity scoring (ESI 1-5)</span></div>
            {triage.map((p,i)=>(
              <div key={i} style={{ background:C.card, border:`1px solid ${p.color}44`, borderLeft:`4px solid ${p.color}`, borderRadius:14, padding:13 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                  <div><div style={{ fontSize:14, fontWeight:700, color:C.textPrimary }}>{p.name}</div><div style={{ fontSize:12, color:C.textSecondary }}>{p.complaint}</div></div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ background:`${p.color}22`, border:`1px solid ${p.color}44`, borderRadius:8, padding:"3px 10px", fontSize:16, fontWeight:900, color:p.color }}>ESI {p.esi}</div>
                    <div style={{ fontSize:10, color:C.textMuted, marginTop:2 }}>Wait {p.wait}</div>
                  </div>
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <button style={{ flex:1, padding:7, borderRadius:10, border:`1px solid ${p.color}44`, background:`${p.color}15`, color:p.color, fontSize:11, fontWeight:700, cursor:"pointer" }}>Start Assessment</button>
                  {p.esi<=2&&<button onClick={()=>setEscalateFor({patient:p.name,bed:"ED"})} style={{ padding:"7px 10px", borderRadius:10, border:`1px solid ${C.red}44`, background:`${C.red}15`, color:C.red, fontSize:11, fontWeight:700, cursor:"pointer", display:"flex", gap:4, alignItems:"center" }}><Ic d={P.escalate} size={12} color={C.red}/>Escalate</button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// PATIENT — MEDICATION REMINDERS
// ═══════════════════════════════════════════════════════════════════════════════
const PatientMedications = () => {
  const [meds, setMeds] = useState([
    { id:1, name:"Aspirin 75mg", dose:"1 tablet", when:"Morning with food", time:"07:00", taken:[true,true,false,true,true,true,false], reminder:true, color:C.teal, note:"Do not stop abruptly. Take with food." },
    { id:2, name:"Clopidogrel 75mg", dose:"1 tablet", when:"Morning", time:"07:00", taken:[true,true,false,true,false,true,true], reminder:true, color:C.blue, note:"Avoid NSAIDs. Report unusual bruising." },
    { id:3, name:"Atorvastatin 40mg", dose:"1 tablet", when:"Night", time:"21:00", taken:[true,false,true,true,true,false,true], reminder:true, color:C.purple, note:"Avoid grapefruit juice. Take at night." },
    { id:4, name:"Ramipril 5mg", dose:"1 capsule", when:"Morning", time:"07:00", taken:[true,true,true,false,true,true,true], reminder:false, color:C.amber, note:"Monitor BP and kidney function. Avoid potassium supplements." },
  ]);
  const [markingId, setMarkingId] = useState(null);

  const days = ["M","T","W","T","F","S","S"];
  const toggleReminder = (id) => setMeds(p=>p.map(m=>m.id===id?{...m,reminder:!m.reminder}:m));
  const markTaken = (id) => {
    setMarkingId(id);
    setTimeout(()=>setMarkingId(null), 1200);
  };

  const adherenceScore = (taken) => Math.round((taken.filter(Boolean).length / taken.length) * 100);

  return (
    <div style={{ paddingBottom:20 }}>
      <ScreenHeader title="My Medications" sub="Patient" accent={C.teal}/>
      <div style={{ padding:"12px 14px 0" }}>
        {/* Today's doses */}
        <SH>Today's Schedule</SH>
        <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:16 }}>
          {meds.map(m=>{
            const takenToday = m.taken[m.taken.length-1];
            const marking = markingId===m.id;
            return (
              <div key={m.id} style={{ background:C.card, border:`1px solid ${takenToday?C.green+"44":m.color+"33"}`, borderLeft:`3px solid ${takenToday?C.green:m.color}`, borderRadius:14, padding:14 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:3 }}>
                      <span style={{ fontSize:14, fontWeight:800, color:C.textPrimary }}>{m.name}</span>
                      {takenToday && <Badge color={C.green}>TAKEN ✓</Badge>}
                    </div>
                    <div style={{ fontSize:12, color:C.textSecondary }}>{m.dose} · {m.when} · {m.time}</div>
                  </div>
                  {/* Reminder toggle */}
                  <div onClick={()=>toggleReminder(m.id)} style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <Ic d={P.bell} size={14} color={m.reminder?m.color:C.textMuted}/>
                    <div style={{ width:36, height:20, borderRadius:10, background:m.reminder?m.color:C.border, position:"relative", cursor:"pointer", transition:"all 0.2s" }}>
                      <div style={{ position:"absolute", top:2, left:m.reminder?18:2, width:16, height:16, borderRadius:"50%", background:"#fff", transition:"all 0.2s" }}/>
                    </div>
                  </div>
                </div>
                {/* Adherence dots */}
                <div style={{ display:"flex", gap:5, alignItems:"center", marginBottom:10 }}>
                  <span style={{ fontSize:10, color:C.textMuted, marginRight:2 }}>7-day</span>
                  {m.taken.map((t,i)=>(
                    <div key={i} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
                      <div style={{ width:18, height:18, borderRadius:6, background:t?`${m.color}33`:C.surface, border:`1.5px solid ${t?m.color:C.border}`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                        {t && <Ic d={P.check} size={10} color={m.color} stroke={3}/>}
                      </div>
                      <span style={{ fontSize:8, color:C.textMuted }}>{days[i]}</span>
                    </div>
                  ))}
                  <div style={{ marginLeft:"auto", background:`${m.color}18`, borderRadius:99, padding:"2px 8px" }}>
                    <span style={{ fontSize:10, color:m.color, fontWeight:700 }}>{adherenceScore(m.taken)}%</span>
                  </div>
                </div>
                <div style={{ fontSize:11, color:C.textMuted, marginBottom:10, fontStyle:"italic" }}>{m.note}</div>
                {!takenToday && (
                  <button onClick={()=>markTaken(m.id)} style={{ width:"100%", padding:9, borderRadius:11, border:"none", background: marking ? `${C.green}33` : `linear-gradient(135deg,${m.color},${m.color}88)`, color: marking ? C.green : "#000", fontWeight:800, fontSize:12, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6, transition:"all 0.3s" }}>
                    {marking ? <><Ic d={P.check} size={14} color={C.green} stroke={3}/>Marked as taken!</> : <><Ic d={P.pill} size={14} color="#000" stroke={2}/>Mark as Taken</>}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {/* Overall adherence */}
        <Card>
          <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:10 }}>
            <AiBadge text="ADHERENCE"/><span style={{ fontSize:13, fontWeight:700, color:C.textPrimary }}>Weekly Summary</span>
          </div>
          <div style={{ display:"flex", gap:10 }}>
            {[["82%","Adherence",C.green],["4","Doses Today",C.teal],["1","Missed",C.amber]].map(([v,l,c])=>(
              <div key={l} style={{ flex:1, textAlign:"center" }}>
                <div style={{ fontSize:22, fontWeight:900, color:c, fontFamily:"'JetBrains Mono',monospace" }}>{v}</div>
                <div style={{ fontSize:10, color:C.textMuted }}>{l}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// PATIENT — BILL PAYMENT
// ═══════════════════════════════════════════════════════════════════════════════
const PatientBills = () => {
  const [payingId, setPayingId] = useState(null);
  const [payMethod, setPayMethod] = useState("ecocash");
  const [phone, setPhone] = useState("077 123 4567");
  const [step, setStep] = useState(1);
  const [paid, setPaid] = useState([]);

  const bills = [
    { id:"INV-2026-0044", desc:"Cardiology Consultation + ECG", date:"Mar 7, 2026", amount:42.00, currency:"USD", status:"due", items:[{l:"Cardiology Consultation",v:28.00},{l:"ECG 12-lead",v:8.00},{l:"CDSS Decision Support",v:6.00}] },
    { id:"INV-2026-0039", desc:"Troponin I + BNP Lab Panel", date:"Mar 7, 2026", amount:18.50, currency:"USD", status:"due", items:[{l:"Troponin I (quantitative)",v:12.50},{l:"BNP",v:6.00}] },
    { id:"INV-2026-0031", desc:"Pharmacy — Aspirin + Clopidogrel", date:"Mar 7, 2026", amount:7.20, currency:"USD", status:"paid", items:[{l:"Aspirin 75mg × 30",v:2.20},{l:"Clopidogrel 75mg × 30",v:5.00}] },
    { id:"INV-2026-0022", desc:"Emergency Admission Fee", date:"Mar 6, 2026", amount:15.00, currency:"USD", status:"medical-aid", items:[{l:"CCU Admission",v:15.00}] },
  ];

  const payMethods = [
    { id:"ecocash", label:"EcoCash", sub:"Econet Zimbabwe mobile money", color:"#E31837", icon:"📱" },
    { id:"onemoney", label:"OneMoney", sub:"NetOne mobile money", color:"#00A651", icon:"💚" },
    { id:"card", label:"Card Payment", sub:"Visa · Mastercard", color:C.blue, icon:"💳" },
    { id:"bank", label:"Bank Transfer", sub:"ZIPIT / EFT", color:C.textMuted, icon:"🏦" },
  ];

  const statusColor = { due:C.amber, paid:C.green, "medical-aid":C.blue };
  const statusLabel = { due:"DUE", paid:"PAID", "medical-aid":"MED AID" };
  const dueBills = bills.filter(b=>b.status==="due" && !paid.includes(b.id));
  const totalDue = dueBills.reduce((s,b)=>s+b.amount,0).toFixed(2);

  const paying = bills.find(b=>b.id===payingId);

  if(payingId) {
    if(step===3) return (
      <div style={{ height:"100%", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24, gap:16 }}>
        <div style={{ width:80, height:80, borderRadius:"50%", background:`${C.green}22`, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <Ic d={P.check} size={40} color={C.green} stroke={2.5}/>
        </div>
        <div style={{ fontSize:20, fontWeight:900, color:C.textPrimary, textAlign:"center" }}>Payment Successful!</div>
        <div style={{ fontSize:14, color:C.textSecondary, textAlign:"center", lineHeight:1.7 }}>
          ${paying.amount.toFixed(2)} paid via {payMethods.find(p=>p.id===payMethod)?.label}.<br/>Receipt sent to your phone.
        </div>
        <Card style={{ width:"100%", background:`${C.green}0A`, border:`1px solid ${C.green}33` }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
            <span style={{ fontSize:12, color:C.textMuted }}>Invoice</span><span style={{ fontSize:12, color:C.textPrimary, fontFamily:"'JetBrains Mono',monospace" }}>{paying.id}</span>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between" }}>
            <span style={{ fontSize:12, color:C.textMuted }}>Amount</span><span style={{ fontSize:16, fontWeight:900, color:C.green }}>USD ${paying.amount.toFixed(2)}</span>
          </div>
        </Card>
        <button onClick={()=>{ setPaid(p=>[...p,payingId]); setPayingId(null); setStep(1); }} style={{ width:"100%", padding:13, borderRadius:13, border:"none", background:`linear-gradient(135deg,${C.teal},${C.blue})`, color:"#000", fontWeight:800, fontSize:14, cursor:"pointer" }}>Done</button>
      </div>
    );
    if(step===2) return (
      <div style={{ paddingBottom:20 }}>
        <div style={{ padding:"14px 16px 12px", background:C.surface, borderBottom:`1px solid ${C.border}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div onClick={()=>setStep(1)} style={{ width:32, height:32, borderRadius:10, background:C.card, border:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
              <Ic d={P.back} size={16} color={C.textSecondary}/>
            </div>
            <div style={{ fontSize:16, fontWeight:800, color:C.textPrimary }}>Confirm Payment</div>
          </div>
        </div>
        <div style={{ padding:"16px 14px 0" }}>
          <div style={{ background:`${C.amber}12`, border:`1px solid ${C.amber}33`, borderRadius:14, padding:14, marginBottom:14 }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.textPrimary, marginBottom:4 }}>{paying.desc}</div>
            {paying.items.map(it=>(
              <div key={it.l} style={{ display:"flex", justifyContent:"space-between", padding:"5px 0", borderBottom:`1px solid ${C.border}` }}>
                <span style={{ fontSize:12, color:C.textSecondary }}>{it.l}</span>
                <span style={{ fontSize:12, color:C.textPrimary, fontFamily:"'JetBrains Mono',monospace" }}>${it.v.toFixed(2)}</span>
              </div>
            ))}
            <div style={{ display:"flex", justifyContent:"space-between", marginTop:10 }}>
              <span style={{ fontSize:14, fontWeight:800, color:C.textPrimary }}>Total</span>
              <span style={{ fontSize:18, fontWeight:900, color:C.amber, fontFamily:"'JetBrains Mono',monospace" }}>USD ${paying.amount.toFixed(2)}</span>
            </div>
          </div>
          <Card style={{ marginBottom:14 }}>
            <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:10 }}>
              <span style={{ fontSize:20 }}>{payMethods.find(p=>p.id===payMethod)?.icon}</span>
              <div>
                <div style={{ fontSize:14, fontWeight:800, color:C.textPrimary }}>{payMethods.find(p=>p.id===payMethod)?.label}</div>
                <div style={{ fontSize:11, color:C.textMuted }}>{payMethods.find(p=>p.id===payMethod)?.sub}</div>
              </div>
            </div>
            {(payMethod==="ecocash"||payMethod==="onemoney") && (
              <div>
                <div style={{ fontSize:11, color:C.textMuted, marginBottom:6, fontWeight:700, textTransform:"uppercase" }}>Mobile Number</div>
                <div style={{ background:C.surface, borderRadius:10, padding:"9px 12px", fontSize:13, color:C.textPrimary, fontFamily:"'JetBrains Mono',monospace" }}>{phone}</div>
                <div style={{ fontSize:11, color:C.textMuted, marginTop:6 }}>You will receive a payment prompt on this number</div>
              </div>
            )}
          </Card>
          <div style={{ display:"flex", gap:6, alignItems:"center", marginBottom:14 }}>
            <Ic d={P.shield} size={13} color={C.green}/>
            <span style={{ fontSize:11, color:C.textMuted }}>Secured by MediCore Pay · HIPAA-compliant transaction</span>
          </div>
          <button onClick={()=>setStep(3)} style={{ width:"100%", padding:14, borderRadius:13, border:"none", background:`linear-gradient(135deg,${payMethod==="ecocash"?"#E31837":"#00A651"},${payMethod==="card"?C.blue:payMethod==="bank"?C.textMuted:C.teal})`, color:"#fff", fontWeight:800, fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
            <Ic d={P.phone} size={18} color="#fff"/> Confirm & Pay USD ${paying.amount.toFixed(2)}
          </button>
        </div>
      </div>
    );
    return (
      <div style={{ paddingBottom:20 }}>
        <div style={{ padding:"14px 16px 12px", background:C.surface, borderBottom:`1px solid ${C.border}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div onClick={()=>setPayingId(null)} style={{ width:32, height:32, borderRadius:10, background:C.card, border:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
              <Ic d={P.back} size={16} color={C.textSecondary}/>
            </div>
            <div style={{ fontSize:16, fontWeight:800, color:C.textPrimary }}>Choose Payment</div>
          </div>
        </div>
        <div style={{ padding:"14px 14px 0" }}>
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:14, marginBottom:16 }}>
            <div style={{ fontSize:12, color:C.textMuted, marginBottom:4 }}>{paying.id}</div>
            <div style={{ fontSize:14, fontWeight:700, color:C.textPrimary, marginBottom:6 }}>{paying.desc}</div>
            <div style={{ fontSize:26, fontWeight:900, color:C.amber, fontFamily:"'JetBrains Mono',monospace" }}>USD ${paying.amount.toFixed(2)}</div>
          </div>
          <SH>Payment Method</SH>
          {payMethods.map(m=>(
            <div key={m.id} onClick={()=>setPayMethod(m.id)} style={{ background:payMethod===m.id?`${m.color}15`:C.card, border:`2px solid ${payMethod===m.id?m.color:C.border}`, borderRadius:14, padding:"13px 14px", marginBottom:8, cursor:"pointer", display:"flex", gap:12, alignItems:"center" }}>
              <span style={{ fontSize:22 }}>{m.icon}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:700, color:C.textPrimary }}>{m.label}</div>
                <div style={{ fontSize:11, color:C.textMuted }}>{m.sub}</div>
              </div>
              {payMethod===m.id && <div style={{ width:20, height:20, borderRadius:"50%", background:m.color, display:"flex", alignItems:"center", justifyContent:"center" }}><Ic d={P.check} size={12} color="#fff" stroke={3}/></div>}
            </div>
          ))}
          {(payMethod==="ecocash"||payMethod==="onemoney") && (
            <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:14, marginBottom:14 }}>
              <div style={{ fontSize:11, color:C.textMuted, fontWeight:700, textTransform:"uppercase", marginBottom:8 }}>Mobile Number for {payMethod==="ecocash"?"EcoCash":"OneMoney"}</div>
              <input value={phone} onChange={e=>setPhone(e.target.value)} style={{ width:"100%", background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:"9px 12px", color:C.textPrimary, fontSize:13, outline:"none", fontFamily:"'JetBrains Mono',monospace" }}/>
            </div>
          )}
          <button onClick={()=>setStep(2)} style={{ width:"100%", padding:13, borderRadius:13, border:"none", background:`linear-gradient(135deg,${C.teal},${C.blue})`, color:"#000", fontWeight:800, fontSize:14, cursor:"pointer" }}>
            Continue to Review
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom:20 }}>
      <ScreenHeader title="My Bills" sub="Patient" accent={C.amber}
        extra={<div style={{ textAlign:"right" }}><div style={{ fontSize:11, color:C.textMuted }}>Balance due</div><div style={{ fontSize:20, fontWeight:900, color:C.amber, fontFamily:"'JetBrains Mono',monospace" }}>${totalDue}</div></div>}
      />
      <div style={{ padding:"12px 14px 0" }}>
        {dueBills.length>0 && (
          <div style={{ background:`linear-gradient(135deg,#1A1200,#001520)`, border:`1px solid ${C.amber}44`, borderRadius:16, padding:14, marginBottom:14 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
              <span style={{ fontSize:13, fontWeight:700, color:C.textPrimary }}>Outstanding Balance</span>
              <span style={{ fontSize:22, fontWeight:900, color:C.amber, fontFamily:"'JetBrains Mono',monospace" }}>${totalDue}</span>
            </div>
            <div style={{ fontSize:12, color:C.textSecondary, marginBottom:10 }}>Pay with EcoCash, OneMoney, card, or bank transfer</div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={()=>setPayingId(dueBills[0].id)} style={{ flex:1, padding:9, borderRadius:10, border:"none", background:"#E31837", color:"#fff", fontSize:12, fontWeight:800, cursor:"pointer" }}>📱 EcoCash</button>
              <button onClick={()=>{ setPayMethod("onemoney"); setPayingId(dueBills[0].id); }} style={{ flex:1, padding:9, borderRadius:10, border:"none", background:"#00A651", color:"#fff", fontSize:12, fontWeight:800, cursor:"pointer" }}>💚 OneMoney</button>
            </div>
          </div>
        )}

        <SH>All Invoices</SH>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {bills.map(b=>{
            const isPaid = paid.includes(b.id) || b.status==="paid";
            const status = isPaid?"paid":b.status;
            return (
              <div key={b.id} style={{ background:C.card, border:`1px solid ${statusColor[status]+"33"}`, borderLeft:`3px solid ${statusColor[status]}`, borderRadius:14, padding:14 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:C.textPrimary, marginBottom:2 }}>{b.desc}</div>
                    <div style={{ fontSize:11, color:C.textMuted }}>{b.id} · {b.date}</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:18, fontWeight:900, color:statusColor[status], fontFamily:"'JetBrains Mono',monospace" }}>${b.amount.toFixed(2)}</div>
                    <Badge color={statusColor[status]}>{statusLabel[status]}</Badge>
                  </div>
                </div>
                {status==="due" && !paid.includes(b.id) && (
                  <button onClick={()=>setPayingId(b.id)} style={{ width:"100%", padding:9, borderRadius:10, border:"none", background:`linear-gradient(135deg,${C.amber},${C.orange})`, color:"#000", fontSize:12, fontWeight:800, cursor:"pointer", marginTop:6 }}>
                    Pay Now
                  </button>
                )}
                {(isPaid) && (
                  <div style={{ display:"flex", gap:5, alignItems:"center", marginTop:6 }}>
                    <Ic d={P.check} size={12} color={C.green} stroke={3}/>
                    <span style={{ fontSize:11, color:C.green }}>Payment confirmed · Receipt saved</span>
                  </div>
                )}
                {status==="medical-aid" && (
                  <div style={{ display:"flex", gap:5, alignItems:"center", marginTop:6 }}>
                    <Ic d={P.shield} size={12} color={C.blue}/>
                    <span style={{ fontSize:11, color:C.blue }}>Claimed to CIMAS — awaiting reimbursement</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// EXISTING SCREENS (kept concise)
// ═══════════════════════════════════════════════════════════════════════════════

const DoctorWardRounds = ({ onNav }) => {
  const pts=[
    {id:"C-12",name:"Tendai Moyo",age:67,ward:"Cardiology",dx:"NSTEMI",flag:"critical",vitals:{"BP":"158/94","SpO₂":"88%","HR":"108"},alerts:["Critical: SpO₂ 88%","Troponin 2.4","ST changes"]},
    {id:"M-03",name:"Chipo Ncube",age:34,ward:"Maternity",dx:"Pre-eclampsia",flag:"warning",vitals:{"BP":"151/94","SpO₂":"98%","HR":"86"},alerts:["BP trending up — escalated"]},
    {id:"G-08",name:"Felix Dube",age:52,ward:"General",dx:"T2DM / CKD",flag:"high",vitals:{"BP":"132/80","K+":"6.8","HR":"78"},alerts:["K+ 6.8 — CRITICAL"]},
    {id:"H-05",name:"Ruth Sithole",age:28,ward:"HIV/ART",dx:"HIV Stage 3",flag:"stable",vitals:{"BP":"118/72","SpO₂":"99%","HR":"72"},alerts:["CD4 312 received"]},
  ];
  const fc={critical:C.red,warning:C.amber,high:C.amber,stable:C.green};
  return (
    <div style={{ paddingBottom:20 }}>
      <div style={{ padding:"14px 16px 12px", background:C.surface, borderBottom:`1px solid ${C.border}` }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
          <div><div style={{ fontSize:10, color:C.textMuted, fontWeight:600, marginBottom:2, letterSpacing:"0.1em" }}>DR. CHINYAMA</div><div style={{ fontSize:19, fontWeight:900, color:C.textPrimary }}>Ward Rounds</div></div>
          <div style={{ background:`${C.red}22`, border:`1px solid ${C.red}44`, borderRadius:10, padding:"4px 10px", display:"flex", gap:5, alignItems:"center" }}>
            <Dot color={C.red} pulse/><span style={{ fontSize:11, color:C.red, fontWeight:700 }}>3 Urgent</span>
          </div>
        </div>
        <div style={{ display:"flex", gap:8, marginBottom:10 }}>
          {[["12","Patients"],["3","Escalations"],["3","Signoffs"]].map(([v,l])=>(
            <div key={l} style={{ flex:1, background:C.card, borderRadius:11, padding:"7px 8px", textAlign:"center", border:`1px solid ${C.border}` }}><div style={{ fontSize:19, fontWeight:900, color:C.textPrimary }}>{v}</div><div style={{ fontSize:10, color:C.textMuted }}>{l}</div></div>
          ))}
        </div>
        <div onClick={()=>onNav("postvisit")} style={{ background:"linear-gradient(135deg,#00291E,#001428)", border:`1px solid ${C.teal}44`, borderRadius:14, padding:12, cursor:"pointer", display:"flex", gap:10, alignItems:"center" }}>
          <AiPulse size={40} active/><div style={{ flex:1 }}><div style={{ display:"flex", gap:6, alignItems:"center", marginBottom:2 }}><span style={{ fontSize:13, fontWeight:800, color:C.textPrimary }}>PostVisit AI</span><AiBadge text="3 PENDING"/></div><div style={{ fontSize:11, color:C.teal }}>Review AI summaries → sign → publish →</div></div>
        </div>
      </div>
      <div style={{ padding:"12px 14px 0" }}>
        {pts.map(p=>(
          <div key={p.id} style={{ background:C.card, border:`1px solid ${fc[p.flag]}33`, borderLeft:`3px solid ${fc[p.flag]}`, borderRadius:13, padding:13, marginBottom:9 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:7 }}>
              <div><div style={{ display:"flex", gap:7, alignItems:"center", marginBottom:2 }}><span style={{ fontSize:14, fontWeight:800, color:C.textPrimary }}>{p.name}</span><Badge color={fc[p.flag]}>{p.flag.toUpperCase()}</Badge></div><div style={{ fontSize:11, color:C.textMuted }}>{p.age}y · {p.ward} · Bed {p.id} · {p.dx}</div></div>
            </div>
            <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:7 }}>
              {Object.entries(p.vitals).map(([k,v])=>(
                <div key={k} style={{ background:C.surface, borderRadius:7, padding:"3px 8px", fontSize:11, color:C.textSecondary, fontFamily:"'JetBrains Mono',monospace" }}><span style={{ color:C.textMuted, fontSize:9 }}>{k} </span>{v}</div>
              ))}
            </div>
            {p.alerts.length>0&&<div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>{p.alerts.map(a=><div key={a} style={{ display:"flex", gap:3, alignItems:"center", background:`${C.amber}14`, borderRadius:99, padding:"2px 8px" }}><Ic d={P.alert} size={10} color={C.amber}/><span style={{ fontSize:10, color:C.amber, fontWeight:600 }}>{a}</span></div>)}</div>}
          </div>
        ))}
      </div>
    </div>
  );
};

const PostVisitSignoff = () => {
  const [signed, setSigned] = useState([]);
  const sessions=[
    {id:"PV-2240",patient:"Tendai Moyo",time:"10:32",dur:"24 min",conf:96,entities:["NSTEMI","Aspirin 300mg","Troponin 2.4","Cardiology referral"],draft:"Tendai Moyo, 67M. Chest pain × 4h. ECG: ST depression V4-V6. Troponin I: 2.4 μg/L. NSTEMI. Plan: DAPT initiated. Urgent cardiology referral. Admit CCU.",flags:["Critical lab cited","Drug interaction verified","WHO guideline applied"]},
    {id:"PV-2241",patient:"Chipo Ncube",time:"11:15",dur:"18 min",conf:91,entities:["Pre-eclampsia","Labetalol 200mg","BP 148/92","Fetal monitoring"],draft:"Chipo Ncube, 34F, 32wk. Pre-eclampsia. Labetalol 200mg BD started. Fetal monitoring. MFM consult placed.",flags:["WHO maternity guideline","Dosing verified"]},
    {id:"PV-2242",patient:"Ruth Sithole",time:"09:50",dur:"31 min",conf:94,entities:["HIV Stage 3","TLD ART","CD4 312","TPT"],draft:"Ruth Sithole, 28F. HIV 3-month review. VL undetectable. CD4 312. ART (TLD) continued. TPT ongoing. EAC performed.",flags:["WHO HIV guideline","PHI-minimized"]},
  ];
  return (
    <div style={{ paddingBottom:20 }}>
      <div style={{ padding:"14px 16px 12px", background:C.surface, borderBottom:`1px solid ${C.border}` }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <AiPulse size={36} active/><div><div style={{ fontSize:10, color:C.teal, fontWeight:700, letterSpacing:"0.1em" }}>POSTVISIT AI</div><div style={{ fontSize:18, fontWeight:900, color:C.textPrimary }}>Signoff Queue</div></div>
        </div>
      </div>
      <div style={{ padding:"12px 14px 0", display:"flex", flexDirection:"column", gap:12 }}>
        {sessions.map(s=>{
          const done=signed.includes(s.id);
          return (
            <div key={s.id} style={{ background:C.card, border:`1px solid ${done?C.green+"33":C.border}`, borderRadius:16, overflow:"hidden" }}>
              <div style={{ padding:"12px 14px", borderBottom:`1px solid ${C.border}` }}>
                <div style={{ display:"flex", justifyContent:"space-between" }}>
                  <div><div style={{ fontSize:14, fontWeight:800, color:C.textPrimary }}>{s.patient}</div><div style={{ fontSize:11, color:C.textMuted }}>{s.time} · {s.dur} · {s.id}</div></div>
                  <div style={{ width:36, height:36, borderRadius:"50%", background:`${C.green}22`, display:"flex", alignItems:"center", justifyContent:"center" }}><span style={{ fontSize:11, fontWeight:800, color:C.green }}>{s.conf}%</span></div>
                </div>
                <div style={{ display:"flex", gap:5, marginTop:8, flexWrap:"wrap" }}>{s.entities.map(e=><span key={e} style={{ background:`${C.blue}18`, border:`1px solid ${C.blue}30`, borderRadius:6, padding:"2px 7px", fontSize:10, color:C.blue, fontWeight:600 }}>{e}</span>)}</div>
              </div>
              <div style={{ padding:"10px 14px", background:`${C.teal}07`, borderBottom:`1px solid ${C.border}` }}>
                <div style={{ display:"flex", gap:6, alignItems:"center", marginBottom:5 }}><AiBadge text="AI DRAFT"/><span style={{ fontSize:10, color:C.textMuted }}>citation-grounded</span></div>
                <div style={{ fontSize:12, color:C.textSecondary, lineHeight:1.65 }}>{s.draft}</div>
              </div>
              <div style={{ padding:"8px 14px", borderBottom:`1px solid ${C.border}`, display:"flex", gap:10, flexWrap:"wrap" }}>{s.flags.map(f=><div key={f} style={{ display:"flex", gap:4, alignItems:"center" }}><Ic d={P.shield} size={11} color={C.green}/><span style={{ fontSize:10, color:C.green }}>{f}</span></div>)}</div>
              <div style={{ padding:"10px 14px", display:"flex", gap:8 }}>
                {done ? <div style={{ flex:1, display:"flex", gap:6, alignItems:"center", justifyContent:"center" }}><Ic d={P.check} size={16} color={C.green} stroke={3}/><span style={{ fontSize:13, fontWeight:700, color:C.green }}>Signed & Published</span></div> : <>
                  <button style={{ flex:1, padding:9, borderRadius:10, border:`1px solid ${C.border}`, background:"transparent", color:C.textSecondary, fontSize:12, fontWeight:600, cursor:"pointer" }}>Edit</button>
                  <button onClick={()=>setSigned(p=>[...p,s.id])} style={{ flex:2, padding:9, borderRadius:10, border:"none", background:`linear-gradient(135deg,${C.teal},${C.blue})`, color:"#000", fontSize:12, fontWeight:800, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}><Ic d={P.sign} size={14} color="#000" stroke={2.5}/>Sign & Publish</button>
                </>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const DoctorCDSS = () => {
  const [q,setQ]=useState(""); const [result,setResult]=useState(null); const [loading,setLoading]=useState(false);
  const tools=[{l:"Drug Interactions",i:P.pill,c:C.purple},{l:"Dose Calculator",i:P.pulse,c:C.teal},{l:"Risk Scores",i:P.trending,c:C.amber},{l:"WHO Guidelines",i:P.book,c:C.blue},{l:"Dx Suggest",i:P.brain,c:C.green},{l:"Lab Interpret",i:P.lab,c:C.red}];
  const mock={"aspirin warfarin":{sv:"HIGH",t:"Aspirin + Warfarin",b:"Increased bleeding risk. Avoid unless benefits outweigh risk. Monitor INR. Add PPI cover.",s:"WHO EML 2023 · CDSS-verified"},"metformin ckd":{sv:"MED",t:"Metformin in CKD",b:"Safe eGFR>60. Reduce dose eGFR 45-59. Avoid eGFR<30. Monitor 3-6 monthly.",s:"KDIGO 2022 · WHO Guideline"}};
  const sc={HIGH:C.red,MED:C.amber,LOW:C.green,INFO:C.blue};
  const search=()=>{ setLoading(true); setTimeout(()=>{ const k=Object.keys(mock).find(x=>q.toLowerCase().includes(x.split(" ")[0])); setResult(k?mock[k]:{sv:"INFO",t:"AI Diagnostic Assist",b:`Query "${q}" — CDSS RAG analysis returning differential guidance with WHO Smart Guideline citations.`,s:"MediCore CDSS · AI-enhanced"}); setLoading(false); },1200); };
  return (
    <div style={{ paddingBottom:20 }}>
      <ScreenHeader title="Decision Support" sub="Clinical AI" accent={C.teal}/>
      <div style={{ padding:"12px 14px 0" }}>
        <div style={{ display:"flex", gap:8, marginBottom:12 }}>
          <input placeholder="Drug · symptom · guideline..." value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&search()} style={{ flex:1, background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"9px 13px", color:C.textPrimary, fontSize:13, outline:"none", fontFamily:"inherit" }}/>
          <button onClick={search} style={{ width:42,height:42,borderRadius:12,background:`linear-gradient(135deg,${C.teal},${C.blue})`,border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}><Ic d={P.sparkle} size={18} color="#fff" stroke={2}/></button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:12 }}>
          {tools.map(t=><div key={t.l} onClick={()=>setQ(t.l)} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"11px 8px", display:"flex", flexDirection:"column", alignItems:"center", gap:6, cursor:"pointer" }}><div style={{ width:34,height:34,borderRadius:10,background:`${t.c}18`,display:"flex",alignItems:"center",justifyContent:"center" }}><Ic d={t.i} size={17} color={t.c}/></div><span style={{ fontSize:10,color:C.textSecondary,fontWeight:600,textAlign:"center" }}>{t.l}</span></div>)}
        </div>
        {loading&&<div style={{ background:C.card,borderRadius:14,padding:18,textAlign:"center",border:`1px solid ${C.teal}33`,color:C.teal,fontSize:13 }}>⟳ Analyzing with CDSS...</div>}
        {result&&!loading&&<div style={{ background:C.card,borderRadius:16,border:`1px solid ${sc[result.sv]}44`,overflow:"hidden",animation:"fadeIn 0.3s" }}><div style={{ background:`${sc[result.sv]}14`,padding:"10px 14px",borderBottom:`1px solid ${sc[result.sv]}33`,display:"flex",justifyContent:"space-between",alignItems:"center" }}><div style={{ display:"flex",gap:7,alignItems:"center" }}><AiBadge text="CDSS"/><span style={{ fontSize:14,fontWeight:800,color:C.textPrimary }}>{result.t}</span></div><Badge color={sc[result.sv]}>{result.sv}</Badge></div><div style={{ padding:14 }}><div style={{ fontSize:12,color:C.textSecondary,lineHeight:1.7,marginBottom:8 }}>{result.b}</div><div style={{ display:"flex",gap:4,alignItems:"center" }}><Ic d={P.shield} size={11} color={C.green}/><span style={{ fontSize:10,color:C.textMuted }}>{result.s}</span></div></div></div>}
      </div>
    </div>
  );
};

const DoctorDictate = () => {
  const [rec,setRec]=useState(false); const [processing,setProcessing]=useState(false); const [draft,setDraft]=useState(null);
  const toggle=()=>{ if(rec){setRec(false);setProcessing(true);setTimeout(()=>{setDraft({soap:{S:"SOB on exertion × 3d, no chest pain",O:"BP 162/96 · SpO₂ 93% · Bilateral basal creps",A:"Decompensated Heart Failure (J81.0)",P:"Furosemide 40mg IV · Fluid restrict · BNP · Echo"},meds:["Furosemide 40mg IV STAT","ACE-I optimization"],orders:["BNP","CXR","Echo"],conf:89});setProcessing(false);},2200);}else{setRec(true);setDraft(null);}};
  return (
    <div style={{ paddingBottom:20 }}>
      <ScreenHeader title="Voice → SOAP Note" sub="AI Dictation" accent={C.teal}/>
      <div style={{ padding:"24px 14px 0", display:"flex", flexDirection:"column", alignItems:"center" }}>
        <div style={{ position:"relative", marginBottom:20 }} onClick={toggle}>
          {rec&&[1,2].map(i=><div key={i} style={{ position:"absolute",width:96+i*28,height:96+i*28,borderRadius:"50%",border:`2px solid ${C.red}`,opacity:0.3-i*0.08,animation:`ripple 1.2s ${i*0.4}s infinite`,top:"50%",left:"50%",transform:"translate(-50%,-50%)" }}/>)}
          <div style={{ width:96,height:96,borderRadius:"50%",cursor:"pointer",background:rec?`linear-gradient(135deg,${C.red},#FF6B00)`:`linear-gradient(135deg,${C.teal},${C.blue})`,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:rec?`0 0 40px ${C.red}50`:`0 0 30px ${C.teal}40` }}>
            <Ic d={P.mic} size={36} color="#fff" stroke={2}/>
          </div>
        </div>
        <div style={{ fontSize:13,color:rec?C.red:C.textMuted,fontWeight:600,marginBottom:20 }}>{processing?"Processing...":rec?"● Recording — tap to stop":"Tap mic to dictate"}</div>
        {draft&&(
          <div style={{ width:"100%", animation:"fadeIn 0.4s" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}><AiBadge text="AI SOAP"/><Badge color={C.green}>{draft.conf}% confidence</Badge></div>
            <Card style={{ marginBottom:10 }}>
              {Object.entries(draft.soap).map(([k,v])=>(
                <div key={k} style={{ display:"flex",gap:10,marginBottom:6 }}><span style={{ width:14,fontSize:13,fontWeight:900,color:C.teal }}>{k}</span><span style={{ fontSize:12,color:C.textSecondary,flex:1,lineHeight:1.55 }}>{v}</span></div>
              ))}
            </Card>
            <div style={{ display:"flex",gap:8,marginBottom:12 }}>
              <Card style={{ flex:1 }}><div style={{ fontSize:9,color:C.textMuted,marginBottom:5,fontWeight:700,textTransform:"uppercase" }}>Meds</div>{draft.meds.map(m=><div key={m} style={{ fontSize:11,color:C.textSecondary,marginBottom:2 }}>• {m}</div>)}</Card>
              <Card style={{ flex:1 }}><div style={{ fontSize:9,color:C.textMuted,marginBottom:5,fontWeight:700,textTransform:"uppercase" }}>Orders</div>{draft.orders.map(o=><div key={o} style={{ fontSize:11,color:C.textSecondary,marginBottom:2 }}>• {o}</div>)}</Card>
            </div>
            <button style={{ width:"100%",padding:13,borderRadius:13,border:"none",background:`linear-gradient(135deg,${C.teal},${C.blue})`,color:"#000",fontWeight:800,fontSize:14,cursor:"pointer" }}>Save to Patient Record</button>
          </div>
        )}
      </div>
    </div>
  );
};

const NurseVitals = () => {
  const [v,setV]=useState({bp_s:"120",bp_d:"80",hr:"72",temp:"36.8",spo2:"98",rr:"16",pain:"2"});
  const [interp,setInterp]=useState(null); const [loading,setLoading]=useState(false);
  const fields=[{k:"bp_s",l:"Systolic",u:"mmHg"},{k:"bp_d",l:"Diastolic",u:"mmHg"},{k:"hr",l:"Heart Rate",u:"bpm"},{k:"temp",l:"Temp",u:"°C"},{k:"spo2",l:"SpO₂",u:"%"},{k:"rr",l:"Resp Rate",u:"/min"},{k:"pain",l:"Pain",u:"/10"}];
  const interpret=()=>{setLoading(true);setTimeout(()=>{setInterp("Vitals within normal limits. BP prehypertensive range (120/80). SpO₂ and HR normal. No immediate clinical concern.");setLoading(false);},1000);};
  return (
    <div style={{ paddingBottom:20 }}>
      <ScreenHeader title="Record Vitals" sub="Nurse Copilot" accent={C.purple}/>
      <div style={{ padding:"12px 14px 12px", background:C.surface, borderBottom:`1px solid ${C.border}` }}>
        <div style={{ fontSize:12, color:C.textSecondary }}>Patient: <strong style={{ color:C.textPrimary }}>Tendai Moyo</strong> · Bed C-12</div>
      </div>
      <div style={{ padding:"12px 14px 0" }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
          {fields.map(f=>(
            <div key={f.k} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"9px 12px" }}>
              <div style={{ fontSize:9,color:C.textMuted,marginBottom:3,fontWeight:700,textTransform:"uppercase" }}>{f.l}</div>
              <div style={{ display:"flex",alignItems:"center",gap:4 }}>
                <input value={v[f.k]} onChange={e=>setV(p=>({...p,[f.k]:e.target.value}))} style={{ flex:1,background:"transparent",border:"none",outline:"none",fontSize:22,fontWeight:900,color:C.textPrimary,fontFamily:"'JetBrains Mono',monospace",width:0,minWidth:0 }}/>
                <span style={{ fontSize:10,color:C.textMuted }}>{f.u}</span>
              </div>
            </div>
          ))}
        </div>
        <button onClick={interpret} style={{ width:"100%",padding:12,borderRadius:12,border:`1px solid ${C.teal}44`,background:`${C.teal}15`,color:C.teal,fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:10 }}>
          <AiBadge text="AI"/> Interpret with Copilot
        </button>
        {loading&&<div style={{ textAlign:"center",color:C.teal,fontSize:13,padding:14 }}>Analyzing...</div>}
        {interp&&<Card style={{ marginBottom:10 }}><div style={{ display:"flex",gap:6,alignItems:"center",marginBottom:6 }}><AiBadge text="INTERPRETATION"/></div><div style={{ fontSize:12,color:C.textSecondary,lineHeight:1.65 }}>{interp}</div></Card>}
        <button style={{ width:"100%",padding:13,borderRadius:13,border:"none",background:`linear-gradient(135deg,${C.purple},${C.blue})`,color:"#fff",fontWeight:800,fontSize:14,cursor:"pointer" }}>Save Vitals</button>
      </div>
    </div>
  );
};

const PatientHome = ({ onNav }) => {
  const results=[{test:"Troponin I",value:"0.04 μg/L",status:"normal",date:"Today"},{test:"eGFR",value:"62 mL/min",status:"low",date:"Today"},{test:"HbA1c",value:"7.2%",status:"borderline",date:"3 Mar"}];
  const rc={normal:C.green,low:C.amber,borderline:C.amber};
  return (
    <div style={{ paddingBottom:20 }}>
      <div style={{ padding:"18px 16px 14px", background:"linear-gradient(180deg,#0A1628 0%,#0E1829 100%)" }}>
        <div style={{ fontSize:11,color:C.textMuted }}>Good morning</div>
        <div style={{ fontSize:22,fontWeight:900,color:C.textPrimary }}>Tendai 👋</div>
      </div>
      <div style={{ padding:"0 14px" }}>
        <div onClick={()=>onNav("visit")} style={{ background:"linear-gradient(135deg,#001A2E,#00201A)",border:`1px solid ${C.teal}44`,borderRadius:18,padding:16,cursor:"pointer",marginBottom:14,position:"relative",overflow:"hidden" }}>
          <div style={{ position:"absolute",right:-16,top:-16,width:80,height:80,borderRadius:"50%",background:`${C.teal}12` }}/>
          <div style={{ display:"flex",gap:12,alignItems:"center" }}>
            <AiPulse size={46} active/>
            <div style={{ flex:1 }}><div style={{ display:"flex",gap:6,alignItems:"center",marginBottom:3 }}><span style={{ fontSize:15,fontWeight:800,color:C.textPrimary }}>PostVisit AI</span><div style={{ width:8,height:8,borderRadius:"50%",background:C.teal,animation:"pulse 1.5s infinite" }}/></div><div style={{ fontSize:12,color:C.textSecondary }}>Dr. Chinyama signed your visit summary.</div><div style={{ fontSize:11,color:C.teal,marginTop:4 }}>View summary + ask AI →</div></div>
          </div>
        </div>
        {/* Medication reminder strip */}
        <div onClick={()=>onNav("meds")} style={{ background:`${C.teal}12`, border:`1px solid ${C.teal}33`, borderRadius:14, padding:"10px 14px", marginBottom:14, cursor:"pointer", display:"flex", gap:10, alignItems:"center" }}>
          <div style={{ width:36, height:36, borderRadius:10, background:`${C.teal}22`, display:"flex", alignItems:"center", justifyContent:"center" }}><Ic d={P.pill} size={18} color={C.teal}/></div>
          <div style={{ flex:1 }}><div style={{ fontSize:13, fontWeight:700, color:C.textPrimary }}>Medication Reminder</div><div style={{ fontSize:11, color:C.textSecondary }}>Aspirin 75mg due now · 82% adherence this week</div></div>
          <Badge color={C.teal}>4 today</Badge>
        </div>
        <SH action="See all" onAction={()=>onNav("health")}>Lab Results</SH>
        <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:14 }}>
          {results.map(r=>(
            <div key={r.test} onClick={()=>onNav("health")} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"11px 14px", display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer" }}>
              <div><div style={{ fontSize:13, fontWeight:700, color:C.textPrimary }}>{r.test}</div><div style={{ fontSize:11, color:C.textMuted }}>{r.date}</div></div>
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                <span style={{ fontSize:14, fontWeight:800, color:rc[r.status], fontFamily:"'JetBrains Mono',monospace" }}>{r.value}</span>
                <Dot color={rc[r.status]}/>
              </div>
            </div>
          ))}
        </div>
        <SH>Quick Actions</SH>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          {[[P.calendar,"Book Appt",C.teal,()=>{}],[P.telehealth,"Telehealth",C.blue,()=>{}],[P.wallet,"Pay Bills",C.amber,()=>onNav("bills")],[P.pulse,"Symptom Check",C.purple,()=>{}]].map(([ic,l,c,fn])=>(
            <div key={l} onClick={fn} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:"13px 10px", display:"flex", flexDirection:"column", alignItems:"center", gap:7, cursor:"pointer" }}>
              <div style={{ width:38, height:38, borderRadius:11, background:`${c}18`, display:"flex", alignItems:"center", justifyContent:"center" }}><Ic d={ic} size={19} color={c}/></div>
              <span style={{ fontSize:11, fontWeight:700, color:C.textSecondary, textAlign:"center" }}>{l}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const PatientVisit = ({ onNav }) => {
  const [tab,setTab]=useState("summary"); const [expanded,setExpanded]=useState({}); const [msgs,setMsgs]=useState([{role:"ai",intro:true}]); const [input,setInput]=useState(""); const [typing,setTyping]=useState(false);
  const toggle=k=>setExpanded(p=>({...p,[k]:!p[k]}));
  const sections=[{k:"cc",l:"Chief Complaint",icon:"💬",c:"Chest pain radiating to left arm, diaphoresis. Onset 4h prior. Severity 8/10."},{k:"hpi",l:"History of Present Illness",icon:"🕐",c:"67M with HTN and dyslipidaemia. Central crushing chest pain × 4h, left arm radiation, diaphoresis, mild nausea."},{k:"sx",l:"Reported Symptoms",icon:"📋",c:"Chest pain 8/10, left arm radiation, diaphoresis, mild nausea. No dyspnoea, no syncope."},{k:"pe",l:"Physical Examination",icon:"🩺",c:"BP 158/94. HR 108. SpO₂ 94%. Heart sounds normal, no murmurs. Lungs clear."},{k:"assess",l:"Assessment",icon:"⚕️",c:"NSTEMI (I21.4). Troponin I 2.4 μg/L. ECG: ST depression V4-V6."},{k:"plan",l:"Plan",icon:"⭐",c:"Admit CCU. Aspirin 300mg + Clopidogrel 600mg loading. Enoxaparin 1mg/kg BD. Urgent cardiology review. Serial ECG + troponin. Echo 24h. Statin initiated."}];
  const suggestions=["What happened during my visit?","What was discussed?","What was the conclusion?","What do my medications do?"];
  const send=text=>{ const m=text||input; if(!m.trim())return; setMsgs(p=>p.filter(x=>!x.intro).concat({role:"patient",text:m})); setInput(""); setTyping(true); setTimeout(()=>{setMsgs(p=>[...p,{role:"ai",text:m.toLowerCase().includes("medic")?"You are on Aspirin 75mg daily, Clopidogrel 75mg daily, and Atorvastatin 40mg at night. These prevent clots and lower cholesterol after your heart attack.":"You were diagnosed with NSTEMI — a type of heart attack caused by partial blockage of a heart artery. Treatment was started immediately and you were admitted to the cardiac care unit.",badge:"PostVisit AI · citation-grounded"}]);setTyping(false);},1400); };
  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column" }}>
      <div style={{ padding:"12px 14px 10px", background:C.surface, borderBottom:`1px solid ${C.border}` }}>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={()=>setTab("summary")} style={{ flex:1, padding:8, borderRadius:10, border:"none", cursor:"pointer", background:tab==="summary"?C.teal:C.card, color:tab==="summary"?"#000":C.textSecondary, fontSize:12, fontWeight:700 }}>Visit Summary</button>
          <button onClick={()=>setTab("chat")} style={{ flex:1, padding:8, borderRadius:10, border:"none", cursor:"pointer", background:tab==="chat"?C.teal:C.card, color:tab==="chat"?"#000":C.textSecondary, fontSize:12, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
            <Ic d={P.chat} size={13} color={tab==="chat"?"#000":C.textSecondary}/>AI Chat
          </button>
        </div>
      </div>
      <div style={{ flex:1, overflowY:"auto" }}>
        {tab==="summary"&&(
          <div style={{ padding:"14px 14px 20px" }}>
            <div onClick={()=>onNav("home")} style={{ display:"flex",alignItems:"center",gap:5,marginBottom:12,cursor:"pointer" }}><span style={{ fontSize:16,color:C.textMuted }}>‹</span><span style={{ fontSize:12,color:C.textMuted }}>Back to Profile</span></div>
            <div style={{ fontSize:22,fontWeight:900,color:C.textPrimary,marginBottom:10 }}>Visit Summary</div>
            <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:12 }}>
              <div style={{ background:C.blue,borderRadius:8,padding:"4px 8px",textAlign:"center" }}><div style={{ fontSize:9,fontWeight:700,color:"#fff",textTransform:"uppercase" }}>Mar</div><div style={{ fontSize:18,fontWeight:900,color:"#fff",lineHeight:1 }}>7</div></div>
              <div><div style={{ fontSize:13,color:C.textSecondary }}>Office Visit</div><div style={{ fontSize:12,color:C.teal,fontWeight:700 }}>Dr. Chinyama · Cardiology</div></div>
            </div>
            <div style={{ background:`${C.teal}12`,border:`1px solid ${C.teal}30`,borderRadius:14,padding:"12px 14px",marginBottom:14 }}>
              <div style={{ fontSize:13,fontWeight:700,color:C.textPrimary,marginBottom:4 }}>ℹ️ Quick Summary</div>
              <div style={{ fontSize:12,color:C.textSecondary,lineHeight:1.6 }}>Chest pain presentation → diagnosed with <span style={{ color:C.teal,fontWeight:700 }}>NSTEMI</span>. Urgent treatment started.</div>
            </div>
            {sections.map(s=>(
              <div key={s.k} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, marginBottom:8, overflow:"hidden" }}>
                <div onClick={()=>toggle(s.k)} style={{ padding:"12px 14px", display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer" }}>
                  <div style={{ display:"flex",gap:9,alignItems:"center" }}><span style={{ fontSize:15 }}>{s.icon}</span><span style={{ fontSize:14,fontWeight:700,color:C.textPrimary }}>{s.l}</span></div>
                  <div style={{ display:"flex",gap:8,alignItems:"center" }}>
                    <div onClick={e=>{e.stopPropagation();setTab("chat");}} style={{ display:"flex",gap:4,alignItems:"center",background:`${C.teal}18`,borderRadius:99,padding:"3px 9px",cursor:"pointer" }}><Ic d={P.check} size={10} color={C.teal} stroke={2.5}/><span style={{ fontSize:10,color:C.teal,fontWeight:700 }}>Ask</span></div>
                    <div style={{ transform:expanded[s.k]?"rotate(180deg)":"",transition:"transform 0.2s" }}><Ic d={P.chevron} size={15} color={C.textMuted}/></div>
                  </div>
                </div>
                {expanded[s.k]&&<div style={{ padding:"0 14px 12px", borderTop:`1px solid ${C.border}` }}><div style={{ fontSize:12,color:C.textSecondary,lineHeight:1.7,paddingTop:10 }}>{s.c}</div></div>}
              </div>
            ))}
          </div>
        )}
        {tab==="chat"&&(
          <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
            <div style={{ flex:1, overflowY:"auto", padding:"14px 14px 8px", display:"flex", flexDirection:"column", gap:10 }}>
              {msgs[0]?.intro&&<div style={{ display:"flex",flexDirection:"column",alignItems:"center",padding:"24px 20px 10px",animation:"fadeIn 0.4s" }}><AiPulse size={58} active/><div style={{ fontSize:17,fontWeight:800,color:C.textPrimary,marginTop:12,marginBottom:4 }}>Your visit assistant</div><div style={{ background:`${C.teal}22`,borderRadius:99,padding:"4px 12px",fontSize:12,color:C.teal,fontWeight:700,marginBottom:8 }}>Visit Summary</div><div style={{ fontSize:13,color:C.textMuted,textAlign:"center" }}>Ask me anything about your visit.</div></div>}
              {msgs.length===1&&<div style={{ display:"flex",flexDirection:"column",gap:8 }}>{suggestions.map(s=><div key={s} onClick={()=>{setMsgs(p=>p.filter(m=>!m.intro));send(s);}} style={{ background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"11px 14px",cursor:"pointer",fontSize:13,color:C.textSecondary }}>{s}</div>)}</div>}
              {msgs.filter(m=>!m.intro).map((m,i)=>m.role==="ai"?<div key={i} style={{ display:"flex",gap:8,maxWidth:"88%" }}><div style={{ width:28,height:28,borderRadius:"50%",background:`linear-gradient(135deg,${C.teal},${C.blue})`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}><Ic d={P.sparkle} size={14} color="#fff" stroke={2}/></div><div><div style={{ background:C.card,border:`1px solid ${C.border}`,borderRadius:"0 14px 14px 14px",padding:"10px 12px" }}><div style={{ fontSize:13,color:C.textSecondary,lineHeight:1.65 }}>{m.text}</div>{m.badge&&<div style={{ marginTop:5 }}><Badge color={C.teal}>{m.badge}</Badge></div>}</div></div></div>:<div key={i} style={{ display:"flex",justifyContent:"flex-end" }}><div style={{ background:`linear-gradient(135deg,${C.teal}33,${C.blue}33)`,border:`1px solid ${C.teal}33`,borderRadius:"14px 0 14px 14px",padding:"10px 12px",maxWidth:220 }}><div style={{ fontSize:13,color:C.textPrimary,lineHeight:1.5 }}>{m.text}</div></div></div>)}
              {typing&&<div style={{ display:"flex",gap:8 }}><div style={{ width:28,height:28,borderRadius:"50%",background:`linear-gradient(135deg,${C.teal},${C.blue})`,flexShrink:0 }}/><div style={{ background:C.card,border:`1px solid ${C.border}`,borderRadius:"0 14px 14px 14px",padding:"12px 16px",display:"flex",gap:4 }}>{[0,1,2].map(i=><div key={i} style={{ width:6,height:6,borderRadius:"50%",background:C.teal,animation:`pulse 1s ${i*0.3}s infinite` }}/>)}</div></div>}
            </div>
            <div style={{ padding:"8px 12px 12px", borderTop:`1px solid ${C.border}`, background:C.surface }}>
              <div style={{ display:"flex",gap:8,alignItems:"center" }}>
                <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Ask about your visit..." style={{ flex:1,background:C.card,border:`1px solid ${C.border}`,borderRadius:20,padding:"9px 14px",color:C.textPrimary,fontSize:12,outline:"none",fontFamily:"inherit" }}/>
                <button onClick={()=>send()} style={{ width:38,height:38,borderRadius:"50%",background:`linear-gradient(135deg,${C.teal},${C.blue})`,border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}><Ic d={P.send} size={16} color="#fff" stroke={2}/></button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// APP SHELL
// ═══════════════════════════════════════════════════════════════════════════════

// Tab definitions per role
const DOCTOR_TABS = [
  {k:"ward",    icon:P.rounds,   l:"Rounds"},
  {k:"postvisit",icon:P.sparkle, l:"PostVisit"},
  {k:"escalations",icon:P.alert,l:"Inbox"},
  {k:"messages",icon:P.chat,     l:"Messages"},
  {k:"cdss",    icon:P.brain,    l:"AI"},
];

const NURSE_TABS = [
  {k:"dashboard",icon:P.home,    l:"Shift"},
  {k:"vitals",  icon:P.pulse,    l:"Vitals"},
  {k:"messages",icon:P.chat,     l:"Messages"},
];

const PATIENT_TABS = [
  {k:"home",    icon:P.home,     l:"Home"},
  {k:"visit",   icon:P.sparkle,  l:"PostVisit"},
  {k:"meds",    icon:P.pill,     l:"Meds"},
  {k:"bills",   icon:P.wallet,   l:"Bills"},
  {k:"health",  icon:P.heart,    l:"Health"},
];

const ROLE_ACCENT = { doctor:C.teal, nurse:C.purple, patient:C.teal };

// Simplified health screen placeholder
const PatientHealth = () => (
  <div style={{ paddingBottom:20 }}>
    <ScreenHeader title="My Health" sub="Patient" accent={C.blue}/>
    <div style={{ padding:"14px 14px 0" }}>
      {[["Health Profile","Personal info, biometrics, diagnoses"],["Vitals","Blood pressure, HR, SpO₂ history"],["Lab Results","Trend charts with reference ranges"],["Connected Services","Apple Health, Google Fit, Fitbit, Garmin"],["Documents","Medical records, reports, letters"]].map(([t,d])=>(
        <div key={t} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:13, padding:"13px 14px", marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div><div style={{ fontSize:14, fontWeight:700, color:C.textPrimary }}>{t}</div><div style={{ fontSize:11, color:C.textMuted, marginTop:2 }}>{d}</div></div>
          <Ic d={P.arrow} size={16} color={C.textMuted}/>
        </div>
      ))}
    </div>
  </div>
);

export default function App() {
  const [role, setRole] = useState("doctor");
  const [dt, setDt] = useState("ward");
  const [nt, setNt] = useState("dashboard");
  const [pt, setPt] = useState("home");
  const [showNotifs, setShowNotifs] = useState(false);

  const tabState = { doctor:[dt,setDt], nurse:[nt,setNt], patient:[pt,setPt] };
  const [activeTab, setActiveTab] = tabState[role];

  const unreadCount = { doctor:4, nurse:3, patient:3 };

  const renderContent = () => {
    if (role === "doctor") {
      if (dt === "ward")        return <DoctorWardRounds onNav={setDt}/>;
      if (dt === "postvisit")   return <PostVisitSignoff/>;
      if (dt === "escalations") return <DoctorEscalationInbox/>;
      if (dt === "messages")    return <SecureMessaging myRole="doctor"/>;
      if (dt === "cdss")        return <DoctorCDSS/>;
      if (dt === "dictate")     return <DoctorDictate/>;
    }
    if (role === "nurse") {
      if (nt === "dashboard")   return <NurseDashboard/>;
      if (nt === "vitals")      return <NurseVitals/>;
      if (nt === "messages")    return <SecureMessaging myRole="nurse"/>;
    }
    if (role === "patient") {
      if (pt === "home")        return <PatientHome onNav={setPt}/>;
      if (pt === "visit")       return <PatientVisit onNav={setPt}/>;
      if (pt === "meds")        return <PatientMedications/>;
      if (pt === "bills")       return <PatientBills/>;
      if (pt === "health")      return <PatientHealth/>;
    }
  };

  const tabs = role === "doctor" ? DOCTOR_TABS : role === "nurse" ? NURSE_TABS : PATIENT_TABS;
  const ac = ROLE_ACCENT[role];

  return (
    <>
      <style>{css}</style>
      <div style={{ minHeight:"100vh", background:"#030710", display:"flex", justifyContent:"center", alignItems:"flex-start", padding:"22px 16px 40px", fontFamily:"'Sora',sans-serif" }}>
        <div style={{ display:"flex", gap:32, flexWrap:"wrap", justifyContent:"center", alignItems:"flex-start", maxWidth:920 }}>

          {/* ── PHONE ────────────────────────────────────────────────────── */}
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>

            {/* Role switcher */}
            <div style={{ display:"flex", gap:4, marginBottom:14, background:"#0A1422", borderRadius:14, padding:4, border:`1px solid ${C.border}` }}>
              {[["doctor","👨‍⚕️","Doctor"],["nurse","👩‍⚕️","Nurse"],["patient","🧑","Patient"]].map(([r,em,l])=>(
                <button key={r} onClick={()=>setRole(r)} style={{ padding:"7px 12px", borderRadius:10, border:"none", cursor:"pointer", background:role===r?ROLE_ACCENT[r]:"transparent", color:role===r?"#000":C.textMuted, fontSize:11, fontWeight:700, transition:"all 0.2s", whiteSpace:"nowrap" }}>{em} {l}</button>
              ))}
            </div>

            {/* Phone frame */}
            <div style={{ width:375, background:C.bg, borderRadius:48, overflow:"hidden", border:`2px solid ${C.border}`, boxShadow:`0 40px 90px rgba(0,0,0,0.85), 0 0 0 1px #08101E, inset 0 1px 0 ${C.borderLight}`, position:"relative" }}>

              {/* Status bar */}
              <div style={{ height:40, background:C.bg, display:"flex", alignItems:"center", justifyContent:"center", borderBottom:`1px solid ${C.border}`, position:"relative" }}>
                <div style={{ width:90, height:24, background:"#060C18", borderRadius:20, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                  <div style={{ width:9, height:9, borderRadius:"50%", background:"#1a2535" }}/>
                  <div style={{ width:36, height:5, background:"#1a2535", borderRadius:3 }}/>
                </div>
                <div style={{ position:"absolute", left:16, display:"flex", alignItems:"center", gap:4 }}>
                  <span style={{ fontSize:10, color:C.textMuted, fontFamily:"'JetBrains Mono',monospace" }}>9:41</span>
                </div>
                {/* Notification bell */}
                <div onClick={()=>setShowNotifs(true)} style={{ position:"absolute", right:14, width:30, height:30, borderRadius:9, background:C.card, border:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", position:"absolute", right:12 }}>
                  <Ic d={P.bell} size={15} color={C.textSecondary}/>
                  {unreadCount[role]>0 && (
                    <div style={{ position:"absolute", top:-3, right:-3, width:16, height:16, borderRadius:"50%", background:C.red, display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <span style={{ fontSize:9, fontWeight:800, color:"#fff" }}>{unreadCount[role]}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Screen content */}
              <div style={{ height:680, overflowY:"auto", background:C.bg, position:"relative" }}>
                {showNotifs && (
                  <NotificationCentre
                    role={role}
                    onClose={()=>setShowNotifs(false)}
                    onNavigate={(page)=>{ setActiveTab(page); setShowNotifs(false); }}
                  />
                )}
                {!showNotifs && renderContent()}
              </div>

              {/* Bottom nav */}
              <div style={{ background:C.surface, borderTop:`1px solid ${C.border}`, display:"flex", alignItems:"center", padding:"6px 2px 8px" }}>
                {tabs.map(t=>{
                  const isActive = activeTab===t.k;
                  return (
                    <button key={t.k} onClick={()=>{ setActiveTab(t.k); setShowNotifs(false); }} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3, padding:"6px 2px", background:"transparent", border:"none", cursor:"pointer", position:"relative" }}>
                      <div style={{ width:38, height:30, borderRadius:10, background:isActive?`${ac}22`:"transparent", display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.2s" }}>
                        <Ic d={t.icon} size={19} color={isActive?ac:C.textMuted} stroke={isActive?2:1.5}/>
                      </div>
                      <span style={{ fontSize:9, fontWeight:isActive?800:500, color:isActive?ac:C.textMuted, letterSpacing:"0.02em" }}>{t.l}</span>
                      {/* Badge on escalation tab */}
                      {t.k==="escalations" && role==="doctor" && activeTab!=="escalations" && (
                        <div style={{ position:"absolute", top:2, right:"50%", transform:"translateX(10px)", width:14, height:14, borderRadius:"50%", background:C.red, display:"flex", alignItems:"center", justifyContent:"center" }}>
                          <span style={{ fontSize:8, fontWeight:800, color:"#fff" }}>3</span>
                        </div>
                      )}
                      {t.k==="messages" && activeTab!=="messages" && (
                        <div style={{ position:"absolute", top:2, right:"50%", transform:"translateX(10px)", width:14, height:14, borderRadius:"50%", background:C.blue, display:"flex", alignItems:"center", justifyContent:"center" }}>
                          <span style={{ fontSize:8, fontWeight:800, color:"#fff" }}>2</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              <div style={{ height:8, background:C.surface, display:"flex", alignItems:"center", justifyContent:"center" }}>
                <div style={{ width:80, height:3, background:C.border, borderRadius:99 }}/>
              </div>
            </div>
          </div>

          {/* ── FEATURE PANEL ────────────────────────────────────────────── */}
          <div style={{ width:310, paddingTop:66 }}>
            <div style={{ marginBottom:24 }}>
              <div style={{ fontSize:11, fontWeight:800, color:C.teal, letterSpacing:"0.15em", marginBottom:5 }}>MEDICORE</div>
              <div style={{ fontSize:26, fontWeight:900, color:C.textPrimary, lineHeight:1.2, marginBottom:8 }}>Companion App<br/><span style={{ color:C.teal }}>v3</span> — Complete</div>
              <div style={{ fontSize:13, color:C.textSecondary, lineHeight:1.7 }}>All five missing flows added. The app is now genuinely complete for its mobile purpose.</div>
            </div>

            {/* NEW additions callout */}
            <div style={{ background:`${C.green}08`, border:`1px solid ${C.green}33`, borderRadius:16, padding:14, marginBottom:16 }}>
              <div style={{ display:"flex", gap:7, alignItems:"center", marginBottom:10 }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background:C.green, animation:"pulse 2s infinite" }}/>
                <span style={{ fontSize:12, fontWeight:800, color:C.textPrimary }}>5 Flows Added in v3</span>
              </div>
              {[
                ["🔴","Doctor Escalation Inbox","SLA timers · CDSS AI suggestion · vitals at escalation · acknowledge + resolve"],
                ["🔔","Nurse → Doctor Escalation","Severity picker · doctor select · finding input · instant audit trail"],
                ["💬","Secure Messaging","Provider threads · message types · end-to-end encrypted · HIPAA audited"],
                ["💊","Medication Reminders","7-day adherence dots · reminder toggles · mark as taken · AI adherence score"],
                ["💳","Mobile Bill Payment","EcoCash · OneMoney · card · 3-step pay flow · CIMAS medical aid status"],
              ].map(([em,t,d])=>(
                <div key={t} style={{ display:"flex", gap:10, alignItems:"flex-start", marginBottom:10, paddingBottom:10, borderBottom:`1px solid ${C.border}` }}>
                  <span style={{ fontSize:18, flexShrink:0 }}>{em}</span>
                  <div>
                    <div style={{ fontSize:12, fontWeight:800, color:C.textPrimary, marginBottom:2 }}>{t}</div>
                    <div style={{ fontSize:11, color:C.textMuted, lineHeight:1.4 }}>{d}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Cross-cutting */}
            <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:14, marginBottom:14 }}>
              <div style={{ fontSize:11, fontWeight:700, color:C.textMuted, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:10 }}>🔔 Notification Centre</div>
              {[
                "Bell icon in status bar with live unread badge",
                "Tap opens full notification screen with category filters",
                "Types: escalation · critical · message · result · reminder · bill",
                "Each notification deep-links into the right screen",
                "Role-specific — doctor, nurse, and patient each see their own feed",
              ].map(f=>(
                <div key={f} style={{ display:"flex", gap:7, alignItems:"flex-start", marginBottom:6 }}>
                  <Ic d={P.check} size={11} color={C.teal} stroke={2.5}/>
                  <span style={{ fontSize:11, color:C.textSecondary, lineHeight:1.45 }}>{f}</span>
                </div>
              ))}
            </div>

            {/* Role tabs summary */}
            {[
              { role:"doctor", color:C.teal, em:"👨‍⚕️", tabs:["Rounds","PostVisit AI","Escalation Inbox ✦","Secure Messages ✦","AI Assist"], note:"Dictate accessible via ward context" },
              { role:"nurse",  color:C.purple, em:"👩‍⚕️", tabs:["Shift + Escalate ✦","Vitals + AI Copilot","Secure Messages ✦"], note:"Escalate button on each task row" },
              { role:"patient",color:C.blue, em:"🧑", tabs:["Home","PostVisit AI","Medications ✦","Bills & Payment ✦","My Health"], note:"EcoCash + OneMoney + Card + Bank" },
            ].map(r=>(
              <div key={r.role} onClick={()=>setRole(r.role)} style={{ background:C.card, border:`1px solid ${role===r.role?r.color+"55":C.border}`, borderLeft:`3px solid ${r.color}`, borderRadius:14, padding:13, marginBottom:10, cursor:"pointer" }}>
                <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:8 }}>
                  <span style={{ fontSize:17 }}>{r.em}</span>
                  <span style={{ fontSize:14, fontWeight:800, color:C.textPrimary, textTransform:"capitalize" }}>{r.role} Mode</span>
                  {role===r.role && <Badge color={r.color}>ACTIVE</Badge>}
                </div>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:6 }}>
                  {r.tabs.map(t=>(
                    <span key={t} style={{ background:t.includes("✦")?`${r.color}22`:`${C.surface}`, border:`1px solid ${t.includes("✦")?r.color+"44":C.border}`, borderRadius:6, padding:"3px 8px", fontSize:10, color:t.includes("✦")?r.color:C.textMuted, fontWeight:t.includes("✦")?700:500 }}>{t}</span>
                  ))}
                </div>
                <div style={{ fontSize:11, color:C.textMuted, fontStyle:"italic" }}>{r.note}</div>
              </div>
            ))}

            <div style={{ background:`${C.teal}08`, border:`1px solid ${C.teal}33`, borderRadius:14, padding:12 }}>
              <div style={{ fontSize:11, color:C.teal, fontWeight:700, marginBottom:6 }}>✦ = New in v3</div>
              <div style={{ fontSize:11, color:C.textMuted, lineHeight:1.6 }}>The app now covers all mobile-first clinical workflows. Heavy desktop features (billing dashboards, analytics, OR scheduling, CDI, DHIS2, admin) remain correctly on the web EHR.</div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
