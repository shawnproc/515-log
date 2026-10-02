"use strict";
/* ---------- tiny DOM helpers (all user/AI text goes through textContent) ---------- */
const $ = (s, r = document) => r.querySelector(s);
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k === "style") el.setAttribute("style", v);
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "value") el.value = v;
    else if (k === "checked") el.checked = !!v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat()) { if (c == null || c === false) continue; el.append(c instanceof Node ? c : document.createTextNode(String(c))); }
  return el;
}
const SVGNS = "http://www.w3.org/2000/svg";
function s(tag, attrs, ...kids) {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null) el.setAttribute(k, v);
  for (const c of kids.flat()) { if (c == null) continue; el.append(c instanceof Node ? c : document.createTextNode(String(c))); }
  return el;
}
const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
const clone = o => JSON.parse(JSON.stringify(o));
const n0 = v => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const clampNum = (v, max = 20000) => Math.max(0, Math.min(max, Math.round(n0(v))));
const fmt = v => Math.round(v).toLocaleString();

/* ---------- dates (local time) ---------- */
const pad = n => String(n).padStart(2, "0");
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = str => { const [y, m, d] = str.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (str, n) => { const d = parse(str); d.setDate(d.getDate() + n); return iso(d); };
const todayISO = () => iso(new Date());
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WDL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const nice = str => { const d = parse(str); return `${MON[d.getMonth()]} ${d.getDate()}`; };
const mondayOf = str => { const d = parse(str); const off = (d.getDay() + 6) % 7; d.setDate(d.getDate() - off); return iso(d); };

/* ---------- defaults: a starter split, meant to be edited in Plan ---------- */
const E = (n, s, r) => ({ n, s, r });
const DEFAULT_PROFILE = {
  kind: "profile", unit: "lb", goalBw: "", vacation: false,
  targets: { kcal: 2600, p: 200, c: 260, f: 80 },
  likes: "oatmeal with chia, steak, tuna with pickles and hot sauce, Greek yogurt with non-berry fruit",
  dislikes: "quinoa, cottage cheese",
  split: {
    "0": { name: "Rest", rest: true, ex: [] },
    "1": { name: "Push A", rest: false, ex: [E("Bench Press",4,6),E("Incline DB Press",3,10),E("Overhead Press",3,8),E("Lateral Raise",3,15),E("Triceps Pushdown",3,12)] },
    "2": { name: "Pull A", rest: false, ex: [E("Deadlift",3,5),E("Weighted Pull-up",4,6),E("Barbell Row",3,8),E("Face Pull",3,15),E("Barbell Curl",3,10)] },
    "3": { name: "Legs A", rest: false, ex: [E("Back Squat",4,6),E("Romanian Deadlift",3,8),E("Walking Lunge",3,12),E("Leg Curl",3,12),E("Standing Calf Raise",4,15)] },
    "4": { name: "Push B", rest: false, ex: [E("Incline Bench Press",4,8),E("Seated DB Press",3,10),E("Weighted Dip",3,10),E("Cable Fly",3,15),E("Skull Crusher",3,12)] },
    "5": { name: "Pull B", rest: false, ex: [E("Pendlay Row",4,6),E("Lat Pulldown",3,10),E("Chest-Supported Row",3,12),E("Rear Delt Fly",3,15),E("Hammer Curl",3,12)] },
    "6": { name: "Legs B", rest: false, ex: [E("Front Squat",4,6),E("Hip Thrust",3,10),E("Leg Press",3,12),E("Leg Extension",3,15),E("Seated Calf Raise",4,15)] }
  },
  foods: [
    { n: "Oatmeal + chia", kcal: 210, p: 7, c: 32, f: 7 },
    { n: "Steak, 8 oz sirloin", kcal: 400, p: 60, c: 0, f: 17 },
    { n: "Tuna, pickles + hot sauce", kcal: 125, p: 26, c: 1, f: 1 },
    { n: "Greek yogurt + banana", kcal: 205, p: 18, c: 33, f: 0 },
    { n: "3 eggs", kcal: 215, p: 19, c: 1, f: 15 }
  ]
};

/* ---------- state ---------- */
let profile = clone(DEFAULT_PROFILE);
let days = {};                 // date -> day doc
let cur = todayISO();
let tab = ["train","fuel","progress","plan"].includes(lsGet("515.tab")) ? lsGet("515.tab") : "train";
const ui = { lift: lsGet("515.lift") || "", draft: { name: "", kcal: "", p: "", c: "", f: "", fav: false }, importMsg: "",
  food: { q: "", results: [], busy: false, err: "", pick: null, amt: "", unit: "g", fav: false, scanning: false, code: "" }, keyMsg: "" };

function mergeProfile(remote) {
  const p = Object.assign(clone(DEFAULT_PROFILE), remote || {});
  p.targets = Object.assign(clone(DEFAULT_PROFILE.targets), (remote && remote.targets) || {});
  if (!p.split || typeof p.split !== "object") p.split = clone(DEFAULT_PROFILE.split);
  for (let i = 0; i < 7; i++) if (!p.split[i]) p.split[i] = { name: "Rest", rest: true, ex: [] };
  if (!Array.isArray(p.foods)) p.foods = [];
  return p;
}

function blankDay(date) {
  const sp = profile.split[parse(date).getDay()] || { name: "Rest", rest: true, ex: [] };
  return {
    kind: "day", date, bw: "", notes: "", meals: [],
    workout: {
      name: sp.name, rest: !!sp.rest, status: "open",
      exercises: (sp.ex || []).map(e => ({ n: e.n, ts: e.s, tr: e.r, sets: Array.from({ length: Math.max(1, e.s | 0) }, () => ({ w: "", r: "", d: false })) }))
    }
  };
}
const getDay = date => days[date] || blankDay(date);
function mutDay(date, fn, rerender = true) {
  if (!days[date]) days[date] = blankDay(date);
  fn(days[date]);
  scheduleSave(date);
  if (rerender) render();
}

/* ---------- persistence: this device only (localStorage), nothing leaves the phone ---------- */
const KEY_DAYS = "515.days.v1", KEY_PROF = "515.profile.v1";
let saveTimer = null;
function setSave(state, msg) {
  const el = $("#save");
  el.classList.toggle("err", state === "error");
  el.textContent = msg || ({ saving: "Saving…", saved: "Saved on this device", error: "Couldn't save" }[state] || "");
}
function persistNow() {
  try {
    localStorage.setItem(KEY_DAYS, JSON.stringify(days));
    localStorage.setItem(KEY_PROF, JSON.stringify(profile));
    setSave("saved");
  } catch (e) {
    setSave("error", e && e.name === "QuotaExceededError" ? "Storage full. Export a backup, then clear old days." : "Browser blocked saving. Export a backup now.");
  }
}
function scheduleSave() { clearTimeout(saveTimer); setSave("saving"); saveTimer = setTimeout(persistNow, 400); }
const scheduleProfileSave = scheduleSave;
function loadLocal() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY_DAYS) || "null");
    if (d && typeof d === "object") for (const [k, v] of Object.entries(d)) if (/^\d{4}-\d{2}-\d{2}$/.test(k) && v && typeof v === "object") days[k] = v;
    const pr = JSON.parse(localStorage.getItem(KEY_PROF) || "null");
    if (pr && typeof pr === "object") profile = mergeProfile(pr);
    setSave("saved", Object.keys(days).length ? "Saved on this device" : "Ready");
  } catch { setSave("error", "Couldn't read saved data on this browser."); }
}
window.addEventListener("pagehide", persistNow);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") persistNow(); });

