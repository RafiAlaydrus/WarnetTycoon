(() => {
'use strict';

const DEBUG = /[?&]debug=1\b/.test(location.search);
const SPEED = DEBUG ? 10 : 1;
const SAVE_KEY = 'warnet-tycoon-save-v1';
const HOUR_SEC = 12.5;
const OPEN_HOUR = 7;
// Closed hours (00-07) run 3x faster so a full day is about 4 real minutes.
const DAY_SEC = 17 * HOUR_SEC + (7 * HOUR_SEC) / 3;
const QUEUE_MAX = 8;
const OFFLINE_EFF = 0.5;
const GROWTH = 1.15;
const PRESTIGE_T = 28e6;


const TYPES = [
  { id: 'pel', name: 'Pelajar', tag: 'P', col: '#6aa7ff', minSpec: 1, hrs: [0.8, 1.5], pay: 0.8, fair: 3000, bw: 1.5, app: 0.8, pat: 30, peak: 0.17, prio: 0, prem: false },
  { id: 'gam', name: 'Gamer', tag: 'G', col: '#ff7b7b', minSpec: 3, hrs: [2, 4.5], pay: 1.2, fair: 4500, bw: 3, app: 1.3, pat: 40, peak: 0.12, prio: 2, prem: true },
  { id: 'pek', name: 'Pekerja', tag: 'K', col: '#8fd16b', minSpec: 1, hrs: [0.7, 2], pay: 1, fair: 4000, bw: 1, app: 0.9, pat: 22, peak: 0.14, prio: 1, prem: false },
  { id: 'str', name: 'Streamer', tag: 'S', col: '#c78bff', minSpec: 5, hrs: [3, 6], pay: 1.3, fair: 7000, bw: 15, app: 1, pat: 50, peak: 0.02, prio: 3, prem: true },
];

// Arrival weight per clock hour, 0..1, for each customer type.
const W = {
  pel: [0, 0, 0, 0, 0, 0, 0, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.3, 0.8, 1, 1, 1, 0.5, 0.5, 0.3, 0.1, 0, 0],
  gam: [0.7, 0.6, 0.4, 0.1, 0, 0, 0, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.2, 0.4, 0.5, 0.7, 1, 1, 1, 1, 0.9],
  pek: [0, 0, 0, 0, 0, 0, 0, 0.4, 1, 1, 1, 1, 1.4, 1.2, 1, 1, 1, 0.8, 0.2, 0.1, 0, 0, 0, 0],
  str: [0.4, 0.3, 0.1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.2, 0.4, 0.6, 0.8, 1, 1, 1, 1, 1, 0.8],
};

const TIERS = [
  { name: 'Bekas Pentium', spec: 1, mult: 0.75, heat: 1.0, brk: 0.006, cost: 10000 },
  { name: 'Office PC', spec: 2, mult: 1.0, heat: 1.2, brk: 0.004, cost: 48000 },
  { name: 'Gaming Mid', spec: 3, mult: 1.6, heat: 2.0, brk: 0.003, cost: 200000 },
  { name: 'Gaming High', spec: 4, mult: 2.4, heat: 3.0, brk: 0.0025, cost: 880000 },
  { name: 'RTX Rig', spec: 5, mult: 3.6, heat: 4.5, brk: 0.002, cost: 3600000 },
  { name: 'Streaming Booth', spec: 6, mult: 5.0, heat: 5.5, brk: 0.002, cost: 13000000 },
];

const PLANS = [
  { name: 'Home 8 Mbps', mbps: 8, cost: 0 },
  { name: 'Business 20 Mbps', mbps: 20, cost: 25000 },
  { name: 'Dedicated 50 Mbps', mbps: 50, cost: 140000 },
  { name: 'Fiber 100 Mbps', mbps: 100, cost: 720000 },
  { name: 'Fiber 300 Mbps', mbps: 300, cost: 3600000 },
  { name: 'Fiber 1 Gbps', mbps: 1000, cost: 18000000 },
];

// aff: appetite multiplier per customer type [pel, gam, pek, str].
const ITEMS = [
  { id: 'esteh', name: 'Es Teh', price: 3000, rate: 0.25, unlock: 3000, up: 5000, aff: [1.4, 1, 0.8, 1] },
  { id: 'gorengan', name: 'Gorengan', price: 2500, rate: 0.22, unlock: 6000, up: 8000, aff: [1.2, 1, 1, 0.8] },
  { id: 'kopi', name: 'Kopi', price: 5000, rate: 0.2, unlock: 12000, up: 18000, aff: [0.4, 1, 1.7, 1.2] },
  { id: 'indomie', name: 'Indomie', price: 9000, rate: 0.18, unlock: 28000, up: 36000, aff: [1, 1.6, 0.7, 1.2] },
];
const SNACK_MAX = 5;

const STAFF = [
  { id: 'op', name: 'Operator', wage: 3000, desc: 'Seats the queue at once. Puts gamers on your best PCs and everyone else on the cheapest.' },
  { id: 'tech', name: 'Teknisi', wage: 4000, desc: 'Repairs broken PCs for free, a few seconds after they break.' },
  { id: 'sell', name: 'Penjual', wage: 3000, desc: 'Runs the snack counter, so orders are served without a tap.' },
  { id: 'clean', name: 'Cleaner', wage: 2500, desc: 'Reputation decays 60% slower.' },
];

const ROOM_COST = [48000, 360000, 2400000, 12000000];
const PRINT = [0, 2000, 4000, 8000];
const PRINT_COST = [16000, 120000, 800000];
const SIGN_COST = [32000, 240000, 1600000];
const VAULT_H = [2, 3, 4, 6, 8];
const VAULT_COST = [60000, 320000, 1600000, 8000000];
const FAN_MAX = 6;
const AC_MAX = 4;
const GENSET_COST = 100000;
const NIGHT_COST = 200000;
const STREAM_COST = 2400000;

const ACH_KEY = { inc: 'income', arr: 'customers', pat: 'patience', cool: 'cooling', bw: 'bandwidth' };
const ACH = [
  { id: 'first', name: 'First Customer', desc: 'Serve 1 customer', t: (s) => s.stats.served >= 1, k: 'inc', v: 0.01 },
  { id: 'busy', name: 'Open House', desc: 'Serve 50 customers', t: (s) => s.stats.served >= 50, k: 'arr', v: 0.02 },
  { id: 'regular', name: 'Regulars', desc: 'Serve 300 customers', t: (s) => s.stats.served >= 300, k: 'arr', v: 0.03 },
  { id: 'jt1', name: 'First Million', desc: 'Earn Rp 1 Jt in total', t: (s) => s.life >= 1e6, k: 'inc', v: 0.02 },
  { id: 'jt100', name: 'Hundred Million', desc: 'Earn Rp 100 Jt in total', t: (s) => s.life >= 1e8, k: 'inc', v: 0.03 },
  { id: 'm1', name: 'Billionaire', desc: 'Earn Rp 1 M in total', t: (s) => s.life >= 1e9, k: 'inc', v: 0.05 },
  { id: 'pc6', name: 'Six Desks', desc: 'Own 6 PCs at once', t: (s) => s.stats.maxPcs >= 6, k: 'sat', v: 1 },
  { id: 'pc12', name: 'Twelve Desks', desc: 'Own 12 PCs at once', t: (s) => s.stats.maxPcs >= 12, k: 'sat', v: 2 },
  { id: 'star3', name: 'Three Stars', desc: 'Reach a 3.0 reputation', t: (s) => s.stats.maxRep >= 3, k: 'arr', v: 0.01 },
  { id: 'star4', name: 'Four Stars', desc: 'Reach a 4.0 reputation', t: (s) => s.stats.maxRep >= 4, k: 'arr', v: 0.03 },
  { id: 'fix10', name: 'Handyman', desc: 'Repair 10 PCs by hand', t: (s) => s.stats.fixed >= 10, k: 'pat', v: 0.03 },
  { id: 'fix50', name: 'Master Fixer', desc: 'Repair 50 PCs by hand', t: (s) => s.stats.fixed >= 50, k: 'pat', v: 0.05 },
  { id: 'snack50', name: 'Snack Rush', desc: 'Sell 50 snacks', t: (s) => s.stats.snacks >= 50, k: 'inc', v: 0.01 },
  { id: 'menu', name: 'Full Menu', desc: 'Sell all four snacks', t: (s) => ITEMS.every((it) => s.snack[it.id][0] > 0), k: 'inc', v: 0.02 },
  { id: 'gen3', name: 'Genset Hero', desc: 'Start the genset by hand 3 times', t: (s) => s.stats.gens >= 3, k: 'pat', v: 0.03 },
  { id: 'fiber', name: 'Fast Lane', desc: 'Buy the Fiber 100 Mbps plan', t: (s) => s.net >= 3, k: 'bw', v: 0.05 },
  { id: 'ac', name: 'Cold Room', desc: 'Install an AC', t: (s) => s.ac >= 1, k: 'cool', v: 0.05 },
  { id: 'crew', name: 'Full Crew', desc: 'Hire all four staff', t: (s) => STAFF.every((x) => s.staff[x.id]), k: 'inc', v: 0.03 },
  { id: 'gam100', name: 'Gamer Nation', desc: 'Serve 100 gamers', t: (s) => s.stats.gam >= 100, k: 'inc', v: 0.02 },
  { id: 'stage', name: 'Main Stage', desc: 'Serve your first streamer', t: (s) => s.stats.str >= 1, k: 'inc', v: 0.02 },
  { id: 'branch', name: 'Franchise Owner', desc: 'Open a branch', t: (s) => s.prestiges >= 1, k: 'arr', v: 0.05 },
  { id: 'haul', name: 'Long Haul', desc: 'Play for 2 hours in total', t: (s) => s.playSec >= 7200, k: 'inc', v: 0.02 },
];

const EVENTS = {
  rel: { name: 'New game release', text: 'Gamers arrive twice as often.', dur: 60 },
  rain: { name: 'Heavy rain', text: 'More walk-ins and more snack orders.', dur: 75 },
  exam: { name: 'Exam week', text: 'Pelajar mostly stay home today.', dur: DAY_SEC },
};

const TIPS = [
  'Customers take a free PC and pay per hour at your billing rate. When every PC is busy they queue at the door, and they leave if they wait too long.',
  'Tap a broken PC to repair it. Tap a snack tag on a desk to serve it. A Teknisi and a Penjual do both for you.',
  'A higher billing rate pays more per hour but brings fewer people and grumpier ones. Past 100% the Net and Heat bars cost you satisfaction, and your stars decide how many customers show up.',
  'Spend in PCs, Upgrades, Staff and Snacks. The shop keeps earning while the app is closed. When it is big enough, Buka Cabang resets it for a permanent income bonus.',
];


const $ = (s, r = document) => r.querySelector(s);
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const pick = (a) => a[(Math.random() * a.length) | 0];

const dots = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
function sig(x) {
  const s = x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2);
  return (s.includes('.') ? s.replace(/\.?0+$/, '') : s).replace('.', ',');
}
const UNITS = [[1e12, 'T'], [1e9, 'M'], [1e6, 'Jt'], [1e3, 'Rb']];
function rp(n, full) {
  n = Math.floor(n);
  if (n < 0) return '-' + rp(-n, full);
  if (n < 10000 || (full && n < 1e6)) return 'Rp ' + dots(n);
  for (const [v, u] of UNITS) if (n >= v * 0.9995) return 'Rp ' + sig(n / v) + ' ' + u;
}
const signed = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(Math.round(n));

function h(tag, props, ...kids) {
  const e = document.createElement(tag);
  if (props) {
    for (const k in props) {
      const v = props[k];
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (v === true) e.setAttribute(k, '');
      else if (v !== false && v != null) e.setAttribute(k, v);
    }
  }
  for (const c of kids.flat()) if (c != null) e.append(c);
  return e;
}
function setT(el, v) { if (el._t !== v) { el._t = v; el.textContent = v; } }
function setA(el, k, v) { const key = '_a' + k; if (el[key] !== v) { el[key] = v; el.setAttribute(k, v); } }


let S;
let stepInc = 0;
const R = { tab: 'shop', bon: {}, ema: 0, fx: true, acc: 0, n: 0, deskEls: [], floorN: -1, qKey: '', evKey: '', lists: {}, cap: 10, demand: 0, cool: 6, load: 0, noSave: false };

const newDesk = (tier) => ({ tier, broken: 0, fixT: 0, cust: null });

function fresh() {
  return {
    v: 1, money: 50000, runEarned: 0, t: 0, clock: 8, day: 1, rate: 4000, rep: 2.5, room: 0,
    desks: [newDesk(0), newDesk(0), null], bought: [0, 0, 0, 0, 0, 0],
    net: 0, fans: 0, ac: 0, genset: 0, printer: 0, sign: 0, night: 0, nightOn: 0, streamer: 0, vault: 0,
    staff: { op: 0, tech: 0, sell: 0, clean: 0 },
    snack: { esteh: [1, 1], gorengan: [0, 0], kopi: [0, 0], indomie: [0, 0] },
    queue: [], ev: { blackout: 0, bt: 0, rel: 0, rain: 0, exam: 0, next: 150 },
    heat: 0, bw: 0, rateRef: 0, satAvg: 80, nid: 1,
    life: 0, franchise: 0, prestiges: 0, ach: {}, tips: 0, mute: 0, playSec: 0, saved: Date.now(),
    stats: { served: 0, gam: 0, str: 0, walk: 0, fixed: 0, snacks: 0, gens: 0, maxRep: 0, maxPcs: 0, turned: 0 },
  };
}

function merge(def, src) {
  if (Array.isArray(def)) return Array.isArray(src) ? src : def;
  if (def && typeof def === 'object') {
    const o = {};
    for (const k in def) o[k] = merge(def[k], src && src[k]);
    if (src && typeof src === 'object') for (const k in src) if (!(k in o)) o[k] = src[k];
    return o;
  }
  return typeof src === typeof def ? src : def;
}

function load() {
  let raw = null;
  try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { /* storage blocked */ }
  if (!raw) return fresh();
  try {
    const s = merge(fresh(), JSON.parse(raw));
    if (!isFinite(s.money) || !Array.isArray(s.desks)) throw new Error('bad save');
    while (s.desks.length < 3 + 3 * s.room) s.desks.push(null);
    return s;
  } catch (e) {
    try { localStorage.setItem(SAVE_KEY + '-bad', raw); } catch (_) { /* nothing more to do */ }
    R.loadErr = true;
    return fresh();
  }
}

function save() {
  if (R.noSave || !S) return;
  S.saved = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* quota or private mode */ }
}


