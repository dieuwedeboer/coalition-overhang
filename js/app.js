const $ = (sel, root = document) => root.querySelector(sel);

const ELECTION = new Date("2026-11-07T00:00:00+13:00");

function countdownCopy(now = new Date()) {
  const ms = ELECTION - now;
  const day = 86400000;
  if (ms <= -day) return "Election was Saturday 7 November 2026";
  if (ms <= 0) return "<b>Election day</b> · Saturday 7 November";
  const days = Math.ceil(ms / day);
  const label = days === 1 ? "day" : "days";
  return `<b>${days} ${label}</b> to Saturday 7 November`;
}

function startCountdown() {
  const el = $("#countdown");
  if (!el) return;
  const tick = () => {
    el.innerHTML = countdownCopy();
  };
  tick();
  setInterval(tick, 60 * 1000);
}

function fmt(n) {
  if (n == null || Number.isNaN(n)) return "—";
  return Math.round(n).toLocaleString("en-NZ");
}

function fmtPct(n) {
  if (n == null || Number.isNaN(n)) return "—";
  const t = Math.round(n * 10) / 10;
  return Number.isInteger(t) ? String(t) : t.toFixed(1);
}

function qualify(poll) {
  return [
    ["nat", poll.nat, true],
    ["lab", poll.lab, poll.lab >= 5],
    ["grn", poll.grn, poll.grn >= 5],
    ["act", poll.act, poll.act >= 5],
    ["nzf", poll.nzf, poll.nzf >= 5],
    ["opp", poll.opp, poll.opp >= 5],
    ["tpm", poll.tpm, true],
  ].filter(([, , ok]) => ok);
}

function largestRemainder(poll) {
  const rows = qualify(poll);
  const tot = rows.reduce((s, [, p]) => s + p, 0);
  const parts = rows.map(([k, p]) => {
    const exact = (p / tot) * 120;
    const base = Math.floor(exact);
    return { k, base, frac: exact - base };
  });
  let left = 120 - parts.reduce((s, r) => s + r.base, 0);
  parts.sort((a, b) => b.frac - a.frac);
  const out = {};
  for (const r of parts) {
    out[r.k] = r.base + (left > 0 ? 1 : 0);
    if (left > 0) left -= 1;
  }
  return out;
}

function switchPoll(poll, s = 0) {
  const moved = poll.nat * (s / 100);
  const pool = poll.nzf + poll.act;
  if (pool <= 0 || moved === 0) return Object.assign({}, poll);
  const nzfShare = poll.nzf / pool;
  return Object.assign({}, poll, {
    nat: poll.nat - moved,
    nzf: poll.nzf + moved * nzfShare,
    act: poll.act + moved * (1 - nzfShare),
  });
}

function projection(data, t = 0, s = 0) {
  const basePoll = data.poll;
  const poll = switchPoll(basePoll, s);
  const of120 = largestRemainder(poll);
  const baseOf120 = largestRemainder(basePoll);
  const natHaul = data.electorates.filter((e) => holder(e) === "National").length;
  const natOverhang = Math.max(0, natHaul - of120.nat);
  const winnable = data.electorates.filter((e) => flipsAt(e, t)).length;
  const tpmElec = data.tpmElectoratesAssumed;
  const tpmOverhang = Math.max(0, tpmElec - (of120.tpm || 0));
  const natSeats = natHaul + winnable;
  const overhang = Math.max(0, natSeats - of120.nat);
  const dangerCount = Math.max(0, natHaul - baseOf120.nat);
  return {
    basePoll,
    poll,
    of120,
    baseOf120,
    natHaul,
    natOverhang,
    overhang,
    dangerCount,
    winnable,
    tpmElec,
    tpmOverhang,
    natSeats,
    coalition: natSeats + of120.act + of120.nzf,
    pollCoalition: baseOf120.nat + (baseOf120.nzf || 0) + (baseOf120.act || 0),
    house: 120 + natOverhang + winnable + tpmOverhang,
    transfer: t,
    switchShare: s,
    nzfGain: of120.nzf - baseOf120.nzf,
    actGain: of120.act - baseOf120.act,
  };
}

