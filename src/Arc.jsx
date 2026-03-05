import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Check, Pencil, Trash2, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════
// TOKENS
// ═══════════════════════════════════════════════════════════════════════
const T = {
  bg:       "#0C0C0C",
  s1:       "#131313",
  s2:       "#1A1A1A",
  s3:       "#222222",
  border:   "#242424",
  borderHi: "#333333",
  hi:       "#F4F0EB",
  mid:      "#9A948C",
  lo:       "#4A4540",
  beam:     "#EDE8E0",
  beamGlow: "rgba(237,232,224,0.20)",
  scar:     "#B04A35",
  scarGlow: "rgba(176,74,53,0.30)",
  gold:     "#C8A84B",
  goldGlow: "rgba(200,168,75,0.25)",
};

const PALETTE = [
  { id:"beam",   main:"#EDE8E0", glow:"rgba(237,232,224,0.35)", label:"Луч" },
  { id:"gold",   main:"#C8A84B", glow:"rgba(200,168,75,0.30)",  label:"Золото" },
  { id:"mint",   main:"#6ECFB2", glow:"rgba(110,207,178,0.30)", label:"Мята" },
  { id:"violet", main:"#B07BE5", glow:"rgba(176,123,229,0.30)", label:"Фиолет" },
  { id:"coral",  main:"#E88B6A", glow:"rgba(232,139,106,0.30)", label:"Коралл" },
  { id:"sky",    main:"#6AAFE8", glow:"rgba(106,175,232,0.30)", label:"Небо" },
];

const getColor = (proto) =>
  PALETTE.find(c => c.id === proto.colorId) || PALETTE[0];

const uid      = () => Math.random().toString(36).slice(2, 8);
const LONG_MS  = 640;
const WINDOW   = 28; // living 28-day ring window
const MAX_PROTOCOLS = 5;
const STORAGE_KEY = "arc.protocols.v1";

// ═══════════════════════════════════════════════════════════════════════
// DATE UTILS
// ═══════════════════════════════════════════════════════════════════════
const toKey   = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const today   = () => toKey(new Date());
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return toKey(d); };
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
const formatDate  = (key) => new Date(key).toLocaleDateString("ru-RU", { day:"numeric", month:"long" });
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const PALETTE_IDS = new Set(PALETTE.map(c => c.id));
const isDateKey = (v) => typeof v === "string" && DATE_KEY_RE.test(v);

function getTelegramWebApp() {
  if (typeof window === "undefined") return null;
  return window.Telegram?.WebApp ?? null;
}

function triggerHaptic(kind = "light") {
  try {
    const tg = getTelegramWebApp();
    const hf = tg?.HapticFeedback;
    if (hf) {
      if (kind === "success") hf.notificationOccurred("success");
      else if (kind === "warning") hf.notificationOccurred("warning");
      else if (kind === "medium") hf.impactOccurred("medium");
      else if (kind === "heavy") hf.impactOccurred("heavy");
      else if (kind === "selection") hf.selectionChanged();
      else hf.impactOccurred("light");
      return;
    }
  } catch {
    // fallback below
  }
  try { navigator.vibrate?.(kind === "success" ? [12, 18, 28] : 20); } catch {}
}

function normalizeDateKey(value, fallback) {
  return isDateKey(value) ? value : fallback;
}

function isHabitActiveOn(habit, dateKey) {
  const startDate = normalizeDateKey(habit?.startDate, null);
  const archivedAt = normalizeDateKey(habit?.archivedAt, null);
  if (startDate && dateKey < startDate) return false;
  if (archivedAt && dateKey >= archivedAt) return false;
  return true;
}

function activeHabitsOn(proto, dateKey) {
  return (proto.habits || []).filter(h => isHabitActiveOn(h, dateKey));
}

function normalizeHabit(raw, protocolStartDate) {
  if (!raw || typeof raw !== "object") return null;
  const id = typeof raw.id === "string" && raw.id ? raw.id : uid();
  const name = typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : "Привычка";
  const startDate = normalizeDateKey(raw.startDate, protocolStartDate);
  const archivedAt = normalizeDateKey(raw.archivedAt, null);
  return { id, name, startDate, archivedAt };
}

function normalizeKintsugi(raw) {
  const arr = raw instanceof Set ? [...raw] : Array.isArray(raw) ? raw : [];
  return [...new Set(arr.filter(isDateKey))];
}

function normalizeLogs(rawLogs, habits) {
  if (!rawLogs || typeof rawLogs !== "object") return {};
  const logs = {};
  Object.entries(rawLogs).forEach(([dateKey, value]) => {
    if (!isDateKey(dateKey) || !value || typeof value !== "object") return;
    const day = {};
    habits.forEach(h => {
      if (typeof value[h.id] === "boolean") day[h.id] = value[h.id];
    });
    logs[dateKey] = day;
  });
  return logs;
}

function normalizeProtocol(raw) {
  const startDate = normalizeDateKey(raw?.startDate, today());
  const habits = Array.isArray(raw?.habits)
    ? raw.habits.map(h => normalizeHabit(h, startDate)).filter(Boolean)
    : [];
  const logs = normalizeLogs(raw?.logs, habits);
  return {
    id: typeof raw?.id === "string" && raw.id ? raw.id : uid(),
    name: typeof raw?.name === "string" && raw.name.trim() ? raw.name.trim() : "Новый протокол",
    colorId: PALETTE_IDS.has(raw?.colorId) ? raw.colorId : PALETTE[0].id,
    startDate,
    habits,
    logs,
    kintsugi: normalizeKintsugi(raw?.kintsugi ?? raw?.kintsugiDays),
  };
}

// ═══════════════════════════════════════════════════════════════════════
// DEMO DATA — rich test data with varied start dates
// ═══════════════════════════════════════════════════════════════════════
function buildDemoLogs(startDaysAgo, habitCount, pattern) {
  // pattern: array of booleans per day (true = done), indexed from startDaysAgo→0
  const logs = {};
  const totalDays = startDaysAgo + 1;
  for (let d = 0; d < totalDays; d++) {
    const key = daysAgo(startDaysAgo - d);
    logs[key] = {};
    for (let h = 0; h < habitCount; h++) {
      logs[key][h] = pattern[d] !== undefined ? (Array.isArray(pattern[d]) ? pattern[d][h] : pattern[d]) : false;
    }
  }
  return logs;
}

// Helper: generate realistic pattern
function pattern(days, missEvery = null, startFrom = 0) {
  return Array.from({ length: days }, (_, i) => {
    if (i < startFrom) return false;
    if (missEvery && (i + 1) % missEvery === 0) return false;
    return true;
  });
}

// Per-habit partial patterns (some habits done, some not)
function partialPattern(days, habitCount, habitRates) {
  // habitRates: array of 0-1 for each habit, probability of doing it each day
  return Array.from({ length: days }, (_, di) =>
    Array.from({ length: habitCount }, (_, hi) => {
      // deterministic pseudo-random
      const seed = (di * 7 + hi * 13) % 17;
      return seed / 17 < habitRates[hi];
    })
  );
}

const DEMO_PROTOCOLS = [
  {
    id: "proto_mind",
    name: "Ясность ума",
    colorId: "beam",
    startDate: daysAgo(27),  // started 27 days ago — almost full ring
    habits: [
      { id: "h1", name: "Медитация 20 мин" },
      { id: "h2", name: "Утренние страницы" },
      { id: "h3", name: "Час без телефона" },
    ],
    // logs[dateKey][habitIndex] = bool
    logs: partialPattern(28, 3, [0.85, 0.72, 0.9]),
    kintsugiDays: [daysAgo(8), daysAgo(15)],
  },
  {
    id: "proto_body",
    name: "Тело",
    colorId: "coral",
    startDate: daysAgo(19),  // started 19 days ago
    habits: [
      { id: "h4", name: "Тренировка" },
      { id: "h5", name: "10 000 шагов" },
      { id: "h6", name: "Холодный душ" },
    ],
    logs: partialPattern(20, 3, [0.75, 0.88, 0.6]),
    kintsugiDays: [],
  },
  {
    id: "proto_focus",
    name: "Фокус",
    colorId: "mint",
    startDate: daysAgo(11),  // started 11 days ago — partial ring
    habits: [
      { id: "h7", name: "2 ч без уведомлений" },
      { id: "h8", name: "Главная задача дня" },
    ],
    logs: partialPattern(12, 2, [0.82, 0.95]),
    kintsugiDays: [],
  },
  {
    id: "proto_fuel",
    name: "Питание",
    colorId: "gold",
    startDate: daysAgo(5),   // started 5 days ago — just started
    habits: [
      { id: "h9",  name: "2 л воды" },
      { id: "h10", name: "Без сахара" },
      { id: "h11", name: "Ужин до 20:00" },
    ],
    logs: partialPattern(6, 3, [0.95, 0.7, 0.85]),
    kintsugiDays: [],
  },
  {
    id: "proto_rhythm",
    name: "Режим дня",
    colorId: "violet",
    startDate: daysAgo(27),  // same age as mind but worse compliance
    habits: [
      { id: "h12", name: "Подъём в 6:00" },
      { id: "h13", name: "Сон 8 часов" },
      { id: "h14", name: "Вечерний план" },
    ],
    logs: partialPattern(28, 3, [0.55, 0.65, 0.78]),
    kintsugiDays: [daysAgo(3)],
  },
];

// Materialize logs into proper date-keyed structure
function initProtocols() {
  return DEMO_PROTOCOLS.map(p => {
    const startDaysAgo = daysBetween(p.startDate, today());
    const logs = {};
    p.logs.forEach((dayLog, di) => {
      const key = daysAgo(startDaysAgo - di);
      if (di <= startDaysAgo) {
        logs[key] = {};
        p.habits.forEach((h, hi) => {
          logs[key][h.id] = Array.isArray(dayLog) ? dayLog[hi] : dayLog;
        });
      }
    });
    // Today's state — partially done for demo
    const todayKey = today();
    if (!logs[todayKey]) logs[todayKey] = {};
    p.habits.forEach((h, hi) => {
      logs[todayKey][h.id] = hi === 0; // first habit done today
    });

    return normalizeProtocol({
      id:         p.id,
      name:       p.name,
      colorId:    p.colorId,
      startDate:  p.startDate,
      habits:     p.habits.map(h => ({ ...h, startDate: p.startDate, archivedAt: null })),
      logs,       // logs[dateKey][habitId] = bool
      kintsugi:   p.kintsugiDays,
    });
  });
}

function loadProtocols() {
  if (typeof window === "undefined") return initProtocols();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return initProtocols();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return initProtocols();
    return parsed.map(normalizeProtocol);
  } catch {
    return initProtocols();
  }
}

const PB_URL = (import.meta.env.VITE_PB_URL || "").replace(/\/+$/, "");
const PB_TOKEN_KEY = "arc.pb.token";
const PB_RECORD_KEY = "arc.pb.record";

function isPocketBaseUnauthorized(status) {
  return status === 401 || status === 403;
}

function getTelegramInitData() {
  const tg = getTelegramWebApp();
  const fromTg = typeof tg?.initData === "string" ? tg.initData.trim() : "";
  if (fromTg) return fromTg;
  if (typeof window !== "undefined") {
    const fromUrl = new URLSearchParams(window.location.search).get("tgWebAppData");
    if (typeof fromUrl === "string" && fromUrl.trim()) return fromUrl.trim();
  }
  return "";
}

function loadPocketBaseAuth() {
  if (!PB_URL || typeof window === "undefined") return null;
  const token = window.localStorage.getItem(PB_TOKEN_KEY);
  const rawRecord = window.localStorage.getItem(PB_RECORD_KEY);
  if (!token || !rawRecord) return null;
  try {
    const record = JSON.parse(rawRecord);
    if (!record?.id) return null;
    return { token, record };
  } catch {
    return null;
  }
}

function savePocketBaseAuth(auth) {
  if (!PB_URL || typeof window === "undefined") return;
  if (!auth?.token || !auth?.record) {
    window.localStorage.removeItem(PB_TOKEN_KEY);
    window.localStorage.removeItem(PB_RECORD_KEY);
    return;
  }
  window.localStorage.setItem(PB_TOKEN_KEY, auth.token);
  window.localStorage.setItem(PB_RECORD_KEY, JSON.stringify(auth.record));
}