const slots = () => 3 + 3 * S.room;
const isOpen = () => !!S.nightOn || S.clock >= OPEN_HOUR;
const nightHr = () => !!S.nightOn && (S.clock >= 22 || S.clock < 6);
const sun = () => Math.max(0, Math.sin((Math.PI * (S.clock - 6)) / 12));
const bonus = (k) => R.bon[k] || 0;
const incMult = () => (1 + 0.05 * S.franchise) * (1 + bonus('inc'));
const priceFactor = () => clamp(Math.pow(4000 / S.rate, 1.15), 0.15, 2);
const priceOf = (t) => Math.round(TIERS[t].cost * Math.pow(GROWTH, S.bought[t]));
const freeSlot = () => S.desks.findIndex((d) => !d);
const wage = (st) => Math.round(st.wage * (1 + 0.6 * S.room));
const dailyWages = () => STAFF.reduce((a, st) => a + (S.staff[st.id] ? wage(st) : 0), 0);
const repairCost = (d) => Math.max(600, Math.round((TIERS[d.tier].cost * 0.04) / 100) * 100);
const snackPrice = (it) => Math.round(it.price * Math.pow(1.18, S.snack[it.id][0] - 1));
const snackSpeed = (it) => 1 + 0.3 * (S.snack[it.id][1] - 1);
const snackUp = (it, lv) => Math.round(it.up * Math.pow(1.9, lv - 1));
const hasSpec = (min) => S.desks.some((d) => d && TIERS[d.tier].spec >= min);
const gain = () => Math.floor(Math.sqrt(S.runEarned / PRESTIGE_T));
function priceMood(t) {
  const r = S.rate / TYPES[t].fair;
  return r > 1 ? -Math.min(40, (r - 1) * 35) : Math.min(8, (1 - r) * 15);
}
function calcBonus() {
  R.bon = {};
  for (const a of ACH) if (S.ach[a.id]) R.bon[a.k] = (R.bon[a.k] || 0) + a.v;
}
const bonusText = (a) => (a.k === 'sat' ? `+${a.v} mood` : `+${Math.round(a.v * 100)}% ${ACH_KEY[a.k]}`);
function hhmm() {
  const hr = Math.floor(S.clock);
  const m = Math.floor((S.clock - hr) * 6) * 10;
  return String(hr).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}