/* ---------- training helpers ---------- */
const filled = st => st.w !== "" && st.r !== "" && st.w != null && st.r != null;
const e1rm = (w, r) => r <= 0 ? 0 : (r === 1 ? w : w * (1 + r / 30));
const keyOf = name => String(name || "").trim().toLowerCase();
const sortedDates = () => Object.keys(days).sort();
function lastPerf(name, before) {
  const k = keyOf(name), ds = sortedDates();
  for (let i = ds.length - 1; i >= 0; i--) {
    if (ds[i] >= before) continue;
    const ex = (days[ds[i]].workout?.exercises || []).find(e => keyOf(e.n) === k);
    if (ex) { const sets = ex.sets.filter(filled); if (sets.length) return { date: ds[i], sets, ts: ex.ts, tr: ex.tr }; }
  }
  return null;
}
function knownExercises() {
  const set = new Set();
  for (const d of Object.values(profile.split)) for (const e of d.ex || []) set.add(e.n);
  for (const d of Object.values(days)) for (const e of d.workout?.exercises || []) set.add(e.n);
  return [...set].filter(Boolean).sort((a, b) => a.localeCompare(b));
}
function sessionStats(day) {
  let sets = 0, vol = 0;
  for (const e of day.workout?.exercises || []) for (const st of e.sets) if (st.d && filled(st)) { sets++; vol += n0(st.w) * n0(st.r); }
  return { sets, vol };
}
const macroTotals = day => (day.meals || []).reduce((a, m) => ({ kcal: a.kcal + n0(m.kcal), p: a.p + n0(m.p), c: a.c + n0(m.c), f: a.f + n0(m.f) }), { kcal: 0, p: 0, c: 0, f: 0 });
const isTrainingDay = date => { const d = days[date]; return d ? !d.workout?.rest : !profile.split[parse(date).getDay()]?.rest; };

/* ---------- render shell ---------- */
function render() {
  // keep focus + caret across re-renders
  const a = document.activeElement, fid = a && a.id && $("#main").contains(a) ? a.id : null;
  let sel = null; try { if (fid && a.selectionStart != null) sel = [a.selectionStart, a.selectionEnd]; } catch {}
  const y = window.scrollY;

  const d = parse(cur), t = todayISO();
  $("#datelabel").replaceChildren(
    h("span", { text: cur === t ? "Today" : WDL[d.getDay()] }),
    h("small", { text: `${WDL[d.getDay()]}, ${MON[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}` })
  );
  document.querySelectorAll(".tab").forEach(b => b.setAttribute("aria-selected", String(b.dataset.tab === tab)));
  const main = $("#main");
  main.replaceChildren(...({ train: viewTrain, fuel: viewFuel, progress: viewProgress, plan: viewPlan }[tab])().filter(Boolean));

  if (fid) { const el = document.getElementById(fid); if (el) { el.focus({ preventScroll: true }); if (sel) try { el.setSelectionRange(sel[0], sel[1]); } catch {} } }
  window.scrollTo(0, y);
}

/* ---------- TRAIN ---------- */
function viewTrain() {
  const day = getDay(cur), w = day.workout, unit = profile.unit;
  const st = sessionStats(day);
  const status = w.status === "done" ? h("span", { class: "pill done", text: "Done" }) : w.status === "skipped" ? h("span", { class: "pill skip", text: "Skipped" }) : h("span", { class: "pill", text: w.rest ? "Rest day" : "Open" });

  const head = h("section", {},
    h("div", { class: "dayhead" },
      h("div", {}, h("div", { class: "label", text: WDL[parse(cur).getDay()] + " session" }), h("h2", { text: w.rest && !w.exercises.length ? "Rest" : (w.name || "Session") })),
      status),
    w.exercises.length ? h("div", { class: "statline" },
      h("div", { class: "stat" }, h("div", { class: "label", text: "Sets logged" }), h("div", { class: "v", text: st.sets + " / " + w.exercises.reduce((a, e) => a + e.sets.length, 0) })),
      h("div", { class: "stat" }, h("div", { class: "label", text: "Volume" }), h("div", { class: "v", text: fmt(st.vol) + " " + unit })),
      h("div", { class: "stat" }, h("div", { class: "label", text: "Bodyweight" }),
        h("input", { id: "bw-" + cur, type: "text", inputmode: "decimal", placeholder: unit, value: day.bw || "", style: "width:90px;font-family:var(--mono)",
          oninput: e => mutDay(cur, dd => dd.bw = e.target.value.replace(/[^\d.]/g, "").slice(0, 6), false) }))
    ) : null
  );

  const out = [head];
  if (w.rest && !w.exercises.length) {
    out.push(h("section", {}, h("div", { class: "card stack" },
      h("div", { class: "sub", text: "Recovery is part of the program. Log bodyweight and food, or add work if you're training anyway." }),
      h("div", { class: "row" },
        h("span", { class: "label", text: "Bodyweight" }),
        h("input", { id: "bw-" + cur, type: "text", inputmode: "decimal", placeholder: unit, value: day.bw || "", style: "width:100px;font-family:var(--mono)",
          oninput: e => mutDay(cur, dd => dd.bw = e.target.value.replace(/[^\d.]/g, "").slice(0, 6), false) }))
    )));
  }

  const list = h("section", { class: "stack" });
  w.exercises.forEach((ex, i) => list.append(exerciseCard(ex, i, unit)));
  if (w.exercises.length) out.push(list);

  // add exercise
  const dl = h("datalist", { id: "exlist" }, knownExercises().map(n => h("option", { value: n })));
  const addIn = h("input", { id: "addex", type: "text", placeholder: "Add exercise", list: "exlist", autocomplete: "off" });
  const add = () => {
    const name = addIn.value.trim().slice(0, 60); if (!name) return;
    const lp = lastPerf(name, cur);
    mutDay(cur, dd => { dd.workout.rest = false; dd.workout.exercises.push({ n: name, ts: lp ? lp.sets.length : 3, tr: lp ? (lp.tr || 8) : 8, sets: Array.from({ length: lp ? lp.sets.length : 3 }, () => ({ w: "", r: "", d: false })) }); });
  };
  addIn.addEventListener("keydown", e => { if (e.key === "Enter") add(); });
  out.push(h("section", {}, h("div", { class: "row" }, h("div", { style: "flex:1;min-width:160px" }, addIn, dl), h("button", { class: "btn", onclick: add, text: "Add" }))));

  // session controls
  if (w.exercises.length) {
    out.push(h("section", { class: "row" },
      w.status !== "done" ? h("button", { class: "btn primary", text: "Finish session", onclick: () => mutDay(cur, dd => dd.workout.status = "done") }) : h("button", { class: "btn", text: "Reopen session", onclick: () => mutDay(cur, dd => dd.workout.status = "open") }),
      w.status !== "skipped" && w.status !== "done" ? h("button", { class: "btn ghost", text: "Mark skipped", onclick: () => mutDay(cur, dd => dd.workout.status = "skipped") }) : null,
      w.status === "skipped" ? h("button", { class: "btn ghost", text: "Undo skip", onclick: () => mutDay(cur, dd => dd.workout.status = "open") }) : null
    ));
  }
  out.push(h("section", {}, h("div", { class: "label", text: "Session notes" }),
    h("textarea", { id: "notes-" + cur, placeholder: "How it moved, what hurt, what to change next time", value: day.notes || "",
      oninput: e => mutDay(cur, dd => dd.notes = e.target.value.slice(0, 2000), false) })));
  return out;
}