function votesNeeded(e) {
  if (e.natLead == null) return null;
  if (e.natLead >= 0) return 0;
  return 1 - e.natLead;
}

function holder(e) {
  return e.winner2023 || "";
}

const CLOSE_SHORT = 2500;

function flipsAt(e, t) {
  if (e.natLead == null) return false;
  const moved = Math.round((t / 100) * (e.pool || 0));
  return e.natLead + moved > 0 && holder(e) !== "National";
}

function closeTarget(e) {
  if (e.natLead == null || e.natLead >= 0) return false;
  if (holder(e) === "National") return false;
  return -e.natLead <= CLOSE_SHORT;
}

function inBasket(e) {
  return Boolean(e.danger || closeTarget(e));
}

function winnableLabel(e) {
  return `Winnable with ${fmt(votesNeeded(e))} votes`;
}

function badge(e, t) {
  const who = holder(e);
  if (e.danger) return ["At risk", "badge-danger"];
  if (who === "National") return ["National holds this", "badge-held"];
  if (flipsAt(e, t)) return [winnableLabel(e), "badge-flip"];
  if (closeTarget(e)) return [winnableLabel(e), "badge-maybe"];
  if (who === "ACT") return ["ACT holds this", "badge-act"];
  if (who === "Labour") return ["Labour holds this", "badge-no"];
  if (who === "Green") return ["Green holds this", "badge-no"];
  return [(who || "Unknown") + " holds this", "badge-no"];
}

function seatCopy(e, t) {
  if (e.note && !e.natVotes) return e.note;
  const pool = e.pool || 0;
  const moved = Math.round((t / 100) * pool);
  const parts = [];
  if (e.natVotes != null && e.winnerVotes != null) {
    if (e.winner2023 === "National") {
      parts.push(`2023: National ${fmt(e.natVotes)}, ${e.second2023} ${fmt(e.secondVotes)} — National ahead by ${fmt(e.natLead)} votes.`);
    } else {
      parts.push(`2023: ${e.winner2023} ${fmt(e.winnerVotes)}, National ${fmt(e.natVotes)} — National behind by ${fmt(-e.natLead)} votes.`);
    }
  }
  if (pool === 0) {
    parts.push("NZ First and ACT stood no candidate here in 2023, so there is no local pool to move.");
  } else {
    parts.push(`NZ First ${fmt(e.nzfVotes)} + ACT ${fmt(e.actVotes)} = ${fmt(pool)} candidate votes. At ${t}% that is ${fmt(moved)} votes toward National.`);
    if (e.natLead != null && e.natLead < 0) {
      const need = 1 - e.natLead;
      parts.push(need <= pool
        ? `Needs ${fmt(need)} of those votes to pass.`
        : `Needs ${fmt(need)} votes — more than this 2023 pool.`);
    }
  }
  if (e.nameChanged) parts.push(`2023 name: ${e.oldName}.`);
  if (e.redraw) parts.push("Big boundary changes on the 2026 map, so the 2023 margin is a weaker guide to how in-play this seat is.");
  return parts.join(" ");
}

function setGain(id, n) {
  const el = $(id);
  if (!el) return;
  if (n > 0) {
    el.textContent = "+" + n;
    el.hidden = false;
  } else {
    el.textContent = "";
    el.hidden = true;
  }
}

function tightCopy(n) {
  const seats = n === 1 ? "seat" : "seats";
  return `${n} tight ${seats} to hold`;
}

function splitShareCopy(n) {
  if (n === 10) return "one in ten Coalition voters";
  if (n === 20) return "one in five Coalition voters";
  if (n === 25) return "one in four Coalition voters";
  if (n === 50) return "half of Coalition voters";
  return `${n}% of Coalition voters`;
}

function pitchCopy(p) {
  const extra = p.coalition - p.pollCoalition;
  const mp = extra === 1 ? "MP" : "MPs";
  if (extra <= 0) {
    return "Splitting votes is how the Coalition grows beyond the poll’s share of 120.";
  }
  if (p.switchShare === p.transfer && p.switchShare > 0) {
    return `If ${splitShareCopy(p.switchShare)} split their votes, the Coalition would gain <b>${extra} extra ${mp}</b>.`;
  }
  return `At this split, the Coalition would gain <b>${extra} extra ${mp}</b>.`;
}