let AC = null;
function ac() {
  if (!AC) {
    try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
  }
  if (AC.state === 'suspended') AC.resume();
  return AC;
}
function tone(f, dur = 0.1, type = 'sine', vol = 0.06, t0 = 0, slide = 0) {
  if (S.mute) return;
  const a = ac();
  if (!a) return;
  const t = a.currentTime + t0;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.03);
}
const SFX = {
  coin() { tone(988, 0.06, 'square', 0.03); tone(1319, 0.1, 'square', 0.03, 0.05); },
  tap() { tone(520, 0.04, 'triangle', 0.05); },
  buy() { tone(523, 0.08, 'triangle', 0.06); tone(659, 0.08, 'triangle', 0.06, 0.07); tone(784, 0.14, 'triangle', 0.06, 0.14); },
  err() { tone(160, 0.16, 'sawtooth', 0.04); },
  fix() { tone(300, 0.05, 'square', 0.035); tone(450, 0.08, 'square', 0.035, 0.05); },
  brk() { tone(220, 0.25, 'sawtooth', 0.045, 0, -150); },
  alarm() { tone(440, 0.18, 'sawtooth', 0.045); tone(330, 0.18, 'sawtooth', 0.045, 0.2); tone(440, 0.18, 'sawtooth', 0.045, 0.4); },
  ach() { [659, 784, 988, 1319].forEach((f, i) => tone(f, 0.12, 'sine', 0.06, i * 0.09)); },
  gen() { tone(90, 0.5, 'sawtooth', 0.05, 0, 60); },
};
const lastSfx = {};
function sfx(n) {
  if (!R.fx) return;
  const now = performance.now();
  if (now - (lastSfx[n] || 0) < 70) return;
  lastSfx[n] = now;
  try { SFX[n](); } catch (e) { /* audio is optional */ }
}


function earn(base, i, small) {
  const a = Math.round(base * incMult());
  if (a <= 0) return 0;
  S.money += a; S.runEarned += a; S.life += a; stepInc += a;
  if (i != null) { floaty(i, '+' + rp(a), small); if (!small) sfx('coin'); }
  return a;
}

function repMix(stars, w) {
  S.rep = clamp(S.rep + (stars - S.rep) * w, 0, 5);
  if (S.rep > S.stats.maxRep) S.stats.maxRep = S.rep;
}

function newDay() {
  S.day++;
  let paid = 0;
  for (const st of STAFF) {
    if (!S.staff[st.id]) continue;
    const c = wage(st);
    if (S.money >= c) { S.money -= c; paid += c; }
    else { S.staff[st.id] = 0; toast(`${st.name} quit. Wage went unpaid.`, 'bad'); }
  }
  toast(paid ? `Day ${S.day}. Wages paid: ${rp(paid)}` : `Day ${S.day} begins`);
}

function fireEvent() {
  const e = S.ev;
  const k = pick(['black', 'rel', 'rain', 'exam']);
  if (k === 'black') {
    if (e.blackout) return;
    e.blackout = 1; e.bt = 0;
    sfx('alarm');
    toast(S.genset ? 'PLN blackout. The genset is starting.' : 'PLN blackout. Start the genset.', 'bad');
  } else {
    e[k] = EVENTS[k].dur;
    toast(EVENTS[k].name + '. ' + EVENTS[k].text);
    sfx('ach');
  }
}

function events(dt) {
  const e = S.ev;
  if (e.blackout) {
    e.bt += dt;
    if (S.genset && e.bt >= 4) { e.blackout = 0; sfx('gen'); toast('Genset is running.', 'good'); }
  } else if (S.t >= e.next) {
    fireEvent();
    e.next = S.t + rnd(120, 240);
  }
  for (const k of ['rel', 'rain', 'exam']) {
    if (e[k] > 0) { e[k] -= dt; if (e[k] <= 0) { e[k] = 0; toast(EVENTS[k].name + ' is over.'); } }
  }
}

function startGenset() {
  if (!S.ev.blackout) return;
  S.ev.blackout = 0;
  S.stats.gens++;
  sfx('gen');
  toast('Genset is running.', 'good');
}

function spawn(i) {
  if (S.queue.length >= QUEUE_MAX) { S.stats.turned++; return; }
  const ty = TYPES[i];
  S.queue.push({ id: S.nid++, type: i, wait: 0, pat: ty.pat * rnd(0.8, 1.2) * (1 + bonus('pat')) });
}

function arrivals(dt) {
  if (!isOpen()) return;
  const hr = Math.floor(S.clock) % 24;
  const base = (0.3 + 0.3 * Math.pow(S.rep, 1.25)) * priceFactor() * (1 + 0.12 * S.sign) * (1 + bonus('arr')) * (S.ev.rain ? 1.5 : 1);
  TYPES.forEach((ty, i) => {
    if (i === 3 && !S.streamer) return;
    let w = W[ty.id][hr];
    if (i === 1 && S.ev.rel) w *= 2;
    if (i === 0 && S.ev.exam) w *= 0.3;
    if (!hasSpec(ty.minSpec)) w *= 0.15;
    if (Math.random() < 1 - Math.exp(-ty.peak * w * base * dt)) spawn(i);
  });
}

function pickDesk(c, smart) {
  const ty = TYPES[c.type];
  const cands = [];
  S.desks.forEach((d, i) => { if (d && !d.broken && !d.cust && TIERS[d.tier].spec >= ty.minSpec) cands.push(i); });
  if (!cands.length) return -1;
  if (!smart) return pick(cands);
  const spec = (i) => TIERS[S.desks[i].tier].spec;
  return cands.reduce((a, b) => (ty.prem ? (spec(b) > spec(a) ? b : a) : (spec(b) < spec(a) ? b : a)));
}

function seat(c, di) {
  const d = S.desks[di];
  const ty = TYPES[c.type];
  S.queue.splice(S.queue.indexOf(c), 1);
  c.hrs = rnd(ty.hrs[0], ty.hrs[1]);
  c.len = c.left = c.hrs * HOUR_SEC;
  c.sat = 85 + bonus('sat') + priceMood(c.type) - 25 * Math.min(1, c.wait / c.pat);
  c.order = null; c.printed = 0;
  d.cust = c;
}

function queueStep(dt) {
  const q = S.queue;
  const op = !!S.staff.op;
  for (let k = q.length - 1; k >= 0; k--) {
    const c = q[k];
    c.wait += dt;
    if (c.wait > c.pat) { q.splice(k, 1); S.stats.walk++; repMix(1, 0.06); }
  }
  if (S.ev.blackout || !q.length) return;
  const order = op ? q.slice().sort((a, b) => TYPES[b.type].prio - TYPES[a.type].prio) : q.slice();
  for (const c of order) {
    const ty = TYPES[c.type];
    if (!hasSpec(ty.minSpec)) {
      c.noPc = (c.noPc || 0) + dt;
      if (c.noPc > 6) { q.splice(q.indexOf(c), 1); S.stats.walk++; repMix(1.5, 0.03); }
      continue;
    }
    if (c.wait < (op ? 0.8 : 3)) continue;
    const di = pickDesk(c, op);
    if (di >= 0) seat(c, di);
  }
}

function payFor(c, d, frac) {
  const ty = TYPES[c.type];
  const tr = TIERS[d.tier];
  let m = ty.pay * (ty.prem ? tr.mult : Math.min(tr.mult, 1));
  if (c.type === 1 && nightHr()) m *= 1.35;
  return Math.round((S.rate * m * c.hrs * frac) / 100) * 100;
}

function finish(i, frac, broke) {
  const d = S.desks[i];
  const c = d.cust;
  d.cust = null;
  earn(payFor(c, d, frac), i);
  const sat = clamp(c.sat - (broke ? 30 : 0), 0, 100);
  repMix(sat / 20, 0.07);
  S.satAvg += (sat - S.satAvg) * 0.1;
  S.stats.served++;
  if (c.type === 1) S.stats.gam++;
  if (c.type === 3) S.stats.str++;
}