function exerciseCard(ex, i, unit) {
  const lp = lastPerf(ex.n, cur);
  let hint = null;
  if (lp) {
    const hitAll = lp.sets.length >= (ex.ts || lp.sets.length) && lp.sets.every(st => n0(st.r) >= n0(ex.tr || 0));
    const jump = unit === "kg" ? "2.5 kg" : "5 lb";
    hint = h("div", { class: "hint" },
      h("span", { class: "muted", text: `Last (${nice(lp.date)}): ` }),
      h("span", { class: "mono", text: lp.sets.map(st => `${st.w}×${st.r}`).join("  ") }),
      h("br"),
      hitAll ? h("b", { text: `Hit every rep last time. Add ${jump} to the working sets.` }) : h("span", { text: "Match last time, then beat one set by a rep." }));
  } else hint = h("div", { class: "hint muted", text: "First time logging this one. Set your baseline." });

  const grid = h("div", { class: "sets" },
    h("div", { class: "h", text: "Set" }), h("div", { class: "h", text: unit }), h("div", { class: "h", text: "Reps" }), h("div", { class: "h", text: "✓" }), h("div"));
  ex.sets.forEach((st, j) => {
    const prev = lp && lp.sets[j];
    const upd = (field) => e => {
      const val = e.target.value.replace(/[^\d.]/g, "").slice(0, 6);
      mutDay(cur, dd => { const s2 = dd.workout.exercises[i].sets[j]; s2[field] = val; if (filled(s2) && !s2.touched) s2.d = true; }, false);
      const box = document.getElementById(`d-${i}-${j}`); if (box) box.checked = !!getDay(cur).workout.exercises[i].sets[j].d;
    };
    grid.append(
      h("div", { class: "n", text: j + 1 }),
      h("input", { id: `w-${i}-${j}`, type: "text", inputmode: "decimal", "aria-label": `Set ${j + 1} weight`, placeholder: prev ? String(prev.w) : "", value: st.w, oninput: upd("w") }),
      h("input", { id: `r-${i}-${j}`, type: "text", inputmode: "numeric", "aria-label": `Set ${j + 1} reps`, placeholder: prev ? String(prev.r) : String(ex.tr || ""), value: st.r, oninput: upd("r") }),
      h("input", { id: `d-${i}-${j}`, type: "checkbox", "aria-label": `Set ${j + 1} done`, checked: st.d, onchange: e => mutDay(cur, dd => { const s2 = dd.workout.exercises[i].sets[j]; s2.d = e.target.checked; s2.touched = true; }, false) }),
      h("button", { class: "x", "aria-label": `Remove set ${j + 1}`, text: "×", onclick: () => mutDay(cur, dd => { const arr = dd.workout.exercises[i].sets; if (arr.length > 1) arr.splice(j, 1); }) })
    );
  });

  return h("div", { class: "ex" },
    h("div", { class: "exhead" },
      h("div", { class: "exname", text: ex.n }),
      h("div", { class: "row", style: "gap:4px;flex-wrap:nowrap" },
        h("span", { class: "target", text: ex.ts && ex.tr ? `${ex.ts} × ${ex.tr}` : "" }),
        h("button", { class: "x", "aria-label": "Remove " + ex.n, text: "×", onclick: () => mutDay(cur, dd => dd.workout.exercises.splice(i, 1)) }))),
    hint, grid,
    h("div", { style: "margin-top:8px" }, h("button", { class: "btn small ghost", text: "+ Set", onclick: () => mutDay(cur, dd => { const arr = dd.workout.exercises[i].sets; const last = arr[arr.length - 1]; arr.push({ w: last ? last.w : "", r: "", d: false }); }) }))
  );
}

/* ---------- FUEL ---------- */
const MACROS = [
  { k: "kcal", name: "Calories", unit: "kcal", color: "var(--ink)" },
  { k: "p", name: "Protein", unit: "g", color: "var(--red)" },
  { k: "c", name: "Carbs", unit: "g", color: "var(--blue)" },
  { k: "f", name: "Fat", unit: "g", color: "var(--yellow)" }
];
function addMeal(m) {
  const meal = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), t: new Date().toTimeString().slice(0, 5), n: String(m.n || "Meal").slice(0, 60), kcal: clampNum(m.kcal), p: clampNum(m.p, 1000), c: clampNum(m.c, 2000), f: clampNum(m.f, 1000) };
  if (!meal.kcal) meal.kcal = meal.p * 4 + meal.c * 4 + meal.f * 9;
  mutDay(cur, dd => dd.meals.push(meal));
}
function viewFuel() {
  const day = getDay(cur), tot = macroTotals(day), T = profile.targets;
  const meters = h("div", { class: "meters" }, MACROS.map(m => {
    const tgt = n0(T[m.k]) || 1, val = tot[m.k], pct = Math.min(100, (val / tgt) * 100), left = tgt - val;
    return h("div", { class: "meter" },
      h("div", { class: "top2" },
        h("span", { class: "name" }, h("span", { class: "dot", style: `background:${m.color}` }), m.name),
        h("span", { class: "v", text: `${fmt(val)} / ${fmt(tgt)} ${m.unit} · ${left >= 0 ? fmt(left) + " left" : fmt(-left) + " over"}` })),
      h("div", { class: "bar", role: "meter", "aria-valuemin": 0, "aria-valuemax": tgt, "aria-valuenow": Math.round(val), "aria-label": m.name }, h("i", { style: `width:${pct}%;background:${m.color}` })));
  }));

  const chips = h("div", { class: "chips" }, profile.foods.map(f =>
    h("button", { class: "chip", onclick: () => addMeal(f), title: `${f.kcal} kcal · P${f.p} C${f.c} F${f.f}` }, f.n, h("small", { text: `${f.kcal}` }))));

  // manual form
  const D = ui.draft;
  const fld = (k, label, mode, cls) => h("label", { class: "fieldl " + (cls || "") }, h("span", { text: label }),
    h("input", { id: "m-" + k, type: "text", inputmode: mode, value: D[k], oninput: e => { D[k] = k === "name" ? e.target.value.slice(0, 60) : e.target.value.replace(/[^\d.]/g, "").slice(0, 6); } }));
  const form = h("div", { class: "stack" },
    h("div", { class: "macrogrid" }, fld("name", "Food", "text", "full"), fld("kcal", "kcal", "numeric"), fld("p", "Protein g", "numeric"), fld("c", "Carbs g", "numeric"), fld("f", "Fat g", "numeric")),
    h("div", { class: "row" },
      h("button", { class: "btn primary", text: "Add to log", onclick: () => {
        if (!D.name.trim() && !D.kcal && !D.p && !D.c && !D.f) return;
        const m = { n: D.name.trim() || "Meal", kcal: D.kcal, p: D.p, c: D.c, f: D.f };
        if (D.fav) { const f = { n: m.n.slice(0, 40), kcal: clampNum(m.kcal) || clampNum(m.p) * 4 + clampNum(m.c) * 4 + clampNum(m.f) * 9, p: clampNum(m.p), c: clampNum(m.c), f: clampNum(m.f) }; profile.foods.push(f); scheduleProfileSave(); }
        ui.draft = { name: "", kcal: "", p: "", c: "", f: "", fav: false };
        addMeal(m);
      } }),
      h("label", { class: "row", style: "gap:6px" }, h("input", { id: "m-fav", type: "checkbox", checked: D.fav, onchange: e => D.fav = e.target.checked }), h("span", { class: "sub", text: "Save as a quick add" })),
      h("span", { class: "muted", style: "font-size:12px", text: "Leave kcal blank to compute it from macros." })));

  const meals = h("div", {}, day.meals.length ? day.meals.map((m, i) =>
    h("div", { class: "meal" },
      h("div", { style: "min-width:0" }, h("div", { text: m.n, style: "font-weight:500;overflow-wrap:anywhere" }), h("div", { class: "muted mono", style: "font-size:12px", text: m.t || "" })),
      h("div", { class: "m", text: `${m.kcal} · ${m.p}P ${m.c}C ${m.f}F` }),
      h("button", { class: "x", "aria-label": "Remove " + m.n, text: "×", onclick: () => mutDay(cur, dd => dd.meals.splice(i, 1)) }))) :
    h("div", { class: "muted", text: "Nothing logged for this day yet. Tap a quick add or enter a meal above." }));


  return [
    h("section", {}, h("div", { class: "label", text: "Fuel" }), h("h2", { text: `${fmt(tot.p)}g protein` }), h("div", { class: "sub", style: "margin-top:4px", text: `${fmt(Math.max(0, T.p - tot.p))}g to go on a ${fmt(T.p)}g target` })),
    h("section", { class: "card" }, meters),
    h("section", { class: "stack" }, h("h3", { text: "Quick add" }), chips),
    h("section", { class: "stack" }, h("h3", { text: "Find food" }), findFoodCard()),
    h("section", { class: "stack" }, h("h3", { text: "Log a meal" }), form),
    h("section", { class: "stack" }, h("h3", { text: "Today's log" }), h("div", { class: "card", style: "padding-block:4px" }, meals))
  ];
}