function renderProjection(p) {
  const base = p.basePoll;
  const poll = p.poll;
  const baselineOver = Math.max(0, p.natSeats - p.baseOf120.nat);
  $("#proj-nat").textContent = p.natSeats;
  $("#proj-over").textContent = "+" + p.overhang;
  $("#proj-nzf").textContent = p.of120.nzf;
  $("#proj-act").textContent = p.of120.act;
  $("#proj-coal").textContent = p.coalition;
  setGain("#proj-nzf-gain", p.nzfGain);
  setGain("#proj-act-gain", p.actGain);

  const natBits = [`Polling at ${p.baseOf120.nat} + ${tightCopy(p.dangerCount)}`];
  if (p.winnable) natBits.push(`+${p.winnable} winnable`);
  const natSub = $("#proj-nat-sub");
  if (natSub) natSub.textContent = natBits.join(" · ");
  const overSub = $("#proj-over-sub");
  if (overSub) overSub.textContent = "Electorates beyond the share of the 120";

  $("#tile-nat").classList.toggle("is-hot", p.winnable > 0);
  $("#tile-over").classList.toggle("is-hot", p.overhang > baselineOver);
  $("#tile-nzf").classList.toggle("is-hot", p.nzfGain > 0);
  $("#tile-act").classList.toggle("is-hot", p.actGain > 0);
  $("#tile-coal").classList.toggle("is-hot", p.switchShare > 0 || p.winnable > 0);

  const pitch = $("#proj-pitch");
  if (pitch) pitch.innerHTML = pitchCopy(p);

  const hold = $("#proj-hold");
  if (hold) {
    hold.innerHTML =
      `<strong>${p.dangerCount} tight National seats</strong> could go on current polling. ` +
      `Coalition electorate votes have to hold them, or the overhang shrinks. ` +
      `<a href="#finder">See them in the Finder</a>.`;
  }

  const seatsWord = p.winnable === 1 ? "seat is" : "seats are";
  const winnableLine = p.winnable
    ? `At ${p.transfer}% of the 2023 NZ First + ACT candidate pool, ${p.winnable} ${seatsWord} winnable.`
    : `At ${p.transfer}% of the 2023 NZ First + ACT candidate pool, no other seat is winnable.`;
  const quotaLine = p.switchShare > 0
    ? `${base.org}, ${base.dates}: National’s ${fmtPct(base.nat)}% party vote entitles it to ${p.baseOf120.nat} of 120 — already filled by ${p.natHaul} electorates, so National takes <strong>no list MPs</strong>. If ${p.switchShare}% of that party vote moved to NZ First and ACT (in their current poll ratio), the quota drops to <strong>${p.of120.nat} of 120</strong> and the overhang grows. National still keeps the electorates. NZ First ${fmtPct(base.nzf)}% → ${fmtPct(poll.nzf)}% → <strong>${p.of120.nzf}</strong>. ACT ${fmtPct(base.act)}% → ${fmtPct(poll.act)}% → <strong>${p.of120.act}</strong>.`
    : `${base.org}, ${base.dates}: National’s ${fmtPct(base.nat)}% party vote entitles it to ${p.of120.nat} of 120 — already filled by ${p.natHaul} electorates, so National takes <strong>no list MPs</strong>. NZ First ${fmtPct(base.nzf)}% → <strong>${p.of120.nzf}</strong>. ACT ${fmtPct(base.act)}% → <strong>${p.of120.act}</strong>.`;
  const oppLine = base.oppPublished != null && base.oppPublished !== base.opp
    ? ` Opportunity polled ${fmtPct(base.oppPublished)}%. This projection enters it at ${fmtPct(base.opp)}%.`
    : "";
  $("#proj-note").innerHTML =
    `${quotaLine} ` +
    `${winnableLine}` +
    `${oppLine} ` +
    `<a href="${base.url}">Poll source</a>.`;

  const switchLive = $("#switch-live");
  if (switchLive) {
    switchLive.innerHTML = p.switchShare
      ? `NZ First <b>${p.baseOf120.nzf} → ${p.of120.nzf}</b> · ACT <b>${p.baseOf120.act} → ${p.of120.act}</b> · National stays at <b>${p.natSeats}</b>`
      : `Partners stay on the poll: NZ First <b>${p.of120.nzf}</b>, ACT <b>${p.of120.act}</b>. National stays at <b>${p.natSeats}</b>`;
  }
  const transferOutcome = $("#transfer-outcome");
  if (transferOutcome) {
    transferOutcome.innerHTML =
      `<b>+${p.overhang}</b> overhang · ${tightCopy(p.dangerCount)}` +
      (p.winnable ? ` · <b>+${p.winnable}</b> winnable` : "");
  }

  renderParliament(p);
  const sum = $("#proj-sum");
  if (sum) {
    sum.innerHTML =
      `<b>${p.natSeats}</b> Nat + <b>${p.of120.nzf}</b> NZ First + <b>${p.of120.act}</b> ACT = <b>${p.coalition}</b>`;
  }

  const live = $("#transfer-live");
  if (live) {
    const switchBit = p.switchShare
      ? ` · ${p.switchShare}% of National’s party vote to the partners`
      : "";
    live.innerHTML =
      `Hypothetical at ${p.transfer}% of the candidate pool${switchBit}: ` +
      `<b>+${p.overhang}</b> overhang` +
      (p.winnable ? `, <b>+${p.winnable}</b> winnable` : "") +
      ` · ${tightCopy(p.dangerCount)}.<br>` +
      `<b>${p.natSeats}</b> Nat + <b>${p.of120.nzf}</b> NZ First + <b>${p.of120.act}</b> ACT = <b>${p.coalition}</b>`;
  }
}

