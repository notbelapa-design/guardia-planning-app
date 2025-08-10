/* Guardia Planning App – clean static version
 * - Admin defines guardias (date + type).
 * - Residents pick up to N slots (default 4).
 * - Conflicts show in red; “Resolve conflicts” balances totals then Mon/Fri, then random.
 * - “Random assign remaining” fills empty slots fairly.
 * - State persists to localStorage. No backend here.
 */

(() => {
  "use strict";

  // ---------- Config ----------
  const STATE_KEY = "guardiaPlanner.v2";
  const DEFAULT_RESIDENTS = ["Resident 1", "Resident 2", "Resident 3", "Resident 4"];
  const DEFAULT_TYPES = ["Puerta", "Observa", "Traumato"];
  const DEFAULT_SLOTS_PER_RESIDENT = 4;
  const FAIRNESS = { monFriWeight: 1 }; // change if you want Friday/Monday to count more/less

  // ---------- DOM ----------
  const els = {
    admin: document.getElementById("admin-setup"),
    newDate: document.getElementById("new-date"),
    newType: document.getElementById("new-type"),
    addGuardiaBtn: document.getElementById("add-guardia-btn"),
    guardiaList: document.getElementById("guardia-list"),
    adminFinishBtn: document.getElementById("admin-finish-btn"),
    resetSetupBtn: document.getElementById("reset-setup-btn"),

    login: document.getElementById("login"),
    userSelect: document.getElementById("user-select"),
    startBtn: document.getElementById("start-btn"),
    resetAppBtn: document.getElementById("reset-app-btn"),

    planning: document.getElementById("planning"),
    currentUser: document.getElementById("current-user"),
    maxPerUser: document.getElementById("max-per-user"),
    remaining: document.getElementById("remaining"),
    monfri: document.getElementById("monfri"),
    shiftsTbody: document.getElementById("shifts-tbody"),
    finishBtn: document.getElementById("finish-btn"),
    unlockBtn: document.getElementById("unlock-btn"),
    switchBtn: document.getElementById("switch-btn"),
    resolveBtn: document.getElementById("resolve-btn"),
    randomBtn: document.getElementById("random-btn"),
    status: document.getElementById("status"),

    calendar: document.getElementById("calendar"),
    calendarGrid: document.getElementById("calendar-grid"),

    homeBtn: document.getElementById("home-btn"),
  };

  // ---------- State ----------
  let state = loadState() || {
    setupDone: false,
    config: { slotsPerResident: DEFAULT_SLOTS_PER_RESIDENT, types: DEFAULT_TYPES },
    residents: [...DEFAULT_RESIDENTS],
    shifts: [], // { id, date:'YYYY-MM-DD', type, assigned:[name1,name2,...] }
    picks: {},  // { [residentName]: [shiftId, ...] }
    finished: {}, // { [residentName]: boolean }
  };

  // Ensure picks/finished objects exist for every resident
  function hydrateResidents() {
    state.residents.forEach(r => {
      if (!state.picks[r]) state.picks[r] = [];
      if (typeof state.finished[r] !== "boolean") state.finished[r] = false;
    });
  }
  hydrateResidents();

  // ---------- Utils ----------
  const idFor = (date, type) => `${date}__${type.toUpperCase()}`;
  const niceType = (t) => t; // already capitalized
  const fmtDate = (iso) => {
    // Render as "30 Jul 2025" invariant of timezone
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    const fmt = new Intl.DateTimeFormat(undefined, { day: "2-digit", month: "short", year: "numeric" });
    return fmt.format(dt);
  };
  const weekdayUTC = (iso) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 Sun .. 6 Sat
  };
  const isMon = (iso) => weekdayUTC(iso) === 1;
  const isFri = (iso) => weekdayUTC(iso) === 5;
  const isMonOrFri = (iso) => isMon(iso) || isFri(iso);

  function saveState() {
    try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch {}
  }
  function loadState() {
    try {
      const raw = localStorage.getItem(STATE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
  function clearState() {
    try { localStorage.removeItem(STATE_KEY); } catch {}
  }

  function show(el) { el.hidden = false; }
  function hide(el) { el.hidden = true; }
  function toast(msg) {
    els.status.textContent = msg;
    els.status.hidden = false;
    setTimeout(() => { els.status.hidden = true; }, 1800);
  }

  // Stats for fairness / UI
  function statsFor(name) {
    const ids = state.picks[name] || [];
    const total = ids.length;
    const monfri = ids.reduce((c, id) => {
      const s = state.shifts.find(x => x.id === id);
      return c + (s && isMonOrFri(s.date) ? 1 : 0);
    }, 0);
    return { total, monfri };
  }

  /**
   * Render the Monday/Friday tally for all residents.
   * Lists each resident and how many of their selected guardias fall on a Monday or Friday.
   */
  function renderTally() {
    const list = document.getElementById("tally-list");
    if (!list) return;
    list.innerHTML = "";
    state.residents.forEach(res => {
      const { monfri } = statsFor(res);
      const li = document.createElement("li");
      li.textContent = `${res}: ${monfri} on Mon/Fri`;
      list.appendChild(li);
    });
  }

  // ---------- Admin rendering ----------
  function renderAdminList() {
    els.guardiaList.innerHTML = "";
    const sorted = [...state.shifts].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.type.localeCompare(b.type)));
    if (!sorted.length) {
      const li = document.createElement("li");
      li.className = "muted";
      li.textContent = "No guardias added yet.";
      els.guardiaList.appendChild(li);
      return;
    }
    for (const s of sorted) {
      const li = document.createElement("li");
      li.innerHTML = `
        <span class="chip">${fmtDate(s.date)}</span>
        <span class="chip">${niceType(s.type)}</span>
        <span class="muted">id: ${s.id}</span>
      `;
      const btn = document.createElement("button");
      btn.className = "btn btn-secondary";
      btn.textContent = "Remove";
      btn.onclick = () => {
        // remove shift and any picks referencing it
        state.shifts = state.shifts.filter(x => x.id !== s.id);
        for (const r of state.residents) {
          state.picks[r] = state.picks[r].filter(id => id !== s.id);
        }
        saveState();
        renderAll();
      };
      li.appendChild(btn);
      els.guardiaList.appendChild(li);
    }
  }

  // ---------- Login rendering ----------
  function renderLogin() {
    // Fill users
    els.userSelect.innerHTML = `<option value="">--Select--</option>`;
    for (const r of state.residents) {
      const opt = document.createElement("option");
      opt.value = r; opt.textContent = r;
      els.userSelect.appendChild(opt);
    }
  }

  // ---------- Planning rendering ----------
  function renderPlanning(name) {
    els.currentUser.textContent = name;
    els.maxPerUser.textContent = state.config.slotsPerResident;
    const meFinished = !!state.finished[name];

    // Table
    els.shiftsTbody.innerHTML = "";
    const conflicts = new Set();
    const byId = Object.fromEntries(state.shifts.map(s => [s.id, s]));
    // rebuild assigned per shift from picks for consistency
    for (const s of state.shifts) s.assigned = [];
    for (const r of state.residents) {
      for (const sid of state.picks[r]) {
        if (byId[sid]) byId[sid].assigned.push(r);
      }
    }
    const sorted = [...state.shifts].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.type.localeCompare(b.type)));
    sorted.forEach(s => {
      if ((s.assigned || []).length > 1) conflicts.add(s.id);

      const tr = document.createElement("tr");
      if (conflicts.has(s.id)) tr.classList.add("conflict");

      const tdDate = document.createElement("td"); tdDate.textContent = fmtDate(s.date);
      const tdType = document.createElement("td"); tdType.textContent = niceType(s.type);
      const tdAssigned = document.createElement("td");
      tdAssigned.textContent = s.assigned.length ? s.assigned.join(", ") : "—";

      const tdSelect = document.createElement("td");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = state.picks[name].includes(s.id);
      cb.disabled = meFinished; // lock if finished
      cb.addEventListener("change", () => {
        const arr = state.picks[name];
        if (cb.checked) {
          if (arr.length >= state.config.slotsPerResident) {
            cb.checked = false;
            toast(`Max ${state.config.slotsPerResident} guardias.`);
            return;
          }
          if (!arr.includes(s.id)) arr.push(s.id);
        } else {
          state.picks[name] = arr.filter(x => x !== s.id);
        }
        saveState();
        renderPlanning(name);
        renderCalendar();
        toast("Selections saved");
      });
      tdSelect.appendChild(cb);

      tr.append(tdDate, tdType, tdAssigned, tdSelect);
      els.shiftsTbody.appendChild(tr);
    });

    // Stats
    const stats = statsFor(name);
    const remaining = state.config.slotsPerResident - stats.total;
    els.remaining.textContent = `${remaining} shifts remaining`;
    els.monfri.textContent = `Monday/Friday guardias: ${stats.monfri}`;

    // Update the global tally list for all residents
    renderTally();

    // Buttons
    els.finishBtn.disabled = meFinished;
    els.unlockBtn.disabled = !meFinished;
  }

  // ---------- Calendar rendering ----------
  function renderCalendar() {
    // Find a nice month to show: earliest shift's month, else current month
    const baseIso = state.shifts.length ? state.shifts.map(s => s.date).sort()[0] : toIso(new Date());
    const [by, bm] = baseIso.split("-").map(Number);
    const first = new Date(Date.UTC(by, bm - 1, 1));
    const startDow = first.getUTCDay(); // 0 Sun
    const daysInMonth = new Date(Date.UTC(by, bm, 0)).getUTCDate();

    els.calendarGrid.innerHTML = "";

    // Weekday headers
    ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].forEach(d => {
      const h = document.createElement("div");
      h.className = "day";
      h.style.background = "transparent";
      h.style.border = "none";
      h.innerHTML = `<strong class="muted">${d}</strong>`;
      els.calendarGrid.appendChild(h);
    });

    // We start with Monday as first column. Compute offset from Monday.
    const offsetFromMonday = (startDow + 6) % 7;

    for (let i = 0; i < offsetFromMonday; i++) {
      const pad = document.createElement("div");
      pad.className = "day";
      pad.style.visibility = "hidden";
      els.calendarGrid.appendChild(pad);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${by}-${String(bm).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
      const day = document.createElement("div");
      const classes = ["day"];
      if (isMon(iso)) classes.push("mon");
      if (isFri(iso)) classes.push("fri");
      day.className = classes.join(" ");

      const head = document.createElement("div");
      head.className = "date";
      head.textContent = d;
      day.appendChild(head);

      // add shifts badges
      for (const s of state.shifts.filter(s => s.date === iso)) {
        const b = document.createElement("div");
        let cls;
        const t = s.type.toLowerCase();
        if (t === "puerta") cls = "puerta";
        else if (t === "traumato") cls = "traumato";
        else cls = "observa";
        b.className = "badge " + cls;
        // assigned is recomputed in renderPlanning; ensure fallback:
        const assignedNames = (s.assigned && s.assigned.length ? s.assigned : whoIsAssigned(s.id)).join(", ") || "—";
        b.textContent = `${s.type}: ${assignedNames}`;
        day.appendChild(b);
      }
      els.calendarGrid.appendChild(day);
    }
  }

  function whoIsAssigned(shiftId) {
    const arr = [];
    for (const r of state.residents) {
      if ((state.picks[r] || []).includes(shiftId)) arr.push(r);
    }
    return arr;
  }

  // ---------- Fairness / conflict resolution ----------
  function resolveConflictsFair() {
    const idToResidents = {};
    for (const s of state.shifts) idToResidents[s.id] = whoIsAssigned(s.id);

    // Helper: tuple compare [total, monfri]
    const metric = (name) => {
      const st = statsFor(name);
      return [st.total, st.monfri];
    };
    const better = (a, b) => {
      if (a[0] !== b[0]) return a[0] - b[0];
      if (FAIRNESS.monFriWeight > 0) {
        const ma = a[1], mb = b[1];
        if (ma !== mb) return ma - mb;
      }
      return 0; // tie -> random later
    };

    for (const s of state.shifts) {
      const contenders = idToResidents[s.id];
      if (contenders.length <= 1) continue; // no conflict
      // choose winner
      const ranked = contenders.slice().sort((ra, rb) => {
        const cmp = better(metric(ra), metric(rb));
        if (cmp !== 0) return cmp;
        // tie: random
        return Math.random() - 0.5;
      });
      const winner = ranked[0];

      // assign only winner; remove others
      for (const r of contenders) {
        if (r === winner) continue;
        state.picks[r] = state.picks[r].filter(id => id !== s.id);
      }
    }
    saveState();
  }

  function randomAssignRemaining() {
    const empty = state.shifts.filter(s => whoIsAssigned(s.id).length === 0);
    if (!empty.length) return;

    for (const s of empty) {
      // choose resident with minimal [total, monfri]; tie -> random
      const ranked = state.residents.slice().sort((ra, rb) => {
        const a = statsFor(ra), b = statsFor(rb);
        if (a.total !== b.total) return a.total - b.total;
        if (a.monfri !== b.monfri) return a.monfri - b.monfri;
        return Math.random() - 0.5;
      });
      const chosen = ranked[0];
      if (!state.picks[chosen].includes(s.id) && state.picks[chosen].length < state.config.slotsPerResident) {
        state.picks[chosen].push(s.id);
      } else {
        // if chosen is full, try the next
        for (const cand of ranked.slice(1)) {
          if (!state.picks[cand].includes(s.id) && state.picks[cand].length < state.config.slotsPerResident) {
            state.picks[cand].push(s.id);
            break;
          }
        }
      }
    }
    saveState();
  }

  // ---------- Event handlers ----------
  els.addGuardiaBtn.addEventListener("click", () => {
    const date = els.newDate.value; // already YYYY-MM-DD
    const type = els.newType.value;
    if (!date || !type) {
      alert("Please choose date and type.");
      return;
    }
    const id = idFor(date, type);
    if (state.shifts.some(s => s.id === id)) {
      alert("That guardia already exists.");
      return;
    }
    state.shifts.push({ id, date, type, assigned: [] });
    saveState();
    els.newDate.value = "";
    renderAll();
  });

  els.adminFinishBtn.addEventListener("click", () => {
    if (state.shifts.length === 0) {
      alert("Add at least one guardia before finishing.");
      return;
    }
    state.setupDone = true;
    saveState();
    renderAll();
    toast("Setup complete. Residents can now choose.");
  });

  els.resetSetupBtn.addEventListener("click", () => {
    if (!confirm("Reset setup? This clears guardias and resident picks but keeps app config.")) return;
    state.shifts = [];
    for (const r of state.residents) {
      state.picks[r] = [];
      state.finished[r] = false;
    }
    state.setupDone = false;
    saveState();
    renderAll();
    toast("Setup reset.");
  });

  els.startBtn.addEventListener("click", () => {
    const name = els.userSelect.value;
    if (!name) return;
    if (!state.setupDone) {
      alert("Admin setup is not finished yet.");
      return;
    }
    show(els.planning);
    els.currentUser.dataset.name = name;
    renderPlanning(name);
    renderCalendar();
    window.scrollTo({ top: els.planning.offsetTop - 10, behavior: "smooth" });
  });

  els.resetAppBtn.addEventListener("click", () => {
    if (!confirm("Reset whole app? This clears everything.")) return;
    clearState();
    state = {
      setupDone: false,
      config: { slotsPerResident: DEFAULT_SLOTS_PER_RESIDENT, types: DEFAULT_TYPES },
      residents: [...DEFAULT_RESIDENTS],
      shifts: [],
      picks: {},
      finished: {},
    };
    hydrateResidents();
    saveState();
    renderAll();
  });

  els.finishBtn.addEventListener("click", () => {
    const me = els.currentUser.dataset.name;
    state.finished[me] = true;
    saveState();
    renderPlanning(me);
    toast("Marked as finished.");
  });

  els.unlockBtn.addEventListener("click", () => {
    const me = els.currentUser.dataset.name;
    state.finished[me] = false;
    saveState();
    renderPlanning(me);
    toast("Unlocked. You can edit again.");
  });

  els.switchBtn.addEventListener("click", () => {
    hide(els.planning);
    renderLogin();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  els.resolveBtn.addEventListener("click", () => {
    resolveConflictsFair();
    const me = els.currentUser.dataset.name;
    renderPlanning(me);
    renderCalendar();
    toast("Conflicts resolved fairly.");
  });

  els.randomBtn.addEventListener("click", () => {
    randomAssignRemaining();
    const me = els.currentUser.dataset.name;
    renderPlanning(me);
    renderCalendar();
    toast("Random assignment complete.");
  });

  els.homeBtn.addEventListener("click", () => {
    hide(els.planning);
    if (!state.setupDone) {
      show(els.admin);
      hide(els.login);
    } else {
      hide(els.admin);
      show(els.login);
    }
    renderLogin();
    renderCalendar();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // ---------- Helpers ----------
  function renderAll() {
    hydrateResidents();
    if (!state.setupDone) {
      show(els.admin);
      show(els.login);
    } else {
      hide(els.admin);
      show(els.login);
    }
    renderAdminList();
    renderLogin();
    renderCalendar();
  }

  function toIso(d) {
    // Convert Date->YYYY-MM-DD in UTC
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  // ---------- Init ----------
  renderAll();
})();