function breakDesk(i) {
  const d = S.desks[i];
  const frac = 1 - d.cust.left / d.cust.len;
  finish(i, clamp(frac, 0, 1), true);
  d.broken = 1; d.fixT = 0;
  S.stats.broke = (S.stats.broke || 0) + 1;
  toast(`Desk ${i + 1} broke down.`, 'bad');
  sfx('brk');
}

function serve(i) {
  const d = S.desks[i];
  if (!d || !d.cust || !d.cust.order) return;
  const it = ITEMS[d.cust.order.i];
  d.cust.order = null;
  d.cust.sat += 4;
  S.stats.snacks++;
  earn(snackPrice(it), i, true);
  sfx('tap');
}

function repair(i, free) {
  const d = S.desks[i];
  if (!d || !d.broken) return;
  const c = free ? 0 : repairCost(d);
  if (S.money < c) { short(c); return; }
  S.money -= c;
  d.broken = 0;
  if (!free) S.stats.fixed++;
  sfx('fix');
}

function sessions(dt) {
  const lag = Math.max(0, S.bw - 1);
  const hot = Math.max(0, S.heat - 1);
  const night = nightHr();
  const rain = S.ev.rain ? 1.3 : 1;
  const sold = ITEMS.filter((it) => S.snack[it.id][0] > 0);
  for (let i = 0; i < S.desks.length; i++) {
    const d = S.desks[i];
    if (!d || !d.cust || d.broken) continue;
    const c = d.cust;
    const ty = TYPES[c.type];
    c.left -= dt;
    c.sat -= (lag * 4 * (c.type === 1 ? 1.5 : c.type === 3 ? 2.5 : 1) + hot * 3.2) * dt;
    if (c.type === 2 && !c.printed && c.left <= c.len / 2) {
      c.printed = 1;
      if (S.printer) earn(PRINT[S.printer], i, true);
      else c.sat -= 12;
    }
    if (c.order) {
      c.order.t += dt;
      if (S.staff.sell) {
        if (c.order.t >= 1.5 / snackSpeed(ITEMS[c.order.i])) serve(i);
      } else if (c.order.t > 30) { c.order = null; c.sat -= 3; }
    } else {
      for (const it of sold) {
        const per = (it.rate * it.aff[c.type] * ty.app * snackSpeed(it) * rain * dt) / HOUR_SEC;
        if (Math.random() < per) { c.order = { i: ITEMS.indexOf(it), t: 0 }; break; }
      }
    }
    if (Math.random() < TIERS[d.tier].brk * (1 + 1.5 * hot) * (night ? 1.8 : 1) * dt) { breakDesk(i); continue; }
    if (c.left <= 0) finish(i, 1, false);
  }
}

function repairs(dt) {
  if (!S.staff.tech || S.ev.blackout) return;
  S.desks.forEach((d, i) => {
    if (d && d.broken) { d.fixT += dt; if (d.fixT >= 4) repair(i, true); }
  });
}

function environment(dt) {
  const pw = !S.ev.blackout;
  let dem = 0, load = 0;
  for (const d of S.desks) {
    if (d && d.cust && !d.broken) { dem += TYPES[d.cust.type].bw; load += TIERS[d.tier].heat; }
  }
  R.cap = PLANS[S.net].mbps * (1 + bonus('bw'));
  R.demand = pw ? dem : 0;
  R.cool = (5.5 + 2.5 * S.fans + 7 * S.ac) * (1 + bonus('cool')) * (1 - 0.2 * sun());
  R.load = pw ? load : 0;
  S.bw += ((pw ? dem / R.cap : 0) - S.bw) * Math.min(1, dt / 1.5);
  S.heat += ((pw ? load / R.cool : 0) - S.heat) * Math.min(1, dt / 20);
}

function checkAch() {
  if (S.bw > 1 && !S.stats.hintBw) { S.stats.hintBw = 1; toast('Net is overloaded and customers are lagging. Upgrade the plan.', 'bad'); }
  if (S.heat > 1 && !S.stats.hintHeat) { S.stats.hintHeat = 1; toast('The room is too hot. Buy fans, then an AC.', 'bad'); }
  const n = S.desks.filter(Boolean).length;
  if (n > S.stats.maxPcs) S.stats.maxPcs = n;
  for (const a of ACH) {
    if (!S.ach[a.id] && a.t(S)) {
      S.ach[a.id] = 1;
      calcBonus();
      toast(`Achievement: ${a.name} (${bonusText(a)})`, 'good');
      sfx('ach');
    }
  }
}

function step(dt) {
  stepInc = 0;
  S.t += dt; S.playSec += dt;
  S.clock += (dt * (isOpen() ? 1 : 3)) / HOUR_SEC;
  if (S.clock >= 24) { S.clock -= 24; newDay(); }
  if (!isOpen() && S.queue.length) S.queue.length = 0;
  events(dt);
  if (!S.ev.blackout) arrivals(dt);
  queueStep(dt);
  if (!S.ev.blackout) sessions(dt);
  repairs(dt);
  environment(dt);
  if (isOpen()) S.rep = Math.max(0, S.rep - 0.004 * (S.staff.clean ? 0.4 : 1) * dt);
  R.ema += (stepInc / dt - R.ema) * Math.min(1, dt / 40);
  if (!S.ev.blackout) S.rateRef += (stepInc / dt - S.rateRef) * Math.min(1, dt / 90);
  R.acc += dt;
  if (R.acc >= 1) { R.acc = 0; checkAch(); }
}


function applyOffline(sec) {
  const cap = VAULT_H[S.vault] * 3600;
  const eff = Math.min(sec, cap);
  if (eff < 30 || S.rateRef <= 0) return null;
  const days = eff / DAY_SEC;
  const gross = Math.round(S.rateRef * eff * OFFLINE_EFF);
  const wages = Math.round(dailyWages() * days);
  const net = Math.max(0, gross - wages);
  S.money += net; S.runEarned += net; S.life += net;
  const total = S.clock + days * 24;
  S.day += Math.floor(total / 24);
  S.clock = total % 24;
  S.queue = [];
  S.desks.forEach((d) => { if (d) { d.cust = null; if (S.staff.tech) d.broken = 0; } });
  S.ev = { blackout: 0, bt: 0, rel: 0, rain: 0, exam: 0, next: S.t + rnd(120, 240) };
  S.heat = 0; S.bw = 0;
  return { sec, eff, capped: sec > cap, gross, wages, net };
}

function away(sec) {
  const m = Math.round(sec / 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
}

function showOffline(r) {
  modal('Welcome back', [
    h('p', { text: `You were away for ${away(r.sec)}. The shop ran at half speed without you.` }),
    h('div', { class: 'kv' }, h('span', { text: 'Takings' }), h('b', { text: rp(r.gross) })),
    h('div', { class: 'kv' }, h('span', { text: 'Wages' }), h('b', { text: '-' + rp(r.wages) })),
    h('div', { class: 'kv' }, h('span', { text: 'Added to cash' }), h('b', { text: rp(r.net) })),
    r.capped ? h('p', { class: 'sub', text: `Offline earnings stop after ${VAULT_H[S.vault]} hours. A bigger cash drawer in Upgrades raises that.` }) : null,
  ], [{ label: 'Back to the shop', cls: 'primary' }]);
}


function short(c) { toast(`Need ${rp(c - S.money)} more.`); sfx('err'); }

function buyPc(t) {
  const i = freeSlot();
  if (i < 0) return false;
  S.desks[i] = newDesk(t);
  S.bought[t]++;
}

function upgradeCost(i, t) {
  const d = S.desks[i];
  return Math.max(0, priceOf(t) - Math.round(TIERS[d.tier].cost * 0.4));
}
function upgradeDesk(i, t) {
  const d = S.desks[i];
  if (!d || d.cust || t <= d.tier) return false;
  const c = upgradeCost(i, t);
  if (S.money < c) { short(c); return false; }
  S.money -= c;
  S.bought[t]++;
  d.tier = t; d.broken = 0;
  sfx('buy');
  return true;
}

function prestige() {
  const g = gain();
  if (g < 1) return;
  const keep = { franchise: S.franchise + g, prestiges: S.prestiges + 1, life: S.life, ach: S.ach, stats: S.stats, tips: S.tips, mute: S.mute, playSec: S.playSec };
  S = Object.assign(fresh(), keep);
  calcBonus();
  R.floorN = -1; R.qKey = ''; R.evKey = '';
  syncRate();
  go('shop');
  save();
  toast(`Branch opened. +${g} franchise point${g > 1 ? 's' : ''}.`, 'good');
  sfx('ach');
}

function toast(msg, kind) {
  if (!R.fx) return;
  const box = $('#toasts');
  if (!box) return;
  const t = h('div', { class: 'toast' + (kind ? ' ' + kind : ''), text: msg });
  box.append(t);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => t.remove(), 2800);
}