const HOUSE_PARTIES = [
  { id: "lab", name: "Labour" },
  { id: "grn", name: "Green" },
  { id: "tpm", name: "Te Pāti Māori" },
  { id: "opp", name: "Opportunity" },
  { id: "act", name: "ACT" },
  { id: "nzf", name: "NZ First" },
  { id: "nat", name: "National" },
];

function houseParties(p) {
  const seats = {
    lab: p.of120.lab || 0,
    grn: p.of120.grn || 0,
    tpm: p.tpmElec,
    opp: p.of120.opp || 0,
    act: p.of120.act || 0,
    nzf: p.of120.nzf || 0,
    nat: p.natSeats,
  };
  const overhang = {
    tpm: p.tpmOverhang,
    nat: Math.max(0, p.natSeats - (p.of120.nat || 0)),
  };
  return HOUSE_PARTIES
    .map((party) => ({
      id: party.id,
      name: party.name,
      seats: seats[party.id] || 0,
      overhang: Math.min(overhang[party.id] || 0, seats[party.id] || 0),
    }))
    .filter((party) => party.seats > 0);
}

function rowCounts(n) {
  const rows = n > 165 ? 6 : 5;
  const weights = [];
  for (let i = 0; i < rows; i++) weights.push(1 - i * 0.16);
  const sum = weights.reduce((s, w) => s + w, 0);
  const parts = weights.map((w) => {
    const exact = (n * w) / sum;
    return { base: Math.floor(exact), frac: exact - Math.floor(exact) };
  });
  let left = n - parts.reduce((s, r) => s + r.base, 0);
  const order = parts.map((r, i) => ({ i, frac: r.frac })).sort((a, b) => b.frac - a.frac);
  const counts = parts.map((r) => r.base);
  for (const row of order) {
    if (left <= 0) break;
    counts[row.i] += 1;
    left -= 1;
  }
  return counts;
}

function houseSlots(counts) {
  const start = (200 * Math.PI) / 180;
  const end = (-20 * Math.PI) / 180;
  const slots = [];
  counts.forEach((k, row) => {
    const rx = 300 - row * 46;
    const ry = 206 - row * 32;
    for (let i = 0; i < k; i++) {
      const t = k === 1 ? 0.5 : i / (k - 1);
      const ang = start + (end - start) * t;
      slots.push({
        ang,
        x: 340 + rx * Math.cos(ang),
        y: 236 - ry * Math.sin(ang),
      });
    }
  });
  slots.sort((a, b) => b.ang - a.ang || a.x - b.x);
  let gap = Infinity;
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const d = Math.hypot(slots[i].x - slots[j].x, slots[i].y - slots[j].y);
      if (d > 0 && d < gap) gap = d;
    }
  }
  const r = Math.max(3.2, Math.min(7.4, gap / 2 - 1.15));
  return { slots, r };
}