/* ---------- PROGRESS ---------- */
function weekInfo() {
  const mon = mondayOf(cur), t = todayISO();
  const cells = [];
  let done = 0, planned = 0, missed = 0;
  for (let i = 0; i < 7; i++) {
    const date = addDays(mon, i), d = days[date], train = isTrainingDay(date);
    const status = d?.workout?.status;
    let cls = "", sym = "·";
    if (train) planned++;
    if (status === "done") { cls = "done"; sym = "✓"; done++; }
    else if (!train) { sym = "–"; }
    else if (status === "skipped" || date < t) { cls = "miss"; sym = "✕"; missed++; }
    cells.push({ date, cls: cls + (date === t ? " today" : ""), sym, wd: WD[parse(date).getDay()] });
  }
  return { cells, done, planned, missed };
}
function viewProgress() {
  const wk = weekInfo();
  const out = [];
  let verdict;
  if (profile.vacation) verdict = "Vacation mode is on. Misses aren't counted.";
  else if (wk.missed > 2) verdict = `${wk.missed} planned sessions missed this week. That's past your line of two. Get the next one in before anything else on the calendar.`;
  else if (wk.missed > 0) verdict = `${wk.missed} missed so far. Still inside your line of two.`;
  else verdict = wk.done ? "No misses this week. Keep it that way." : "Fresh week. First session sets the tone.";
  out.push(h("section", {},
    h("div", { class: "label", text: `Week of ${nice(mondayOf(cur))}` }),
    h("h2", { text: `${wk.done} of ${wk.planned} sessions` }),
    h("div", { class: "week" }, wk.cells.map(c => h("div", { class: "wd " + c.cls, title: c.date }, h("div", { class: "l", text: c.wd }), h("div", { class: "s", text: c.sym })))),
    h("div", { class: wk.missed > 2 && !profile.vacation ? "notice" : "sub", style: "margin-top:10px" + (wk.missed > 2 && !profile.vacation ? ";border-color:var(--red);color:var(--ink)" : ""), text: verdict })
  ));

  // bodyweight
  const W = chartWidth();
  const bwPts = sortedDates().filter(d => d >= addDays(cur, -90) && d <= cur && n0(days[d].bw) > 0).map(d => ({ d, v: n0(days[d].bw) }));
  out.push(h("section", { class: "stack" }, h("div", { class: "spread" }, h("h3", { text: "Bodyweight, 90 days" }),
      bwPts.length ? h("span", { class: "mono sub", text: `${bwPts[bwPts.length - 1].v} ${profile.unit}` + (bwPts.length > 1 ? `  (${signed(bwPts[bwPts.length - 1].v - bwPts[0].v)} since ${nice(bwPts[0].d)})` : "") }) : null),
    bwPts.length >= 2 ? h("div", { class: "card chartbox" }, lineChart(bwPts, W, n0(profile.goalBw) || null)) :
      h("div", { class: "notice", text: "Log bodyweight on the Train tab. The trend shows up after two entries." })));

  // calories
  const cal = []; for (let i = 13; i >= 0; i--) { const d = addDays(cur, -i); cal.push({ d, v: days[d] ? macroTotals(days[d]).kcal : 0, p: days[d] ? macroTotals(days[d]).p : 0 }); }
  const logged = cal.filter(x => x.v > 0);
  const avgK = logged.length ? logged.reduce((a, x) => a + x.v, 0) / logged.length : 0;
  const avgP = logged.length ? logged.reduce((a, x) => a + x.p, 0) / logged.length : 0;
  out.push(h("section", { class: "stack" }, h("div", { class: "spread" }, h("h3", { text: "Calories, 14 days" }),
      logged.length ? h("span", { class: "mono sub", text: `avg ${fmt(avgK)} kcal · ${fmt(avgP)}g P` }) : null),
    logged.length ? h("div", { class: "card chartbox" }, barChart(cal, W, n0(profile.targets.kcal))) :
      h("div", { class: "notice", text: "Log meals on the Fuel tab. Daily totals land here against your target line." })));

  // PRs
  const prs = {}, hist = {};
  for (const d of sortedDates()) for (const ex of days[d].workout?.exercises || []) {
    const k = keyOf(ex.n); let best = 0, bs = null;
    for (const st of ex.sets) if (filled(st)) { const v = e1rm(n0(st.w), n0(st.r)); if (v > best) { best = v; bs = st; } }
    if (!bs) continue;
    (hist[k] ||= { n: ex.n, pts: [] }).pts.push({ d, v: best });
    if (!prs[k] || best > prs[k].e) prs[k] = { n: ex.n, e: best, w: bs.w, r: bs.r, d };
  }
  const prList = Object.values(prs).sort((a, b) => b.e - a.e);
  if (prList.length) {
    if (!ui.lift || !hist[ui.lift]) ui.lift = keyOf(prList[0].n);
    const sel = h("select", { id: "liftsel", style: "width:auto", onchange: e => { ui.lift = e.target.value; lsSet("515.lift", ui.lift); render(); } },
      prList.map(p => h("option", { value: keyOf(p.n), text: p.n, selected: keyOf(p.n) === ui.lift })));
    const hp = hist[ui.lift].pts;
    out.push(h("section", { class: "stack" },
      h("div", { class: "spread" }, h("h3", { text: "Estimated 1RM" }), sel),
      hp.length >= 2 ? h("div", { class: "card chartbox" }, lineChart(hp, W, null)) : h("div", { class: "notice", text: "One session logged for this lift. The trend appears after the next." }),
      h("div", { class: "tblwrap" }, h("table", { class: "tbl" },
        h("thead", {}, h("tr", {}, h("th", { text: "Lift" }), h("th", { text: "Best set" }), h("th", { text: "e1RM" }), h("th", { text: "Date" }))),
        h("tbody", {}, prList.slice(0, 15).map(p => h("tr", {}, h("td", { text: p.n }), h("td", { class: "num mono", text: `${p.w}×${p.r}` }), h("td", { class: "num mono", text: `${Math.round(p.e)} ${profile.unit}` }), h("td", { class: "num mono", text: nice(p.d) })))))),
      h("div", { class: "muted", style: "font-size:12px", text: "e1RM uses the Epley formula: weight × (1 + reps ÷ 30)." })));
  } else {
    out.push(h("section", { class: "stack" }, h("h3", { text: "Estimated 1RM" }), h("div", { class: "notice", text: "Log working sets on the Train tab. Your best set per lift and its trend show up here." })));
  }

  return out;
}
const signed = v => (v > 0 ? "+" : "") + (Math.round(v * 10) / 10);
function chartWidth() { const m = $("#main"); return Math.max(300, Math.min(686, (m ? m.clientWidth : 360) - 32 - 30)); }

function scaleY(vals, extra) {
  const all = vals.concat(extra != null ? [extra] : []);
  let lo = Math.min(...all), hi = Math.max(...all);
  if (lo === hi) { lo -= 1; hi += 1; }
  const step = niceStep((hi - lo) / 4);
  lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
  const ticks = []; for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);
  return { lo, hi, ticks };
}
function niceStep(raw) { const p = Math.pow(10, Math.floor(Math.log10(raw || 1))); const m = raw / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; }