function floaty(i, txt, small) {
  if (!R.fx || R.tab !== 'shop') return;
  const o = R.deskEls[i];
  if (!o || o.el.querySelectorAll('.fl').length > 3) return;
  const f = h('span', { class: 'fl' + (small ? ' sm' : ''), text: txt });
  o.el.append(f);
  setTimeout(() => f.remove(), 1400);
}

const dlg = () => $('#dlg');
function modal(title, body, foot) {
  const d = dlg();
  d.replaceChildren(
    h('div', { class: 'dlg-h', id: 'dlgTitle', text: title }),
    h('div', { class: 'dlg-b' }, body),
    h('div', { class: 'dlg-f' }, foot.map((f) => h('button', {
      class: 'btn wide' + (f.cls ? ' ' + f.cls : ''), type: 'button',
      onclick: () => { if (!f.keep) d.close(); if (f.fn) f.fn(); },
    }, h('span', { class: 'b1', text: f.label })))),
  );
  if (!d.open) d.showModal();
  const btn = d.querySelector('.dlg-f .primary') || d.querySelector('.dlg-f button');
  if (btn) btn.focus();
}

function confirmBox(title, text, yes, fn) {
  modal(title, [h('p', { text })], [{ label: yes, cls: 'primary', fn }, { label: 'Cancel' }]);
}

function showTips(i = 0) {
  S.tips = 1;
  if (i >= TIPS.length) return;
  modal(`Tip ${i + 1} of ${TIPS.length}`, [h('p', { text: TIPS[i] })],
    [{ label: i < TIPS.length - 1 ? 'Next tip' : 'Open the shop', cls: 'primary', fn: () => showTips(i + 1) }]);
}

function openDesk(i) {
  const d = S.desks[i];
  const tr = TIERS[d.tier];
  const who = TYPES.filter((t) => t.minSpec <= tr.spec && (t.id !== 'str' || S.streamer)).map((t) => t.name).join(', ');
  const rows = [];
  for (let t = d.tier + 1; t < TIERS.length; t++) {
    const c = upgradeCost(i, t);
    rows.push({
      label: `${TIERS[t].name}: ${rp(c)}`,
      cls: !d.cust && S.money >= c ? 'primary' : 'poor',
      fn: () => { if (upgradeDesk(i, t)) toast(`Desk ${i + 1} is now a ${TIERS[t].name}.`, 'good'); },
    });
  }
  modal(`Desk ${i + 1}: ${tr.name}`, [
    h('div', { class: 'stat-line' },
      h('span', { text: 'Spec' }), h('span', { text: String(tr.spec) }),
      h('span', { text: 'Rate' }), h('span', { text: `x${tr.mult} (gamers and streamers; others cap at x1)` }),
      h('span', { text: 'Heat' }), h('span', { text: String(tr.heat) }),
      h('span', { text: 'Serves' }), h('span', { text: who }),
      h('span', { text: 'Status' }), h('span', { text: d.cust ? `${TYPES[d.cust.type].name}, ${Math.round(100 * (1 - d.cust.left / d.cust.len))}% done` : 'Free' })),
    rows.length ? h('p', { class: 'sub', text: d.cust ? 'Upgrades wait until the session ends. Trade-in refunds 40% of the old PC.' : 'Upgrade price already includes a 40% trade-in on this PC.' }) : h('p', { class: 'sub', text: 'Top tier.' }),
  ], [...rows.map((r) => (d.cust ? { label: r.label, cls: 'poor', keep: true } : r)), { label: 'Close' }]);
}


function exportSave() {
  save();
  const code = btoa(JSON.stringify(S));
  const ta = h('textarea', { readonly: true, 'aria-label': 'Save text' });
  ta.value = code;
  modal('Export save', [h('p', { text: 'Copy this text and keep it somewhere safe. Import it later to restore this shop.' }), ta], [
    {
      label: 'Copy text', cls: 'primary', keep: true,
      fn: () => {
        const ok = () => toast('Save text copied.', 'good');
        const manual = () => {
          ta.focus(); ta.select();
          try { document.execCommand('copy') ? ok() : toast('Select the text and copy it by hand.'); } catch (e) { toast('Select the text and copy it by hand.'); }
        };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(ok, manual); else manual();
      },
    },
    { label: 'Close' },
  ]);
}

function importSave() {
  const ta = h('textarea', { placeholder: 'Paste save text here', 'aria-label': 'Save text to import' });
  const err = h('p', { class: 'err', hidden: true });
  modal('Import save', [h('p', { text: 'This replaces the shop on this device.' }), ta, err], [
    {
      label: 'Replace my save', cls: 'primary', keep: true,
      fn: () => {
        try {
          const o = JSON.parse(atob(ta.value.trim()));
          if (!o || typeof o.money !== 'number' || !Array.isArray(o.desks)) throw new Error('shape');
          R.noSave = true;
          localStorage.setItem(SAVE_KEY, JSON.stringify(o));
          location.reload();
        } catch (e) {
          err.hidden = false;
          err.textContent = 'That text is not a Warnet Tycoon save. Copy it again in full.';
          sfx('err');
        }
      },
    },
    { label: 'Cancel' },
  ]);
}

function resetSave() {
  confirmBox('Reset everything?', 'Your shop, franchise points and achievements will be deleted for good. Export first if you might want them back.', 'Delete my save', () => {
    R.noSave = true;
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* nothing to remove */ }
    location.reload();
  });
}

function openSettings() {
  modal('Settings', [
    h('div', { class: 'kv' }, h('span', { text: 'Played' }), h('b', { text: away(S.playSec) })),
    h('div', { class: 'kv' }, h('span', { text: 'Customers served' }), h('b', { text: dots(S.stats.served) })),
    h('div', { class: 'kv' }, h('span', { text: 'Walked out' }), h('b', { text: dots(S.stats.walk) })),
  ], [
    { label: S.mute ? 'Sound is off. Turn on' : 'Sound is on. Mute', fn: () => { S.mute = S.mute ? 0 : 1; sfx('tap'); } },
    { label: 'Export save text', fn: exportSave },
    { label: 'Import save text', fn: importSave },
    { label: 'Reset everything', fn: resetSave },
    { label: 'Close', cls: 'primary' },
  ]);
}


function buildList(ul, defs) {
  const rows = defs.map((def) => {
    const name = h('span');
    const tag = h('span', { class: 'tag' });
    const desc = h('p');
    const btns = (def.btns || []).map((bd) => {
      const b1 = h('span', { class: 'b1' });
      const b2 = h('span', { class: 'b2' });
      const el = h('button', { class: 'btn', type: 'button' }, b1, b2);
      const b = { def: bd, el, b1, b2, cost: null, hot: false };
      el.addEventListener('click', () => press(b));
      return b;
    });
    const li = h('li', { class: 'row' + (btns.length ? '' : ' nobtn') },
      h('div', { class: 'r-main' }, h('h3', null, name, tag), desc),
      btns.length ? h('div', { class: 'btns' }, btns.map((b) => b.el)) : null);
    ul.append(li);
    return { def, li, name, tag, desc, btns };
  });
  return { ul, rows };
}