function renderParliament(p) {
  const svgRoot = $("#parliament-svg");
  const key = $("#parliament-key");
  const cap = $("#parliament-cap");
  const note = $("#parliament-note");
  if (!svgRoot || !key) return;
  const parties = houseParties(p);
  const marks = [];
  for (const party of parties) {
    const plain = party.seats - party.overhang;
    for (let i = 0; i < plain; i++) marks.push({ id: party.id, name: party.name, over: false });
    for (let i = 0; i < party.overhang; i++) marks.push({ id: party.id, name: party.name, over: true });
  }
  const { slots, r } = houseSlots(rowCounts(marks.length));
  const circles = marks.map((mark, i) => {
    const s = slots[i];
    const label = mark.over ? `${mark.name}, overhang` : mark.name;
    return `<circle class="p-dot p-${mark.id}${mark.over ? " is-over" : ""}" cx="${s.x.toFixed(1)}" cy="${s.y.toFixed(1)}" r="${r.toFixed(2)}"><title>${label}</title></circle>`;
  });
  svgRoot.innerHTML = `<svg viewBox="0 0 680 348" role="presentation">${circles.join("")}</svg>`;
  key.innerHTML = parties.map((party) => {
    const ring = party.overhang ? ` <span class="p-over">${party.overhang} overhang</span>` : "";
    return `<li><i class="swatch p-${party.id}"></i>${party.name} <b>${party.seats}</b>${ring}</li>`;
  }).join("");
  if (cap) {
    const majority = Math.floor(p.house / 2) + 1;
    cap.innerHTML = `Coalition <b>${p.coalition}</b> of <b>${p.house}</b> · majority is <b>${majority}</b>`;
  }
  if (note) {
    note.textContent = "Te Pāti Māori keeps the four electorates it holds: Tāmaki Makaurau, Hauraki-Waikato, Waiariki, and Te Tai Hauāuru. A gold ring is a seat beyond that party’s share of the 120.";
  }
}

function absLead(e) {
  return e.natLead == null ? 999999 : Math.abs(e.natLead);
}

function byAbsLead(a, b) {
  return absLead(a) - absLead(b) || a.name.localeCompare(b.name, "en");
}

function sortSeats(seats, dangerCount = 5) {
  const nat = [];
  const others = [];
  for (const e of seats) {
    if (holder(e) === "National") nat.push(e);
    else others.push(e);
  }
  nat.sort(byAbsLead);
  const atRisk = nat.slice(0, dangerCount).map((e) => Object.assign({}, e, { danger: true }));
  const leftoverNat = nat.slice(dangerCount).map((e) => Object.assign({}, e, { danger: false }));
  const restPool = leftoverNat.concat(others.map((e) => Object.assign({}, e, { danger: false })));
  const winnable = [];
  const tail = [];
  for (const e of restPool) {
    if (closeTarget(e)) winnable.push(e);
    else tail.push(e);
  }
  winnable.sort(byAbsLead);
  tail.sort(byAbsLead);
  return atRisk.concat(winnable, tail);
}

function matches(e, q) {
  if (!q) return true;
  return e.name.toLowerCase().includes(q) || e.oldName.toLowerCase().includes(q);
}

const FIRST_SEATS = 12;
const MORE_SEATS = 6;
const DEFAULT_SPLIT = 10;

