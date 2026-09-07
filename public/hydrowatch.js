// ── State ──────────────────────────────────────────────────────────────────
const FIREBASE_SENSOR_URL = 'https://hidroponik-iot-69bf7-default-rtdb.asia-southeast1.firebasedatabase.app/SensorReading.json';
const sensor = { ph: null, nutrisi: null, kekeruhan: null, suhu: null, volume: null };

const history = {
   ph: [],
   nutrisi: [],
   suhu: [],
};

let logEntries = [];
let logId = 0;
let isDark = true;

// ── Sensor backend stream ──────────────────────────────────────────────────
async function loadSensorData() {
  try {
    const response = await fetch(`${FIREBASE_SENSOR_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = normalizeSensorData(await response.json());
    if (!data) throw new Error('Data SensorReading Firebase masih kosong atau formatnya tidak sesuai');

    const nextValue = (value) => {
      const number = Number(value);
      return Number.isFinite(number) ? number : null;
    };

    sensor.ph        = nextValue(data.phLevel);
    sensor.nutrisi   = nextValue(data.nutrientLevel);
    sensor.kekeruhan = nextValue(data.turbidity);
    sensor.suhu      = nextValue(data.temperature);
    sensor.volume    = nextValue(data.waterVolume);

    if (sensor.ph !== null) { history.ph.push(sensor.ph); if (history.ph.length > 12) history.ph.shift(); }
    if (sensor.nutrisi !== null) { history.nutrisi.push(sensor.nutrisi); if (history.nutrisi.length > 12) history.nutrisi.shift(); }
    if (sensor.suhu !== null) { history.suhu.push(sensor.suhu); if (history.suhu.length > 12) history.suhu.shift(); }

    updateDOM();
  } catch (error) {
    console.error('Gagal mengambil data sensor:', error);
  }
}

function normalizeSensorData(payload) {
  if (!payload || typeof payload !== 'object') return null;

  const sensorKeys = ['phLevel', 'ph', 'pH', 'nutrientLevel', 'nutrisi', 'ec', 'turbidity', 'kekeruhan', 'temperature', 'suhu', 'waterVolume', 'volume'];
  const hasSensorFields = sensorKeys.some((key) => key in payload);
  const entries = Array.isArray(payload)
    ? payload.filter(Boolean)
    : Object.values(payload).filter((value) => value && typeof value === 'object');
  const data = hasSensorFields ? payload : entries[entries.length - 1];
  if (!data) return null;

  return {
    phLevel: data.phLevel ?? data.ph ?? data.pH,
    nutrientLevel: data.nutrientLevel ?? data.nutrisi ?? data.ec,
    turbidity: data.turbidity ?? data.kekeruhan,
    temperature: data.temperature ?? data.suhu,
    waterVolume: data.waterVolume ?? data.volume,
  };
}

function hasSensorData() {
  return Object.values(sensor).some((value) => value !== null);
}

// ── Status helpers ─────────────────────────────────────────────────────────
function phStatus(v)      { return v<5.5||v>7.5 ? {l:"KRITIS",c:"danger"} : v<6.0||v>7.0 ? {l:"PERINGATAN",c:"warn"} : {l:"NORMAL",c:"ok"}; }
function nutrisiStatus(v) { return v<800||v>1800 ? {l:"KRITIS",c:"danger"} : v<1000||v>1600 ? {l:"PERINGATAN",c:"warn"} : {l:"OPTIMAL",c:"ok"}; }
function keruhStatus(v)   { return v>40 ? {l:"KERUH",c:"danger"} : v>25 ? {l:"SEDANG",c:"warn"} : {l:"JERNIH",c:"ok"}; }
function suhuStatus(v)    { return v<18||v>30 ? {l:"KRITIS",c:"danger"} : v<20||v>28 ? {l:"PERINGATAN",c:"warn"} : {l:"IDEAL",c:"ok"}; }

const COLOR = { ok:"#22c55e", warn:"#f59e0b", danger:"#ef4444" };
function clr(c) { return COLOR[c]; }

// ── Format time ────────────────────────────────────────────────────────────
function fmt(d) {
  return d.toLocaleTimeString("id-ID", { hour:"2-digit", minute:"2-digit", second:"2-digit" });
}

// ── Gauge SVG ──────────────────────────────────────────────────────────────
function drawGauge(svgId, value, min, max, unit, statusClass) {
  const svg = document.getElementById(svgId);
  if (!svg) return;
  const pct  = Math.min(1, Math.max(0, (value - min) / (max - min)));
  const x=15, y=52, width=250, height=18;
  const color = clr(statusClass);

  const trackColor = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)";
  const textColor  = isDark ? "rgba(255,255,255,0.72)" : "rgba(10,30,18,0.72)";

  const displayVal = unit==="ppm"||unit==="L"
    ? Math.round(value)
    : value.toFixed(1);

  svg.innerHTML = `
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${height / 2}" fill="${trackColor}"/>
    <rect x="${x}" y="${y}" width="${width * pct}" height="${height}" rx="${height / 2}" fill="${color}"
      style="filter:drop-shadow(0 0 5px ${color}77)"/>
    <circle cx="${x + width * pct}" cy="${y + height / 2}" r="5"
      fill="${color}" style="filter:drop-shadow(0 0 4px ${color})"/>
    <text x="140" y="38" text-anchor="middle" font-family="JetBrains Mono,monospace"
      font-size="24" font-weight="700" fill="${color}">${displayVal}</text>
    <text x="140" y="88" text-anchor="middle" font-family="Outfit,sans-serif"
      font-size="14" font-weight="600" fill="${textColor}">${unit}</text>
    <text x="${x}" y="92" font-family="JetBrains Mono,monospace" font-size="12" font-weight="600" fill="${textColor}">${min}</text>
    <text x="${x + width}" y="92" text-anchor="end" font-family="JetBrains Mono,monospace" font-size="12" font-weight="600" fill="${textColor}">${max}</text>
  `;
}

// ── Sparkline SVG ──────────────────────────────────────────────────────────
function drawSparkline(svgId, data, statusClass) {
  const svg = document.getElementById(svgId);
  if (!svg || data.length < 2) return;
  const color = clr(statusClass);
  const mn=Math.min(...data), mx=Math.max(...data), range=mx-mn||1;
  const w=300, h=40;
  const pts = data.map((v,i)=>`${(i/(data.length-1))*w},${h-((v-mn)/range)*h}`).join(" ");
  const areaPts = `0,${h} ${pts} ${w},${h}`;
  const last = data[data.length-1];
  const lx=(data.length-1)/(data.length-1)*w;
  const ly=h-((last-mn)/range)*h;
  svg.innerHTML = `
    <polygon points="${areaPts}" fill="${color}" opacity="0.1"/>
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.2"
      stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/>
    <circle cx="${lx}" cy="${ly}" r="3.5" fill="${color}" style="filter:drop-shadow(0 0 3px ${color})"/>
  `;
}

// ── Badge ─────────────────────────────────────────────────────────────────
function setBadge(id, status) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = status.l;
  el.className = "badge " + status.c;
}

// ── Update DOM ─────────────────────────────────────────────────────────────
function updateDOM() {
  if (!hasSensorData()) return;

  const ps  = phStatus(sensor.ph);
  const ns  = nutrisiStatus(sensor.nutrisi);
  const ks  = keruhStatus(sensor.kekeruhan);
  const ss  = suhuStatus(sensor.suhu);

  // Badges
  setBadge("badge-ph", ps);
  setBadge("badge-nutrisi", ns);
  setBadge("badge-keruh", ks);
  setBadge("badge-suhu", ss);

  // Gauges
  drawGauge("gauge-ph",      sensor.ph,        4,    9,    "pH",  ps.c);
  drawGauge("gauge-nutrisi", sensor.nutrisi,   0,    2000, "ppm", ns.c);
  drawGauge("gauge-keruh",   sensor.kekeruhan, 0,    100,  "NTU", ks.c);

  // Sparklines
  drawSparkline("spark-ph",      history.ph,      ps.c);
  drawSparkline("spark-nutrisi", history.nutrisi, ns.c);
  drawSparkline("spark-suhu",    history.suhu,    ss.c);

  // pH values
  const phNow = document.getElementById("val-ph-now");
  if (phNow) { phNow.textContent = sensor.ph.toFixed(2); phNow.style.color = clr(ps.c); }

  // Nutrisi values
  const nNow = document.getElementById("val-nutrisi-now");
  if (nNow) { nNow.textContent = sensor.nutrisi; nNow.style.color = clr(ns.c); }

  // Kekeruhan label
  const kntu = document.getElementById("val-keruh-ntu");
  if (kntu) kntu.textContent = sensor.kekeruhan.toFixed(1) + " NTU";

  // Suhu
  const svEl = document.getElementById("val-suhu");
  if (svEl) { svEl.textContent = sensor.suhu.toFixed(1); svEl.style.color = clr(ss.c); }
  const sMin = document.getElementById("val-suhu-min");
  const sMax = document.getElementById("val-suhu-max");
  if (sMin) sMin.textContent = Math.min(...history.suhu).toFixed(1) + "°";
  if (sMax) sMax.textContent = Math.max(...history.suhu).toFixed(1) + "°";

  // Volume
  const vol   = sensor.volume;
  const volEl = document.getElementById("val-volume");
  const volUs = document.getElementById("val-volume-used");
  const tankF = document.getElementById("tank-fill");
  const tankL = document.getElementById("tank-line");
  const barV  = document.getElementById("bar-volume");
  const volAl = document.getElementById("volume-alert");
  if (volEl) volEl.textContent = vol.toFixed(1) + " L";
  if (volUs) volUs.textContent = vol.toFixed(1) + " L";
  if (tankF) tankF.style.height = vol + "%";
  if (tankL) tankL.style.bottom = vol + "%";
  if (barV)  barV.style.width   = vol + "%";
  if (volAl) volAl.style.display = vol < 30 ? "flex" : "none";

  // Control live values
  const cpv = document.getElementById("ctrl-ph-val");
  const cnv = document.getElementById("ctrl-nutrisi-val");
  if (cpv) { cpv.textContent = "pH " + sensor.ph.toFixed(2); cpv.style.color = clr(ps.c); }
  if (cnv) { cnv.textContent = sensor.nutrisi + " ppm"; cnv.style.color = clr(ns.c); }

  // Clock
  const clock = document.getElementById("clock");
  if (clock) clock.textContent = fmt(new Date());
}

// ── Check inputs ───────────────────────────────────────────────────────────
function checkInputs() {
  const phVal  = parseFloat(document.getElementById("input-ph")?.value);
  const nutVal = parseFloat(document.getElementById("input-nutrisi")?.value);

  const btnPh  = document.getElementById("btn-ph");
  const btnNut = document.getElementById("btn-nutrisi");
  const hintPh = document.getElementById("hint-ph");
  const hintNut= document.getElementById("hint-nutrisi");

  const phOk  = !isNaN(phVal)  && phVal  > 0;
  const nutOk = !isNaN(nutVal) && nutVal > 0;

  if (btnPh)  { btnPh.disabled  = !phOk;  btnPh.className  = "ctrl-btn"  + (phOk  ? " active" : ""); }
  if (btnNut) { btnNut.disabled = !nutOk; btnNut.className = "ctrl-btn warn-btn" + (nutOk ? " active" : ""); }
  if (hintPh)  hintPh.style.display  = phOk  ? "none" : "block";
  if (hintNut) hintNut.style.display = nutOk ? "none" : "block";
}

// ── Add actions ────────────────────────────────────────────────────────────
function addPh() {
  const ml = parseFloat(document.getElementById("input-ph")?.value);
  if (!ml || ml <= 0) return;
  pushLog("ph", ml);
  document.getElementById("input-ph").value = "";
  checkInputs();
  updateDOM();
}

function addNutrisi() {
  const ml = parseFloat(document.getElementById("input-nutrisi")?.value);
  if (!ml || ml <= 0) return;
  pushLog("nutrisi", ml);
  document.getElementById("input-nutrisi").value = "";
  checkInputs();
  updateDOM();
}

// ── Log ───────────────────────────────────────────────────────────────────
function pushLog(type, amount) {
  logEntries.unshift({ id: logId++, time: new Date(), type, amount });
  if (logEntries.length > 20) logEntries.pop();
  renderLog();
}

function renderLog() {
  const empty  = document.getElementById("log-empty");
  const list   = document.getElementById("log-list");
  const count  = document.getElementById("log-count");
  if (!list) return;

  if (count) count.textContent = logEntries.length + " entri";

  if (logEntries.length === 0) {
    if (empty) empty.style.display = "block";
    list.innerHTML = "";
    return;
  }
  if (empty) empty.style.display = "none";

  list.innerHTML = logEntries.map(e => {
    const isPh = e.type === "ph";
    const label  = isPh ? "cairan pH" : "nutrisi";
    const valClr = isPh ? "#22c55e"   : "#f59e0b";
    const iconCls= isPh ? "ph-icon"   : "nut-icon";
    const dotCls = isPh ? "ph-dot"    : "nut-dot";
    return `
      <div class="log-item">
        <div class="log-icon ${iconCls}">
          <div class="log-dot ${dotCls}"></div>
        </div>
        <span class="log-text">
          Tambah ${label}
          <span class="mono" style="color:${valClr};font-weight:600"> ${e.amount} mL</span>
        </span>
        <span class="log-time mono">${fmt(e.time)}</span>
      </div>
    `;
  }).join("");
}

// ── Theme toggle ───────────────────────────────────────────────────────────
function toggleTheme() {
  isDark = !isDark;
  document.body.className = isDark ? "dark" : "light";
  updateDOM(); // redraw gauges with new colors
}

// Keep the existing inline HTML handlers working with the module script.
Object.assign(window, { toggleTheme, checkInputs, addPh, addNutrisi });

// ── Init ───────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  checkInputs();
  updateDOM();
  renderLog();
  loadSensorData();
  setInterval(loadSensorData, 3000);
});