function refreshList(L) {
  for (const r of L.rows) {
    const d = r.def;
    const show = !d.show || d.show();
    r.li.hidden = !show;
    if (!show) { r.btns.forEach((b) => { b.hot = false; }); continue; }
    setT(r.name, d.name());
    setT(r.tag, d.tag ? d.tag() : '');
    r.tag.classList.toggle('ok', !!(d.tagOk && d.tagOk()));
    setT(r.desc, d.desc());
    if (d.done) r.li.classList.toggle('done', d.done());
    for (const b of r.btns) {
      const bd = b.def;
      const hide = !!(bd.hide && bd.hide());
      b.el.hidden = hide;
      if (hide) { b.hot = false; continue; }
      const ok = bd.ok();
      const cost = bd.cost ? bd.cost() : null;
      b.cost = cost;
      setT(b.b1, bd.label());
      const sub = bd.sub && bd.sub();
      setT(b.b2, sub || (cost != null ? rp(cost) : ''));
      b.el.disabled = !ok;
      b.hot = ok && (cost == null ? !!(bd.hot && bd.hot()) : S.money >= cost);
      b.el.classList.toggle('primary', b.hot);
      b.el.classList.toggle('poor', ok && cost != null && S.money < cost);
    }
  }
}

function press(b) {
  if (b.el.disabled) return;
  const bd = b.def;
  const c = bd.cost ? bd.cost() : 0;
  if (c > S.money) { short(c); return; }
  S.money -= c;
  const r = bd.go();
  if (r === false) { S.money += c; sfx('err'); } else if (r !== 'later') sfx(c ? 'buy' : 'tap');
  refreshTab();
  renderHud();
  save();
}

const who = (spec) => TYPES.filter((t) => t.minSpec <= spec && (t.id !== 'str' || S.streamer)).map((t) => t.name).join(', ');

function pcRows() {
  return [
    {
      name: () => `Room: ${slots()} desks`,
      tag: () => (S.room < 4 ? '' : 'Largest'),
      desc: () => (S.room < 4 ? `Rent the next unit for ${slots() + 3} desks. Empty slots show on the Shop screen.` : 'You rented the biggest unit.'),
      btns: [{ label: () => (S.room < 4 ? 'Expand room' : 'Maxed'), cost: () => (S.room < 4 ? ROOM_COST[S.room] : null), ok: () => S.room < 4, go: () => { S.room++; while (S.desks.length < slots()) S.desks.push(null); } }],
    },
    ...TIERS.map((t, i) => ({
      name: () => t.name,
      tag: () => `Owned ${S.desks.filter((d) => d && d.tier === i).length}`,
      desc: () => `Spec ${t.spec}, rate x${t.mult}, heat ${t.heat}. Serves ${who(t.spec)}.`,
      btns: [{ label: () => (freeSlot() >= 0 ? 'Buy for a free desk' : 'No free desk'), cost: () => priceOf(i), ok: () => freeSlot() >= 0, go: () => buyPc(i) }],
    })),
  ];
}

function upgradeRows() {
  return [
    {
      name: () => PLANS[S.net].name,
      tag: () => `Plan ${S.net + 1}/${PLANS.length}`,
      desc: () => `Shared by every busy PC. Using ${sig(R.demand)} of ${sig(R.cap)} Mbps. Past 100% the shop lags and customers get angry.`,
      btns: [{ label: () => (S.net < PLANS.length - 1 ? `Switch to ${PLANS[S.net + 1].name}` : 'Maxed'), cost: () => (S.net < PLANS.length - 1 ? PLANS[S.net + 1].cost : null), ok: () => S.net < PLANS.length - 1, go: () => { S.net++; } }],
    },
    {
      name: () => 'Fans',
      tag: () => `${S.fans}/${FAN_MAX}`,
      desc: () => `Each fan adds 2.5 cooling. Cooling ${sig(R.cool)}, PCs in use produce ${sig(R.load)}. Past 100% the room gets hot.`,
      btns: [{ label: () => (S.fans < FAN_MAX ? 'Buy a fan' : 'Maxed'), cost: () => (S.fans < FAN_MAX ? Math.round(6000 * Math.pow(GROWTH, S.fans)) : null), ok: () => S.fans < FAN_MAX, go: () => { S.fans++; } }],
    },
    {
      name: () => 'Air conditioners',
      tag: () => `${S.ac}/${AC_MAX}`,
      desc: () => 'Each AC adds 7 cooling. Costly, but fans alone will not keep up with gaming PCs.',
      btns: [{ label: () => (S.ac < AC_MAX ? 'Install an AC' : 'Maxed'), cost: () => (S.ac < AC_MAX ? Math.round(160000 * Math.pow(GROWTH, S.ac)) : null), ok: () => S.ac < AC_MAX, go: () => { S.ac++; } }],
    },
    {
      name: () => 'Auto genset',
      tag: () => (S.genset ? 'Installed' : ''),
      tagOk: () => !!S.genset,
      desc: () => 'Starts itself 4 seconds after a PLN blackout. Without it you must tap Start genset.',
      btns: [{ label: () => (S.genset ? 'Installed' : 'Buy the genset'), cost: () => (S.genset ? null : GENSET_COST), ok: () => !S.genset, go: () => { S.genset = 1; } }],
    },
    {
      name: () => 'Printer',
      tag: () => `${S.printer}/3`,
      desc: () => `Pekerja print once per visit${S.printer ? ` and pay ${rp(PRINT[S.printer])}` : ''}. Without a printer they leave a little annoyed.`,
      btns: [{ label: () => (S.printer < 3 ? (S.printer ? 'Better printer' : 'Buy a printer') : 'Maxed'), cost: () => (S.printer < 3 ? PRINT_COST[S.printer] : null), ok: () => S.printer < 3, go: () => { S.printer++; } }],
    },
    {
      name: () => 'Neon sign',
      tag: () => `${S.sign}/3`,
      desc: () => `Passers-by notice you. Each level brings 12% more customers.`,
      btns: [{ label: () => (S.sign < 3 ? 'Hang a bigger sign' : 'Maxed'), cost: () => (S.sign < 3 ? SIGN_COST[S.sign] : null), ok: () => S.sign < 3, go: () => { S.sign++; } }],
    },
    {
      name: () => 'Night shift',
      tag: () => (S.night ? (S.nightOn ? 'Open 24 hours' : 'Closed at night') : ''),
      tagOk: () => !!S.nightOn,
      desc: () => 'Open all night for gamers who pay 35% more. PCs break down 80% more often between 22:00 and 06:00.',
      btns: [
        { label: () => 'Unlock', cost: () => NIGHT_COST, ok: () => !S.night, hide: () => !!S.night, go: () => { S.night = 1; S.nightOn = 1; } },
        { label: () => (S.nightOn ? 'Turn night shift off' : 'Turn night shift on'), ok: () => !!S.night, hide: () => !S.night, go: () => { S.nightOn = S.nightOn ? 0 : 1; } },
      ],
    },
    {
      name: () => 'Streamer contract',
      tag: () => (S.streamer ? 'Signed' : ''),
      tagOk: () => !!S.streamer,
      desc: () => `Streamers pay the most but eat 15 Mbps each and need an RTX Rig or better. Needs the Fiber 100 plan. Costs ${rp(STREAM_COST)}.`,
      btns: [{
        label: () => (S.streamer ? 'Signed' : 'Sign the contract'),
        cost: () => (S.streamer ? null : STREAM_COST),
        sub: () => (S.streamer || (S.net >= 3 && S.desks.some((d) => d && d.tier >= 4)) ? '' : 'Needs Fiber 100 and an RTX Rig'),
        ok: () => !S.streamer && S.net >= 3 && S.desks.some((d) => d && d.tier >= 4),
        go: () => { S.streamer = 1; },
      }],
    },
    {
      name: () => 'Cash drawer',
      tag: () => `Offline limit ${VAULT_H[S.vault]} h`,
      desc: () => 'How long the shop keeps earning while the app is closed, at half speed.',
      btns: [{ label: () => (S.vault < VAULT_H.length - 1 ? `Raise to ${VAULT_H[S.vault + 1]} h` : 'Maxed'), cost: () => (S.vault < VAULT_H.length - 1 ? VAULT_COST[S.vault] : null), ok: () => S.vault < VAULT_H.length - 1, go: () => { S.vault++; } }],
    },
  ];
}