function lineChart(pts, W, goal) {
  const H = 190, L = 44, R = 12, T = 12, B = 26;
  const t0 = parse(pts[0].d).getTime(), t1 = parse(pts[pts.length - 1].d).getTime() || t0 + 1;
  const { lo, hi, ticks } = scaleY(pts.map(p => p.v), goal);
  const x = d => L + ((parse(d).getTime() - t0) / Math.max(1, t1 - t0)) * (W - L - R);
  const y = v => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const svg = s("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Trend chart" });
  for (const tk of ticks) svg.append(s("line", { x1: L, x2: W - R, y1: y(tk), y2: y(tk), stroke: "var(--line)", "stroke-width": 1 }), s("text", { x: L - 6, y: y(tk) + 4, "text-anchor": "end" }, String(tk)));
  svg.append(s("text", { x: L, y: H - 6 }, nice(pts[0].d)), s("text", { x: W - R, y: H - 6, "text-anchor": "end" }, nice(pts[pts.length - 1].d)));
  if (goal) svg.append(s("line", { x1: L, x2: W - R, y1: y(goal), y2: y(goal), stroke: "var(--green)", "stroke-width": 1.5, "stroke-dasharray": "5 4" }), s("text", { x: W - R, y: y(goal) - 5, "text-anchor": "end", style: "fill:var(--green)" }, "goal " + goal));
  const d = pts.map((p, i) => (i ? "L" : "M") + x(p.d).toFixed(1) + " " + y(p.v).toFixed(1)).join(" ");
  const area = d + ` L${x(pts[pts.length - 1].d).toFixed(1)} ${H - B} L${x(pts[0].d).toFixed(1)} ${H - B} Z`;
  svg.append(s("path", { d: area, fill: "var(--red)", opacity: .08 }), s("path", { d, fill: "none", stroke: "var(--red)", "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }));
  pts.forEach((p, i) => {
    const last = i === pts.length - 1;
    svg.append(s("circle", { cx: x(p.d), cy: y(p.v), r: last ? 5 : 3, fill: "var(--red)", stroke: "var(--surface)", "stroke-width": 2 }));
    svg.append(s("circle", { cx: x(p.d), cy: y(p.v), r: 12, fill: "transparent", "data-tip": `${nice(p.d)}: ${Math.round(p.v * 10) / 10} ${profile.unit}` }));
  });
  return svg;
}
function barChart(pts, W, target) {
  const H = 180, L = 44, R = 12, T = 12, B = 26;
  const { hi, ticks } = scaleY(pts.map(p => p.v).concat([0]), target);
  const lo = 0;
  const bw = (W - L - R) / pts.length;
  const y = v => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const svg = s("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Daily calories" });
  for (const tk of ticks) svg.append(s("line", { x1: L, x2: W - R, y1: y(tk), y2: y(tk), stroke: "var(--line)" }), s("text", { x: L - 6, y: y(tk) + 4, "text-anchor": "end" }, fmt(tk)));
  pts.forEach((p, i) => {
    const bx = L + i * bw + 2, w = Math.max(2, bw - 4), top = y(p.v), base = y(0);
    if (p.v > 0) {
      const r = Math.min(4, w / 2, base - top);
      svg.append(s("path", { d: `M${bx} ${base} V${top + r} Q${bx} ${top} ${bx + r} ${top} H${bx + w - r} Q${bx + w} ${top} ${bx + w} ${top + r} V${base} Z`, fill: p.v > target * 1.05 ? "var(--yellow)" : "var(--blue)" }));
    }
    svg.append(s("rect", { x: L + i * bw, y: T, width: bw, height: H - T - B, fill: "transparent", "data-tip": `${nice(p.d)}: ${fmt(p.v)} kcal` }));
    if (i === 0 || i === pts.length - 1 || i === 7) svg.append(s("text", { x: bx + w / 2, y: H - 6, "text-anchor": "middle" }, nice(p.d)));
  });
  if (target) svg.append(s("line", { x1: L, x2: W - R, y1: y(target), y2: y(target), stroke: "var(--ink)", "stroke-width": 1.5, "stroke-dasharray": "5 4" }), s("text", { x: W - R, y: y(target) - 5, "text-anchor": "end", style: "fill:var(--ink2)" }, "target " + fmt(target)));
  return svg;
}

/* ---------- PLAN ---------- */
function viewPlan() {
  const P = profile, T = P.targets;
  const pset = (fn) => { fn(P); scheduleProfileSave(); };
  const numIn = (id, val, fn) => h("input", { id, type: "text", inputmode: "numeric", value: val, style: "font-family:var(--mono)", oninput: e => { const v = e.target.value.replace(/[^\d.]/g, "").slice(0, 6); pset(p => fn(p, v)); } });

  const targets = h("div", { class: "card stack" },
    h("div", { class: "grid2" },
      h("label", { class: "fieldl" }, h("span", { text: "Calories" }), numIn("t-kcal", T.kcal, (p, v) => p.targets.kcal = clampNum(v))),
      h("label", { class: "fieldl" }, h("span", { text: "Protein g" }), numIn("t-p", T.p, (p, v) => p.targets.p = clampNum(v))),
      h("label", { class: "fieldl" }, h("span", { text: "Carbs g" }), numIn("t-c", T.c, (p, v) => p.targets.c = clampNum(v))),
      h("label", { class: "fieldl" }, h("span", { text: "Fat g" }), numIn("t-f", T.f, (p, v) => p.targets.f = clampNum(v))),
      h("label", { class: "fieldl" }, h("span", { text: "Goal bodyweight" }), numIn("t-goal", P.goalBw || "", (p, v) => p.goalBw = v)),
      h("label", { class: "fieldl" }, h("span", { text: "Units" }), h("select", { id: "t-unit", onchange: e => pset(p => p.unit = e.target.value === "kg" ? "kg" : "lb") }, h("option", { value: "lb", text: "lb", selected: P.unit === "lb" }), h("option", { value: "kg", text: "kg", selected: P.unit === "kg" })))),
    h("div", { class: "muted", style: "font-size:12.5px", text: `Macros add up to ${fmt(T.p * 4 + T.c * 4 + T.f * 9)} kcal against a ${fmt(T.kcal)} kcal target.` }),
    h("label", { class: "row", style: "gap:8px" }, h("input", { id: "t-vac", type: "checkbox", checked: P.vacation, onchange: e => { pset(p => p.vacation = e.target.checked); render(); } }), h("span", { text: "Vacation mode (missed sessions don't count against the week)" })));

  const prefs = h("div", { class: "card stack" },
    h("label", { class: "fieldl" }, h("span", { text: "Foods you like" }), h("input", { id: "pf-like", type: "text", value: P.likes, oninput: e => pset(p => p.likes = e.target.value.slice(0, 400)) })),
    h("label", { class: "fieldl" }, h("span", { text: "Never suggest" }), h("input", { id: "pf-dis", type: "text", value: P.dislikes, oninput: e => pset(p => p.dislikes = e.target.value.slice(0, 400)) })),
    h("div", { class: "muted", style: "font-size:12.5px", text: "Claude uses these when suggesting food to close out a day." }));

  const order = [1, 2, 3, 4, 5, 6, 0];
  const split = h("div", { class: "card" }, order.map(i => {
    const sd = P.split[i];
    return h("div", { class: "splitday" },
      h("div", { class: "row" },
        h("span", { class: "label", style: "width:34px", text: WD[i] }),
        h("input", { id: `sp-n-${i}`, type: "text", value: sd.name, style: "flex:1;min-width:120px;font-weight:600", oninput: e => pset(p => p.split[i].name = e.target.value.slice(0, 30)) }),
        h("label", { class: "row", style: "gap:6px" }, h("input", { id: `sp-r-${i}`, type: "checkbox", checked: sd.rest, onchange: e => { pset(p => p.split[i].rest = e.target.checked); render(); } }), h("span", { class: "sub", text: "Rest" }))),
      sd.rest ? null : h("div", {},
        h("div", { class: "exrow", style: "margin-top:8px" }, h("span", { class: "label", text: "Exercise" }), h("span", { class: "label", text: "Sets" }), h("span", { class: "label", text: "Reps" }), h("span")),
        sd.ex.map((e, j) => h("div", { class: "exrow" },
          h("input", { id: `sp-${i}-${j}-n`, type: "text", value: e.n, list: "exlist2", oninput: ev => pset(p => p.split[i].ex[j].n = ev.target.value.slice(0, 60)) }),
          h("input", { id: `sp-${i}-${j}-s`, type: "text", inputmode: "numeric", value: e.s, style: "text-align:center;font-family:var(--mono)", oninput: ev => pset(p => p.split[i].ex[j].s = Math.min(12, clampNum(ev.target.value)) || 1) }),
          h("input", { id: `sp-${i}-${j}-r`, type: "text", inputmode: "numeric", value: e.r, style: "text-align:center;font-family:var(--mono)", oninput: ev => pset(p => p.split[i].ex[j].r = Math.min(100, clampNum(ev.target.value))) }),
          h("button", { class: "x", "aria-label": "Remove " + e.n, text: "×", onclick: () => { pset(p => p.split[i].ex.splice(j, 1)); render(); } }))),
        h("button", { class: "btn small ghost", style: "margin-top:6px", text: "+ Exercise", onclick: () => { pset(p => p.split[i].ex.push({ n: "", s: 3, r: 10 })); render(); setTimeout(() => document.getElementById(`sp-${i}-${P.split[i].ex.length - 1}-n`)?.focus(), 0); } })));
  }), h("datalist", { id: "exlist2" }, knownExercises().map(n => h("option", { value: n }))));

  const foods = h("div", { class: "card", style: "padding-block:4px" }, P.foods.length ? P.foods.map((f, i) => h("div", { class: "meal" },
    h("div", { text: f.n, style: "min-width:0;overflow-wrap:anywhere" }), h("div", { class: "m", text: `${f.kcal} · ${f.p}P ${f.c}C ${f.f}F` }),
    h("button", { class: "x", "aria-label": "Remove " + f.n, text: "×", onclick: () => { pset(p => p.foods.splice(i, 1)); render(); } }))) :
    h("div", { class: "muted", style: "padding:10px 0", text: "No quick adds. Tick “Save as a quick add” when logging a meal." }));

  const nDays = Object.keys(days).length;
  const fileIn = h("input", { id: "importfile", type: "file", accept: "application/json,.json", hidden: true, onchange: e => importBackup(e.target.files && e.target.files[0], e.target) });
  const data = h("div", { class: "card stack" },
    h("div", { class: "sub", text: `${nDays} day${nDays === 1 ? "" : "s"} saved on this device. Your log is never sent anywhere. Deleting the app or clearing browser data erases it, so export a backup weekly.` }),
    backupLine(),
    h("div", { class: "row" },
      h("button", { class: "btn", text: "Export backup", onclick: exportBackup }),
      h("button", { class: "btn", text: "Import backup", onclick: () => fileIn.click() }), fileIn),
    ui.importMsg ? h("div", { class: "notice", text: ui.importMsg }) : null);

  return [
    h("section", {}, h("div", { class: "label", text: "Plan" }), h("h2", { text: "Targets & split" })),
    h("section", { class: "stack" }, h("h3", { text: "Daily targets" }), targets),
    h("section", { class: "stack" }, h("h3", { text: "Weekly split" }), h("div", { class: "muted", style: "font-size:13px", text: "Changes apply to days you haven't logged yet. Logged days keep what you did." }), split),
    h("section", { class: "stack" }, h("h3", { text: "Food preferences" }), prefs),
    h("section", { class: "stack" }, h("h3", { text: "Quick adds" }), foods),
    h("section", { class: "stack" }, h("h3", { text: "Food search key" }), keyCard()),
    h("section", { class: "stack" }, h("h3", { text: "Your data" }), data)
  ];
}

/* ---------- food lookup: Open Food Facts (barcodes) + USDA FoodData Central (search) ---------- */
const OFF_URL = code => `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,brands,serving_size,serving_quantity,nutriments`;
const FDC_URL = (q, key) => `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(key)}&query=${encodeURIComponent(q)}&pageSize=15&dataType=${encodeURIComponent("Foundation,SR Legacy,Survey (FNDDS),Branded")}`;
const getKey = () => (lsGet("515.fdcKey") || "").trim();
const numOr = v => { const x = Number(v); return Number.isFinite(x) && x >= 0 ? x : null; };
const titleCase = str => str && str === str.toUpperCase() ? str.toLowerCase().replace(/\b\w/g, ch => ch.toUpperCase()) : str;

async function fetchJSON(url, ms = 12000) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, referrerPolicy: "no-referrer", credentials: "omit", cache: "no-store" });
    if (!r.ok) { const e = new Error("http " + r.status); e.status = r.status; throw e; }
    return await r.json();
  } finally { clearTimeout(t); }
}
function fillKcal(m) {
  if (m.kcal == null && m.p == null && m.c == null && m.f == null) return null;
  const o = { kcal: m.kcal, p: m.p || 0, c: m.c || 0, f: m.f || 0 };
  if (o.kcal == null) o.kcal = o.p * 4 + o.c * 4 + o.f * 9;
  return o;
}
function parseOFF(j, code) {
  if (!j || j.status !== 1 || !j.product) return null;
  const p = j.product, n = p.nutriments || {};
  const pick = suf => {
    let kcal = numOr(n["energy-kcal" + suf]);
    if (kcal == null && numOr(n["energy" + suf]) != null) kcal = numOr(n["energy" + suf]) / 4.184; // energy_* is kJ
    return fillKcal({ kcal, p: numOr(n["proteins" + suf]), c: numOr(n["carbohydrates" + suf]), f: numOr(n["fat" + suf]) });
  };
  const sq = numOr(p.serving_quantity);
  return { src: "off", id: code, name: String(p.product_name || "").trim().slice(0, 60) || "Product " + code,
    brand: String(p.brands || "").split(",")[0].trim().slice(0, 40), per100: pick("_100g"), perServing: pick("_serving"),
    servingG: sq && sq > 0 ? sq : null, servingLabel: String(p.serving_size || "").slice(0, 40) };
}
function parseFDC(f) {
  const ns = Array.isArray(f.foodNutrients) ? f.foodNutrients : [];
  const get = (ids, nums, unit) => {
    for (const n of ns) if ((ids.includes(n.nutrientId) || nums.includes(String(n.nutrientNumber))) && (!unit || String(n.unitName || "").toUpperCase() === unit)) { const v = numOr(n.value); if (v != null) return v; }
    return null;
  };
  const unit = String(f.servingSizeUnit || "").toLowerCase(), sg = unit === "g" || unit === "grm" ? numOr(f.servingSize) : null;
  return { src: "usda", id: String(f.fdcId), name: titleCase(String(f.description || "Food")).slice(0, 60),
    brand: titleCase(String(f.brandName || f.brandOwner || "")).slice(0, 40),
    per100: fillKcal({ kcal: get([1008, 2048, 2047], ["208", "958", "957"], "KCAL"), p: get([1003], ["203"]), c: get([1005], ["205"]), f: get([1004], ["204"]) }),
    perServing: null, servingG: sg && sg > 0 ? sg : null, servingLabel: String(f.householdServingFullText || "").slice(0, 40) };
}
function foodCache() { try { return JSON.parse(lsGet("515.foodcache") || "{}") || {}; } catch { return {}; } }
function cachePut(code, item) { const c = foodCache(); c[code] = item; const ks = Object.keys(c); if (ks.length > 300) delete c[ks[0]]; lsSet("515.foodcache", JSON.stringify(c)); }