function renderSeats(data, t, query, limit) {
  const q = query.trim().toLowerCase();
  const pinnedNames = new Set(data.pinned || []);
  const pollNat = largestRemainder(data.poll).nat;
  const dangerCount = Math.max(0, data.electorates.filter((e) => holder(e) === "National").length - pollNat);
  const list = sortSeats(data.electorates, dangerCount).filter((e) => matches(e, q));
  const searching = Boolean(q);
  const visible = searching ? list : list.slice(0, limit);
  const root = $("#seat-list");
  root.innerHTML = "";
  const more = $("#show-more");
  if (!list.length) {
    root.innerHTML = `<p class="meta">No matching general electorates.</p>`;
    if (more) more.hidden = true;
    return;
  }
  if (more) {
    more.hidden = searching || visible.length >= list.length;
  }
  for (const e of visible) {
    const [label, cls] = badge(e, t);
    const el = document.createElement("article");
    el.className = "seat";
    if (e.danger) el.classList.add("danger");
    if (flipsAt(e, t)) el.classList.add("flip");
    else if (closeTarget(e)) el.classList.add("maybe");
    if (holder(e) === "National") el.classList.add("held");
    if (holder(e) === "ACT" && !flipsAt(e, t)) el.classList.add("act");
    if (pinnedNames.has(e.name)) el.classList.add("pinned");
    const star = e.redraw ? ` <span class="star" title="Big boundary changes — the 2023 result is a weaker guide to how in-play this seat is">*</span>` : "";
    const old = e.nameChanged ? ` <span class="meta">(was ${e.oldName})</span>` : "";
    const lead = e.natLead == null
      ? `<span class="year">2023</span>`
      : e.natLead >= 0
        ? `<span class="year">2023</span> <span class="votes">National +${fmt(e.natLead)}</span>`
        : `<span class="year">2023</span> <span class="votes behind">National −${fmt(-e.natLead)}</span>`;
    const pitch = inBasket(e)
      ? `<p class="seat-pitch"><strong>Coalition voters in this electorate can get a 2nd MP with their votes if they vote for the National candidate.</strong></p>`
      : "";
    el.innerHTML = `
      <div class="seat-top">
        <h3>${e.name}${star}${old}</h3>
        <span class="badge ${cls}">${label}</span>
      </div>
      <p class="tally">${lead}</p>
      <p class="meta">${seatCopy(e, t)}</p>
      ${pitch}`;
    root.appendChild(el);
  }
}

function fillDatalist(data) {
  $("#electorate-list").innerHTML = data.electorates
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "en"))
    .map((e) => `<option value="${e.name}"></option>`)
    .join("");
}

function fillRange(el) {
  if (!el) return;
  el.style.setProperty("--pct", el.value + "%");
}

async function main() {
  startCountdown();
  const data = await fetch("data/site.json").then((r) => r.json());
  fillDatalist(data);
  const switchEl = $("#switch");
  const transfer = $("#transfer");
  const transferFinder = $("#transfer-finder");
  const search = $("#q");
  const more = $("#show-more");
  let shown = FIRST_SEATS;

  const setTransfer = (v) => {
    if (transfer) transfer.value = v;
    if (transferFinder) transferFinder.value = v;
    fillRange(transfer);
    fillRange(transferFinder);
    const out = $("#transfer-out");
    const outFinder = $("#transfer-finder-out");
    if (out) out.textContent = v + "%";
    if (outFinder) outFinder.textContent = v + "%";
  };

  const paint = () => {
    const t = Number(transfer ? transfer.value : 0);
    const s = Number(switchEl ? switchEl.value : 0);
    if (switchEl) {
      fillRange(switchEl);
      const out = $("#switch-out");
      if (out) out.textContent = s + "%";
    }
    renderProjection(projection(data, t, s));
    renderSeats(data, t, search.value, shown);
  };

  if (switchEl) switchEl.addEventListener("input", paint);
  if (transfer) {
    transfer.addEventListener("input", () => {
      setTransfer(transfer.value);
      paint();
    });
  }
  if (transferFinder) {
    transferFinder.addEventListener("input", () => {
      setTransfer(transferFinder.value);
      paint();
    });
  }
  search.addEventListener("input", paint);
  more.addEventListener("click", () => {
    shown += MORE_SEATS;
    paint();
  });
  setTransfer(transfer ? transfer.value : DEFAULT_SPLIT);
  paint();
}

main().catch((err) => {
  console.error(err);
  const note = $("#proj-note");
  if (note) note.textContent = "Could not load data/site.json.";
});