function staffRows() {
  return STAFF.map((st) => ({
    name: () => st.name,
    tag: () => (S.staff[st.id] ? `Hired, ${rp(wage(st))} a day` : `${rp(wage(st))} a day`),
    tagOk: () => !!S.staff[st.id],
    desc: () => st.desc,
    btns: [{
      label: () => (S.staff[st.id] ? 'Let go' : 'Hire'),
      cost: () => (S.staff[st.id] ? null : wage(st) * 5),
      ok: () => true,
      go: () => {
        if (!S.staff[st.id]) { S.staff[st.id] = 1; return true; }
        confirmBox(`Let ${st.name} go?`, 'You would have to pay the hiring fee again to bring them back.', 'Let go', () => { S.staff[st.id] = 0; refreshTab(); });
        return 'later';
      },
    }],
  }));
}

function snackRows() {
  return ITEMS.map((it) => {
    const st = () => S.snack[it.id];
    return {
      name: () => it.name,
      tag: () => (st()[0] ? `Price ${st()[0]}/${SNACK_MAX}, speed ${st()[1]}/${SNACK_MAX}` : 'Not on the menu'),
      desc: () => (st()[0] ? `Sells for ${rp(snackPrice(it))}. Orders come ${snackSpeed(it).toFixed(1)}x as often as at level 1.` : `Unlock to put ${it.name} on the counter.`),
      btns: [
        {
          label: () => (!st()[0] ? 'Put on the menu' : st()[0] < SNACK_MAX ? 'Raise price' : 'Price maxed'),
          cost: () => (!st()[0] ? it.unlock : st()[0] < SNACK_MAX ? snackUp(it, st()[0]) : null),
          ok: () => !st()[0] || st()[0] < SNACK_MAX,
          go: () => { if (!st()[0]) S.snack[it.id] = [1, 1]; else st()[0]++; },
        },
        {
          label: () => (st()[1] < SNACK_MAX ? 'Serve faster' : 'Speed maxed'),
          cost: () => (st()[1] < SNACK_MAX ? Math.round(snackUp(it, st()[1]) * 1.3) : null),
          ok: () => st()[1] < SNACK_MAX,
          hide: () => !st()[0],
          go: () => { st()[1]++; },
        },
      ],
    };
  });
}

function cabangRows() {
  return [
    {
      name: () => 'Franchise points',
      tag: () => `${S.franchise}`,
      desc: () => `Each point adds 5% to all income, so you earn +${S.franchise * 5}% now. This run: ${rp(S.runEarned)} earned.`,
    },
    {
      name: () => 'Buka Cabang',
      tag: () => (gain() >= 1 ? `+${gain()} points ready` : ''),
      tagOk: () => gain() >= 1,
      desc: () => (gain() >= 1
        ? 'Resets money, PCs, upgrades, staff and snacks. Points and achievements stay.'
        : `Earn ${rp(PRESTIGE_T)} in one run to open the first branch. Now at ${rp(S.runEarned)}.`),
      btns: [{
        label: () => 'Buka Cabang',
        sub: () => (gain() >= 1 ? `+${gain()} pts` : 'Not yet'),
        ok: () => gain() >= 1,
        hot: () => gain() >= 1,
        go: () => {
          confirmBox('Buka Cabang?', `The shop resets to its first day. You keep ${S.franchise + gain()} franchise points (+${(S.franchise + gain()) * 5}% income) and every achievement.`, 'Open the branch', prestige);
          return 'later';
        },
      }],
    },
  ];
}

function achRows() {
  return ACH.map((a) => ({
    name: () => a.name,
    tag: () => (S.ach[a.id] ? 'Done' : 'Locked'),
    tagOk: () => !!S.ach[a.id],
    desc: () => `${a.desc}. Reward: ${bonusText(a)}.`,
    done: () => !!S.ach[a.id],
  }));
}


function buildFloor() {
  const f = $('#floor');
  f.replaceChildren();
  R.deskEls = [];
  S.desks.forEach((_, i) => {
    const b = h('button', { class: 'desk', type: 'button', 'data-i': i },
      h('span', { class: 'd-tier' }), h('span', { class: 'd-mon' }, h('i')), h('span', { class: 'd-who' }),
      h('span', { class: 'd-tag' }), h('span', { class: 'd-msg' }), h('span', { class: 'd-bar' }, h('i')));
    f.append(b);
    R.deskEls.push({ el: b, tier: b.children[0], who: b.children[2], tag: b.children[3], msg: b.children[4], bar: b.children[5].firstChild, cid: 0 });
  });
  R.floorN = S.desks.length;
}

function renderDesks() {
  if (R.floorN !== S.desks.length) buildFloor();
  S.desks.forEach((d, i) => {
    const o = R.deskEls[i];
    const st = !d ? 'empty' : d.broken ? 'broken' : d.cust ? 'busy' : 'idle';
    if (o.el.dataset.st !== st) o.el.dataset.st = st;
    let label;
    if (st === 'empty') {
      setT(o.msg, 'Empty slot');
      label = `Desk ${i + 1}, empty slot. Opens PCs`;
    } else {
      setT(o.tier, `${i + 1}. ${TIERS[d.tier].name}`);
      if (st === 'broken') {
        const c = repairCost(d);
        setT(o.msg, S.staff.tech ? 'Teknisi coming' : `Fix ${rp(c)}`);
        label = `Desk ${i + 1}, broken. Tap to repair for ${rp(c)}`;
      } else if (st === 'idle') {
        setT(o.msg, 'Free');
        label = `Desk ${i + 1}, ${TIERS[d.tier].name}, free. Opens upgrades`;
      } else {
        const c = d.cust;
        const ty = TYPES[c.type];
        if (o.cid !== c.id) { o.cid = c.id; o.el.style.setProperty('--c', ty.col); setT(o.tag, ty.tag); }
        o.bar.style.width = (100 * (1 - c.left / c.len)).toFixed(1) + '%';
        const ord = c.order && !S.staff.sell;
        o.msg.classList.toggle('on', !!ord);
        setT(o.msg, ord ? `Serve ${ITEMS[c.order.i].name}` : '');
        label = `Desk ${i + 1}, ${ty.name} playing${ord ? '. Tap to serve ' + ITEMS[c.order.i].name : ''}`;
      }
    }
    setA(o.el, 'aria-label', label);
  });
}

function renderQueue() {
  const q = $('#queue');
  const key = S.queue.map((c) => c.id).join();
  if (key !== R.qKey) {
    R.qKey = key;
    q.replaceChildren();
    R.qBars = new Map();
    if (!S.queue.length) q.append(h('span', { class: 'q-empty', text: 'Nobody waiting.' }));
    for (const c of S.queue) {
      const ty = TYPES[c.type];
      const bar = h('i');
      q.append(h('div', { class: 'qc', style: `--c:${ty.col}`, title: ty.name, role: 'img', 'aria-label': `${ty.name} waiting` }, h('b', { text: ty.tag }), h('span', { class: 'pb' }, bar)));
      R.qBars.set(c.id, bar);
    }
  }
  for (const c of S.queue) {
    const bar = R.qBars.get(c.id);
    if (bar) bar.style.width = (100 * clamp(1 - c.wait / c.pat, 0, 1)).toFixed(0) + '%';
  }
  setT($('#qCount'), `${S.queue.length}/${QUEUE_MAX} waiting`);
}

function renderEv() {
  const e = S.ev;
  const box = $('#evBanner');
  const act = ['rel', 'rain', 'exam'].filter((k) => e[k] > 0);
  const key = (e.blackout ? 'b' + S.genset : '') + act.join();
  if (key !== R.evKey) {
    R.evKey = key;
    box.replaceChildren();
    R.evBars = {};
    box.hidden = !key;
    if (e.blackout) {
      box.append(h('div', { class: 'ev bad' },
        h('div', null, h('b', { text: 'PLN blackout' }), h('span', { class: 'sub', text: S.genset ? 'The auto genset is starting. Everything is paused.' : 'Everything is paused and customers are losing patience.' })),
        S.genset ? null : h('button', { class: 'btn primary wide', type: 'button', onclick: startGenset }, h('span', { class: 'b1', text: 'Start genset' }))));
    }
    for (const k of act) {
      const bar = h('i');
      R.evBars[k] = bar;
      box.append(h('div', { class: 'ev' }, h('div', null, h('b', { text: EVENTS[k].name }), h('span', { class: 'sub', text: EVENTS[k].text })), h('div', { class: 'ev-bar' }, bar)));
    }
  }
  for (const k of act) R.evBars[k].style.width = (100 * e[k] / EVENTS[k].dur).toFixed(0) + '%';
}