function choose(item) {
  const F = ui.food;
  F.pick = item; F.err = "";
  F.unit = item.perServing || (item.per100 && item.servingG) ? "serving" : "g";
  F.amt = F.unit === "serving" ? "1" : "100";
  render();
}
function portion(it, amt, unit) {
  const a = numOr(amt); if (!a) return null;
  let base, mult;
  if (unit === "serving") {
    if (it.perServing) { base = it.perServing; mult = a; }
    else if (it.per100 && it.servingG) { base = it.per100; mult = a * it.servingG / 100; }
    else return null;
  } else { if (!it.per100) return null; base = it.per100; mult = (unit === "oz" ? a * 28.3495 : a) / 100; }
  return { kcal: Math.round(base.kcal * mult), p: Math.round(base.p * mult), c: Math.round(base.c * mult), f: Math.round(base.f * mult) };
}

async function searchFoods() {
  const F = ui.food, q = F.q.trim().slice(0, 80);
  if (!q || F.busy) return;
  F.busy = true; F.err = ""; F.results = []; F.pick = null; render();
  try {
    const j = await fetchJSON(FDC_URL(q, getKey() || "DEMO_KEY"));
    F.results = (Array.isArray(j && j.foods) ? j.foods : []).map(parseFDC).filter(x => x.per100).slice(0, 15);
    if (!F.results.length) F.err = "No matches. Try fewer words, like “sirloin cooked”.";
  } catch (e) {
    F.err = !navigator.onLine ? "No signal. Enter the macros by hand below."
      : e.status === 403 ? "USDA rejected the search key. Check it on the Plan tab."
      : e.status === 429 ? (getKey() ? "Hourly search limit reached. Try again shortly." : "The shared demo key is maxed out. Add your free key on the Plan tab.")
      : "Search failed. Try again.";
  } finally { F.busy = false; render(); }
}
async function lookupBarcode(raw) {
  const F = ui.food, code = String(raw || "").replace(/\D/g, "");
  if (code.length < 6 || code.length > 14) { F.err = "That barcode doesn't look right. It should be 8 to 14 digits."; render(); return; }
  const cached = foodCache()[code];
  if (cached) { choose(cached); return; }
  F.busy = true; F.err = ""; F.results = []; F.pick = null; render();
  try {
    const item = parseOFF(await fetchJSON(OFF_URL(code)), code);
    if (!item) F.err = `Barcode ${code} isn't in the database. Search by name or enter it from the label.`;
    else if (!item.per100 && !item.perServing) { F.err = `Found “${item.name}” but it has no nutrition data. Enter it from the label.`; ui.draft.name = item.name; }
    else { cachePut(code, item); F.busy = false; choose(item); return; }
  } catch (e) {
    F.err = !navigator.onLine ? "No signal. Barcode lookup needs a connection; enter it by hand below."
      : e.status === 404 ? `Barcode ${code} isn't in the database. Search by name or enter it from the label.`
      : "Lookup failed. Try again.";
  }
  F.busy = false; render();
}

