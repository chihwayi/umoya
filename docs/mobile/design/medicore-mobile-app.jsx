import { useState, useRef, useEffect } from "react";

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const C = {
  bg: "#080E1A", surface: "#0E1829", card: "#121F33", cardHover: "#172438",
  border: "#1E3050", borderLight: "#253A58",
  teal: "#00C896", tealDim: "#009E76", tealGlow: "rgba(0,200,150,0.15)",
  blue: "#2B7FFF", blueDim: "#1A5FCC",
  amber: "#FFB020", red: "#FF4D6A", green: "#00E5A0",
  purple: "#A66CFF", pink: "#FF6BB5",
  textPrimary: "#E8F0FF", textSecondary: "#7A92B8", textMuted: "#4A6080",
};

// ─── MICRO COMPONENTS ─────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800;900&family=JetBrains+Mono:wght@400;600;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#040810;font-family:'Sora',sans-serif}
  ::-webkit-scrollbar{width:0}
  input::placeholder{color:#4A6080}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes ripple{0%{transform:translate(-50%,-50%) scale(1);opacity:0.5}100%{transform:translate(-50%,-50%) scale(3);opacity:0}}
  @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
`;

const Icon = ({ d, size = 20, color = C.textSecondary, stroke = 1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const I = {
  home: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z",
  heart: "M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z",
  lab: "M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v11l3 3 3-3V3M3 9h18",
  book: "M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 016.5 22H20V2H6.5A2.5 2.5 0 004 4.5v15z",
  chat: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z",
  sparkle: "M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3zM5 3l.75 2.25L8 6l-2.25.75L5 9l-.75-2.25L2 6l2.25-.75L5 3zM19 16l.75 2.25L22 19l-2.25.75L19 22l-.75-2.25L16 19l2.25-.75L19 16z",
  send: "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z",
  check: "M20 6L9 17l-5-5",
  chevron: "M6 9l6 6 6-6",
  arrow: "M5 12h14M12 5l7 7-7 7",
  plus: "M12 5v14M5 12h14",
  link: "M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71",
  upload: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12",
  search: "M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35",
  pulse: "M22 12h-4l-3 9L9 3l-3 9H2",
  watch: "M12 2a10 10 0 100 20A10 10 0 0012 2zM12 6v6l4 2",
  alert: "M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01",
  expand: "M8 3H5a2 2 0 00-2 2v3M21 8V5a2 2 0 00-2-2h-3M3 16v3a2 2 0 002 2h3M16 21h3a2 2 0 002-2v-3",
  pill: "M10.5 20H4a2 2 0 01-2-2V6a2 2 0 012-2h16a2 2 0 012 2v7.5M16 3v4M8 3v4M2 11h20M21.29 14.7a2.43 2.43 0 00-3.43 3.43L21 21l3.14-3.14-2.85-3.16zM16 19h6",
  ward: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z",
  mic: "M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8",
  brain: "M9.5 2A2.5 2.5 0 007 4.5A2.5 2.5 0 004.5 7H4a2 2 0 00-2 2v2c0 1.1.9 2 2 2h.5A2.5 2.5 0 007 15.5A2.5 2.5 0 009.5 18h5a2.5 2.5 0 002.5-2.5A2.5 2.5 0 0019.5 13H20a2 2 0 002-2V9a2 2 0 00-2-2h-.5A2.5 2.5 0 0017 4.5A2.5 2.5 0 0014.5 2h-5z",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  bed: "M3 7v13M21 7v13M3 12h18M3 7h18M9 7V3M15 7V3",
  sign: "M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
  refresh: "M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15",
  trending: "M23 6l-9.5 9.5-5-5L1 18",
  user: "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8",
  calendar: "M3 4h18v18H3V4zM16 2v4M8 2v4M3 10h18",
  telehealth: "M15 10l4.553-2.069A1 1 0 0121 8.868V15.13a1 1 0 01-1.447.899L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z",
};

const Badge = ({ children, color = C.teal, small }) => (
  <span style={{ background: `${color}22`, color, fontSize: small ? 9 : 10, fontWeight: 700, padding: small ? "1px 6px" : "2px 8px", borderRadius: 99, letterSpacing: "0.04em", fontFamily: "'JetBrains Mono', monospace", whiteSpace: "nowrap" }}>
    {children}
  </span>
);

const AiBadge = ({ text = "AI" }) => (
  <span style={{ background: "linear-gradient(135deg,#00C896,#2B7FFF)", color: "#fff", fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 6, letterSpacing: "0.06em" }}>{text}</span>
);

const Dot = ({ color = C.green, pulse }) => (
  <span style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", width: 10, height: 10 }}>
    {pulse && <span style={{ position: "absolute", inset: -3, borderRadius: "50%", background: color, opacity: 0.25, animation: "pulse 1.5s infinite" }} />}
    <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, display: "block" }} />
  </span>
);

const Card = ({ children, style = {}, onClick }) => (
  <div onClick={onClick} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "14px 16px", cursor: onClick ? "pointer" : "default", ...style }}>
    {children}
  </div>
);

const SectionHeader = ({ children, action, onAction }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
    <span style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: "0.1em", textTransform: "uppercase" }}>{children}</span>
    {action && <span onClick={onAction} style={{ fontSize: 12, color: C.teal, fontWeight: 600, cursor: "pointer" }}>{action}</span>}
  </div>
);

const AiPulse = ({ size = 40, active }) => (
  <div style={{ position: "relative", width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
    {active && [1, 2].map(i => (
      <div key={i} style={{ position: "absolute", width: "100%", height: "100%", borderRadius: "50%", border: `1.5px solid ${C.teal}`, opacity: 0.5 / i, animation: `ripple 2s ${i * 0.5}s infinite`, top: "50%", left: "50%", transform: "translate(-50%,-50%)" }} />
    ))}
    <div style={{ width: size, height: size, borderRadius: "50%", background: active ? `linear-gradient(135deg,${C.teal},${C.blue})` : C.surface, border: `2px solid ${active ? C.teal : C.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Icon d={I.sparkle} size={size * 0.45} color="#fff" stroke={2} />
    </div>
  </div>
);

// ─── SPARKLINE COMPONENT ──────────────────────────────────────────────────────
const Sparkline = ({ data, color, width = 220, height = 60, min, max, refLow, refHigh }) => {
  if (!data || data.length < 2) return null;
  const allVals = data.map(d => d.v);
  const lo = min ?? Math.min(...allVals) * 0.9;
  const hi = max ?? Math.max(...allVals) * 1.1;
  const px = (i) => (i / (data.length - 1)) * width;
  const py = (v) => height - ((v - lo) / (hi - lo)) * height;
  const pts = data.map((d, i) => `${px(i)},${py(d.v)}`).join(" ");
  const area = `M${px(0)},${py(data[0].v)} ${data.slice(1).map((d, i) => `L${px(i + 1)},${py(d.v)}`).join(" ")} L${width},${height} L0,${height} Z`;
  return (
    <svg width={width} height={height} style={{ overflow: "visible" }}>
      {refLow && <line x1="0" y1={py(refLow)} x2={width} y2={py(refLow)} stroke={`${color}44`} strokeWidth={1} strokeDasharray="4,3" />}
      {refHigh && <line x1="0" y1={py(refHigh)} x2={width} y2={py(refHigh)} stroke={`${C.red}44`} strokeWidth={1} strokeDasharray="4,3" />}
      <path d={area} fill={`${color}18`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      {data.map((d, i) => (
        <circle key={i} cx={px(i)} cy={py(d.v)} r={i === data.length - 1 ? 4 : 3} fill={color} stroke={C.bg} strokeWidth={1.5} />
      ))}
    </svg>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// DOCTOR SCREENS
// ═══════════════════════════════════════════════════════════════════════════════

const DoctorWardRounds = ({ onNav }) => {
  const patients = [
    { id: "C-12", name: "Tendai Moyo", age: 67, ward: "Cardiology", dx: "NSTEMI", flag: "critical", vitals: { "BP": "158/94", "SpO₂": "94%", "HR": "108" }, alerts: ["Critical troponin 2.4", "New ST changes V4-V6"] },
    { id: "M-03", name: "Chipo Ncube", age: 34, ward: "Maternity", dx: "Pre-eclampsia", flag: "warning", vitals: { "BP": "148/92", "SpO₂": "98%", "HR": "88" }, alerts: ["BP trending up"] },
    { id: "G-08", name: "Felix Dube", age: 52, ward: "General", dx: "T2DM / CKD", flag: "stable", vitals: { "BP": "132/80", "SpO₂": "97%", "HR": "76" }, alerts: [] },
    { id: "H-05", name: "Ruth Sithole", age: 28, ward: "HIV/ART", dx: "HIV Stage 3", flag: "info", vitals: { "BP": "118/72", "SpO₂": "99%", "HR": "72" }, alerts: ["CD4 pending"] },
  ];
  const fc = { critical: C.red, warning: C.amber, stable: C.green, info: C.blue };

  return (
    <div style={{ paddingBottom: 20 }}>
      <div style={{ padding: "16px 18px 12px", background: C.surface, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, marginBottom: 2 }}>DR. CHINYAMA · MEDICORE</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: C.textPrimary }}>Ward Rounds</div>
          </div>
          <div style={{ background: `${C.red}22`, border: `1px solid ${C.red}44`, borderRadius: 10, padding: "5px 10px", display: "flex", gap: 5, alignItems: "center" }}>
            <Dot color={C.red} pulse /><span style={{ fontSize: 11, color: C.red, fontWeight: 700 }}>2 Critical</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {[["12","My Pts"],["3","Pending"],["2","Signoffs"]].map(([v,l])=>(
            <div key={l} style={{ flex:1, background:C.card, borderRadius:12, padding:"8px 10px", textAlign:"center", border:`1px solid ${C.border}` }}>
              <div style={{ fontSize:20, fontWeight:900, color:C.textPrimary }}>{v}</div>
              <div style={{ fontSize:10, color:C.textMuted }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: "14px 14px 0" }}>
        {/* PostVisit AI banner */}
        <div onClick={() => onNav("postvisit")} style={{
          background: "linear-gradient(135deg,#00291E,#001428)", border: `1px solid ${C.teal}44`, borderRadius: 18, padding: 14, cursor: "pointer", marginBottom: 14, position: "relative", overflow: "hidden",
        }}>
          <div style={{ position:"absolute", right:-16, top:-16, width:80, height:80, borderRadius:"50%", background:`${C.teal}12` }} />
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <AiPulse size={44} active />
            <div style={{ flex:1 }}>
              <div style={{ display:"flex", gap:6, alignItems:"center", marginBottom:3 }}>
                <span style={{ fontSize:14, fontWeight:800, color:C.textPrimary }}>PostVisit AI</span>
                <AiBadge text="3 PENDING" />
              </div>
              <div style={{ fontSize:12, color:C.textSecondary }}>AI summaries ready — review, edit & sign</div>
              <div style={{ fontSize:11, color:C.teal, marginTop:4 }}>Tap to open signoff queue →</div>
            </div>
          </div>
        </div>

        <SectionHeader>Round List</SectionHeader>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {patients.map(p=>(
            <div key={p.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderLeft:`3px solid ${fc[p.flag]}`, borderRadius:14, padding:14 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                <div>
                  <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:3 }}>
                    <span style={{ fontSize:15, fontWeight:800, color:C.textPrimary }}>{p.name}</span>
                    <Badge color={fc[p.flag]}>{p.flag.toUpperCase()}</Badge>
                  </div>
                  <div style={{ fontSize:11, color:C.textMuted }}>{p.age}y · {p.ward} · Bed {p.id} · {p.dx}</div>
                </div>
              </div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {Object.entries(p.vitals).map(([k,v])=>(
                  <div key={k} style={{ background:C.surface, borderRadius:8, padding:"3px 8px", fontSize:11, color:C.textSecondary, fontFamily:"'JetBrains Mono',monospace" }}>
                    <span style={{ color:C.textMuted, fontSize:9 }}>{k} </span>{v}
                  </div>
                ))}
              </div>
              {p.alerts.length>0&&(
                <div style={{ marginTop:8, display:"flex", gap:6, flexWrap:"wrap" }}>
                  {p.alerts.map(a=>(
                    <div key={a} style={{ display:"flex", alignItems:"center", gap:4, background:`${C.amber}15`, borderRadius:99, padding:"2px 8px" }}>
                      <Icon d={I.alert} size={11} color={C.amber} /><span style={{ fontSize:10, color:C.amber, fontWeight:600 }}>{a}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const PostVisitSignoff = () => {
  const [signed, setSigned] = useState([]);
  const sessions = [
    { id:"PV-2240", patient:"Tendai Moyo", time:"10:32", dur:"24 min", conf:96, entities:["NSTEMI","Aspirin 300mg","Troponin 2.4","Cardiology referral"], draft:"Tendai Moyo, 67M. Chest pain × 4h. ECG: ST depression V4-V6. Troponin I: 2.4 μg/L. Impression: NSTEMI. Plan: DAPT initiated. Urgent cardiology referral. Admit CCU.", flags:["Critical lab cited","Drug interaction verified","WHO guideline applied"] },
    { id:"PV-2241", patient:"Chipo Ncube", time:"11:15", dur:"18 min", conf:91, entities:["Pre-eclampsia","Labetalol 200mg","BP 148/92","Fetal monitoring"], draft:"Chipo Ncube, 34F, 32wk. Headache & BP 148/92. Pre-eclampsia (no severe features). Labetalol 200mg BD started. Fetal monitoring initiated. MFM consult placed.", flags:["WHO maternity guideline","Dosing weight-adjusted"] },
    { id:"PV-2242", patient:"Ruth Sithole", time:"09:50", dur:"31 min", conf:94, entities:["HIV Stage 3","TLD ART","CD4 pending","TPT ongoing"], draft:"Ruth Sithole, 28F. HIV-positive 3-month review. VL undetectable. CD4 pending. WHO Stage 3. ART (TLD) continued. TPT ongoing. EAC performed.", flags:["WHO HIV guideline","PHI-minimized AI prompt"] },
  ];
  const pending = sessions.filter(s=>!signed.includes(s.id));
  const done = sessions.filter(s=>signed.includes(s.id));

  return (
    <div style={{ paddingBottom:20 }}>
      <div style={{ padding:"14px 16px 12px", background:C.surface, borderBottom:`1px solid ${C.border}` }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
          <AiPulse size={36} active />
          <div>
            <div style={{ fontSize:11, color:C.teal, fontWeight:700, letterSpacing:"0.1em" }}>POSTVISIT AI</div>
            <div style={{ fontSize:18, fontWeight:900, color:C.textPrimary }}>Signoff Queue</div>
          </div>
        </div>
        <div style={{ display:"flex", gap:8, marginTop:8 }}>
          <div style={{ flex:1, background:`${C.amber}15`, borderRadius:10, padding:"6px 10px", textAlign:"center" }}>
            <div style={{ fontSize:18, fontWeight:900, color:C.amber }}>{pending.length}</div>
            <div style={{ fontSize:9, color:C.textMuted }}>PENDING</div>
          </div>
          <div style={{ flex:1, background:`${C.green}15`, borderRadius:10, padding:"6px 10px", textAlign:"center" }}>
            <div style={{ fontSize:18, fontWeight:900, color:C.green }}>{done.length}</div>
            <div style={{ fontSize:9, color:C.textMuted }}>SIGNED</div>
          </div>
          <div style={{ flex:1, background:`${C.blue}15`, borderRadius:10, padding:"6px 10px", textAlign:"center" }}>
            <div style={{ fontSize:18, fontWeight:900, color:C.blue }}>3</div>
            <div style={{ fontSize:9, color:C.textMuted }}>FHIR EXP</div>
          </div>
        </div>
      </div>

      <div style={{ padding:"12px 14px 0", display:"flex", flexDirection:"column", gap:14 }}>
        {pending.map(s=>(
          <div key={s.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, overflow:"hidden", animation:"fadeIn 0.3s ease" }}>
            <div style={{ padding:"12px 14px", borderBottom:`1px solid ${C.border}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div>
                  <div style={{ fontSize:15, fontWeight:800, color:C.textPrimary }}>{s.patient}</div>
                  <div style={{ fontSize:11, color:C.textMuted }}>{s.time} · {s.dur} · {s.id}</div>
                </div>
                <div style={{ background:`${C.green}22`, borderRadius:"50%", width:38, height:38, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <span style={{ fontSize:12, fontWeight:800, color:C.green }}>{s.conf}%</span>
                </div>
              </div>
              <div style={{ display:"flex", gap:5, marginTop:8, flexWrap:"wrap" }}>
                {s.entities.map(e=><span key={e} style={{ background:`${C.blue}18`, border:`1px solid ${C.blue}30`, borderRadius:6, padding:"2px 7px", fontSize:10, color:C.blue, fontWeight:600 }}>{e}</span>)}
              </div>
            </div>
            <div style={{ padding:"10px 14px", background:`${C.teal}07`, borderBottom:`1px solid ${C.border}` }}>
              <div style={{ display:"flex", gap:6, alignItems:"center", marginBottom:6 }}>
                <AiBadge text="AI DRAFT" />
                <span style={{ fontSize:10, color:C.textMuted }}>citation-grounded · deterministic fallback</span>
              </div>
              <div style={{ fontSize:12, color:C.textSecondary, lineHeight:1.65 }}>{s.draft}</div>
            </div>
            <div style={{ padding:"8px 14px", borderBottom:`1px solid ${C.border}`, display:"flex", gap:10, flexWrap:"wrap" }}>
              {s.flags.map(f=>(
                <div key={f} style={{ display:"flex", gap:4, alignItems:"center" }}>
                  <Icon d={I.shield} size={11} color={C.green} />
                  <span style={{ fontSize:10, color:C.green }}>{f}</span>
                </div>
              ))}
            </div>
            <div style={{ padding:"10px 14px", display:"flex", gap:8 }}>
              <button style={{ flex:1, padding:"9px", borderRadius:10, border:`1px solid ${C.border}`, background:"transparent", color:C.textSecondary, fontSize:12, fontWeight:600, cursor:"pointer" }}>Edit</button>
              <button onClick={()=>setSigned(p=>[...p,s.id])} style={{ flex:2, padding:"9px", borderRadius:10, border:"none", background:`linear-gradient(135deg,${C.teal},${C.blue})`, color:"#000", fontSize:12, fontWeight:800, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                <Icon d={I.sign} size={14} color="#000" stroke={2.5} />Sign & Publish
              </button>
            </div>
          </div>
        ))}
        {done.map(s=>(
          <div key={s.id} style={{ background:C.card, border:`1px solid ${C.green}30`, borderRadius:14, padding:14, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:C.textPrimary }}>{s.patient}</div>
              <div style={{ fontSize:11, color:C.textMuted }}>{s.id} · FHIR exported · Patient notified</div>
            </div>
            <Badge color={C.green}>SIGNED ✓</Badge>
          </div>
        ))}
        {pending.length===0&&done.length>0&&(
          <div style={{ textAlign:"center", padding:"30px 20px" }}>
            <div style={{ fontSize:36, marginBottom:8 }}>🎉</div>
            <div style={{ fontSize:16, fontWeight:800, color:C.textPrimary }}>All signed off!</div>
            <div style={{ fontSize:12, color:C.textMuted, marginTop:4 }}>Patient records updated & published to FHIR</div>
          </div>
        )}
      </div>
    </div>
  );
};

const DoctorCDSS = () => {
  const [q, setQ] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const tools = [
    {label:"Drug Interactions",icon:I.pill,color:C.purple},
    {label:"Dose Calculator",icon:I.pulse,color:C.teal},
    {label:"Risk Scores",icon:I.trending,color:C.amber},
    {label:"WHO Guidelines",icon:I.book,color:C.blue},
    {label:"Dx Suggest",icon:I.brain,color:C.green},
    {label:"Lab Interpret",icon:I.lab,color:C.red},
  ];
  const mockResults = {
    "aspirin warfarin":{ severity:"HIGH", title:"Aspirin + Warfarin", body:"Increased bleeding risk (GI, intracranial). Avoid concurrent use unless mechanical valve or high ACS risk. If combined: use lowest aspirin dose (75mg), add PPI, monitor INR 2-3 weekly.", source:"WHO EML 2023 · CDSS-verified · MedBERT" },
    "metformin ckd":{ severity:"MED", title:"Metformin in CKD", body:"Safe eGFR >60. Reduce dose eGFR 45-59. Contraindicated eGFR <30. Monitor renal function every 3-6 months. Withhold before contrast.", source:"KDIGO 2022 · WHO Smart Guideline · RAG-grounded" },
  };
  const sc = {HIGH:C.red,MED:C.amber,LOW:C.green,INFO:C.blue};
  const search = () => {
    setLoading(true);
    setTimeout(()=>{
      const key = Object.keys(mockResults).find(k=>q.toLowerCase().includes(k.split(" ")[0]));
      setResult(key ? mockResults[key] : { severity:"INFO", title:"AI Diagnostic Assist", body:`Query: "${q}" — CDSS RAG analysis returned differential guidance with citations from WHO Smart Guidelines and MedBERT clinical embeddings.`, source:"MediCore CDSS · AI-enhanced" });
      setLoading(false);
    },1200);
  };
  return (
    <div style={{ paddingBottom:20 }}>
      <div style={{ padding:"14px 16px 12px", background:C.surface, borderBottom:`1px solid ${C.border}` }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <AiPulse size={36} active />
          <div>
            <div style={{ fontSize:11, color:C.teal, fontWeight:700, letterSpacing:"0.1em" }}>CLINICAL AI</div>
            <div style={{ fontSize:18, fontWeight:900, color:C.textPrimary }}>Decision Support</div>
          </div>
        </div>
      </div>
      <div style={{ padding:"14px 14px 0" }}>
        <div style={{ display:"flex", gap:8, marginBottom:14 }}>
          <input placeholder="Drug · symptom · guideline..." value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&search()} style={{ flex:1, background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"10px 14px", color:C.textPrimary, fontSize:13, outline:"none", fontFamily:"inherit" }} />
          <button onClick={search} style={{ width:44,height:44,borderRadius:12,background:`linear-gradient(135deg,${C.teal},${C.blue})`,border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>
            <Icon d={I.sparkle} size={20} color="#fff" stroke={2} />
          </button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:14 }}>
          {tools.map(t=>(
            <div key={t.label} onClick={()=>setQ(t.label)} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"11px 8px", display:"flex", flexDirection:"column", alignItems:"center", gap:6, cursor:"pointer" }}>
              <div style={{ width:34,height:34,borderRadius:10,background:`${t.color}18`,display:"flex",alignItems:"center",justifyContent:"center" }}>
                <Icon d={t.icon} size={17} color={t.color} />
              </div>
              <span style={{ fontSize:10,color:C.textSecondary,fontWeight:600,textAlign:"center" }}>{t.label}</span>
            </div>
          ))}
        </div>
        {loading&&<div style={{ background:C.card,borderRadius:14,padding:20,textAlign:"center",border:`1px solid ${C.teal}33`,color:C.teal,fontSize:13 }}>⟳ Analyzing with CDSS...</div>}
        {result&&!loading&&(
          <div style={{ background:C.card,borderRadius:16,border:`1px solid ${sc[result.severity]}44`,overflow:"hidden",animation:"fadeIn 0.3s" }}>
            <div style={{ background:`${sc[result.severity]}14`,padding:"10px 14px",borderBottom:`1px solid ${sc[result.severity]}33`,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
              <div style={{ display:"flex",gap:7,alignItems:"center" }}><AiBadge text="CDSS"/><span style={{ fontSize:14,fontWeight:800,color:C.textPrimary }}>{result.title}</span></div>
              <Badge color={sc[result.severity]}>{result.severity}</Badge>
            </div>
            <div style={{ padding:14 }}>
              <div style={{ fontSize:12,color:C.textSecondary,lineHeight:1.7,marginBottom:10 }}>{result.body}</div>
              <div style={{ display:"flex",gap:4,alignItems:"center" }}><Icon d={I.shield} size={11} color={C.green}/><span style={{ fontSize:10,color:C.textMuted }}>{result.source}</span></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const DoctorDictate = () => {
  const [rec, setRec] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [draft, setDraft] = useState(null);
  const toggle = () => {
    if(rec){ setRec(false); setProcessing(true); setTimeout(()=>{ setDraft({ soap:{S:"SOB on exertion × 3d, no chest pain, no orthopnea",O:"BP 162/96 · SpO₂ 93% · Bilateral basal creps",A:"Decompensated Heart Failure (J81.0)",P:"Furosemide 40mg IV · Fluid restrict 1.5L/d · BNP · Echo · ACE-I optimization"}, meds:["Furosemide 40mg IV STAT","ACE inhibitor optimization"], orders:["BNP","CXR PA","Echo","U&E"], conf:89 }); setProcessing(false); },2200); }
    else{ setRec(true); setDraft(null); }
  };
  return (
    <div style={{ paddingBottom:20 }}>
      <div style={{ padding:"14px 16px 12px", background:C.surface, borderBottom:`1px solid ${C.border}` }}>
        <div style={{ fontSize:11,color:C.teal,fontWeight:700,marginBottom:2,letterSpacing:"0.1em" }}>AI DICTATION</div>
        <div style={{ fontSize:18,fontWeight:900,color:C.textPrimary }}>Voice → SOAP Note</div>
      </div>
      <div style={{ padding:"24px 14px 0", display:"flex", flexDirection:"column", alignItems:"center" }}>
        <div style={{ position:"relative", marginBottom:20 }} onClick={toggle}>
          {rec&&[1,2].map(i=><div key={i} style={{ position:"absolute",width:96+i*28,height:96+i*28,borderRadius:"50%",border:`2px solid ${C.red}`,opacity:0.3-i*0.08,animation:`ripple 1.2s ${i*0.4}s infinite`,top:"50%",left:"50%",transform:"translate(-50%,-50%)" }} />)}
          <div style={{ width:96,height:96,borderRadius:"50%",cursor:"pointer",background:rec?`linear-gradient(135deg,${C.red},#FF6B00)`:`linear-gradient(135deg,${C.teal},${C.blue})`,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:rec?`0 0 40px ${C.red}50`:`0 0 30px ${C.teal}40` }}>
            <Icon d={I.mic} size={36} color="#fff" stroke={2} />
          </div>
        </div>
        <div style={{ fontSize:13,color:rec?C.red:C.textMuted,fontWeight:600,marginBottom:20 }}>
          {processing?"Processing...":rec?"● Recording — tap to stop":"Tap mic to dictate note"}
        </div>
        {draft&&(
          <div style={{ width:"100%", animation:"fadeIn 0.4s" }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
              <AiBadge text="AI SOAP NOTE"/><Badge color={C.green}>{draft.conf}% confidence</Badge>
            </div>
            <Card style={{ marginBottom:10 }}>
              {Object.entries(draft.soap).map(([k,v])=>(
                <div key={k} style={{ display:"flex",gap:10,marginBottom:7 }}>
                  <span style={{ width:14,fontSize:13,fontWeight:900,color:C.teal }}>{k}</span>
                  <span style={{ fontSize:12,color:C.textSecondary,flex:1,lineHeight:1.55 }}>{v}</span>
                </div>
              ))}
            </Card>
            <div style={{ display:"flex",gap:8,marginBottom:12 }}>
              <Card style={{ flex:1 }}>
                <div style={{ fontSize:9,color:C.textMuted,marginBottom:5,fontWeight:700,textTransform:"uppercase" }}>Meds</div>
                {draft.meds.map(m=><div key={m} style={{ fontSize:11,color:C.textSecondary,marginBottom:2 }}>• {m}</div>)}
              </Card>
              <Card style={{ flex:1 }}>
                <div style={{ fontSize:9,color:C.textMuted,marginBottom:5,fontWeight:700,textTransform:"uppercase" }}>Orders</div>
                {draft.orders.map(o=><div key={o} style={{ fontSize:11,color:C.textSecondary,marginBottom:2 }}>• {o}</div>)}
              </Card>
            </div>
            <button style={{ width:"100%",padding:13,borderRadius:13,border:"none",background:`linear-gradient(135deg,${C.teal},${C.blue})`,color:"#000",fontWeight:800,fontSize:14,cursor:"pointer" }}>
              Save to Patient Record
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// NURSE SCREENS
// ═══════════════════════════════════════════════════════════════════════════════

const NurseDashboard = () => {
  const [tab, setTab] = useState("worklist");
  const [tasks, setTasks] = useState([
    {id:1,patient:"Tendai Moyo",task:"BP recheck",bed:"C-12",pri:"URGENT",due:"Now",done:false},
    {id:2,patient:"Felix Dube",task:"Insulin (BCMA scan)",bed:"G-08",pri:"HIGH",due:"12:30",done:false},
    {id:3,patient:"Chipo Ncube",task:"Fetal monitoring strip",bed:"M-03",pri:"HIGH",due:"13:00",done:false},
    {id:4,patient:"Ruth Sithole",task:"CD4 sample collection",bed:"H-05",pri:"MED",due:"14:00",done:true},
    {id:5,patient:"James Mutasa",task:"Wound dressing",bed:"G-02",pri:"MED",due:"14:30",done:false},
  ]);
  const pc = {URGENT:C.red,HIGH:C.amber,MED:C.blue};
  const triage = [
    {name:"Male ~40y",complaint:"Chest pain, diaphoresis",esi:2,wait:"2 min",color:C.red},
    {name:"Female 28y",complaint:"Headache, BP 170/110",esi:2,wait:"6 min",color:C.red},
    {name:"Child 8y",complaint:"Fever 39.5°C, rash",esi:3,wait:"20 min",color:C.amber},
    {name:"Male 65y",complaint:"UTI symptoms, mild dysuria",esi:4,wait:"48 min",color:C.blue},
  ];
  return (
    <div style={{ paddingBottom:20 }}>
      <div style={{ padding:"14px 16px 12px", background:C.surface, borderBottom:`1px solid ${C.border}` }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
          <div>
            <div style={{ fontSize:11,color:C.textMuted,fontWeight:600,marginBottom:2 }}>NURSE COPILOT</div>
            <div style={{ fontSize:20,fontWeight:900,color:C.textPrimary }}>My Shift</div>
          </div>
          <div style={{ display:"flex",gap:6 }}>
            <div style={{ background:`${C.red}18`,borderRadius:10,padding:"5px 9px",textAlign:"center" }}><div style={{ fontSize:16,fontWeight:900,color:C.red }}>2</div><div style={{ fontSize:9,color:C.textMuted }}>Urgent</div></div>
            <div style={{ background:`${C.amber}18`,borderRadius:10,padding:"5px 9px",textAlign:"center" }}><div style={{ fontSize:16,fontWeight:900,color:C.amber }}>3</div><div style={{ fontSize:9,color:C.textMuted }}>High</div></div>
          </div>
        </div>
        <div style={{ background:`linear-gradient(90deg,${C.teal}20,${C.purple}20)`,borderRadius:12,padding:"7px 12px",border:`1px solid ${C.teal}30`,display:"flex",gap:8,alignItems:"center",marginBottom:10 }}>
          <AiBadge text="COPILOT"/><span style={{ fontSize:11,color:C.teal }}>AI-assisted triage · vitals interpretation · handoff</span>
        </div>
        <div style={{ display:"flex",gap:8 }}>
          {[["worklist","Worklist"],["triage","Triage"]].map(([k,l])=>(
            <button key={k} onClick={()=>setTab(k)} style={{ flex:1,padding:7,borderRadius:10,border:"none",cursor:"pointer",background:tab===k?C.purple:C.card,color:tab===k?"#fff":C.textSecondary,fontSize:12,fontWeight:700 }}>{l}</button>
          ))}
        </div>
      </div>
      <div style={{ padding:"12px 14px 0" }}>
        {tab==="worklist"&&(
          <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
            {tasks.map(t=>(
              <div key={t.id} style={{ background:t.done?C.surface:C.card, border:`1px solid ${t.done?C.border:(pc[t.pri]+"44")}`, borderLeft:`3px solid ${t.done?C.textMuted:pc[t.pri]}`, borderRadius:13, padding:13, opacity:t.done?0.6:1 }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex",gap:7,alignItems:"center",marginBottom:3 }}>
                      <span style={{ fontSize:14,fontWeight:700,color:t.done?C.textMuted:C.textPrimary }}>{t.patient}</span>
                      {!t.done&&<Badge color={pc[t.pri]}>{t.pri}</Badge>}
                    </div>
                    <div style={{ fontSize:12,color:C.textSecondary }}>{t.task}</div>
                    <div style={{ fontSize:11,color:C.textMuted,marginTop:2 }}>Bed {t.bed} · Due {t.due}</div>
                  </div>
                  <div onClick={()=>setTasks(p=>p.map(x=>x.id===t.id?{...x,done:!x.done}:x))} style={{ width:28,height:28,borderRadius:8,background:t.done?C.green:"transparent",border:`2px solid ${t.done?C.green:C.border}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer" }}>
                    {t.done&&<Icon d={I.check} size={14} color="#000" stroke={3}/>}
                  </div>
                </div>
              </div>
            ))}
            <div style={{ background:"linear-gradient(135deg,#0D2040,#0D2535)",border:`1px solid ${C.blue}44`,borderRadius:16,padding:14,marginTop:6 }}>
              <div style={{ display:"flex",gap:7,alignItems:"center",marginBottom:7 }}><AiBadge text="AI HANDOFF"/><span style={{ fontSize:12,color:C.textSecondary,fontWeight:700 }}>End-of-Shift Summary</span></div>
              <div style={{ fontSize:12,color:C.textSecondary,lineHeight:1.65 }}>3 high-priority patients. C-12 (Moyo): critical troponin — MD notified. M-03 (Ncube): BP trending up, monitoring active. G-08 (Dube): insulin due 12:30.</div>
              <button style={{ marginTop:10,width:"100%",padding:9,borderRadius:10,border:`1px solid ${C.blue}44`,background:`${C.blue}15`,color:C.blue,fontSize:12,fontWeight:700,cursor:"pointer" }}>Generate Full Handoff Report</button>
            </div>
          </div>
        )}
        {tab==="triage"&&(
          <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
            <div style={{ display:"flex",gap:7,alignItems:"center",marginBottom:2 }}><AiBadge text="ESI TRIAGE"/><span style={{ fontSize:11,color:C.textSecondary }}>AI-assisted severity scoring (ESI 1-5)</span></div>
            {triage.map((p,i)=>(
              <div key={i} style={{ background:C.card,border:`1px solid ${p.color}44`,borderLeft:`4px solid ${p.color}`,borderRadius:14,padding:13 }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8 }}>
                  <div><div style={{ fontSize:14,fontWeight:700,color:C.textPrimary }}>{p.name}</div><div style={{ fontSize:12,color:C.textSecondary }}>{p.complaint}</div></div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ background:`${p.color}22`,border:`1px solid ${p.color}44`,borderRadius:8,padding:"3px 10px",fontSize:16,fontWeight:900,color:p.color }}>ESI {p.esi}</div>
                    <div style={{ fontSize:10,color:C.textMuted,marginTop:2 }}>Wait {p.wait}</div>
                  </div>
                </div>
                <button style={{ width:"100%",padding:7,borderRadius:10,border:`1px solid ${p.color}44`,background:`${p.color}15`,color:p.color,fontSize:12,fontWeight:700,cursor:"pointer" }}>Start Assessment with AI Copilot</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const NurseVitals = () => {
  const [v, setV] = useState({bp_s:"120",bp_d:"80",hr:"72",temp:"36.8",spo2:"98",rr:"16",pain:"2"});
  const [interp, setInterp] = useState(null);
  const [loading, setLoading] = useState(false);
  const fields = [{k:"bp_s",l:"Systolic",u:"mmHg"},{k:"bp_d",l:"Diastolic",u:"mmHg"},{k:"hr",l:"Heart Rate",u:"bpm"},{k:"temp",l:"Temp",u:"°C"},{k:"spo2",l:"SpO₂",u:"%"},{k:"rr",l:"Resp Rate",u:"/min"},{k:"pain",l:"Pain",u:"/10"}];
  const interpret = () => { setLoading(true); setTimeout(()=>{ setInterp({ text:"Vitals within normal limits. BP prehypertensive range (120/80). All other parameters normal. No immediate clinical concern.", flags:[] }); setLoading(false); },1000); };
  return (
    <div style={{ paddingBottom:20 }}>
      <div style={{ padding:"14px 16px 10px",background:C.surface,borderBottom:`1px solid ${C.border}` }}>
        <div style={{ fontSize:11,color:C.textMuted,marginBottom:2 }}>NURSE COPILOT</div>
        <div style={{ fontSize:18,fontWeight:900,color:C.textPrimary }}>Record Vitals</div>
        <div style={{ fontSize:12,color:C.textSecondary,marginTop:2 }}>Tendai Moyo · Ward C-12</div>
      </div>
      <div style={{ padding:"14px 14px 0" }}>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14 }}>
          {fields.map(f=>(
            <div key={f.k} style={{ background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"9px 12px" }}>
              <div style={{ fontSize:9,color:C.textMuted,marginBottom:3,fontWeight:700,textTransform:"uppercase" }}>{f.l}</div>
              <div style={{ display:"flex",alignItems:"center",gap:4 }}>
                <input value={v[f.k]} onChange={e=>setV(p=>({...p,[f.k]:e.target.value}))} style={{ flex:1,background:"transparent",border:"none",outline:"none",fontSize:22,fontWeight:900,color:C.textPrimary,fontFamily:"'JetBrains Mono',monospace",width:0,minWidth:0 }}/>
                <span style={{ fontSize:10,color:C.textMuted }}>{f.u}</span>
              </div>
            </div>
          ))}
        </div>
        <button onClick={interpret} style={{ width:"100%",padding:12,borderRadius:13,border:`1px solid ${C.teal}44`,background:`${C.teal}15`,color:C.teal,fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:12 }}>
          <AiBadge text="AI"/>Interpret with Copilot
        </button>
        {loading&&<div style={{ textAlign:"center",color:C.teal,fontSize:13,padding:16 }}>Analyzing...</div>}
        {interp&&<Card style={{ marginBottom:12 }}><div style={{ display:"flex",gap:7,alignItems:"center",marginBottom:7 }}><AiBadge text="INTERPRETATION"/></div><div style={{ fontSize:13,color:C.textSecondary,lineHeight:1.65 }}>{interp.text}</div></Card>}
        <button style={{ width:"100%",padding:13,borderRadius:13,border:"none",background:`linear-gradient(135deg,${C.teal},${C.blue})`,color:"#000",fontWeight:800,fontSize:14,cursor:"pointer" }}>Save Vitals</button>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// PATIENT SCREENS  (postvisit.ai-faithful)
// ═══════════════════════════════════════════════════════════════════════════════

// ── Patient Home ─────────────────────────────────────────────────────────────
const PatientHome = ({ onNav }) => {
  const results=[{test:"Troponin I",value:"0.04 μg/L",status:"normal",date:"Today"},{test:"eGFR",value:"62 mL/min",status:"low",date:"Today"},{test:"HbA1c",value:"7.2%",status:"borderline",date:"3 Mar"}];
  const rc={normal:C.green,low:C.amber,borderline:C.amber,high:C.red};
  return (
    <div style={{ paddingBottom:20 }}>
      <div style={{ padding:"20px 18px 14px",background:"linear-gradient(180deg,#0A1628 0%,#0E1829 100%)" }}>
        <div style={{ fontSize:11,color:C.textMuted }}>Good morning</div>
        <div style={{ fontSize:22,fontWeight:900,color:C.textPrimary }}>Tendai 👋</div>
      </div>
      <div style={{ padding:"0 14px" }}>
        {/* PostVisit AI companion */}
        <div onClick={()=>onNav("visit")} style={{ background:"linear-gradient(135deg,#001A2E,#00201A)",border:`1px solid ${C.teal}44`,borderRadius:18,padding:16,cursor:"pointer",marginBottom:14,position:"relative",overflow:"hidden" }}>
          <div style={{ position:"absolute",right:-16,top:-16,width:80,height:80,borderRadius:"50%",background:`${C.teal}12` }}/>
          <div style={{ display:"flex",gap:12,alignItems:"center" }}>
            <AiPulse size={46} active/>
            <div style={{ flex:1 }}>
              <div style={{ display:"flex",gap:6,alignItems:"center",marginBottom:3 }}>
                <span style={{ fontSize:15,fontWeight:800,color:C.textPrimary }}>PostVisit AI</span>
                <div style={{ width:8,height:8,borderRadius:"50%",background:C.teal,animation:"pulse 1.5s infinite" }}/>
              </div>
              <div style={{ fontSize:12,color:C.textSecondary }}>Dr. Chinyama signed your visit summary.</div>
              <div style={{ fontSize:11,color:C.teal,marginTop:4 }}>View summary + ask AI →</div>
            </div>
          </div>
        </div>

        {/* Upcoming */}
        <SectionHeader>Next Appointment</SectionHeader>
        <Card style={{ marginBottom:14 }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
            <div>
              <div style={{ fontSize:15,fontWeight:800,color:C.textPrimary }}>Dr. Chinyama</div>
              <div style={{ fontSize:12,color:C.textSecondary }}>Follow-up · Cardiology</div>
              <div style={{ fontSize:12,color:C.textMuted,marginTop:4 }}>Tue 11 Mar · 10:00 AM</div>
            </div>
            <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
              <button style={{ padding:"6px 12px",borderRadius:9,border:"none",background:`${C.red}22`,color:C.red,fontSize:11,fontWeight:700,cursor:"pointer" }}>Cancel</button>
              <button style={{ padding:"6px 12px",borderRadius:9,border:"none",background:`${C.teal}22`,color:C.teal,fontSize:11,fontWeight:700,cursor:"pointer" }}>Reschedule</button>
            </div>
          </div>
        </Card>

        {/* Lab results */}
        <SectionHeader action="See all">Lab Results</SectionHeader>
        <div style={{ display:"flex",flexDirection:"column",gap:8,marginBottom:14 }}>
          {results.map(r=>(
            <div key={r.test} onClick={()=>onNav("health")} style={{ background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"11px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer" }}>
              <div><div style={{ fontSize:13,fontWeight:700,color:C.textPrimary }}>{r.test}</div><div style={{ fontSize:11,color:C.textMuted }}>{r.date}</div></div>
              <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                <span style={{ fontSize:14,fontWeight:800,color:rc[r.status],fontFamily:"'JetBrains Mono',monospace" }}>{r.value}</span>
                <Dot color={rc[r.status]}/>
              </div>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <SectionHeader>Quick Actions</SectionHeader>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
          {[[I.calendar,"Book Appointment",C.teal,()=>{}],[I.telehealth,"Telehealth",C.blue,()=>{}],[I.pill,"Prescriptions",C.purple,()=>{}],[I.pulse,"Symptom Checker",C.amber,()=>{}]].map(([ic,l,col,fn])=>(
            <div key={l} onClick={fn} style={{ background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"13px 10px",display:"flex",flexDirection:"column",alignItems:"center",gap:7,cursor:"pointer" }}>
              <div style={{ width:38,height:38,borderRadius:11,background:`${col}18`,display:"flex",alignItems:"center",justifyContent:"center" }}><Icon d={ic} size={19} color={col}/></div>
              <span style={{ fontSize:11,fontWeight:700,color:C.textSecondary,textAlign:"center" }}>{l}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── Visit Summary (postvisit.ai-faithful) ─────────────────────────────────────
const PatientVisit = ({ onNav }) => {
  const [tab, setTab] = useState("summary");
  const [expanded, setExpanded] = useState({});
  const [messages, setMessages] = useState([
    { role:"ai", text:"Your visit assistant", intro:true },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);

  const toggle = (k) => setExpanded(p=>({...p,[k]:!p[k]}));

  const sections = [
    { key:"cc", label:"Chief Complaint", icon:"💬", content:"Chest pain radiating to left arm, associated with diaphoresis. Onset: 4 hours prior to presentation. Severity 8/10." },
    { key:"hpi", label:"History of Present Illness", icon:"🕐", content:"Tendai Moyo, 67-year-old male with known hypertension and dyslipidaemia, presented with central crushing chest pain × 4 hours, radiating to the left arm, associated with diaphoresis. No fever, no cough, no shortness of breath at rest." },
    { key:"sx", label:"Reported Symptoms", icon:"📋", content:"Chest pain (8/10), left arm radiation, diaphoresis, mild nausea. No dyspnoea, no syncope, no palpitations." },
    { key:"pe", label:"Physical Examination", icon:"🩺", content:"BP 158/94 mmHg. HR 108 bpm regular. SpO₂ 94% on room air. Afebrile. JVP not elevated. Heart sounds normal, no murmurs. Lungs clear. No peripheral oedema." },
    { key:"assess", label:"Assessment", icon:"⚕️", content:"Non-ST Elevation Myocardial Infarction (NSTEMI). ICD-10: I21.4. Troponin I: 2.4 μg/L (critical). ECG: ST depression V4-V6. High-risk ACS." },
    { key:"plan", label:"Plan", icon:"⭐", content:"1. Admit to CCU. 2. Aspirin 300mg stat + Clopidogrel 600mg loading. 3. Enoxaparin 1mg/kg BD. 4. Urgent cardiology review. 5. Serial ECG and troponin at 3h. 6. Echo within 24h. 7. Statin therapy initiated." },
  ];

  const suggestions = ["What happened during my visit?","What was discussed?","What was the conclusion?","What do my medications do?","When is my follow-up?"];

  const send = (text) => {
    const msg = text || input;
    if(!msg.trim()) return;
    setMessages(p=>[...p,{role:"patient",text:msg}]);
    setInput("");
    setTyping(true);
    setTimeout(()=>{
      setMessages(p=>[...p,{role:"ai",text:`Based on Dr. Chinyama's signed notes: ${msg.toLowerCase().includes("conclusion")||msg.toLowerCase().includes("happen") ? "You were diagnosed with NSTEMI (a type of heart attack). Treatment was started immediately and you were admitted to the cardiac care unit for close monitoring." : msg.toLowerCase().includes("medic") ? "You were started on Aspirin 75mg daily, Clopidogrel 75mg daily and Atorvastatin 40mg at night. These help keep your heart artery open and reduce future risk." : "Your care team is monitoring you closely. Please let your nurse know if you feel any chest pain, breathlessness, or dizziness."} `, badge:"PostVisit AI · citation-grounded"}]);
      setTyping(false);
    },1400);
  };

  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column" }}>
      {/* Header */}
      <div style={{ padding:"12px 14px 10px",background:C.surface,borderBottom:`1px solid ${C.border}` }}>
        <div style={{ display:"flex",gap:8,marginBottom:0 }}>
          <button onClick={()=>setTab("summary")} style={{ flex:1,padding:"8px",borderRadius:10,border:"none",cursor:"pointer",background:tab==="summary"?C.teal:C.card,color:tab==="summary"?"#000":C.textSecondary,fontSize:12,fontWeight:700 }}>Visit Summary</button>
          <button onClick={()=>setTab("chat")} style={{ flex:1,padding:"8px",borderRadius:10,border:"none",cursor:"pointer",background:tab==="chat"?C.teal:C.card,color:tab==="chat"?"#000":C.textSecondary,fontSize:12,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:6 }}>
            <Icon d={I.chat} size={14} color={tab==="chat"?"#000":C.textSecondary}/> AI Chat
          </button>
        </div>
      </div>

      <div style={{ flex:1, overflowY:"auto" }}>
        {tab==="summary"&&(
          <div style={{ padding:"14px 14px 20px" }}>
            {/* ← Back */}
            <div onClick={()=>onNav("home")} style={{ display:"flex",alignItems:"center",gap:6,marginBottom:12,cursor:"pointer" }}>
              <span style={{ fontSize:16,color:C.textMuted }}>‹</span>
              <span style={{ fontSize:12,color:C.textMuted }}>Back to Profile</span>
            </div>
            <div style={{ fontSize:22,fontWeight:900,color:C.textPrimary,marginBottom:10 }}>Visit Summary</div>
            {/* Date/doctor row */}
            <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:12 }}>
              <div style={{ background:C.blue,borderRadius:8,padding:"4px 8px",textAlign:"center" }}>
                <div style={{ fontSize:9,fontWeight:700,color:"#fff",textTransform:"uppercase" }}>Mar</div>
                <div style={{ fontSize:18,fontWeight:900,color:"#fff",lineHeight:1 }}>7</div>
              </div>
              <div>
                <div style={{ fontSize:13,color:C.textSecondary }}>Office Visit</div>
                <div style={{ fontSize:12,color:C.teal,fontWeight:700 }}>Dr. Chinyama · Cardiology</div>
              </div>
            </div>
            {/* Quick summary */}
            <div style={{ background:`${C.teal}12`,border:`1px solid ${C.teal}30`,borderRadius:14,padding:"12px 14px",marginBottom:14,display:"flex",gap:10 }}>
              <div style={{ fontSize:20 }}>ℹ️</div>
              <div>
                <div style={{ fontSize:13,fontWeight:700,color:C.textPrimary,marginBottom:4 }}>Quick Summary</div>
                <div style={{ fontSize:12,color:C.textSecondary,lineHeight:1.6 }}>Patient presented with chest pain radiating to left arm. Diagnosed with{" "}
                  <span style={{ color:C.teal,fontWeight:700 }}>NSTEMI</span> — urgent treatment started.
                </div>
              </div>
            </div>
            {/* Expandable sections */}
            {sections.map(s=>(
              <div key={s.key} style={{ background:C.card,border:`1px solid ${C.border}`,borderRadius:14,marginBottom:8,overflow:"hidden" }}>
                <div onClick={()=>toggle(s.key)} style={{ padding:"12px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer" }}>
                  <div style={{ display:"flex",gap:10,alignItems:"center" }}>
                    <span style={{ fontSize:16 }}>{s.icon}</span>
                    <span style={{ fontSize:14,fontWeight:700,color:C.textPrimary }}>{s.label}</span>
                  </div>
                  <div style={{ display:"flex",gap:10,alignItems:"center" }}>
                    <div onClick={e=>{e.stopPropagation();setTab("chat");}} style={{ display:"flex",gap:4,alignItems:"center",background:`${C.teal}18`,borderRadius:99,padding:"3px 9px",cursor:"pointer" }}>
                      <Icon d={I.check} size={11} color={C.teal} stroke={2.5}/>
                      <span style={{ fontSize:10,color:C.teal,fontWeight:700 }}>Ask</span>
                    </div>
                    <div style={{ transform:expanded[s.key]?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.2s" }}>
                      <Icon d={I.chevron} size={16} color={C.textMuted}/>
                    </div>
                  </div>
                </div>
                {expanded[s.key]&&(
                  <div style={{ padding:"0 14px 12px",borderTop:`1px solid ${C.border}`,animation:"fadeIn 0.2s" }}>
                    <div style={{ fontSize:12,color:C.textSecondary,lineHeight:1.7,paddingTop:10 }}>{s.content}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab==="chat"&&(
          <div style={{ display:"flex",flexDirection:"column",height:"100%" }}>
            <div style={{ flex:1,overflowY:"auto",padding:"14px 14px 8px",display:"flex",flexDirection:"column",gap:10 }}>
              {/* Intro */}
              {messages[0]?.intro&&(
                <div style={{ display:"flex",flexDirection:"column",alignItems:"center",padding:"24px 20px 10px",animation:"fadeIn 0.4s" }}>
                  <AiPulse size={60} active/>
                  <div style={{ fontSize:17,fontWeight:800,color:C.textPrimary,marginTop:14,marginBottom:4 }}>Your visit assistant</div>
                  <div style={{ background:`${C.teal}22`,borderRadius:99,padding:"4px 12px",fontSize:12,color:C.teal,fontWeight:700,marginBottom:8 }}>Visit Summary</div>
                  <div style={{ fontSize:13,color:C.textMuted,textAlign:"center" }}>Ask me anything about your visit.</div>
                </div>
              )}
              {/* Suggestion chips */}
              {messages.length===1&&(
                <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                  {suggestions.map(s=>(
                    <div key={s} onClick={()=>{ setMessages(p=>p.filter(m=>!m.intro)); send(s); }} style={{ background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"11px 14px",cursor:"pointer",fontSize:13,color:C.textSecondary }}>
                      {s}
                    </div>
                  ))}
                </div>
              )}
              {messages.filter(m=>!m.intro).map((m,i)=>{
                if(m.role==="ai") return (
                  <div key={i} style={{ display:"flex",gap:8,maxWidth:"88%",animation:"fadeIn 0.3s" }}>
                    <div style={{ width:28,height:28,borderRadius:"50%",background:`linear-gradient(135deg,${C.teal},${C.blue})`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                      <Icon d={I.sparkle} size={14} color="#fff" stroke={2}/>
                    </div>
                    <div>
                      <div style={{ background:C.card,border:`1px solid ${C.border}`,borderRadius:"0 14px 14px 14px",padding:"10px 12px" }}>
                        <div style={{ fontSize:13,color:C.textSecondary,lineHeight:1.65 }}>{m.text}</div>
                        {m.badge&&<div style={{ marginTop:5 }}><Badge color={C.teal}>{m.badge}</Badge></div>}
                      </div>
                    </div>
                  </div>
                );
                return (
                  <div key={i} style={{ display:"flex",justifyContent:"flex-end",animation:"fadeIn 0.3s" }}>
                    <div style={{ background:`linear-gradient(135deg,${C.teal}33,${C.blue}33)`,border:`1px solid ${C.teal}33`,borderRadius:"14px 0 14px 14px",padding:"10px 12px",maxWidth:220 }}>
                      <div style={{ fontSize:13,color:C.textPrimary,lineHeight:1.5 }}>{m.text}</div>
                    </div>
                  </div>
                );
              })}
              {typing&&<div style={{ display:"flex",gap:8 }}><div style={{ width:28,height:28,borderRadius:"50%",background:`linear-gradient(135deg,${C.teal},${C.blue})`,flexShrink:0 }}/><div style={{ background:C.card,border:`1px solid ${C.border}`,borderRadius:"0 14px 14px 14px",padding:"12px 16px",display:"flex",gap:4 }}>{[0,1,2].map(i=><div key={i} style={{ width:6,height:6,borderRadius:"50%",background:C.teal,animation:`pulse 1s ${i*0.3}s infinite` }}/>)}</div></div>}
            </div>
            {/* Input */}
            <div style={{ padding:"8px 12px 12px",borderTop:`1px solid ${C.border}`,background:C.surface }}>
              <div style={{ display:"flex",gap:8,alignItems:"center" }}>
                <div style={{ width:32,height:32,borderRadius:"50%",background:C.card,border:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,cursor:"pointer" }}>
                  <Icon d={I.plus} size={14} color={C.textMuted}/>
                </div>
                <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Ask about your visit..." style={{ flex:1,background:C.card,border:`1px solid ${C.border}`,borderRadius:20,padding:"9px 14px",color:C.textPrimary,fontSize:13,outline:"none",fontFamily:"inherit" }}/>
                <button onClick={()=>send()} style={{ width:38,height:38,borderRadius:"50%",background:`linear-gradient(135deg,${C.teal},${C.blue})`,border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>
                  <Icon d={I.send} size={16} color="#fff" stroke={2}/>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── My Health ─────────────────────────────────────────────────────────────────
const PatientHealth = () => {
  const [tab, setTab] = useState("profile");

  const labData = [
    { name:"HDL Cholesterol", date:"Dec 16, 2025", value:37, unit:"mg/dL", status:"LOW", statusColor:C.amber, ref:"Desirable: >40 mg/dL (men)", refLow:40, refHigh:60, trend:[{v:35},{v:35.5},{v:36},{v:37}] },
    { name:"Hemoglobin", date:"Dec 16, 2025", value:13.2, unit:"g/dL", status:"LOW", statusColor:C.amber, ref:"13.5–17.5 g/dL (men)", refLow:13.5, refHigh:17.5, trend:[{v:14.8},{v:14.2},{v:13.6},{v:13.2}] },
    { name:"LDL Cholesterol", date:"Dec 16, 2025", value:152, unit:"mg/dL", status:"HIGH", statusColor:C.red, ref:"Optimal: <100 mg/dL", refLow:40, refHigh:130, trend:[{v:162},{v:158},{v:155},{v:152}] },
    { name:"HbA1c", date:"Dec 16, 2025", value:7.2, unit:"%", status:"ELEVATED", statusColor:C.amber, ref:"Normal: <5.7%, Diabetic: ≥6.5%", refLow:0, refHigh:6.5, trend:[{v:7.8},{v:7.5},{v:7.3},{v:7.2}] },
  ];

  const wearables = [
    { name:"Apple Health", desc:"Sync heart rate, activity, sleep, and ECG data", tags:["Heart Rate","Steps","ECG","Sleep"], connected:true, color:"#FF3B30", logo:"🍎" },
    { name:"Google Fit", desc:"Activity tracking and health metrics", tags:["Steps","Heart Rate","Weight"], connected:false, color:"#4285F4", logo:"G" },
    { name:"Fitbit", desc:"Comprehensive health and wellness tracking", tags:["Heart Rate","Sleep","SpO2","Steps"], connected:false, color:"#00B0B9", logo:"⏱" },
    { name:"Samsung Health", desc:"Galaxy Watch and phone sensor data", tags:["Heart Rate","BP","Body Comp"], connected:false, color:"#1428A0", logo:"S" },
    { name:"Garmin Connect", desc:"GPS, heart rate, and performance data", tags:["Heart Rate","VO2 Max","Steps"], connected:false, color:"#00A3E0", logo:"◉" },
    { name:"Withings", desc:"Smart scales, BP monitors, sleep trackers", tags:["Weight","BP","Sleep","ECG"], connected:false, color:"#1C2B3A", logo:"W" },
  ];

  const healthTabs = [{k:"profile",l:"Health Profile"},{k:"vitals",l:"Vitals"},{k:"labs",l:"Lab Results"},{k:"services",l:"Connected"},{k:"docs",l:"Documents"}];

  return (
    <div style={{ paddingBottom:20 }}>
      <div style={{ padding:"14px 16px 10px",background:C.surface,borderBottom:`1px solid ${C.border}` }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
          <div style={{ fontSize:20,fontWeight:900,color:C.textPrimary }}>My Health</div>
          <span style={{ fontSize:12,color:C.teal,fontWeight:600 }}>← Back to Profile</span>
        </div>
        <div style={{ display:"flex",gap:6,overflowX:"auto",paddingBottom:2 }}>
          {healthTabs.map(t=>(
            <button key={t.k} onClick={()=>setTab(t.k)} style={{ whiteSpace:"nowrap",padding:"6px 13px",borderRadius:20,border:`1px solid ${tab===t.k?C.teal:C.border}`,background:tab===t.k?C.teal:"transparent",color:tab===t.k?"#000":C.textSecondary,fontSize:11,fontWeight:700,cursor:"pointer" }}>{t.l}</button>
          ))}
        </div>
      </div>

      <div style={{ padding:"14px 14px 0" }}>
        {tab==="profile"&&(
          <div>
            <div style={{ display:"flex",justifyContent:"flex-end",marginBottom:10 }}>
              <span style={{ fontSize:12,color:C.teal,fontWeight:600,cursor:"pointer" }}>Edit Profile</span>
            </div>
            <Card style={{ marginBottom:10 }}>
              <div style={{ fontSize:13,fontWeight:700,color:C.textPrimary,marginBottom:10 }}>Personal Information</div>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
                {[["Full Name","Tendai Moyo"],["Date of Birth","March 3, 1958"],["Gender","Male"],["Phone","+263 77 123 4567"],["Email","tendai@demo.mc"],["MRN","MRN-001"]].map(([l,v])=>(
                  <div key={l}><div style={{ fontSize:10,color:C.textMuted,marginBottom:2 }}>{l}</div><div style={{ fontSize:13,fontWeight:600,color:C.textPrimary }}>{v}</div></div>
                ))}
              </div>
            </Card>
            <Card style={{ marginBottom:10 }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
                <span style={{ fontSize:13,fontWeight:700,color:C.textPrimary }}>Biometrics</span>
                <div style={{ display:"flex",gap:5,alignItems:"center",background:`${C.teal}18`,borderRadius:99,padding:"3px 9px",cursor:"pointer" }}><Icon d={I.check} size={11} color={C.teal} stroke={2.5}/><span style={{ fontSize:10,color:C.teal,fontWeight:700 }}>Ask</span></div>
              </div>
              <div style={{ display:"flex",gap:10 }}>
                {[["170.0","Height (cm)","normal"],["70.0","Weight (kg)","normal"],["24.2","BMI",C.green]].map(([v,l,c])=>(
                  <div key={l} style={{ flex:1,textAlign:"center" }}>
                    <div style={{ fontSize:26,fontWeight:900,color:c===C.green?C.green:C.textPrimary,fontFamily:"'JetBrains Mono',monospace" }}>{v}</div>
                    <div style={{ fontSize:10,color:C.textMuted }}>{l}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop:8,fontSize:12,color:C.textSecondary }}>Blood Type: <strong style={{ color:C.textPrimary }}>B−</strong></div>
            </Card>
            <Card>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
                <span style={{ fontSize:13,fontWeight:700,color:C.textPrimary }}>Diagnoses</span>
                <div style={{ display:"flex",gap:5,alignItems:"center",background:`${C.teal}18`,borderRadius:99,padding:"3px 9px",cursor:"pointer" }}><Icon d={I.check} size={11} color={C.teal} stroke={2.5}/><span style={{ fontSize:10,color:C.teal,fontWeight:700 }}>Ask</span></div>
              </div>
              {[{dx:"NSTEMI",since:"Mar 7, 2026",severity:"critical",active:true},{dx:"Hypertension",since:"Jan 2024",severity:"moderate",active:true},{dx:"Dyslipidaemia",since:"Jun 2023",severity:"mild",active:true}].map(d=>(
                <div key={d.dx} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${C.border}` }}>
                  <div><div style={{ fontSize:13,fontWeight:700,color:C.textPrimary }}>{d.dx}</div><div style={{ fontSize:11,color:C.textMuted }}>Since {d.since}</div></div>
                  <div style={{ display:"flex",gap:6 }}>
                    <Badge color={d.severity==="critical"?C.red:d.severity==="moderate"?C.amber:C.blue}>{d.severity}</Badge>
                    {d.active&&<Badge color={C.green}>active</Badge>}
                  </div>
                </div>
              ))}
            </Card>
          </div>
        )}

        {tab==="labs"&&(
          <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
            {labData.map(lab=>(
              <Card key={lab.name}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8 }}>
                  <div><div style={{ fontSize:14,fontWeight:800,color:C.textPrimary }}>{lab.name}</div><div style={{ fontSize:11,color:C.textMuted }}>{lab.date}</div></div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:22,fontWeight:900,color:lab.statusColor,fontFamily:"'JetBrains Mono',monospace" }}>{lab.value} <span style={{ fontSize:12,fontWeight:600 }}>{lab.unit}</span></div>
                    <Badge color={lab.statusColor}>{lab.status}</Badge>
                  </div>
                </div>
                <div style={{ fontSize:10,color:C.textMuted,marginBottom:10 }}>{lab.ref}</div>
                {/* Ask button */}
                <div style={{ display:"flex",justifyContent:"flex-end",marginBottom:10 }}>
                  <div style={{ display:"flex",gap:5,alignItems:"center",background:`${C.teal}18`,borderRadius:99,padding:"4px 10px",cursor:"pointer" }}><Icon d={I.check} size={12} color={C.teal} stroke={2.5}/><span style={{ fontSize:11,color:C.teal,fontWeight:700 }}>Ask AI about this</span></div>
                </div>
                {/* Trend chart */}
                <div style={{ overflowX:"auto" }}>
                  <Sparkline data={lab.trend} color={lab.statusColor} width={280} height={60} refLow={lab.refLow} refHigh={lab.refHigh}/>
                </div>
                {/* X axis labels */}
                <div style={{ display:"flex",justifyContent:"space-between",marginTop:4 }}>
                  {["Jun 16","Aug 16","Oct 16","Dec 16"].map(d=><span key={d} style={{ fontSize:9,color:C.textMuted }}>{d}</span>)}
                </div>
              </Card>
            ))}
          </div>
        )}

        {tab==="services"&&(
          <div>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
              <div style={{ fontSize:13,color:C.textSecondary }}>1 of 6 wearables connected</div>
              <div style={{ display:"flex",gap:5,alignItems:"center" }}>
                <Icon d={I.shield} size={13} color={C.green}/><span style={{ fontSize:11,color:C.green }}>HIPAA compliant</span>
              </div>
            </div>
            <div style={{ fontSize:10,color:C.textMuted,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:10 }}>WEARABLES 1/6</div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
              {wearables.map(w=>(
                <div key={w.name} style={{ background:C.card,border:`1px solid ${w.connected?C.teal+"44":C.border}`,borderRadius:14,padding:12 }}>
                  <div style={{ display:"flex",gap:8,alignItems:"center",marginBottom:6 }}>
                    <div style={{ width:32,height:32,borderRadius:8,background:`${w.color}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14 }}>{w.logo}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12,fontWeight:800,color:C.textPrimary }}>{w.name}</div>
                      {w.connected&&<div style={{ display:"flex",gap:4,alignItems:"center" }}><Dot color={C.teal}/><span style={{ fontSize:9,color:C.teal }}>Connected</span></div>}
                    </div>
                  </div>
                  <div style={{ fontSize:10,color:C.textMuted,marginBottom:7,lineHeight:1.4 }}>{w.desc}</div>
                  <div style={{ display:"flex",flexWrap:"wrap",gap:4,marginBottom:8 }}>
                    {w.tags.map(t=><span key={t} style={{ background:C.surface,borderRadius:6,padding:"2px 6px",fontSize:9,color:C.textSecondary }}>{t}</span>)}
                  </div>
                  {w.connected
                    ? <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}><span style={{ fontSize:10,color:C.textMuted }}>Synced 2h ago</span><span style={{ fontSize:10,color:C.red,cursor:"pointer" }}>Disconnect</span></div>
                    : <button style={{ width:"100%",padding:"6px",borderRadius:8,border:"none",background:C.blue,color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer" }}>Connect</button>
                  }
                </div>
              ))}
            </div>
          </div>
        )}

        {(tab==="vitals"||tab==="docs")&&(
          <div style={{ textAlign:"center",padding:"40px 20px",color:C.textMuted }}>
            <div style={{ fontSize:30,marginBottom:10 }}>{tab==="vitals"?"💓":"📄"}</div>
            <div style={{ fontSize:14,fontWeight:700,color:C.textPrimary,marginBottom:6 }}>{tab==="vitals"?"Vitals History":"My Documents"}</div>
            <div style={{ fontSize:12 }}>Connected wearable data and submitted vitals will appear here.</div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Reference Library (postvisit.ai-faithful) ─────────────────────────────────
const PatientReference = () => {
  const [tab, setTab] = useState("relevant");
  const [searchQ, setSearchQ] = useState("");
  const [searchCat, setSearchCat] = useState("Conditions");
  const [libUrl, setLibUrl] = useState("");

  const clinicalRefs = [
    { title:"2023 Focused Update of the 2021 ESC Guidelines for the diagnosis and treatment of acute and chronic heart failure", authors:"McDonagh TA, Metra M, Adamo M, et al.", journal:"European Heart Journal", year:2023, tags:["PubMed Verified","guideline"], body:"Comprehensive ESC guidelines for HF diagnosis and management including pharmacotherapy, devices, and comorbidities." },
    { title:"2023 ESC Guidelines for the management of cardiovascular disease in patients with diabetes", authors:"Marx N, Federici M, et al.", journal:"European Heart Journal", year:2023, tags:["PubMed Verified","guideline"] },
    { title:"Aspirin and antiplatelet therapy in ACS: DAPT duration evidence", authors:"Capodanno D, Angiolillo DJ", journal:"JACC", year:2022, tags:["PubMed Verified","review"] },
  ];

  const libraryItems = [
    { title:"My Cardiac Discharge Instructions", type:"document", status:"Completed" },
    { title:"ESC NSTEMI Pocket Guide 2023 (PDF)", type:"pdf", status:"Completed" },
  ];

  return (
    <div style={{ paddingBottom:20 }}>
      <div style={{ padding:"14px 16px 10px",background:C.surface,borderBottom:`1px solid ${C.border}` }}>
        <div style={{ fontSize:20,fontWeight:900,color:C.textPrimary,marginBottom:2 }}>Reference</div>
        <div style={{ fontSize:12,color:C.textSecondary,marginBottom:10 }}>Evidence-based references and medical databases relevant to your care.</div>
        <div style={{ display:"flex",background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:3,gap:2 }}>
          {[["relevant","Relevant for You"],["search","Search Databases"],["library","My Library"]].map(([k,l])=>(
            <button key={k} onClick={()=>setTab(k)} style={{ flex:1,padding:"7px 4px",borderRadius:9,border:"none",cursor:"pointer",background:tab===k?"#fff":C.card,color:tab===k?"#000":C.textSecondary,fontSize:10,fontWeight:700 }}>{l}</button>
          ))}
        </div>
      </div>

      <div style={{ padding:"12px 14px 0" }}>
        {tab==="relevant"&&(
          <div>
            {/* Your Conditions */}
            <Card style={{ marginBottom:12 }}>
              <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:10 }}>
                <span style={{ fontSize:16 }}>🔴</span>
                <span style={{ fontSize:14,fontWeight:800,color:C.textPrimary }}>Your Conditions</span>
                <div style={{ width:18,height:18,borderRadius:"50%",background:C.amber,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:"#000" }}>3</div>
              </div>
              {["NSTEMI (Acute cardiac event)","Hypertension","Dyslipidaemia"].map(c=>(
                <div key={c} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${C.border}` }}>
                  <span style={{ fontSize:13,color:C.textSecondary }}>{c}</span>
                  <div style={{ display:"flex",gap:5,alignItems:"center",background:`${C.teal}18`,borderRadius:99,padding:"3px 9px",cursor:"pointer" }}><Icon d={I.check} size={11} color={C.teal} stroke={2.5}/><span style={{ fontSize:10,color:C.teal,fontWeight:700 }}>Ask</span></div>
                </div>
              ))}
            </Card>
            {/* Medications */}
            <Card style={{ marginBottom:12 }}>
              <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:10 }}>
                <span style={{ fontSize:16 }}>🧪</span>
                <span style={{ fontSize:14,fontWeight:800,color:C.textPrimary }}>Your Medications</span>
                <div style={{ width:18,height:18,borderRadius:"50%",background:C.blue,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:"#fff" }}>3</div>
              </div>
              {[{n:"Aspirin 75mg tablet",dose:"Once daily with food",note:"Take with food. Do not stop abruptly."},{n:"Clopidogrel 75mg tablet",dose:"Once daily",note:"Avoid NSAIDs. Report unusual bleeding."},{n:"Atorvastatin 40mg",dose:"At night",note:"Avoid grapefruit juice."}].map(m=>(
                <div key={m.n} style={{ padding:"8px 0",borderBottom:`1px solid ${C.border}` }}>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13,fontWeight:700,color:C.textPrimary }}>{m.n}</div>
                      <div style={{ fontSize:11,color:C.textMuted }}>{m.dose}</div>
                      <div style={{ fontSize:11,color:C.textMuted,fontStyle:"italic",marginTop:1 }}>{m.note}</div>
                    </div>
                    <div style={{ display:"flex",gap:5,alignItems:"center",background:`${C.teal}18`,borderRadius:99,padding:"3px 9px",cursor:"pointer",flexShrink:0 }}><Icon d={I.check} size={11} color={C.teal} stroke={2.5}/><span style={{ fontSize:10,color:C.teal,fontWeight:700 }}>Ask</span></div>
                  </div>
                </div>
              ))}
            </Card>
            {/* Clinical References */}
            <Card>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
                <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                  <span style={{ fontSize:16 }}>📖</span>
                  <span style={{ fontSize:14,fontWeight:800,color:C.textPrimary }}>Clinical References</span>
                  <div style={{ width:18,height:18,borderRadius:"50%",background:C.purple,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:"#fff" }}>{clinicalRefs.length}</div>
                </div>
                <span style={{ fontSize:11,color:C.teal,fontWeight:600,cursor:"pointer" }}>+ Add Reference</span>
              </div>
              {clinicalRefs.map((r,i)=>(
                <div key={i} style={{ padding:"10px 0",borderBottom:`1px solid ${C.border}` }}>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4 }}>
                    <div style={{ fontSize:13,fontWeight:700,color:C.textPrimary,flex:1,paddingRight:8,lineHeight:1.5 }}>{r.title}</div>
                    <span style={{ fontSize:11,color:C.blue,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap" }}>View source</span>
                  </div>
                  <div style={{ fontSize:11,color:C.textMuted,marginBottom:5 }}>{r.authors}</div>
                  <div style={{ display:"flex",gap:5,flexWrap:"wrap",marginBottom:5 }}>
                    <span style={{ fontSize:10,color:C.textMuted,fontStyle:"italic" }}>{r.journal} ({r.year})</span>
                    {r.tags.map(t=>(
                      <span key={t} style={{ background:t==="PubMed Verified"?`${C.green}18`:`${C.blue}18`,color:t==="PubMed Verified"?C.green:C.blue,borderRadius:6,padding:"1px 7px",fontSize:9,fontWeight:700,display:"flex",gap:3,alignItems:"center" }}>
                        {t==="PubMed Verified"&&"✓ "}{t}
                      </span>
                    ))}
                  </div>
                  {r.body&&<div style={{ fontSize:11,color:C.textSecondary,lineHeight:1.5 }}>{r.body}</div>}
                </div>
              ))}
            </Card>
          </div>
        )}

        {tab==="search"&&(
          <div>
            {/* OpenEvidence integration */}
            <div style={{ background:`${C.purple}12`,border:`1px solid ${C.purple}33`,borderRadius:14,padding:14,marginBottom:14 }}>
              <div style={{ display:"flex",gap:10,alignItems:"flex-start" }}>
                <div style={{ width:36,height:36,borderRadius:10,background:`${C.purple}22`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                  <Icon d={I.sparkle} size={18} color={C.purple}/>
                </div>
                <div>
                  <div style={{ display:"flex",gap:7,alignItems:"center",marginBottom:4 }}>
                    <span style={{ fontSize:13,fontWeight:800,color:C.textPrimary }}>OpenEvidence Integration</span>
                    <span style={{ background:`${C.amber}22`,color:C.amber,borderRadius:99,fontSize:9,fontWeight:800,padding:"2px 7px" }}>COMING SOON</span>
                  </div>
                  <div style={{ fontSize:12,color:C.purple,lineHeight:1.55 }}>AI-powered evidence-based answers cross-referenced with your visit context. Ask clinical questions and get responses grounded in peer-reviewed research.</div>
                </div>
              </div>
            </div>
            {/* Search bar */}
            <div style={{ background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:14,marginBottom:10 }}>
              <div style={{ display:"flex",gap:8 }}>
                <input placeholder="Search conditions, drugs, procedures..." value={searchQ} onChange={e=>setSearchQ(e.target.value)} style={{ flex:1,background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"9px 12px",color:C.textPrimary,fontSize:12,outline:"none",fontFamily:"inherit" }}/>
                <select value={searchCat} onChange={e=>setSearchCat(e.target.value)} style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"9px 10px",color:C.textSecondary,fontSize:12,outline:"none" }}>
                  {["Conditions","Drugs","Procedures"].map(o=><option key={o}>{o}</option>)}
                </select>
                <button style={{ padding:"9px 14px",borderRadius:10,border:"none",background:C.teal,color:"#000",fontSize:12,fontWeight:700,cursor:"pointer" }}>Search</button>
              </div>
            </div>
            <div style={{ fontSize:11,color:C.textMuted,textAlign:"center",lineHeight:1.6 }}>
              Powered by NIH Clinical Tables, NLM RxTerms, DailyMed, and PubMed<br/>
              <span style={{ fontStyle:"italic" }}>Medical references are for informational purposes only. Always consult your healthcare provider.</span>
            </div>
          </div>
        )}

        {tab==="library"&&(
          <div>
            <Card style={{ marginBottom:12 }}>
              <div style={{ display:"flex",gap:8,alignItems:"center",marginBottom:12 }}>
                <Icon d={I.upload} size={18} color={C.purple}/>
                <span style={{ fontSize:14,fontWeight:800,color:C.textPrimary }}>Add to Your Library</span>
              </div>
              {/* Drop zone */}
              <div style={{ border:`2px dashed ${C.border}`,borderRadius:12,padding:"20px 16px",textAlign:"center",marginBottom:10,cursor:"pointer" }}>
                <Icon d={I.upload} size={24} color={C.textMuted}/>
                <div style={{ fontSize:12,color:C.blue,fontWeight:600,marginTop:6 }}>Click to upload <span style={{ color:C.textMuted,fontWeight:400 }}>or drag and drop</span></div>
                <div style={{ fontSize:11,color:C.textMuted,marginTop:2 }}>PDF files only</div>
              </div>
              {/* URL paste */}
              <div style={{ display:"flex",gap:8 }}>
                <input value={libUrl} onChange={e=>setLibUrl(e.target.value)} placeholder="Paste a URL to a medical article..." style={{ flex:1,background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"9px 12px",color:C.textPrimary,fontSize:12,outline:"none",fontFamily:"inherit" }}/>
                <button style={{ padding:"9px 14px",borderRadius:10,border:"none",background:C.purple,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer" }}>Add</button>
              </div>
            </Card>
            {libraryItems.map(item=>(
              <div key={item.title} style={{ background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"12px 14px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                <div style={{ display:"flex",gap:10,alignItems:"center" }}>
                  <span style={{ fontSize:20,color:C.red }}>📄</span>
                  <span style={{ fontSize:12,color:C.textSecondary,fontWeight:600 }}>{item.title}</span>
                </div>
                <Badge color={C.green}>{item.status}</Badge>
              </div>
            ))}
            {/* Disclaimer */}
            <div style={{ background:`${C.amber}10`,border:`1px solid ${C.amber}33`,borderRadius:12,padding:12,marginTop:10 }}>
              <div style={{ fontSize:11,fontWeight:700,color:C.amber,marginBottom:4 }}>Important disclaimer</div>
              <div style={{ fontSize:11,color:C.textMuted,lineHeight:1.55 }}>Content found on the internet may not be accurate. AI analysis can contain errors. Always consult your doctor before making medical decisions.</div>
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

const DOCTOR_TABS = [{k:"ward",icon:I.bed,l:"Rounds"},{k:"postvisit",icon:I.sparkle,l:"PostVisit"},{k:"cdss",icon:I.brain,l:"AI Assist"},{k:"dictate",icon:I.mic,l:"Dictate"}];
const NURSE_TABS  = [{k:"dashboard",icon:I.home,l:"Shift"},{k:"vitals",icon:I.pulse,l:"Vitals"},{k:"triage",icon:I.alert,l:"Triage"}];
const PATIENT_TABS= [{k:"home",icon:I.home,l:"Home"},{k:"visit",icon:I.sparkle,l:"PostVisit"},{k:"health",icon:I.heart,l:"My Health"},{k:"reference",icon:I.book,l:"Reference"}];

export default function App() {
  const [role, setRole] = useState("doctor");
  const [dt, setDt] = useState("ward");
  const [nt, setNt] = useState("dashboard");
  const [pt, setPt] = useState("home");

  const setTabs = {doctor:setDt,nurse:setNt,patient:setPt};
  const activeTabs = {doctor:dt,nurse:nt,patient:pt};
  const tabsDef = {doctor:DOCTOR_TABS,nurse:NURSE_TABS,patient:PATIENT_TABS};
  const accent = {doctor:C.teal,nurse:C.purple,patient:C.teal};

  const renderContent = () => {
    if(role==="doctor") {
      if(dt==="ward") return <DoctorWardRounds onNav={setDt}/>;
      if(dt==="postvisit") return <PostVisitSignoff/>;
      if(dt==="cdss") return <DoctorCDSS/>;
      if(dt==="dictate") return <DoctorDictate/>;
    }
    if(role==="nurse") {
      if(nt==="dashboard"||nt==="triage") return <NurseDashboard/>;
      if(nt==="vitals") return <NurseVitals/>;
    }
    if(role==="patient") {
      if(pt==="home") return <PatientHome onNav={setPt}/>;
      if(pt==="visit") return <PatientVisit onNav={setPt}/>;
      if(pt==="health") return <PatientHealth/>;
      if(pt==="reference") return <PatientReference/>;
    }
  };

  const tabs = tabsDef[role];
  const active = activeTabs[role];
  const ac = accent[role];

  return (
    <>
      <style>{css}</style>
      <div style={{ minHeight:"100vh", background:"#030710", display:"flex", justifyContent:"center", alignItems:"flex-start", padding:"24px 16px 40px", fontFamily:"'Sora',sans-serif" }}>
        <div style={{ display:"flex", gap:32, flexWrap:"wrap", justifyContent:"center", alignItems:"flex-start", maxWidth:900 }}>

          {/* PHONE */}
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:0 }}>
            {/* Role switcher */}
            <div style={{ display:"flex", gap:4, marginBottom:14, background:"#0A1422", borderRadius:14, padding:4, border:`1px solid ${C.border}` }}>
              {[["doctor","👨‍⚕️","Doctor"],[" nurse","👩‍⚕️","Nurse"],["patient","🧑","Patient"]].map(([r,em,l])=>(
                <button key={r.trim()} onClick={()=>setRole(r.trim())} style={{ padding:"7px 13px",borderRadius:10,border:"none",cursor:"pointer",background:role===r.trim()?accent[r.trim()]||C.teal:"transparent",color:role===r.trim()?"#000":C.textMuted,fontSize:11,fontWeight:700,transition:"all 0.2s",whiteSpace:"nowrap" }}>{em} {l}</button>
              ))}
            </div>

            {/* Phone frame */}
            <div style={{ width:375,background:C.bg,borderRadius:48,overflow:"hidden",border:`2px solid ${C.border}`,boxShadow:`0 40px 90px rgba(0,0,0,0.85),0 0 0 1px #08101E,inset 0 1px 0 ${C.borderLight}`,position:"relative" }}>
              {/* Status bar */}
              <div style={{ height:40,background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",borderBottom:`1px solid ${C.border}` }}>
                <div style={{ width:90,height:24,background:"#060C18",borderRadius:20,display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
                  <div style={{ width:9,height:9,borderRadius:"50%",background:"#1a2535" }}/>
                  <div style={{ width:36,height:5,background:"#1a2535",borderRadius:3 }}/>
                </div>
                <div style={{ position:"absolute",right:18,fontSize:10,color:C.textMuted,fontFamily:"'JetBrains Mono',monospace",display:"flex",gap:7 }}>
                  <span>9:41</span><span style={{ opacity:0.5 }}>●●●</span>
                </div>
              </div>

              {/* Screen */}
              <div style={{ height:680,overflowY:"auto",background:C.bg }}>
                {renderContent()}
              </div>

              {/* Bottom nav */}
              <div style={{ height:68,background:C.surface,borderTop:`1px solid ${C.border}`,display:"flex",alignItems:"center",padding:"0 4px 6px" }}>
                {tabs.map(t=>{
                  const isActive = active===t.k;
                  return (
                    <button key={t.k} onClick={()=>setTabs[role](t.k)} style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"6px 4px",background:"transparent",border:"none",cursor:"pointer" }}>
                      <div style={{ width:38,height:32,borderRadius:11,background:isActive?`${ac}22`:"transparent",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.2s" }}>
                        <Icon d={t.icon} size={20} color={isActive?ac:C.textMuted} stroke={isActive?2:1.5}/>
                      </div>
                      <span style={{ fontSize:9,fontWeight:isActive?800:500,color:isActive?ac:C.textMuted,letterSpacing:"0.03em" }}>{t.l}</span>
                    </button>
                  );
                })}
              </div>
              <div style={{ height:8,background:C.surface,display:"flex",alignItems:"center",justifyContent:"center" }}>
                <div style={{ width:80,height:3,background:C.border,borderRadius:99 }}/>
              </div>
            </div>
          </div>

          {/* FEATURE PANEL */}
          <div style={{ width:320,paddingTop:66 }}>
            <div style={{ marginBottom:28 }}>
              <div style={{ fontSize:11,fontWeight:800,color:C.teal,letterSpacing:"0.15em",marginBottom:6 }}>MEDICORE</div>
              <div style={{ fontSize:28,fontWeight:900,color:C.textPrimary,lineHeight:1.2,marginBottom:8 }}>Companion<br/>Mobile App</div>
              <div style={{ fontSize:13,color:C.textSecondary,lineHeight:1.7 }}>Mobile-first clinical companion powered by <strong style={{ color:C.textPrimary }}>PostVisit AI</strong>, CDSS, and MediCore's clinical engine.</div>
            </div>

            {[
              { role:"doctor", color:C.teal, em:"👨‍⚕️", title:"Doctor Mode", features:["Ward rounds list with real-time critical alerts","PostVisit AI signoff — review AI draft, sign & FHIR publish","Voice dictation → AI-structured SOAP notes","CDSS: drug interactions, dosing, WHO guidelines, risk scores"] },
              { role:"nurse", color:C.purple, em:"👩‍⚕️", title:"Nurse Copilot", features:["Shift worklist with BCMA medication tasks","ESI AI triage scoring with assessment launch","Vitals recording with AI interpretation","AI-generated end-of-shift handoff summary"] },
              { role:"patient", color:C.blue, em:"🧑", title:"Patient Panel", features:["Visit Summary: expandable SOAP sections, each Ask-able via AI","AI Chat — visit assistant with suggested questions","My Health: biometrics, lab trends with reference charts","Connected Services: Apple Health, Fitbit, Garmin…","Reference Library: Relevant for You, Search Databases, My Library"] },
            ].map(r=>(
              <div key={r.role} onClick={()=>setRole(r.role)} style={{ background:C.card,border:`1px solid ${role===r.role?r.color+"55":C.border}`,borderLeft:`3px solid ${r.color}`,borderRadius:16,padding:14,marginBottom:10,cursor:"pointer",transition:"all 0.2s" }}>
                <div style={{ display:"flex",gap:8,alignItems:"center",marginBottom:8 }}>
                  <span style={{ fontSize:18 }}>{r.em}</span>
                  <span style={{ fontSize:14,fontWeight:800,color:C.textPrimary }}>{r.title}</span>
                  {role===r.role&&<Badge color={r.color}>ACTIVE</Badge>}
                </div>
                {r.features.map(f=>(
                  <div key={f} style={{ display:"flex",gap:7,alignItems:"flex-start",marginBottom:4 }}>
                    <div style={{ width:5,height:5,borderRadius:"50%",background:r.color,marginTop:6,flexShrink:0 }}/>
                    <span style={{ fontSize:11,color:C.textSecondary,lineHeight:1.5 }}>{f}</span>
                  </div>
                ))}
              </div>
            ))}

            {/* PostVisit.ai faithful badge */}
            <div style={{ background:`${C.teal}08`,border:`1px solid ${C.teal}33`,borderRadius:14,padding:14,marginTop:4 }}>
              <div style={{ display:"flex",gap:7,alignItems:"center",marginBottom:6 }}>
                <AiBadge text="POSTVISIT.AI"/><span style={{ fontSize:12,fontWeight:700,color:C.textPrimary }}>Feature Parity</span>
              </div>
              <div style={{ display:"flex",flexDirection:"column",gap:4 }}>
                {["Visit Summary: expandable SOAP (CC, HPI, Sx, PE, A, P)","Per-section Ask AI button","Suggested questions in AI Chat","Lab results with trend sparkline charts","Connected wearables (Apple Health, Google Fit, Fitbit…)","Reference Library: Relevant for You / Search Databases / My Library","OpenEvidence integration (coming soon)","HIPAA-compliant wearable sync badge"].map(f=>(
                  <div key={f} style={{ display:"flex",gap:6,alignItems:"flex-start" }}>
                    <Icon d={I.check} size={11} color={C.teal} stroke={2.5}/>
                    <span style={{ fontSize:11,color:C.textSecondary,lineHeight:1.45 }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