function syncRate() {
  const inp = $('#rate');
  if (+inp.value !== S.rate) inp.value = S.rate;
  setT($('#rateOut'), `${rp(S.rate)}/h`);
  const parts = TYPES.filter((t, i) => i !== 3 || S.streamer).map((t) => `${t.name} ${signed(priceMood(TYPES.indexOf(t)))}`);
  setT($('#rateHint'), `Customers arrive x${priceFactor().toFixed(2)} as often. Mood: ${parts.join(', ')}.`);
}

function renderShop() {
  renderDesks();
  renderQueue();
  renderEv();
  setT($('#shopStats'), `Mood ${Math.round(S.satAvg)}%. Served ${dots(S.stats.served)}. Walked out ${dots(S.stats.walk)}.`);
  $('#app').classList.toggle('dark', !!S.ev.blackout);
}

function meter(id, ratio, text) {
  const btn = $('#' + id + 'Btn');
  setT($('#' + id + 'Val'), text);
  $('#' + id + 'Fill').style.width = (100 * clamp(ratio / 1.25, 0, 1)).toFixed(0) + '%';
  btn.classList.toggle('bad', ratio > 1);
  btn.classList.toggle('warn', ratio > 0.85 && ratio <= 1);
}

function renderHud() {
  setT($('#money'), rp(S.money, true));
  setT($('#perMin'), `+${rp(R.ema * 60)}/min`);
  setT($('#clock'), `Day ${S.day} · ${hhmm()}${DEBUG ? ' x10' : ''}`);
  const sg = S.ev.blackout ? ['Blackout', 'out'] : isOpen() ? ['Open', ''] : ['Closed', 'closed'];
  setT($('#sign'), sg[0]);
  $('#sign').className = 'sign ' + sg[1];
  const stars = $('#stars').children;
  for (let i = 0; i < 5; i++) {
    const f = Math.round(clamp(S.rep - i, 0, 1) * 20) * 5 + '%';
    if (stars[i]._f !== f) { stars[i]._f = f; stars[i].style.setProperty('--f', f); }
  }
  setT($('#repNum'), S.rep.toFixed(1));
  setA($('#rep'), 'aria-label', `Reputation ${S.rep.toFixed(1)} of 5`);
  meter('bw', S.bw, `${sig(R.demand)}/${sig(R.cap)} Mbps`);
  meter('heat', S.heat, `${Math.round(S.heat * 100)}%`);
}

function refreshTab() {
  const L = R.lists;
  if (R.tab !== 'shop') {
    if (L[R.tab]) refreshList(L[R.tab]);
    if (R.tab === 'cabang') { refreshList(L.ach); setT($('#achCount'), `${Object.keys(S.ach).length}/${ACH.length}`); }
    if (R.tab === 'staff') setT($('#staffHint'), `Wages are paid at midnight each game day: ${rp(dailyWages())} now. Someone you cannot pay quits.`);
    if (R.tab === 'snacks') setT($('#snackHint'), S.staff.sell ? 'Your Penjual serves every order.' : 'Tap the snack tag on a desk to serve an order, or hire a Penjual. Orders expire after 30 seconds.');
  }
  for (const k of ['pcs', 'upgrades', 'staff', 'snacks', 'cabang']) {
    if (k !== R.tab) refreshList(L[k]);
    const hot = L[k].rows.some((r) => r.btns.some((b) => b.hot));
    const dot = $(`.tab[data-tab=${k}] .dot`);
    if (dot.hidden === hot) dot.hidden = !hot;
  }
}

function render() {
  renderHud();
  if (R.tab === 'shop') renderShop();
  if (++R.n % 5 === 0) refreshTab();
}

function go(tab) {
  R.tab = tab;
  document.querySelectorAll('.view').forEach((v) => { v.hidden = v.id !== 'v-' + tab; });
  document.querySelectorAll('.tab[data-tab]').forEach((t) => t.toggleAttribute('aria-current', t.dataset.tab === tab));
  document.querySelector('.tab[aria-current]').setAttribute('aria-current', 'page');
  $('#views').scrollTop = 0;
  refreshTab();
  if (tab === 'shop') renderShop();
}


let lastPerf = performance.now();
let lastWall = Date.now();

function frame() {
  if (document.hidden) return;
  const nowP = performance.now();
  let dt = Math.min((nowP - lastPerf) / 1000, 1) * SPEED;
  lastPerf = nowP;
  lastWall = Date.now();
  if (dlg().open) return;
  while (dt > 1e-6) { const d = Math.min(dt, 0.2); step(d); dt -= d; }
  render();
}

function resume() {
  const gap = (Date.now() - lastWall) / 1000;
  lastPerf = performance.now();
  if (gap > 20) {
    const r = applyOffline(gap);
    if (r) { go(R.tab); showOffline(r); }
  }
  lastWall = Date.now();
}

function fatal(e) {
  const b = $('#boot');
  b.className = 'err';
  b.replaceChildren(h('div', null,
    h('p', { text: 'The shop would not open.' }),
    h('p', { class: 'sub', text: String(e && e.message || e) }),
    h('button', { class: 'btn primary', type: 'button', onclick: () => { try { localStorage.removeItem(SAVE_KEY); } catch (x) { /* ignore */ } location.reload(); } }, h('span', { class: 'b1', text: 'Reset save and retry' }))));
}

function init() {
  S = load();
  calcBonus();
  R.lists = {
    pcs: buildList($('#l-pcs'), pcRows()),
    upgrades: buildList($('#l-upgrades'), upgradeRows()),
    staff: buildList($('#l-staff'), staffRows()),
    snacks: buildList($('#l-snacks'), snackRows()),
    cabang: buildList($('#l-cabang'), cabangRows()),
    ach: buildList($('#l-ach'), achRows()),
  };

  document.querySelectorAll('.tab[data-tab]').forEach((t) => t.addEventListener('click', () => { sfx('tap'); go(t.dataset.tab); }));
  document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));
  $('#gear').addEventListener('click', openSettings);
  $('#floor').addEventListener('click', (e) => {
    const b = e.target.closest('.desk');
    if (!b) return;
    const i = +b.dataset.i;
    const d = S.desks[i];
    if (!d) { go('pcs'); return; }
    if (d.broken) { repair(i, false); return; }
    if (d.cust && d.cust.order && !S.staff.sell) { serve(i); return; }
    openDesk(i);
  });
  const rate = (v) => { S.rate = clamp(v, 1500, 12000); syncRate(); };
  $('#rate').addEventListener('input', (e) => rate(+e.target.value));
  $('#rateDn').addEventListener('click', () => { rate(S.rate - 500); sfx('tap'); });
  $('#rateUp').addEventListener('click', () => { rate(S.rate + 500); sfx('tap'); });
  dlg().addEventListener('click', (e) => { if (e.target === dlg()) dlg().close(); });

  document.addEventListener('pointerdown', () => ac(), { once: true });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); else resume(); });
  window.addEventListener('pagehide', save);

  if (DEBUG) {
    const b = $('#dbgCash');
    b.hidden = false;
    b.addEventListener('click', () => { S.money += 1e6; renderHud(); refreshTab(); });
    const reset = () => { S = fresh(); calcBonus(); R.floorN = -1; R.qKey = ''; R.evKey = ''; R.ema = 0; R.acc = 0; syncRate(); };
    window.WT = { get S() { return S; }, R, step, render, refreshTab, go, repair, serve, startGenset, upgradeDesk, upgradeCost, repairCost, priceOf, gain, applyOffline, save, reset, fx: (on) => { R.fx = on; } };
  }

  syncRate();
  go('shop');
  $('#app').hidden = false;
  $('#boot').remove();

  const gap = (Date.now() - S.saved) / 1000;
  const off = gap > 20 ? applyOffline(gap) : null;
  if (R.loadErr) toast('The old save could not be read, so you started fresh. The broken copy was kept.', 'bad');
  if (off) showOffline(off); else if (!S.tips) showTips();

  lastPerf = performance.now(); lastWall = Date.now();
  setInterval(frame, 100);
  setInterval(save, 5000);
  render();
  refreshTab();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => { /* offline cache is best effort */ });
}

try { init(); } catch (e) { fatal(e); }
})();