function findFoodCard() {
  const F = ui.food;
  const card = h("div", { class: "card stack" });
  const qIn = h("input", { id: "foodq", type: "search", enterkeyhint: "search", autocomplete: "off", placeholder: "Search: sirloin cooked, white rice, chobani", value: F.q,
    oninput: e => F.q = e.target.value.slice(0, 80), onkeydown: e => { if (e.key === "Enter") { e.preventDefault(); searchFoods(); } } });
  card.append(
    h("button", { class: "btn primary scanbtn", text: "Scan barcode", onclick: startScan }),
    h("div", { class: "row", style: "flex-wrap:nowrap" },
      h("div", { style: "flex:1;min-width:0" }, qIn),
      h("button", { class: "btn", disabled: F.busy, text: "Search", onclick: searchFoods })));
  if (F.busy) card.append(h("div", { class: "muted", text: "Looking it up…" }));
  if (F.err) card.append(h("div", { class: "notice", text: F.err }));
  if (F.pick) card.append(portionPanel(F.pick));
  else if (F.results.length) card.append(h("div", { class: "results" }, F.results.map(it =>
    h("button", { class: "result", onclick: () => choose(it) },
      h("span", { class: "rn", text: it.name }),
      it.brand ? h("span", { class: "rb", text: it.brand }) : null,
      h("span", { class: "rm mono", text: `${Math.round(it.per100.kcal)} kcal · ${Math.round(it.per100.p)}P ${Math.round(it.per100.c)}C ${Math.round(it.per100.f)}F per 100 g` })))));
  card.append(h("details", {},
    h("summary", { class: "muted", text: "Type a barcode instead" }),
    h("div", { class: "row", style: "margin-top:8px" },
      h("input", { id: "codein", type: "text", inputmode: "numeric", placeholder: "UPC / EAN digits", value: F.code, style: "flex:1;min-width:140px", oninput: e => { F.code = e.target.value.replace(/\D/g, "").slice(0, 14); e.target.value = F.code; } }),
      h("button", { class: "btn", text: "Look up", onclick: () => lookupBarcode(F.code) }))));
  return card;
}
function portionPanel(it) {
  const F = ui.food, units = [];
  if (it.perServing || (it.per100 && it.servingG)) units.push(["serving", "servings" + (it.servingLabel ? ` (${it.servingLabel})` : it.servingG ? ` (${it.servingG} g)` : "")]);
  if (it.per100) { units.push(["g", "grams"]); units.push(["oz", "ounces"]); }
  if (!units.some(u => u[0] === F.unit)) F.unit = units[0][0];
  const out = h("div", { class: "mono portion", id: "portionout" });
  const upd = () => { const m = portion(it, F.amt, F.unit); out.textContent = m ? `${m.kcal} kcal · ${m.p}P ${m.c}C ${m.f}F` : "Enter an amount"; };
  upd();
  return h("div", { class: "pick stack" },
    h("div", { class: "spread" },
      h("div", { style: "min-width:0;flex:1" }, h("div", { style: "font-weight:600;overflow-wrap:anywhere", text: it.name }), it.brand ? h("div", { class: "muted", style: "font-size:13px", text: it.brand }) : null),
      h("span", { class: "pill", text: it.src === "off" ? "Open Food Facts" : "USDA" })),
    h("div", { class: "row" },
      h("input", { id: "pamt", type: "text", inputmode: "decimal", "aria-label": "Amount", value: F.amt, style: "width:90px;font-family:var(--mono)", oninput: e => { F.amt = e.target.value.replace(/[^\d.]/g, "").slice(0, 6); upd(); } }),
      h("select", { id: "punit", "aria-label": "Unit", style: "width:auto;flex:1;min-width:120px", onchange: e => { F.unit = e.target.value; upd(); } }, units.map(([v, l]) => h("option", { value: v, text: l, selected: v === F.unit })))),
    out,
    h("div", { class: "row" },
      h("button", { class: "btn primary", text: "Add to log", onclick: () => {
        const m = portion(it, F.amt, F.unit); if (!m) return;
        const amtTxt = F.unit === "serving" ? (Number(F.amt) === 1 ? "" : ` ×${F.amt}`) : `, ${F.amt} ${F.unit}`;
        const label = (it.name + amtTxt).slice(0, 60);
        if (F.fav) { profile.foods.push(Object.assign({ n: label.slice(0, 40) }, m)); scheduleProfileSave(); }
        F.pick = null; F.results = []; F.q = ""; F.fav = false; F.err = "";
        addMeal(Object.assign({ n: label }, m));
      } }),
      h("label", { class: "row", style: "gap:6px" }, h("input", { id: "pfav", type: "checkbox", checked: F.fav, onchange: e => F.fav = e.target.checked }), h("span", { class: "sub", text: "Save as a quick add" })),
      h("button", { class: "btn ghost", text: "Back", onclick: () => { F.pick = null; render(); } })),
    h("div", { class: "muted", style: "font-size:12px", text: "Database values can be off. Check against the label when you have it." }));
}