async function pocketBaseRequest(path, { method = "GET", token, body } = {}) {
  if (!PB_URL) return { ok: false, status: 0, data: null };
  try {
    const headers = {};
    if (typeof body !== "undefined") headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${PB_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      // empty body / non-json
    }
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

async function authPocketBaseWithTelegram(initData) {
  if (!PB_URL || !initData) return null;
  const response = await pocketBaseRequest("/api/arc/telegram-auth", {
    method: "POST",
    body: { initData },
  });
  const auth = response.data;
  if (!response.ok) return null;
  if (!auth?.token || !auth?.record?.id) return null;
  return { token: auth.token, record: auth.record };
}

async function loadProtocolsFromPocketBase(token) {
  if (!PB_URL || !token) return { protocols: null, unauthorized: false };
  const response = await pocketBaseRequest("/api/arc/state", { token });
  if (!response.ok) {
    return { protocols: null, unauthorized: isPocketBaseUnauthorized(response.status) };
  }
  const state = response.data?.state;
  if (state === null || typeof state === "undefined") {
    return { protocols: null, unauthorized: false };
  }
  return { protocols: parseStoredProtocols(state), unauthorized: false };
}

async function persistProtocolsToPocketBase(token, protos) {
  if (!PB_URL || !token) return { ok: false, unauthorized: false };
  const state = JSON.stringify(protos);
  const response = await pocketBaseRequest("/api/arc/state", {
    method: "POST",
    token,
    body: { state },
  });
  return { ok: response.ok, unauthorized: isPocketBaseUnauthorized(response.status) };
}

async function cloudGetItem(key) {
  const tg = getTelegramWebApp();
  if (!tg?.CloudStorage) return null;
  return new Promise(resolve => {
    tg.CloudStorage.getItem(key, (err, value) => {
      if (err) return resolve(null);
      resolve(typeof value === "string" && value.length > 0 ? value : null);
    });
  });
}

async function cloudSetItem(key, value) {
  const tg = getTelegramWebApp();
  if (!tg?.CloudStorage) return false;
  return new Promise(resolve => {
    tg.CloudStorage.setItem(key, value, (err) => resolve(!err));
  });
}

function parseStoredProtocols(raw) {
  if (raw === null || typeof raw === "undefined" || raw === "") return null;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return null;
    return parsed.map(normalizeProtocol);
  } catch {
    return null;
  }
}

async function loadProtocolsFromCloudStorage() {
  const raw = await cloudGetItem(STORAGE_KEY);
  return parseStoredProtocols(raw);
}

async function persistProtocols(protos) {
  const serialized = JSON.stringify(protos);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, serialized);
    } catch {
      // ignore storage quota/privacy errors
    }
  }
  await cloudSetItem(STORAGE_KEY, serialized);
}

// ═══════════════════════════════════════════════════════════════════════
// PROTOCOL STATS
// ═══════════════════════════════════════════════════════════════════════
function calcStats(proto) {
  const todayKey     = today();
  const startDays    = daysBetween(proto.startDate, todayKey);
  const totalDays    = startDays + 1;

  let completedDays = 0, missedDays = 0, currentStreak = 0, bestStreak = 0, runStreak = 0;
  let trackableDays = 0;
  let trackableHistoryDays = 0;

  for (let d = 0; d < totalDays; d++) {
    const key      = daysAgo(startDays - d);
    const activeHabits = activeHabitsOn(proto, key);
    if (activeHabits.length === 0) continue;
    trackableDays++;
    if (key !== todayKey) trackableHistoryDays++;
    const allDone  = dayFraction(proto, key, { withKintsugi: true }) >= 1;
    if (allDone) {
      completedDays++;
      runStreak++;
      if (runStreak > bestStreak) bestStreak = runStreak;
    } else if (key !== todayKey) {
      missedDays++;
      runStreak = 0;
    }
  }
  // Current streak: count backwards from yesterday
  for (let d = 1; d <= startDays; d++) {
    const key     = daysAgo(d);
    const activeHabits = activeHabitsOn(proto, key);
    if (activeHabits.length === 0) continue;
    const allDone = dayFraction(proto, key, { withKintsugi: true }) >= 1;
    if (allDone) currentStreak++;
    else break;
  }

  return { totalDays, completedDays, missedDays, currentStreak, bestStreak,
    rate: trackableHistoryDays > 0 ? Math.round((completedDays / trackableHistoryDays) * 100) : 100,
    trackableDays };
}

function isHealedByKintsugi(proto, dateKey) {
  if (!Array.isArray(proto?.kintsugi)) return false;
  if (dateKey === today()) return false;
  return proto.kintsugi.includes(dateKey);
}

// Day completion fraction 0–1
function dayFraction(proto, dateKey, { withKintsugi = false } = {}) {
  const habits = activeHabitsOn(proto, dateKey);
  const dayLogs = proto.logs[dateKey] || {};
  if (habits.length === 0) return 0;
  if (withKintsugi && isHealedByKintsugi(proto, dateKey)) return 1;
  const done = habits.filter(h => dayLogs[h.id] === true).length;
  return done / habits.length;
}

function getRepairableScars(proto) {
  const todayKey = today();
  const startDays = daysBetween(proto.startDate, todayKey);
  const healed = new Set(proto.kintsugi || []);
  const scars = [];

  for (let d = 1; d <= startDays; d++) {
    const key = daysAgo(d);
    if (healed.has(key)) continue;
    const habits = activeHabitsOn(proto, key);
    if (habits.length === 0) continue;
    const dayLogs = proto.logs[key] || {};
    const done = habits.filter(h => dayLogs[h.id] === true).length;
    if (done >= habits.length) continue;
    scars.push({
      key,
      done,
      total: habits.length,
      fraction: habits.length ? done / habits.length : 0,
    });
  }

  return scars; // newest -> oldest
}

// ═══════════════════════════════════════════════════════════════════════
// BEAM RINGS — 28-day living window, partial segments
// ═══════════════════════════════════════════════════════════════════════
function BeamRings({ protocols, onRingTap }) {
  const S = 300, cx = 150, cy = 150;
  const rings = [
    { r: 128, sw: 18 },
    { r: 104, sw: 18 },
    { r:  80, sw: 18 },
    { r:  56, sw: 18 },
    { r:  32, sw: 18 },
  ];

  return (
    <svg viewBox={`0 0 ${S} ${S}`}
      style={{ width:"100%", maxWidth:300, cursor:"pointer" }}>
      <defs>
        {/* Glow filter */}
        <filter id="ringGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>

        {/* Per-ring gradient from protocol color */}
        {protocols.slice(0, 5).map((proto, ri) => {
          const c = getColor(proto);
          return (
            <linearGradient key={ri} id={`rGrad${ri}`}
              x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={c.main} stopOpacity="0.6"/>
              <stop offset="100%" stopColor={c.main} stopOpacity="1"/>
            </linearGradient>
          );
        })}

        {/* Shadow for the tip overlap (Apple-style end shadow) */}
        <filter id="tipShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="-1" dy="-1" stdDeviation="2"
            floodColor="#000" floodOpacity="0.5"/>
        </filter>
      </defs>

      {protocols.slice(0, 5).map((proto, ri) => {
        const { r, sw } = rings[ri];
        const color     = getColor(proto);
        const C         = 2 * Math.PI * r;
        const todayKey  = today();
        const startDays = daysBetween(proto.startDate, todayKey);

        // Calculate fill: average dayFraction over active days in 28-day window
        let sumFrac = 0, activeDays = 0;
        for (let d = 0; d < WINDOW; d++) {
          const daysBack = WINDOW - 1 - d;
          if (daysBack > startDays) continue;
          const key  = daysAgo(daysBack);
          sumFrac   += dayFraction(proto, key, { withKintsugi: true });
          activeDays++;
        }
        const fillPct = activeDays > 0 ? sumFrac / activeDays : 0;
        const fillLen = fillPct * C;

        return (
          <g key={proto.id} onClick={() => onRingTap(proto.id)}>
            {/* Background track */}
            <circle cx={cx} cy={cy} r={r}
              fill="none"
              stroke="#1A1A1A"
              strokeWidth={sw}
              strokeLinecap="round"/>

            {/* Filled arc — single smooth stroke */}
            {fillPct > 0 && (
              <motion.circle cx={cx} cy={cy} r={r}
                fill="none"
                stroke={`url(#rGrad${ri})`}
                strokeWidth={sw}
                strokeLinecap="round"
                strokeDasharray={`${fillLen} ${C - fillLen}`}
                strokeDashoffset={0}
                transform={`rotate(-90 ${cx} ${cy})`}
                style={{ filter: "url(#ringGlow)" }}
                initial={{ strokeDasharray: `0 ${C}` }}
                animate={{ strokeDasharray: `${fillLen} ${C - fillLen}` }}
                transition={{ duration: 1.2, delay: ri * 0.1, ease: [0.16, 1, 0.3, 1] }}
              />
            )}

            {/* Bright tip cap — small circle at the end of the arc for Apple shadow effect */}
            {fillPct > 0.05 && (() => {
              const angle = -Math.PI / 2 + fillPct * 2 * Math.PI;
              const tx = cx + r * Math.cos(angle);
              const ty = cy + r * Math.sin(angle);
              return (
                <motion.circle cx={tx} cy={ty} r={sw / 2}
                  fill={color.main}
                  filter="url(#tipShadow)"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: fillPct > 0.95 ? 1 : 0 }}
                  transition={{ duration: 0.3, delay: ri * 0.1 + 1 }}
                />
              );
            })()}
          </g>
        );
      })}

      {/* Center dot — breathing */}
      <motion.circle cx={cx} cy={cy} r="3"
        fill={T.beam} opacity="0.3"
        animate={{ r: [3, 4.5, 3], opacity: [0.3, 0.1, 0.3] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}/>
    </svg>
  );
}