/* camera scanner (library loads only when you tap Scan) */
let scanner = null;
function loadScript(src) {
  return new Promise((res, rej) => {
    if (window.__Html5QrcodeLibrary__) return res();
    const el = document.createElement("script"); el.src = src; el.onload = res; el.onerror = () => rej(new Error("load")); document.head.append(el);
  });
}
async function startScan() {
  const F = ui.food; F.err = "";
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { F.err = "This browser can't use the camera here. Type the barcode instead."; render(); return; }
  $("#scanwrap").hidden = false; $("#scanmsg").textContent = "Starting camera…"; document.body.style.overflow = "hidden";
  try {
    await loadScript("vendor/html5-qrcode.min.js");
    const L = window.__Html5QrcodeLibrary__, Fm = L.Html5QrcodeSupportedFormats;
    scanner = new L.Html5Qrcode("reader", { verbose: false, formatsToSupport: [Fm.EAN_13, Fm.EAN_8, Fm.UPC_A, Fm.UPC_E], experimentalFeatures: { useBarCodeDetectorIfSupported: true } });
    let done = false;
    await scanner.start({ facingMode: "environment" },
      { fps: 12, qrbox: (w, hh) => ({ width: Math.max(120, Math.min(320, w * 0.85) | 0), height: Math.max(80, Math.min(170, hh * 0.4) | 0) }) },
      text => { if (done) return; done = true; try { navigator.vibrate && navigator.vibrate(60); } catch {} stopScan().then(() => lookupBarcode(text)); },
      () => {});
    $("#scanmsg").textContent = "Line up the barcode inside the box.";
  } catch (e) {
    await stopScan();
    F.err = /NotAllowed|Permission/i.test(String((e && e.name) || e)) ? "Camera access was denied. Allow it in your phone's settings for this site, or type the barcode." : "Couldn't start the camera. Type the barcode instead.";
    render();
  }
}
async function stopScan() {
  try { if (scanner) { if (scanner.isScanning) await scanner.stop(); scanner.clear(); } } catch {}
  scanner = null; $("#scanwrap").hidden = true; document.body.style.overflow = "";
}

function keyCard() {
  const has = !!getKey();
  const inp = h("input", { id: "fdckey", type: "password", autocomplete: "off", spellcheck: "false", placeholder: has ? "Key saved on this device" : "Paste your api.data.gov key" });
  const save = async () => {
    const v = inp.value.trim();
    if (!/^[A-Za-z0-9]{20,64}$/.test(v)) { ui.keyMsg = "That doesn't look like an api.data.gov key. It's about 40 letters and numbers."; render(); return; }
    ui.keyMsg = "Checking the key…"; render();
    try { await fetchJSON(FDC_URL("egg", v)); lsSet("515.fdcKey", v); ui.keyMsg = "Key works. Saved on this device only."; }
    catch (e) { ui.keyMsg = e.status === 403 ? "USDA rejected that key. Copy it again from the email." : "Couldn't check the key right now. Try again with a signal."; }
    render();
  };
  return h("div", { class: "card stack" },
    h("div", { class: "sub", text: "Food search uses the USDA database. Without your own key it uses a shared demo key that runs out fast. Get a free key at api.data.gov/signup. It's stored only on this device and never in the app's code." }),
    h("div", { class: "row" },
      h("div", { style: "flex:1;min-width:180px" }, inp),
      h("button", { class: "btn", text: has ? "Replace key" : "Save key", onclick: save }),
      has ? h("button", { class: "btn ghost", text: "Remove", onclick: () => { try { localStorage.removeItem("515.fdcKey"); } catch {} ui.keyMsg = "Key removed."; render(); } }) : null),
    h("div", { class: "muted", style: "font-size:13px", text: ui.keyMsg || (has ? "Status: your key is active." : "Status: using the shared demo key.") }));
}
function backupLine() {
  const lb = lsGet("515.lastBackup"), n = Object.keys(days).length;
  if (!n) return null;
  const age = lb ? Math.round((parse(todayISO()) - parse(lb)) / 864e5) : null, stale = age == null || age > 7;
  return h("div", { class: stale ? "notice" : "muted", style: stale ? "border-color:var(--red);color:var(--ink)" : "font-size:13px",
    text: lb ? `Last backup: ${nice(lb)} (${age === 0 ? "today" : age + " day" + (age === 1 ? "" : "s") + " ago"}).${stale ? " Export one now." : ""}` : "No backup yet. Export one now." });
}

/* ---------- backup ---------- */
function exportBackup() {
  persistNow();
  const blob = new Blob([JSON.stringify({ app: "515-log", version: 1, exported: new Date().toISOString(), profile, days }, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = `515-log-${todayISO()}.json`;
  document.body.append(a); a.click(); a.remove();
  lsSet("515.lastBackup", todayISO());
  setTimeout(render, 50);
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function importBackup(file, input) {
  if (!file) return;
  if (file.size > 20 * 1024 * 1024) { ui.importMsg = "That file is too large to be a 5:15 backup."; render(); return; }
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const b = JSON.parse(String(rd.result));
      if (!b || typeof b !== "object" || typeof b.days !== "object" || b.days === null) throw 0;
      let n = 0;
      for (const [k, v] of Object.entries(b.days)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || !v || typeof v !== "object" || !v.workout || !Array.isArray(v.meals)) continue;
        days[k] = clone(v); n++;
      }
      if (b.profile && typeof b.profile === "object") profile = mergeProfile(b.profile);
      persistNow();
      ui.importMsg = `Imported ${n} day${n === 1 ? "" : "s"}. Days in the file replaced the same days here.`;
    } catch { ui.importMsg = "Couldn't read that file. Pick a backup exported from this app."; }
    input.value = ""; render();
  };
  rd.readAsText(file);
}

/* ---------- wiring ---------- */
document.querySelectorAll(".tab").forEach(b => b.addEventListener("click", () => { tab = b.dataset.tab; lsSet("515.tab", tab); render(); window.scrollTo(0, 0); }));
$("#prev").addEventListener("click", () => { cur = addDays(cur, -1); render(); });
$("#next").addEventListener("click", () => { cur = addDays(cur, 1); render(); });
$("#todaybtn").addEventListener("click", () => { cur = todayISO(); render(); });
const tip = $("#tip");
document.addEventListener("pointerover", e => { const t = e.target.closest && e.target.closest("[data-tip]"); if (!t) { tip.hidden = true; return; } tip.textContent = t.getAttribute("data-tip"); tip.hidden = false; });
document.addEventListener("pointermove", e => { if (tip.hidden) return; const x = Math.min(window.innerWidth - tip.offsetWidth - 8, e.clientX + 12); tip.style.left = Math.max(8, x) + "px"; tip.style.top = (e.clientY - 34) + "px"; });
let rz; window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => { if (tab === "progress") render(); }, 200); });

$("#scanclose").addEventListener("click", stopScan);
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("#scanwrap").hidden) stopScan(); });

/* ---------- install / offline ---------- */
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register("sw.js").then(reg => {
    const watch = w => w && w.addEventListener("statechange", () => { if (w.state === "installed" && navigator.serviceWorker.controller) showUpdate(w); });
    if (reg.waiting && navigator.serviceWorker.controller) showUpdate(reg.waiting);
    reg.addEventListener("updatefound", () => watch(reg.installing));
  }).catch(() => {});
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (!hadController || reloading) return; reloading = true; persistNow(); location.reload(); });
}
function showUpdate(w) { $("#update").hidden = false; $("#updatebtn").onclick = () => w.postMessage("skipWaiting"); }
try { navigator.storage && navigator.storage.persist && navigator.storage.persist().catch(() => {}); } catch {}

loadLocal();
render();