// ═══════════════════════════════════════════════════════════════════════
// HEATMAP — 4 weeks grid
// ═══════════════════════════════════════════════════════════════════════
function HeatMap({ proto }) {
  const startDays = daysBetween(proto.startDate, today());
  const weeks = 4;
  const days  = weeks * 7;

  // Build grid: 7 rows (Mon–Sun), 4 cols (weeks)
  // rightmost col = this week
  const todayKey = today();
  const todayDow = new Date().getDay(); // 0=Sun
  // Align so rightmost column ends on today
  const cells = Array.from({ length: days }, (_, i) => {
    const dBack = days - 1 - i;
    const key   = daysAgo(dBack);
    const frac  = dayFraction(proto, key);
    const before = dBack > startDays;
    const isToday = key === todayKey;
    const isKintsugi = proto.kintsugi.includes(key);
    return { key, frac, before, isToday, isKintsugi };
  });

  const CELL = 22, GAP = 3;
  const W = 7 * (CELL + GAP), H = weeks * (CELL + GAP);
  // Transpose: col = week index, row = day-of-week
  return (
    <div style={{ overflowX:"auto" }}>
      <svg width={W} height={H + 20} style={{ display:"block" }}>
        {/* Day labels */}
        {["П","В","С","Ч","П","С","В"].map((d,i) => (
          <text key={i} x={i*(CELL+GAP)+CELL/2} y={H+14}
            textAnchor="middle"
            style={{ fontSize:8, fill:T.lo, fontFamily:"monospace" }}>{d}</text>
        ))}
        {cells.map((c, i) => {
          const col = Math.floor(i / 7);
          const row = i % 7;
          const x   = row * (CELL + GAP);
          const y   = col * (CELL + GAP);

          let fill = T.border;
          let opacity = 1;
          if (c.before) { fill = T.s2; opacity = 0.4; }
          else if (c.isKintsugi) { fill = T.gold; opacity = 0.7; }
          else if (c.frac === 0 && c.key !== todayKey) { fill = T.scar; opacity = 0.35; }
          else if (c.frac > 0) {
            fill = T.beam;
            opacity = 0.15 + c.frac * 0.75;
          }

          return (
            <g key={i}>
              <rect x={x} y={y} width={CELL} height={CELL}
                rx={4} fill={fill} opacity={opacity}/>
              {c.isToday && (
                <rect x={x} y={y} width={CELL} height={CELL}
                  rx={4} fill="none" stroke={T.beam} strokeWidth="1" opacity="0.5"/>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// LONG-PRESS BUTTON
// ═══════════════════════════════════════════════════════════════════════
function LPButton({ done, hasScar, kintsugi: isK, protoColor, onComplete, onUndo }) {
  const [prog, setProg] = useState(0);
  const [on,   setOn]   = useState(false);
  const raf = useRef(null), t0 = useRef(null);
  const SIZE = 34, R = 13, C2 = 2 * Math.PI * R;
  const baseColor = protoColor || T.beam;
  const color = isK ? T.gold : hasScar ? T.scar : baseColor;

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const cancel = useCallback(() => {
    cancelAnimationFrame(raf.current); setOn(false); setProg(0);
  }, []);

  const press = useCallback(e => {
    e.stopPropagation();
    e.preventDefault();
    if (done) { triggerHaptic("medium"); onUndo?.(); return; }
    triggerHaptic("medium");
    setOn(true); setProg(0);
    t0.current = performance.now();
    const tick = now => {
      const p = Math.min((now - t0.current) / LONG_MS, 1);
      setProg(p);
      if (p < 1) { raf.current = requestAnimationFrame(tick); }
      else {
        setOn(false); setProg(0);
        triggerHaptic("success");
        onComplete();
      }
    };
    raf.current = requestAnimationFrame(tick);
  }, [done, onComplete, onUndo]);

  return (
    <motion.div
      style={{ width:SIZE, height:SIZE, position:"relative", cursor:"pointer",
        display:"flex", alignItems:"center", justifyContent:"center",
        flexShrink:0, userSelect:"none", touchAction:"none" }}
      onPointerDown={press} onPointerUp={cancel} onPointerCancel={cancel} onPointerLeave={cancel}
      onClick={e => e.stopPropagation()}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={{ position:"absolute", inset:0, transform:"rotate(-90deg)" }}>
        <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="none"
          stroke={done ? `${color}35` : T.border} strokeWidth="1.3"/>
        {on && (
          <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="none"
            stroke={color} strokeWidth="1.8"
            strokeDasharray={C2} strokeDashoffset={C2*(1-prog)}
            style={{ filter:`drop-shadow(0 0 3px ${color})` }}/>
        )}
        {done && (
          <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="none"
            stroke={color} strokeWidth="1.3"
            style={{ filter:`drop-shadow(0 0 4px ${color}80)` }}/>
        )}
      </svg>
      <div style={{ position:"relative", zIndex:1,
        width:SIZE-10, height:SIZE-10, borderRadius:"50%",
        display:"flex", alignItems:"center", justifyContent:"center",
        background: done ? `${color}12` : on ? `${color}08` : "transparent" }}>
        <AnimatePresence mode="wait">
          {done ? (
            <motion.svg key="c" viewBox="0 0 14 14" fill="none"
              style={{ width:14, height:14 }}
              initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}>
              <motion.polyline points="2,7 6,11 12,3"
                stroke={color} strokeWidth="1.6"
                strokeLinecap="square" strokeLinejoin="miter"
                initial={{ pathLength:0 }} animate={{ pathLength:1 }}
                transition={{ duration:0.2 }}/>
            </motion.svg>
          ) : (
            <motion.div key="d"
              style={{ width:5, height:5, borderRadius:"50%",
                background: on ? color : T.lo }}
              animate={{ opacity: on ? [1,0.4,1] : 0.55 }}
              transition={{ duration:0.35, repeat: on ? Infinity : 0 }}/>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// PROTOCOL DETAIL SCREEN
// ═══════════════════════════════════════════════════════════════════════
function ProtocolDetail({ proto, onBack, onKintsugi }) {
  const stats    = calcStats(proto);
  const todayKey = today();
  const todayLogs = proto.logs[todayKey] || {};
  const todayHabits = activeHabitsOn(proto, todayKey);

  const pColor = getColor(proto);
  const hasScar = getRepairableScars(proto).length > 0;

  // Section label style
  const sectionLabel = {
    fontSize:10, fontFamily:"monospace", color:T.lo,
    letterSpacing:"0.16em", marginBottom:14,
  };

  // Thin rule
  const Rule = ({ mt = 28, mb = 28 }) => (
    <div style={{ height:"0.5px", background:T.border, margin:`${mt}px 0 ${mb}px` }}/>
  );

  return (
    <motion.div
      style={{ position:"fixed", top:"var(--arc-frame-top, 0px)", left:"var(--arc-frame-left, 0px)",
        width:"var(--arc-frame-width, 100vw)", height:"var(--arc-frame-height, 100dvh)",
        background:T.bg, zIndex:100,
        overflowY:"auto", display:"flex", flexDirection:"column", alignItems:"center" }}
      initial={{ x:"100%" }} animate={{ x:0 }} exit={{ x:"100%" }}
      transition={{ duration:0.35, ease:[0.16,1,0.3,1] }}>
      <div style={{ width:"100%", maxWidth:430, padding:"0 20px 80px" }}>

        {/* ── Back + title ── */}
        <div style={{ display:"flex", alignItems:"center", gap:14, padding:"52px 0 28px" }}>
          <motion.button onClick={onBack}
            style={{ width:30, height:30, borderRadius:8, background:"transparent",
              border:"none", cursor:"pointer",
              display:"flex", alignItems:"center", justifyContent:"center",
              flexShrink:0 }}
            whileTap={{ scale:0.85 }}>
            <ChevronLeft size={18} color={T.mid}/>
          </motion.button>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:20, fontWeight:700, color:T.hi,
              lineHeight:1.2 }}>{proto.name}</div>
            <div style={{ fontSize:11, color:T.lo, fontFamily:"monospace", marginTop:3 }}>
              начат {formatDate(proto.startDate)} · {stats.totalDays - 1} дней
            </div>
          </div>
        </div>

        {/* ── Stats — 4 numbers in a row, no box ── */}
        <div style={{ display:"flex", gap:0 }}>
          {[
            { label:"серия",    value: stats.currentStreak, unit:"д", accent:true },
            { label:"рекорд",   value: stats.bestStreak,    unit:"д" },
            { label:"выполнено",value: stats.rate,           unit:"%" },
            { label:"пропущено",value: stats.missedDays,     unit:"д" },
          ].map((s, i) => (
            <div key={s.label} style={{ flex:1, textAlign:"center",
              borderLeft: i > 0 ? `1px solid ${T.border}` : "none",
              padding:"0 4px" }}>
              <div style={{ display:"flex", alignItems:"baseline",
                justifyContent:"center", gap:2 }}>
                <span style={{ fontSize:26, fontWeight:700, fontFamily:"monospace",
                  color: s.accent ? pColor.main : T.hi, lineHeight:1,
                  filter: s.accent ? `drop-shadow(0 0 8px ${pColor.glow})` : "none" }}>
                  {s.value}
                </span>
                <span style={{ fontSize:12, color:T.lo, fontFamily:"monospace" }}>
                  {s.unit}
                </span>
              </div>
              <div style={{ fontSize:9, color:T.lo, marginTop:4,
                letterSpacing:"0.08em" }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* ── Progress bar (no box) ── */}
        <Rule mt={24} mb={20}/>
        <div style={{ display:"flex", justifyContent:"space-between",
          alignItems:"baseline", marginBottom:8 }}>
          <span style={{ fontSize:12, color:T.mid }}>
            {stats.completedDays} из {stats.totalDays - 1} дней выполнено
          </span>
          <span style={{ fontSize:12, fontFamily:"monospace", color: T.mid }}>
            {stats.rate}%
          </span>
        </div>
        <div style={{ height:2, background:T.border, borderRadius:1, overflow:"hidden" }}>
          <motion.div style={{ height:"100%", borderRadius:1,
            background:`linear-gradient(90deg, ${pColor.main}50, ${pColor.main})` }}
            initial={{ width:0 }}
            animate={{ width:`${stats.rate}%` }}
            transition={{ duration:1, ease:[0.16,1,0.3,1], delay:0.15 }}/>
        </div>

        {/* ── Heatmap ── */}
        <Rule mt={28} mb={20}/>
        <div style={sectionLabel}>ПОСЛЕДНИЕ 4 НЕДЕЛИ</div>
        <HeatMap proto={proto}/>
        <div style={{ display:"flex", gap:14, marginTop:12, alignItems:"center" }}>
          {[
            { color:pColor.main, label:"Выполнено",    opacity:0.85 },
            { color:T.scar,      label:"Пропущено",    opacity:0.4 },
            { color:T.gold,      label:"Восстановлено",opacity:0.7 },
          ].map(l => (
            <div key={l.label} style={{ display:"flex", alignItems:"center", gap:5 }}>
              <div style={{ width:7, height:7, borderRadius:2,
                background:l.color, opacity:l.opacity, flexShrink:0 }}/>
              <span style={{ fontSize:10, color:T.lo }}>{l.label}</span>
            </div>
          ))}
        </div>

        {/* ── Habits today ── */}
        <Rule mt={28} mb={20}/>
        <div style={sectionLabel}>СЕГОДНЯ</div>
        {todayHabits.map((h, i) => {
          const done    = todayLogs[h.id] === true;
          const isLast  = i === todayHabits.length - 1;
          // per-habit streak
          let hStreak = 0;
          for (let d = 1; d <= 28; d++) {
            const k = daysAgo(d);
            if (!isHabitActiveOn(h, k)) break;
            if (proto.logs[k]?.[h.id]) hStreak++;
            else break;
          }
          return (
            <div key={h.id} style={{ display:"flex", alignItems:"center",
              gap:12, padding:"10px 0",
              borderBottom: isLast ? "none" : `1px solid ${T.border}` }}>
              <motion.div
                style={{ width:7, height:7, borderRadius:"50%", flexShrink:0,
                  background: done ? pColor.main : T.border,
                  boxShadow: done ? `0 0 7px ${pColor.glow}` : "none",
                  transition:"all 0.3s" }}
                animate={done ? { scale:[1,1.3,1] } : { scale:1 }}
                transition={{ duration:0.4 }}/>
              <span style={{ flex:1, fontSize:14, color: done ? T.lo : T.mid,
                textDecoration: done ? "line-through" : "none",
                textDecorationColor: T.lo, transition:"color 0.25s" }}>
                {h.name}
              </span>
              {hStreak > 0 && (
                <span style={{ fontSize:10, fontFamily:"monospace", color:T.lo }}>
                  {hStreak}д
                </span>
              )}
            </div>
          );
        })}

        {/* ── Kintsugi ── */}
        {hasScar && (
          <>
            <Rule mt={24} mb={16}/>
            <motion.button onClick={onKintsugi}
              style={{ background:"none", border:"none", padding:0, cursor:"pointer",
                display:"flex", alignItems:"center", gap:6 }}
              whileTap={{ scale:0.95 }}
              animate={{ opacity:[0.4,0.65,0.4] }}
              transition={{ duration:3.5, repeat:Infinity }}>
              <span style={{ fontSize:10, color:T.gold }}>⟡</span>
              <span style={{ fontSize:12, color:T.gold, fontFamily:"monospace",
                letterSpacing:"0.08em" }}>восстановить структуру</span>
            </motion.button>
          </>
        )}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// PROTOCOL CARD — flat, habits always visible
// ═══════════════════════════════════════════════════════════════════════
function ProtocolCard({ proto, onComplete, onUndo, onAddHabit, onRemoveHabit,
  onRemoveProtocol, onRenameProtocol, onKintsugi, onOpenDetail }) {
  const [editing,  setEditing]  = useState(false);
  const [newH,     setNewH]     = useState("");
  const [renaming, setRenaming] = useState(false);
  const [nameVal,  setNameVal]  = useState(proto.name);
  const nameRef = useRef(null);

  const todayKey   = today();
  const todayLogs  = proto.logs[todayKey] || {};
  const todayHabits = activeHabitsOn(proto, todayKey);
  const doneCount  = todayHabits.filter(h => todayLogs[h.id]).length;
  const totalCount = todayHabits.length;
  const allDone    = totalCount > 0 && doneCount === totalCount;
  const hasScarred = getRepairableScars(proto).length > 0;

  const stats  = calcStats(proto);
  const pColor = getColor(proto);

  const submitHabit = () => {
    const t = newH.trim();
    if (t) { onAddHabit(t); setNewH(""); }
  };
  const submitRename = () => {
    const t = nameVal.trim();
    if (t) onRenameProtocol(t);
    setRenaming(false);
  };

  return (
    <div>
      {/* Title row */}
      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"4px 4px 10px" }}>
        {/* Glow dot */}
        <motion.div style={{ width:6, height:6, borderRadius:"50%", flexShrink:0,
          background: allDone ? pColor.main : pColor.main,
          opacity: allDone ? 1 : 0.35,
          boxShadow: allDone ? `0 0 8px ${pColor.glow}` : "none",
          transition:"all 0.4s" }}
          animate={allDone ? { scale:[1,1.4,1] } : { scale:1 }}
          transition={{ duration:2, repeat: allDone ? Infinity : 0 }}/>

        {/* Name */}
        {renaming ? (
          <input ref={nameRef} value={nameVal}
            onChange={e => setNameVal(e.target.value)}
            onBlur={submitRename}
            onKeyDown={e => {
              if (e.key === "Enter") submitRename();
              if (e.key === "Escape") { setNameVal(proto.name); setRenaming(false); }
            }}
            autoFocus
            style={{ flex:1, background:"transparent", border:"none", outline:"none",
              color:T.hi, fontSize:18, fontWeight:600,
              fontFamily:"Georgia,'Times New Roman',serif",
              borderBottom:`1px solid ${T.borderHi}`, paddingBottom:1 }}/>
        ) : (
          <span
            onClick={() => { if (editing) { setRenaming(true); setTimeout(() => nameRef.current?.focus(), 40); } }}
            style={{ flex:1, fontSize:18, fontWeight:600,
              fontFamily:"Georgia,'Times New Roman',serif",
              color: allDone ? T.hi : T.mid,
              cursor: editing ? "text" : "default",
              transition:"color 0.3s" }}>
            {proto.name}
          </span>
        )}

        {/* Streak badge */}
        {stats.currentStreak > 1 && !editing && (
          <span style={{ fontSize:10, fontFamily:"monospace", color:T.mid }}>
            🔥 {stats.currentStreak}д
          </span>
        )}

        {/* Progress fraction */}
        <span style={{ fontFamily:"monospace", fontSize:10,
          color: allDone ? pColor.main : T.lo, flexShrink:0, transition:"color 0.3s",
          minWidth:24, textAlign:"right" }}>
          {doneCount}/{totalCount}
        </span>

        {/* Detail arrow */}
        {!editing && (
          <motion.button onClick={onOpenDetail}
            style={{ width:24, height:24, borderRadius:6, background:"transparent",
              border:"none", cursor:"pointer",
              display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}
            whileTap={{ scale:0.85 }}>
            <ChevronRight size={13} color={T.lo}/>
          </motion.button>
        )}

        {/* Edit toggle */}
        <motion.button onClick={() => setEditing(e => !e)}
          style={{ width:26, height:26, borderRadius:7, border:"none",
            background: editing ? T.s2 : "transparent", cursor:"pointer",
            display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}
          whileTap={{ scale:0.85 }}>
          {editing ? <Check size={12} color={T.beam}/> : <Pencil size={11} color={T.lo}/>}
        </motion.button>

        {/* Delete */}
        <AnimatePresence>
          {editing && (
            <motion.button
              initial={{ opacity:0, width:0 }} animate={{ opacity:1, width:26 }}
              exit={{ opacity:0, width:0 }} transition={{ duration:0.18 }}
              onClick={onRemoveProtocol}
              style={{ height:26, borderRadius:7, border:"none",
                background:`${T.scar}14`, cursor:"pointer",
                display:"flex", alignItems:"center", justifyContent:"center",
                flexShrink:0, overflow:"hidden" }}>
              <Trash2 size={11} color={T.scar}/>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Habits */}
      <AnimatePresence initial={false}>
        {todayHabits.map((h, i) => {
          const done    = todayLogs[h.id] === true;
          const isLast  = i === todayHabits.length - 1;
          const hasScar = (() => {
            const yest = daysAgo(1); const yl = proto.logs[yest];
            return isHabitActiveOn(h, yest) && yl && yl[h.id] !== true;
          })();
          const isK = proto.kintsugi.includes(daysAgo(1));
          return (
            <motion.div key={h.id}
              initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0, height:0 }}
              transition={{ duration:0.2 }}
              style={{ display:"flex", alignItems:"center", gap:10,
                padding:"10px 4px",
                borderBottom: isLast && !editing ? "none" : `1px solid ${T.border}` }}>

              <AnimatePresence>
                {editing && (
                  <motion.button
                    initial={{ opacity:0, width:0 }} animate={{ opacity:1, width:18 }}
                    exit={{ opacity:0, width:0 }}
                    onClick={() => onRemoveHabit(h.id)}
                    style={{ height:18, borderRadius:4, border:"none",
                      background:`${T.scar}14`, cursor:"pointer",
                      display:"flex", alignItems:"center", justifyContent:"center",
                      flexShrink:0, overflow:"hidden" }}>
                    <X size={9} color={T.scar}/>
                  </motion.button>
                )}
              </AnimatePresence>

              <span style={{ flex:1, fontSize:"14px", lineHeight:1.5,
                color: done ? T.lo : T.mid,
                textDecoration: done ? "line-through" : "none",
                textDecorationColor: T.lo,
                transition:"color 0.22s",
                userSelect:"none" }}>
                {h.name}
              </span>

              <span style={{ fontFamily:"monospace", fontSize:10, color:T.lo, flexShrink:0 }}>
                {(() => {
                  // calc habit-specific streak
                  let s = 0;
                  for (let d = 1; d <= 28; d++) {
                    const k = daysAgo(d);
                    if (!isHabitActiveOn(h, k)) break;
                    if (proto.logs[k]?.[h.id]) s++;
                    else break;
                  }
                  return s > 0 ? `${s}д` : "";
                })()}
              </span>

              {!editing && (
                <LPButton done={done} hasScar={hasScar && !isK} kintsugi={isK}
                  protoColor={pColor.main}
                  onComplete={() => onComplete(h.id)}
                  onUndo={() => onUndo(h.id)}/>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Kintsugi */}
      <AnimatePresence>
        {hasScarred && !editing && (
          <motion.div
            initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            style={{ padding:"4px 4px 2px" }}>
            <motion.button onClick={onKintsugi}
              style={{ background:"none", border:"none", padding:0, cursor:"pointer",
                display:"flex", alignItems:"center", gap:5 }}
              whileTap={{ scale:0.95 }}
              animate={{ opacity:[0.45,0.65,0.45] }}
              transition={{ duration:3.5, repeat:Infinity }}>
              <span style={{ fontSize:9, color:T.gold }}>⟡</span>
              <span style={{ fontSize:11, color:T.gold, fontFamily:"monospace",
                letterSpacing:"0.06em" }}>восстановить</span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add habit */}
      <div style={{ display:"flex", alignItems:"center", gap:8,
        padding:"8px 4px 2px", borderTop:`1px solid ${T.border}` }}>
        <Plus size={12} color={T.lo} style={{ flexShrink:0 }}/>
        <input value={newH}
          onChange={e => setNewH(e.target.value)}
          onKeyDown={e => e.key === "Enter" && submitHabit()}
          placeholder="Добавить привычку"
          style={{ flex:1, background:"transparent", border:"none", outline:"none",
            color:T.mid, fontSize:13, fontFamily:"inherit", padding:"2px 0" }}/>
        <AnimatePresence>
          {newH.trim() && (
            <motion.button
              initial={{ opacity:0, scale:0.7 }} animate={{ opacity:1, scale:1 }}
              exit={{ opacity:0, scale:0.7 }}
              onClick={submitHabit}
              style={{ width:24, height:24, borderRadius:6, background:T.beam,
                cursor:"pointer", border:"none",
                display:"flex", alignItems:"center", justifyContent:"center" }}
              whileTap={{ scale:0.88 }}>
              <ArrowRight size={12} color="#000"/>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ARC WORDMARK
// ═══════════════════════════════════════════════════════════════════════
// The uploaded logo: letterform "ARC" with serifs on light background.
// We inline the paths, recolor to T.beam, drop the white bg rect.
function ArcMark({ size = "md" }) {
  const dim = size === "lg" ? 56 : size === "sm" ? 36 : 44;
  return (
    <svg
      width={dim} height={dim}
      viewBox="142 359 721 294"
      fill="none"
      style={{ flexShrink:0, filter:`drop-shadow(0 0 6px ${T.beamGlow})` }}
    >
      {/* A letterform */}
      <path fill={T.beam}
        d="M265.471 361.983C277.319 361.965 289.676 361.772 301.483 362.123L360.312 526.201C364.862 538.586 369.349 550.994 373.772 563.425C381.285 584.802 389.81 612.629 404.93 629.562C423.275 615.602 419.144 582.451 419.101 561.58L419.025 502.38L418.854 447.23C418.796 431.746 420.198 410.209 414.271 395.565C411.269 388.148 404.198 385.109 396.958 382.742C397.131 376.024 397.029 368.936 397.032 362.188L487.317 362.303C507.06 362.292 527.05 361.576 546.69 363.445C579.871 366.657 613.761 381.951 622.652 417.006C634.073 462.029 611.551 500.756 566.934 512.559C570.563 519.075 576.137 527.248 580.233 533.801L601.104 567.722C612.385 585.812 623.089 605.132 636.718 621.634C641.795 627.781 646.541 630.625 654.488 631.236C654.384 637.87 654.342 644.506 654.36 651.141C638.576 650.854 622.215 651.036 606.384 650.999L564.96 650.928C545.19 607.954 521.354 564.147 500.589 521.194C495.521 521.411 489.924 521.349 484.814 521.399C484.916 538.867 484.893 556.335 484.745 573.803C484.716 585.227 484.231 596.755 486.014 608.067C488.672 624.93 496.332 629.496 512.382 630.133C512.286 637.012 512.39 644.118 512.402 651.016L300.486 651.011C300.415 644.495 300.418 637.978 300.494 631.462C328.927 625.725 320.374 606.811 313.752 587.135C312.409 583.145 311.234 579.273 308.339 576.108C305.565 574.965 302.546 574.604 299.566 574.436C290.778 573.941 219.015 573.632 215.843 575.248C212.437 576.982 207.013 596.398 205.739 600.939C203.749 608.033 201.705 616.32 205.755 623.045C209.343 629.002 215.921 630.274 222.183 631.677C222.119 638.098 222.142 644.519 222.251 650.938C196.509 651.495 168.877 650.982 142.947 651.021C142.806 644.432 142.773 637.841 142.846 631.251C159.03 629.663 163.731 622.798 170.685 609.04C175.483 599.545 178.88 589.855 182.735 579.974L203.905 524.341L230.209 454.861C242.279 424.023 254.034 393.062 265.471 361.983Z"/>
      {/* Counter of A */}
      <path fill={T.beam} opacity="0.0"
        d="M262.552 446.29C264.654 448.903 275.551 480.085 277.724 485.917L291.923 524.247C295.105 532.735 298.705 541.589 301.482 550.168C290.205 550.609 275.766 550.142 264.25 550.083L223.983 550.137L262.552 446.29Z"/>
      {/* R letterform */}
      <path fill={T.beam}
        d="M498.812 387.682C505.787 386.64 516.381 387.518 523.454 388.663C555.538 393.856 563.581 427.748 558.435 455.529C556.047 468.421 549.61 478.565 538.434 486.013C520.662 495.586 504.728 493.792 485.057 493.728L484.91 429.136C484.883 421.273 484.892 413.107 484.852 405.268C484.785 392.408 485.294 389.277 498.812 387.682Z"/>
      {/* C letterform */}
      <path fill={T.beam}
        d="M766.867 359.716C791.707 357.076 834.009 363.328 857.665 370.816C858.7 393.22 857.938 421.519 857.86 444.402L837.826 444.42C831.007 427.966 824.162 408.08 809.511 397.436C784.776 379.466 748.552 383.897 730.669 409.153C704.29 446.408 700.854 496.355 705.979 540.282C709.151 567.461 718.999 597.346 741.202 614.36C754.875 624.618 772.409 627.974 789.186 625.799C807.576 623.414 818.625 612.112 829.258 597.772C833.073 592.095 837.229 584.931 840.847 579.026L862.791 579.003C860.044 589.603 849.789 634.002 844.322 640.071C837.199 647.979 804.691 651.625 793.473 652.463C754.167 655.398 709.765 651.084 678.803 624.242C650.209 599.452 636.333 562.548 633.698 525.555C630.593 481.942 639.154 438.066 668.725 404.299C695.544 373.672 727.307 362.383 766.867 359.716Z"/>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ADD SHEET
// ═══════════════════════════════════════════════════════════════════════
const TEMPLATES = [
  { tid:"mind",   name:"Ясность ума",  habits:["Медитация 20 мин","Утренние страницы","Час без телефона"] },
  { tid:"body",   name:"Тело",          habits:["Тренировка","10 000 шагов","Холодный душ"] },
  { tid:"focus",  name:"Фокус",         habits:["2 ч без уведомлений","Главная задача дня","Вечерний обзор"] },
  { tid:"fuel",   name:"Питание",       habits:["2 л воды","Без сахара","Ужин до 20:00"] },
  { tid:"rhythm", name:"Режим дня",     habits:["Подъём в 6:00","Сон 8 часов","Вечерний план"] },
];

function mkProtocol(tpl, colorId) {
  const startDate = today();
  return {
    id:        uid(),
    name:      tpl.name,
    colorId:   colorId || "beam",
    startDate,
    habits:    tpl.habits.map(name => ({ id:uid(), name, startDate, archivedAt:null })),
    logs:      {},
    kintsugi:  [],
  };
}

// Color picker row — reused in AddSheet
function ColorPicker({ value, onChange, usedColors = [] }) {
  return (
    <div style={{ display:"flex", gap:10, padding:"4px 0" }}>
      {PALETTE.map(c => {
        const selected = value === c.id;
        const used     = usedColors.includes(c.id) && !selected;
        return (
          <motion.button key={c.id}
            onClick={() => onChange(c.id)}
            style={{
              width: 28, height: 28, borderRadius: "50%",
              background: c.main,
              border: selected ? `2px solid ${T.hi}` : `2px solid transparent`,
              outline: selected ? `2px solid ${c.main}` : "none",
              outlineOffset: 1,
              cursor: "pointer",
              opacity: used ? 0.3 : 1,
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: 0,
              boxShadow: selected ? `0 0 12px ${c.glow}` : "none",
              transition: "all 0.2s",
            }}
            whileTap={{ scale: 0.85 }}>
            {selected && <Check size={12} color={T.bg} strokeWidth={3}/>}
          </motion.button>
        );
      })}
    </div>
  );
}

function AddSheet({ existingNames, usedColors, onAdd, onClose }) {
  const [mode,    setMode]    = useState("list");
  const [cName,   setCName]   = useState("");
  const [cH,      setCH]      = useState([""]);
  const [colorId, setColorId] = useState(() => {
    // auto-pick first unused color
    return PALETTE.find(c => !usedColors.includes(c.id))?.id || PALETTE[0].id;
  });
  const avail = TEMPLATES.filter(t => !existingNames.includes(t.name));

  if (mode === "custom") return (
    <div style={{ padding:20 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20 }}>
        <button onClick={() => setMode("list")}
          style={{ background:"transparent", border:"none", color:T.mid,
            cursor:"pointer", fontSize:13 }}>← назад</button>
        <span style={{ fontSize:15, fontWeight:600, color:T.hi }}>Свой протокол</span>
      </div>

      {/* Color picker */}
      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:10, fontFamily:"monospace", color:T.lo,
          letterSpacing:"0.12em", marginBottom:10 }}>ЦВЕТ</div>
        <ColorPicker value={colorId} onChange={setColorId} usedColors={usedColors}/>
      </div>

      <input value={cName} onChange={e => setCName(e.target.value)}
        placeholder="Название"
        style={{ width:"100%", boxSizing:"border-box", padding:"12px 14px",
          borderRadius:10, background:T.s2, border:`1px solid ${T.border}`,
          color:T.hi, fontSize:14, outline:"none", marginBottom:12, fontFamily:"inherit" }}/>
      <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:12 }}>
        {cH.map((h, i) => (
          <div key={i} style={{ display:"flex", gap:8 }}>
            <input value={h} onChange={e => { const n=[...cH]; n[i]=e.target.value; setCH(n); }}
              placeholder={`Привычка ${i+1}`}
              style={{ flex:1, padding:"11px 14px", borderRadius:10, background:T.s2,
                border:`1px solid ${T.border}`, color:T.hi, fontSize:14, outline:"none",
                fontFamily:"inherit" }}/>
            {cH.length > 1 && (
              <button onClick={() => setCH(cH.filter((_,j) => j!==i))}
                style={{ width:42, borderRadius:10, background:`${T.scar}12`,
                  border:`1px solid ${T.scar}25`, cursor:"pointer",
                  display:"flex", alignItems:"center", justifyContent:"center" }}>
                <X size={13} color={T.scar}/>
              </button>
            )}
          </div>
        ))}
        <button onClick={() => setCH([...cH,""])}
          style={{ padding:10, borderRadius:10, background:"transparent",
            border:`1px dashed ${T.border}`, color:T.lo, fontSize:13, cursor:"pointer" }}>
          + ещё привычка
        </button>
      </div>
      <button disabled={!cName.trim()}
        onClick={() => {
          const startDate = today();
          const prepared = cH.map(h => h.trim()).filter(Boolean);
          const habitNames = prepared.length > 0 ? prepared : ["Новая привычка"];
          onAdd({ id:uid(), name:cName.trim(), colorId, startDate,
            habits: habitNames.map(name=>({id:uid(), name, startDate, archivedAt:null })),
            logs:{}, kintsugi:[] });
        }}
        style={{ width:"100%", padding:14, borderRadius:12, border:"none",
          background: cName.trim() ? T.hi : T.s2,
          color: cName.trim() ? T.bg : T.lo,
          fontSize:14, fontWeight:600,
          cursor: cName.trim() ? "pointer" : "not-allowed" }}>
        Создать
      </button>
      <div style={{ height:32 }}/>
    </div>
  );

  return (
    <div style={{ padding:"16px 16px 8px" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
        marginBottom:16 }}>
        <span style={{ fontFamily:"monospace", fontSize:10, color:T.lo,
          letterSpacing:"0.16em" }}>ДОБАВИТЬ ПРОТОКОЛ</span>
        <button onClick={onClose}
          style={{ width:28, height:28, borderRadius:8, background:T.s2,
            border:`1px solid ${T.border}`, cursor:"pointer",
            display:"flex", alignItems:"center", justifyContent:"center" }}>
          <X size={13} color={T.lo}/>
        </button>
      </div>

      {/* Color picker for template mode */}
      <div style={{ marginBottom:14 }}>
        <div style={{ fontSize:10, fontFamily:"monospace", color:T.lo,
          letterSpacing:"0.12em", marginBottom:10 }}>ЦВЕТ КОЛЬЦА</div>
        <ColorPicker value={colorId} onChange={setColorId} usedColors={usedColors}/>
      </div>

      {avail.map(t => (
        <motion.div key={t.tid}
          onClick={() => { onAdd(mkProtocol(t, colorId)); onClose(); }}
          style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
            padding:"12px 14px", borderRadius:12, cursor:"pointer",
            background:T.s2, border:`1px solid ${T.border}`, marginBottom:8 }}
          whileHover={{ borderColor:T.borderHi }} whileTap={{ scale:0.98 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:8, height:8, borderRadius:"50%",
              background: (PALETTE.find(c => c.id === colorId) || PALETTE[0]).main,
              flexShrink:0 }}/>
            <div>
              <div style={{ fontSize:14, fontWeight:600, color:T.mid, marginBottom:2 }}>{t.name}</div>
              <div style={{ fontSize:11, color:T.lo }}>{t.habits.slice(0,2).join(" · ")}</div>
            </div>
          </div>
          <ChevronRight size={15} color={T.lo}/>
        </motion.div>
      ))}
      <motion.div onClick={() => setMode("custom")}
        style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"12px 14px", borderRadius:12, cursor:"pointer",
          border:`1px dashed ${T.border}`, marginBottom:8 }}
        whileHover={{ borderColor:T.borderHi }} whileTap={{ scale:0.98 }}>
        <span style={{ fontSize:14, color:T.lo }}>Создать свой</span>
        <Plus size={15} color={T.lo}/>
      </motion.div>
      <div style={{ height:24 }}/>
    </div>
  );
}

function KintsugiSheet({ proto, candidates, onPick, onClose }) {
  const pColor = getColor(proto);

  return (
    <div style={{ padding:"16px 16px 12px" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
        marginBottom:14 }}>
        <div>
          <div style={{ fontFamily:"monospace", fontSize:10, color:T.lo, letterSpacing:"0.16em" }}>
            КИНЦУГИ
          </div>
          <div style={{ fontSize:14, color:T.hi, marginTop:5 }}>{proto.name}</div>
        </div>
        <button onClick={onClose}
          style={{ width:28, height:28, borderRadius:8, background:T.s2,
            border:`1px solid ${T.border}`, cursor:"pointer",
            display:"flex", alignItems:"center", justifyContent:"center" }}>
          <X size={13} color={T.lo}/>
        </button>
      </div>

      <div style={{ fontSize:11, color:T.mid, marginBottom:10 }}>
        Выбери день с пропуском, который нужно восстановить
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:8, maxHeight:"48vh", overflowY:"auto" }}>
        {candidates.map(c => (
          <motion.button key={c.key}
            onClick={() => onPick(c.key)}
            style={{ width:"100%", textAlign:"left",
              padding:"11px 12px", borderRadius:12, cursor:"pointer",
              background:T.s2, border:`1px solid ${T.border}`,
              color:T.hi, display:"flex", alignItems:"center", gap:10 }}
            whileHover={{ borderColor:T.borderHi }}
            whileTap={{ scale:0.98 }}>
            <div style={{ width:8, height:8, borderRadius:"50%",
              background:T.gold, boxShadow:`0 0 10px ${T.goldGlow}`, flexShrink:0 }}/>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, color:T.hi, marginBottom:2 }}>{formatDate(c.key)}</div>
              <div style={{ fontSize:10, color:T.lo, fontFamily:"monospace" }}>
                {c.done}/{c.total} привычек · {Math.round(c.fraction * 100)}%
              </div>
            </div>
            <div style={{ fontSize:10, color:pColor.main, fontFamily:"monospace",
              letterSpacing:"0.05em" }}>
              ВОССТАНОВИТЬ
            </div>
          </motion.button>
        ))}
      </div>
      <div style={{ height:8 }}/>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════════
function Dashboard({ protocols: protos, setProtocols: setProtos, onOverlay }) {
  const [showAdd,    setShowAdd]    = useState(false);
  const [detailId,   setDetailId]   = useState(null);
  const [kintsugiId, setKintsugiId] = useState(null);

  const hasOverlay = showAdd || !!detailId || !!kintsugiId;
  useEffect(() => {
    onOverlay?.(hasOverlay);
  }, [hasOverlay, onOverlay]);
  const [toast,      setToast]      = useState(null);

  const toast$ = msg => { setToast(msg); setTimeout(() => setToast(null), 2400); };
  const todayKey = today();
  const canAddProtocol = protos.length < MAX_PROTOCOLS;

  useEffect(() => {
    const tg = getTelegramWebApp();
    if (!tg?.BackButton) return;
    const onBack = () => {
      if (showAdd) setShowAdd(false);
      else if (kintsugiId) setKintsugiId(null);
      else if (detailId) setDetailId(null);
    };

    if (showAdd || detailId || kintsugiId) {
      tg.BackButton.show();
      tg.BackButton.onClick(onBack);
    } else {
      tg.BackButton.hide();
    }

    return () => {
      tg.BackButton.offClick(onBack);
      if (!(showAdd || detailId || kintsugiId)) tg.BackButton.hide();
    };
  }, [showAdd, detailId, kintsugiId]);
  const upd = (pid, fn) => setProtos(ps => ps.map(p => p.id !== pid ? p : fn(p)));

  const completeHabit = (pid, hid) => {
    upd(pid, p => {
      const logs = { ...p.logs };
      logs[todayKey] = { ...(logs[todayKey] || {}), [hid]: true };
      return { ...p, logs };
    });
    toast$("Выполнено");
  };

  const undoHabit = (pid, hid) => {
    upd(pid, p => {
      const logs = { ...p.logs };
      logs[todayKey] = { ...(logs[todayKey] || {}), [hid]: false };
      return { ...p, logs };
    });
  };

  const addHabit = (pid, name) => {
    upd(pid, p => ({ ...p,
      habits: [...p.habits, { id:uid(), name, startDate:todayKey, archivedAt:null }]
    }));
  };

  const removeHabit = (pid, hid) => {
    upd(pid, p => ({
      ...p,
      habits: p.habits.map(h => h.id !== hid ? h : { ...h, archivedAt: todayKey }),
    }));
    toast$("Привычка архивирована");
  };

  const removeProto = (pid) => {
    const proto = protos.find(p => p.id === pid);
    const name = proto?.name || "этот протокол";
    if (!window.confirm(`Удалить протокол "${name}"?`)) return;
    setProtos(ps => ps.filter(p => p.id !== pid));
    toast$("Протокол удален");
  };

  const renameProto = (pid, name) => upd(pid, p => ({ ...p, name }));

  const openKintsugiPicker = (pid) => {
    const proto = protos.find(p => p.id === pid);
    if (!proto) return;
    if (getRepairableScars(proto).length === 0) {
      toast$("Нет пропущенных дней для восстановления");
      return;
    }
    setKintsugiId(pid);
  };

  const doKintsugi = (pid, dateKey = null) => {
    const proto = protos.find(p => p.id === pid);
    if (!proto) return;
    const candidates = getRepairableScars(proto);
    const targetDay = dateKey && candidates.some(c => c.key === dateKey)
      ? dateKey
      : candidates[0]?.key;
    if (!targetDay) {
      toast$("Нет пропущенных дней для восстановления");
      return;
    }
    upd(pid, p => ({
      ...p,
      kintsugi: p.kintsugi.includes(targetDay) ? p.kintsugi : [...p.kintsugi, targetDay],
    }));
    toast$(`⟡ Восстановлен день: ${formatDate(targetDay)}`);
    setKintsugiId(null);
  };

  const detailProto = protos.find(p => p.id === detailId);
  const kintsugiProto = protos.find(p => p.id === kintsugiId) || null;
  const kintsugiDays = kintsugiProto ? getRepairableScars(kintsugiProto) : [];

  const cV = { hidden:{}, visible:{ transition:{ staggerChildren:0.07, delayChildren:0.1 } } };
  const iV = { hidden:{ opacity:0, y:14 }, visible:{ opacity:1, y:0,
    transition:{ duration:0.4, ease:[0.16,1,0.3,1] } } };

  return (
    <>
      <div style={{ background:T.bg,
        display:"flex", flexDirection:"column", alignItems:"center" }}>
        <div style={{ width:"100%", maxWidth:430, display:"flex",
          flexDirection:"column" }}>

          {/* Date */}
          <div style={{ padding:"0 20px 8px" }}>
            <span style={{ fontSize:13, color:T.lo }}>
              {new Date().toLocaleDateString("ru-RU",
                { weekday:"long", day:"numeric", month:"long" })}
            </span>
          </div>

          {/* Rings */}
          <motion.div style={{ display:"flex", justifyContent:"center", padding:"4px 24px 8px" }}
            initial={{ opacity:0, scale:0.94 }} animate={{ opacity:1, scale:1 }}
            transition={{ duration:0.7, delay:0.1, ease:[0.16,1,0.3,1] }}>
            <BeamRings protocols={protos} onRingTap={id => setDetailId(id)}/>
          </motion.div>

          {/* Ring legend */}
          <motion.div style={{ display:"flex", justifyContent:"center",
            gap:12, padding:"0 0 12px", flexWrap:"wrap" }}
            initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.4 }}>
            {protos.slice(0,5).map(p => {
              const stats = calcStats(p);
              const pc    = getColor(p);
              return (
                <div key={p.id}
                  style={{ display:"flex", alignItems:"center", gap:4,
                    cursor:"pointer" }}
                  onClick={() => setDetailId(p.id)}>
                  <div style={{ width:16, height:"1.5px", background:pc.main,
                    opacity:0.5, borderRadius:1, flexShrink:0 }}/>
                  <span style={{ fontSize:9, color:T.lo, fontFamily:"monospace",
                    letterSpacing:"0.06em" }}>
                    {p.name.split(" ")[0].toUpperCase()}
                  </span>
                  {stats.currentStreak > 0 && (
                    <span style={{ fontSize:8, color:T.lo, fontFamily:"monospace" }}>
                      {stats.currentStreak}д
                    </span>
                  )}
                </div>
              );
            })}
          </motion.div>

          <div style={{ height:"0.5px", background:T.border, margin:"0 20px" }}/>

          {/* Protocol list */}
          <motion.div style={{ padding:"14px 20px 24px",
            display:"flex", flexDirection:"column", gap:0,
            overflow:"visible" }}
            variants={cV} initial="hidden" animate="visible">

            <motion.div variants={iV}
              style={{ display:"flex", alignItems:"center",
                justifyContent:"space-between", padding:"0 4px 12px" }}>
              <span style={{ fontFamily:"monospace", fontSize:10, color:T.lo,
                letterSpacing:"0.16em" }}>ПРОТОКОЛЫ</span>
              <motion.button onClick={() => {
                if (!canAddProtocol) {
                  toast$(`Лимит: ${MAX_PROTOCOLS} протоколов`);
                  return;
                }
                setShowAdd(true);
              }}
                style={{ display:"flex", alignItems:"center", gap:5,
                  padding:"4px 10px", borderRadius:8, border:`1px solid ${T.border}`,
                  background:"transparent",
                  color: canAddProtocol ? T.mid : T.lo,
                  fontSize:12,
                  cursor:"pointer",
                  opacity: canAddProtocol ? 1 : 0.55 }}
                whileHover={{ borderColor:T.borderHi, color:T.hi }}
                whileTap={{ scale:0.94 }}>
                <Plus size={12}/> протокол
              </motion.button>
            </motion.div>
            {!canAddProtocol && (
              <motion.div variants={iV}
                style={{ padding:"0 4px 12px", fontSize:11, color:T.lo,
                  fontFamily:"monospace", letterSpacing:"0.04em" }}>
                Лимит: {MAX_PROTOCOLS} протоколов
              </motion.div>
            )}

            {protos.map((proto, idx) => (
              <motion.div key={proto.id} variants={iV} layout>
                {idx > 0 && (
                  <div style={{ height:"0.5px", background:T.border,
                    margin:"8px 4px 16px" }}/>
                )}
                <ProtocolCard
                  proto={proto}
                  onComplete={hid => completeHabit(proto.id, hid)}
                  onUndo={hid => undoHabit(proto.id, hid)}
                  onAddHabit={name => addHabit(proto.id, name)}
                  onRemoveHabit={hid => removeHabit(proto.id, hid)}
                  onRemoveProtocol={() => removeProto(proto.id)}
                  onRenameProtocol={name => renameProto(proto.id, name)}
                  onKintsugi={() => openKintsugiPicker(proto.id)}
                  onOpenDetail={() => setDetailId(proto.id)}
                />
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Detail overlay */}
      <AnimatePresence>
        {detailProto && (
          <ProtocolDetail
            proto={detailProto}
            onBack={() => setDetailId(null)}
            onKintsugi={() => { openKintsugiPicker(detailProto.id); }}
          />
        )}
      </AnimatePresence>

      {/* Add sheet */}
      <AnimatePresence>
        {showAdd && (
          <>
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              style={{ position:"fixed", top:"var(--arc-frame-top, 0px)", left:"var(--arc-frame-left, 0px)",
                width:"var(--arc-frame-width, 100vw)", height:"var(--arc-frame-height, 100dvh)",
                background:"rgba(0,0,0,0.72)", zIndex:40 }}
              onClick={() => setShowAdd(false)}/>
            <motion.div
              initial={{ y:"100%" }} animate={{ y:0 }} exit={{ y:"100%" }}
              transition={{ duration:0.38, ease:[0.16,1,0.3,1] }}
              style={{ position:"fixed", bottom:"max(env(safe-area-inset-bottom), 0px)", left:"var(--arc-frame-left, 0px)",
                width:"var(--arc-frame-width, 100vw)",
                borderRadius:"20px 20px 0 0",
                background:T.s1, border:`1px solid ${T.border}`,
                zIndex:50, maxHeight:"75vh", overflowY:"auto" }}>
              <AddSheet
                existingNames={protos.map(p => p.name)}
                usedColors={protos.map(p => p.colorId)}
                onAdd={p => {
                  if (protos.length >= MAX_PROTOCOLS) {
                    toast$(`Лимит: ${MAX_PROTOCOLS} протоколов`);
                    setShowAdd(false);
                    return;
                  }
                  const normalized = normalizeProtocol(p);
                  setProtos(prev => [normalized, ...prev]);
                  toast$("Протокол создан");
                  setShowAdd(false);
                }}
                onClose={() => setShowAdd(false)}/>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Kintsugi day picker */}
      <AnimatePresence>
        {kintsugiProto && kintsugiDays.length > 0 && (
          <>
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              style={{ position:"fixed", top:"var(--arc-frame-top, 0px)", left:"var(--arc-frame-left, 0px)",
                width:"var(--arc-frame-width, 100vw)", height:"var(--arc-frame-height, 100dvh)",
                background:"rgba(0,0,0,0.72)", zIndex:120 }}
              onClick={() => setKintsugiId(null)}/>
            <motion.div
              initial={{ y:"100%" }} animate={{ y:0 }} exit={{ y:"100%" }}
              transition={{ duration:0.34, ease:[0.16,1,0.3,1] }}
              style={{ position:"fixed", bottom:"max(env(safe-area-inset-bottom), 0px)", left:"var(--arc-frame-left, 0px)",
                width:"var(--arc-frame-width, 100vw)",
                borderRadius:"20px 20px 0 0",
                background:T.s1, border:`1px solid ${T.border}`,
                zIndex:121 }}>
              <KintsugiSheet
                proto={kintsugiProto}
                candidates={kintsugiDays}
                onPick={(dateKey) => doKintsugi(kintsugiProto.id, dateKey)}
                onClose={() => setKintsugiId(null)}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity:0, y:18, scale:0.96 }}
            animate={{ opacity:1, y:0, scale:1 }}
            exit={{ opacity:0, y:10, scale:0.96 }}
            transition={{ duration:0.26, ease:[0.16,1,0.3,1] }}
            style={{ position:"fixed", bottom:36, left:"calc(var(--arc-frame-left, 0px) + (var(--arc-frame-width, 100vw) / 2))",
              transform:"translateX(-50%)", zIndex:60,
              padding:"10px 20px", borderRadius:12, whiteSpace:"nowrap",
              background:"#1C1C1C", border:`1px solid ${T.border}`,
              color:T.hi, fontSize:13,
              boxShadow:"0 16px 40px rgba(0,0,0,0.8)" }}>
            <span style={{ color:T.beam, marginRight:8, fontFamily:"monospace" }}>✦</span>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// SPARKLINE — tiny 7-day bar chart
// ═══════════════════════════════════════════════════════════════════════
function Sparkline({ values, width = 56, height = 22, color = T.beam }) {
  const max = Math.max(...values, 1);
  const bw  = (width - (values.length - 1) * 2) / values.length;
  return (
    <svg width={width} height={height} style={{ display:"block" }}>
      {values.map((v, i) => {
        const h = Math.max(2, (v / max) * height);
        return (
          <rect key={i}
            x={i * (bw + 2)} y={height - h} width={bw} height={h}
            rx={1.5}
            fill={color}
            opacity={v === 0 ? 0.12 : 0.15 + (v / max) * 0.75}
          />
        );
      })}
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ANALYTICS SCREEN
// ═══════════════════════════════════════════════════════════════════════
function AnalyticsScreen({ protocols }) {
  const [selected, setSelected] = useState(null);

  const todayKey = today();

  // Overall stats across all protocols
  const allStats = protocols.map(p => ({ proto: p, stats: calcStats(p) }));

  // Total habits done today
  const totalDoneToday = protocols.reduce((sum, p) => {
    const dl = p.logs[todayKey] || {};
    return sum + activeHabitsOn(p, todayKey).filter(h => dl[h.id]).length;
  }, 0);
  const totalHabits = protocols.reduce((s, p) => s + activeHabitsOn(p, todayKey).length, 0);

  // Best streak across all
  const bestStreak = Math.max(...allStats.map(x => x.stats.bestStreak), 0);
  const bestProto  = allStats.find(x => x.stats.bestStreak === bestStreak)?.proto;

  // 7-day completion rate per day
  const weekData = Array.from({ length: 7 }, (_, i) => {
    const key = daysAgo(6 - i);
    let done = 0, total = 0;
    protocols.forEach(p => {
      const dl = p.logs[key] || {};
      const startDays = daysBetween(p.startDate, todayKey);
      const daysBack  = daysBetween(key, todayKey);
      if (daysBack > startDays) return;
      activeHabitsOn(p, key).forEach(h => {
        total++;
        if (dl[h.id]) done++;
      });
    });
    return total > 0 ? Math.round((done / total) * 100) : 0;
  });

  // 28-day heatmap across all protocols
  const globalFrac = (dateKey) => {
    let done = 0, total = 0;
    protocols.forEach(p => {
      const startDays = daysBetween(p.startDate, todayKey);
      const daysBack  = daysBetween(dateKey, todayKey);
      if (daysBack > startDays) return;
      const dl = p.logs[dateKey] || {};
      activeHabitsOn(p, dateKey).forEach(h => { total++; if (dl[h.id]) done++; });
    });
    return total > 0 ? done / total : -1; // -1 = no data
  };

  const Rule = ({ mt = 24, mb = 20 }) => (
    <div style={{ height:"0.5px", background:T.border, margin:`${mt}px 0 ${mb}px` }}/>
  );

  const sL = { fontSize:10, fontFamily:"monospace", color:T.lo,
    letterSpacing:"0.16em", marginBottom:14 };

  const weekDays = ["ПН","ВТ","СР","ЧТ","ПТ","СБ","ВС"];
  // weekDays aligned to last 7 days
  const weekLabels = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    return weekDays[(d.getDay() + 6) % 7]; // Mon=0
  });

  return (
    <div style={{ background:T.bg,
      display:"flex", flexDirection:"column", alignItems:"center",
      paddingBottom:24 }}>
      <div style={{ width:"100%", maxWidth:430, padding:"52px 20px 0" }}>

        {/* Title */}
        <div style={{ marginBottom:28 }}>
          <div style={{ fontSize:22, fontWeight:700, color:T.hi, marginBottom:4 }}>
            Аналитика
          </div>
          <div style={{ fontSize:12, color:T.lo }}>
            {new Date().toLocaleDateString("ru-RU",
              { day:"numeric", month:"long", year:"numeric" })}
          </div>
        </div>

        {/* ── Top numbers ── */}
        <div style={{ display:"flex", gap:0, marginBottom:4 }}>
          {[
            { v: `${totalDoneToday}/${totalHabits}`, l:"сегодня",  accent: totalDoneToday === totalHabits && totalHabits > 0 },
            { v: `${Math.round((totalDoneToday/Math.max(totalHabits,1))*100)}%`, l:"выполнено" },
            { v: bestStreak, l:"лучшая серия", sub: bestProto?.name },
            { v: protocols.length, l:"протоколов" },
          ].map((s, i) => (
            <div key={i} style={{ flex:1, textAlign:"center",
              borderLeft: i > 0 ? `1px solid ${T.border}` : "none",
              padding:"0 6px" }}>
              <div style={{ fontSize:22, fontWeight:700, fontFamily:"monospace",
                color: s.accent ? T.beam : T.hi, lineHeight:1,
                filter: s.accent ? `drop-shadow(0 0 8px ${T.beamGlow})` : "none" }}>
                {s.v}
              </div>
              <div style={{ fontSize:9, color:T.lo, marginTop:4, letterSpacing:"0.06em" }}>
                {s.l}
              </div>
              {s.sub && (
                <div style={{ fontSize:9, color:T.lo, opacity:0.6, marginTop:1 }}>
                  {s.sub}
                </div>
              )}
            </div>
          ))}
        </div>

        <Rule mt={24} mb={22}/>

        {/* ── 7-day bar chart ── */}
        <div style={sL}>ПОСЛЕДНИЕ 7 ДНЕЙ</div>
        <div style={{ display:"flex", alignItems:"flex-end", gap:6 }}>
          {weekData.map((v, i) => {
            const isToday = i === 6;
            const barH = Math.max(4, (v / 100) * 80);
            return (
              <div key={i} style={{ flex:1, display:"flex", flexDirection:"column",
                alignItems:"center", gap:6 }}>
                <div style={{ fontSize:9, fontFamily:"monospace",
                  color: v > 0 ? T.mid : T.lo }}>
                  {v > 0 ? `${v}%` : "—"}
                </div>
                <motion.div
                  style={{ width:"100%", borderRadius:3,
                    background: isToday ? T.beam : T.beam,
                    opacity: isToday ? (0.2 + (v/100)*0.8) : (0.08 + (v/100)*0.55) }}
                  initial={{ height:0 }}
                  animate={{ height:barH }}
                  transition={{ duration:0.6, delay:i*0.05, ease:[0.16,1,0.3,1] }}/>
                <div style={{ fontSize:9, color:T.lo }}>{weekLabels[i]}</div>
              </div>
            );
          })}
        </div>

        <Rule mt={28} mb={22}/>

        {/* ── Global heatmap ── */}
        <div style={sL}>28 ДНЕЙ — ВСЕ ПРОТОКОЛЫ</div>
        {(() => {
          const CELL = 22, GAP = 3, COLS = 7, ROWS = 4;
          const W = COLS*(CELL+GAP), H = ROWS*(CELL+GAP);
          const cells = Array.from({ length: ROWS*COLS }, (_, i) => {
            const dBack = ROWS*COLS - 1 - i;
            const key   = daysAgo(dBack);
            const frac  = globalFrac(key);
            return { key, frac, isToday: key === todayKey };
          });
          return (
            <svg width={W} height={H + 18} style={{ display:"block" }}>
              {["П","В","С","Ч","П","С","В"].map((d,i) => (
                <text key={i} x={i*(CELL+GAP)+CELL/2} y={H+14}
                  textAnchor="middle"
                  style={{ fontSize:8, fill:T.lo, fontFamily:"monospace" }}>{d}</text>
              ))}
              {cells.map((c, i) => {
                const col = Math.floor(i / COLS);
                const row = i % COLS;
                const x = row*(CELL+GAP), y = col*(CELL+GAP);
                const fill    = c.frac < 0 ? T.s2
                              : c.frac === 0 ? T.scar : T.beam;
                const opacity = c.frac < 0 ? 0.3
                              : c.frac === 0 ? 0.3
                              : 0.12 + c.frac * 0.78;
                return (
                  <g key={i}>
                    <rect x={x} y={y} width={CELL} height={CELL}
                      rx={4} fill={fill} opacity={opacity}/>
                    {c.isToday && (
                      <rect x={x} y={y} width={CELL} height={CELL}
                        rx={4} fill="none" stroke={T.beam} strokeWidth="1" opacity="0.5"/>
                    )}
                  </g>
                );
              })}
            </svg>
          );
        })()}

        <Rule mt={28} mb={22}/>

        {/* ── Per-protocol breakdown ── */}
        <div style={sL}>ПРОТОКОЛЫ</div>
        {allStats.map(({ proto: p, stats: s }, idx) => {
          const isOpen = selected === p.id;
          // 7-day sparkline per protocol
          const spark7 = Array.from({ length: 7 }, (_, i) => {
            const key = daysAgo(6 - i);
            return dayFraction(p, key);
          });

          return (
            <div key={p.id}>
              {idx > 0 && <div style={{ height:"0.5px", background:T.border, margin:"14px 0" }}/>}

              {/* Row */}
              <motion.div
                onClick={() => setSelected(isOpen ? null : p.id)}
                style={{ cursor:"pointer", display:"flex",
                  alignItems:"center", gap:12, padding:"4px 0" }}
                whileTap={{ opacity:0.7 }}>

                {/* Name + date */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:15, fontWeight:600,
                    color: s.currentStreak > 0 ? T.hi : T.mid,
                    marginBottom:2 }}>
                    {p.name}
                  </div>
                  <div style={{ fontSize:10, color:T.lo, fontFamily:"monospace" }}>
                    с {formatDate(p.startDate)}
                  </div>
                </div>

                {/* Sparkline */}
                <Sparkline values={spark7} width={52} height={20}
                  color={s.currentStreak > 0 ? T.beam : T.mid}/>

                {/* Rate */}
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <div style={{ fontSize:16, fontWeight:700,
                    fontFamily:"monospace",
                    color: s.rate > 80 ? T.beam : s.rate > 50 ? T.mid : T.lo }}>
                    {s.rate}%
                  </div>
                  {s.currentStreak > 0 && (
                    <div style={{ fontSize:9, color:T.lo }}>
                      🔥 {s.currentStreak}д
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Expanded: per-habit breakdown */}
              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height:0, opacity:0 }}
                    animate={{ height:"auto", opacity:1 }}
                    exit={{ height:0, opacity:0 }}
                    transition={{ duration:0.3, ease:[0.16,1,0.3,1] }}
                    style={{ overflow:"hidden" }}>
                    <div style={{ paddingTop:12, paddingLeft:4 }}>
                      {/* Progress bar */}
                      <div style={{ height:2, background:T.border,
                        borderRadius:1, overflow:"hidden", marginBottom:14 }}>
                        <motion.div style={{ height:"100%", borderRadius:1,
                          background:`linear-gradient(90deg,${T.beam}50,${T.beam})` }}
                          initial={{ width:0 }}
                          animate={{ width:`${s.rate}%` }}
                          transition={{ duration:0.8, ease:[0.16,1,0.3,1] }}/>
                      </div>

                      {/* Mini stats */}
                      <div style={{ display:"flex", gap:20, marginBottom:14 }}>
                        {[
                          { l:"серия",    v:`${s.currentStreak}д` },
                          { l:"рекорд",   v:`${s.bestStreak}д` },
                          { l:"выполнено",v:`${s.completedDays}д` },
                          { l:"пропущено",v:`${s.missedDays}д` },
                        ].map(x => (
                          <div key={x.l}>
                            <div style={{ fontSize:13, fontWeight:600,
                              fontFamily:"monospace", color:T.mid }}>{x.v}</div>
                            <div style={{ fontSize:9, color:T.lo, marginTop:1 }}>{x.l}</div>
                          </div>
                        ))}
                      </div>

                      {/* Per-habit streaks */}
                      {activeHabitsOn(p, todayKey).map(h => {
                        let hStreak = 0;
                        for (let d = 1; d <= 28; d++) {
                          const k = daysAgo(d);
                          if (!isHabitActiveOn(h, k)) break;
                          if (p.logs[k]?.[h.id]) hStreak++;
                          else break;
                        }
                        const todayDone = (p.logs[todayKey] || {})[h.id];
                        const hSpark = Array.from({ length: 14 }, (_, i) => {
                          const k = daysAgo(13 - i);
                          return (p.logs[k]?.[h.id] ? 1 : 0);
                        });
                        return (
                          <div key={h.id} style={{ display:"flex",
                            alignItems:"center", gap:10,
                            padding:"7px 0",
                            borderTop:`1px solid ${T.border}` }}>
                            <div style={{ width:5, height:5, borderRadius:"50%",
                              flexShrink:0,
                              background: todayDone ? T.beam : T.border,
                              boxShadow: todayDone ? `0 0 5px ${T.beamGlow}` : "none" }}/>
                            <span style={{ flex:1, fontSize:13, color:T.mid }}>
                              {h.name}
                            </span>
                            <Sparkline values={hSpark} width={44} height={14}/>
                            <span style={{ fontSize:10, fontFamily:"monospace",
                              color: hStreak > 0 ? T.mid : T.lo,
                              minWidth:22, textAlign:"right" }}>
                              {hStreak > 0 ? `${hStreak}д` : "—"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// TAB BAR
// ═══════════════════════════════════════════════════════════════════════
function TabBar({ tab, onTab }) {
  const tabs = [
    { id:"dash", label:"Сегодня", icon:(
      <svg viewBox="0 0 20 20" fill="none" width="20" height="20">
        <rect x="3" y="4" width="14" height="13" rx="3" stroke="currentColor" strokeWidth="1.3"/>
        <line x1="3" y1="8" x2="17" y2="8" stroke="currentColor" strokeWidth="1.3"/>
        <line x1="7" y1="2.5" x2="7" y2="6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        <line x1="13" y1="2.5" x2="13" y2="6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        <circle cx="10" cy="12.2" r="1.4" fill="currentColor"/>
      </svg>
    )},
    { id:"analytics",label:"Аналитика",icon:(
      <svg viewBox="0 0 20 20" fill="none" width="20" height="20">
        <rect x="2" y="12" width="3" height="6" rx="1" fill="currentColor" opacity="0.9"/>
        <rect x="7" y="7"  width="3" height="11" rx="1" fill="currentColor" opacity="0.9"/>
        <rect x="12" y="9" width="3" height="9"  rx="1" fill="currentColor" opacity="0.9"/>
        <rect x="17" y="4" width="3" height="14" rx="1" fill="currentColor" opacity="0.9"/>
      </svg>
    )},
  ];

  return (
    <div style={{
      width:"100%",
      display:"flex",
      justifyContent:"center",
      padding:"8px 12px 10px",
      pointerEvents:"auto",
    }}>
      <div style={{
        width:"min(360px, 100%)",
        display:"flex",
        alignItems:"center",
        gap:6,
        padding:"8px",
        borderRadius:24,
        border:`1px solid ${T.borderHi}`,
        background:"rgba(20,20,20,0.72)",
        backdropFilter:"blur(16px) saturate(135%)",
        WebkitBackdropFilter:"blur(16px) saturate(135%)",
        boxShadow:"0 10px 28px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)",
      }}>
        {tabs.map(t => {
          const active = tab === t.id;
          return (
            <motion.button key={t.id}
              onClick={() => onTab(t.id)}
              style={{
                flex:1,
                display:"flex",
                flexDirection:"column",
                alignItems:"center",
                gap:4,
                padding:"7px 8px",
                borderRadius:16,
                border: active ? `1px solid ${T.borderHi}` : "1px solid transparent",
                background: active ? "rgba(237,232,224,0.10)" : "transparent",
                cursor:"pointer",
                color: active ? T.hi : T.lo,
                transition:"all 0.2s",
              }}
              whileTap={{ scale:0.94 }}>
              {t.icon}
              <span style={{ fontSize:10, fontFamily:"monospace",
                letterSpacing:"0.06em",
                filter: active ? `drop-shadow(0 0 6px ${T.beamGlow})` : "none" }}>
                {t.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ROOT
// ═══════════════════════════════════════════════════════════════════════
export default function Arc() {
  const [tab, setTab] = useState("dash");
  // Lift protocols state so Analytics can read same data
  const [protos, setProtos] = useState(loadProtocols);
  const userEditedRef = useRef(false);
  const pbHydratedRef = useRef(false);
  const [pbAuth, setPbAuth] = useState(loadPocketBaseAuth);
  const [pbReady, setPbReady] = useState(!PB_URL);
  const [storageReady, setStorageReady] = useState(false);
  const [viewport, setViewport] = useState(() => {
    if (typeof window === "undefined") return { height: 800, top: 0, width: 430, left: 0 };
    const vv = window.visualViewport;
    return {
      height: Math.max(320, Math.round(vv?.height || window.innerHeight)),
      top: Math.max(0, Math.round(vv?.offsetTop || 0)),
      width: Math.max(320, Math.round(vv?.width || window.innerWidth)),
      left: Math.max(0, Math.round(vv?.offsetLeft || 0)),
    };
  });
  const [tgSafeArea, setTgSafeArea] = useState({ top: 0, bottom: 0 });
  const [overlayOpen, setOverlayOpen] = useState(false);

  useEffect(() => {
    const tg = getTelegramWebApp();
    if (!tg) return;
    const update = () => {
      const sa = tg.safeAreaInset || {};
      const csa = tg.contentSafeAreaInset || {};
      setTgSafeArea({
        top: (sa.top || 0) + (csa.top || 0),
        bottom: (sa.bottom || 0) + (csa.bottom || 0),
      });
    };
    update();
    tg.onEvent?.("safeAreaChanged", update);
    tg.onEvent?.("contentSafeAreaChanged", update);
    return () => {
      tg.offEvent?.("safeAreaChanged", update);
      tg.offEvent?.("contentSafeAreaChanged", update);
    };
  }, []);

  const safeBottom = tgSafeArea.bottom ? `${tgSafeArea.bottom}px` : "max(env(safe-area-inset-bottom), 0px)";
  const safeTop = tgSafeArea.top ? `${tgSafeArea.top}px` : "max(env(safe-area-inset-top), 0px)";
  const HEADER_H = 68;
  const TABBAR_H = 88;
  const FRAME_W = "min(430px, 100vw)";
  const frameWidth = Math.min(430, viewport.width);
  const frameLeft = Math.max(0, Math.round(viewport.left + (viewport.width - frameWidth) / 2));

  useEffect(() => {
    const tg = getTelegramWebApp();
    if (!tg) return;
    tg.ready();
    tg.expand();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    const syncViewport = () => {
      const next = {
        height: Math.max(320, Math.round(vv?.height || window.innerHeight)),
        top: Math.max(0, Math.round(vv?.offsetTop || 0)),
        width: Math.max(320, Math.round(vv?.width || window.innerWidth)),
        left: Math.max(0, Math.round(vv?.offsetLeft || 0)),
      };
      setViewport(prev => (
        prev.height === next.height &&
        prev.top === next.top &&
        prev.width === next.width &&
        prev.left === next.left
          ? prev
          : next
      ));
    };
    syncViewport();
    window.addEventListener("resize", syncViewport);
    window.addEventListener("orientationchange", syncViewport);
    vv?.addEventListener("resize", syncViewport);
    vv?.addEventListener("scroll", syncViewport);
    return () => {
      window.removeEventListener("resize", syncViewport);
      window.removeEventListener("orientationchange", syncViewport);
      vv?.removeEventListener("resize", syncViewport);
      vv?.removeEventListener("scroll", syncViewport);
    };
  }, []);

  useEffect(() => {
    if (!PB_URL) return;
    let active = true;
    (async () => {
      const initData = getTelegramInitData();
      const freshAuth = await authPocketBaseWithTelegram(initData);
      if (!active) return;
      if (freshAuth) {
        setPbAuth(freshAuth);
        savePocketBaseAuth(freshAuth);
      }
      setPbReady(true);
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!pbReady || !pbAuth?.token) return;
    let active = true;
    (async () => {
      const pbState = await loadProtocolsFromPocketBase(pbAuth.token);
      if (!active) return;
      if (pbState.unauthorized) {
        setPbAuth(null);
        savePocketBaseAuth(null);
        return;
      }
      if (pbState.protocols && !userEditedRef.current) {
        pbHydratedRef.current = true;
        setProtos(pbState.protocols);
      }
    })();
    return () => { active = false; };
  }, [pbReady, pbAuth?.token]);

  useEffect(() => {
    let active = true;
    (async () => {
      const fromCloud = await loadProtocolsFromCloudStorage();
      if (!active) return;
      if (fromCloud && !userEditedRef.current && !pbHydratedRef.current) setProtos(fromCloud);
      setStorageReady(true);
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    void persistProtocols(protos);
    if (!pbReady || !pbAuth?.token) return;
    let active = true;
    (async () => {
      const result = await persistProtocolsToPocketBase(pbAuth.token, protos);
      if (!active) return;
      if (result.unauthorized) {
        setPbAuth(null);
        savePocketBaseAuth(null);
      }
    })();
    return () => { active = false; };
  }, [protos, storageReady, pbReady, pbAuth?.token]);

  // Global integrity for fixed header
  const todayKey = today();
  const allH   = protos.flatMap(p => activeHabitsOn(p, todayKey));
  const doneH  = protos.flatMap(p => {
    const dl = p.logs[todayKey] || {};
    return activeHabitsOn(p, todayKey).filter(h => dl[h.id]);
  }).length;
  const integ  = allH.length ? Math.round((doneH / allH.length) * 100) : 0;
  const setProtosFromUser = useCallback((updater) => {
    userEditedRef.current = true;
    setProtos(updater);
  }, []);

  return (
    <div style={{ fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      "--arc-frame-top": `${viewport.top}px`,
      "--arc-frame-height": `${viewport.height}px`,
      "--arc-frame-left": `${frameLeft}px`,
      "--arc-frame-width": `${frameWidth}px`,
      position:"fixed", top:viewport.top, left:0, right:0,
      height:`min(100dvh, ${viewport.height}px)`,
      background:T.bg,
      overflow:"hidden" }}>
      <div style={{ width:FRAME_W, height:"100%", margin:"0 auto",
        background:T.bg, borderLeft:`1px solid ${T.border}`, borderRight:`1px solid ${T.border}`,
        display:"flex", flexDirection:"column", overflow:"hidden", position:"relative" }}>
        {/* Header overlay (fixed and truly transparent) */}
        <div style={{ position:"absolute", top:0, left:0, right:0, zIndex:20, pointerEvents:"none",
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:`calc(8px + ${safeTop}) 20px 8px`,
          background:"transparent" }}>
          <ArcMark size="sm"/>
          <div style={{ textAlign:"right", pointerEvents:"auto" }}>
            <div style={{ fontSize:11, color:T.lo, marginBottom:2 }}>сегодня</div>
            <div style={{ fontFamily:"monospace", fontSize:24, fontWeight:600,
              color: integ > 80 ? T.beam : T.mid }}>
              {integ}%
            </div>
          </div>
        </div>

        {/* Single scroll container */}
        <div style={{ flex:1, minHeight:0, overflowY:"auto",
          overscrollBehavior:"none", WebkitOverflowScrolling:"touch",
          paddingTop:`calc(${HEADER_H}px + ${safeTop})`,
          paddingBottom:`calc(${TABBAR_H}px + ${safeBottom} + 12px)` }}>
        {tab === "dash" ? (
          <Dashboard key="dash" protocols={protos} setProtocols={setProtosFromUser} onOverlay={setOverlayOpen}/>
        ) : (
          <AnalyticsScreen key="analytics" protocols={protos}/>
        )}
        </div>

        {/* Tabbar overlay (no background block) */}
        {!overlayOpen && (
          <div style={{ position:"absolute", left:0, right:0, bottom:0, zIndex:21,
            background:"transparent",
            paddingBottom:safeBottom,
            pointerEvents:"none",
            display:"flex", alignItems:"flex-end" }}>
            <TabBar tab={tab} onTab={setTab}/>
          </div>
        )}
      </div>
    </div>
  );
}
