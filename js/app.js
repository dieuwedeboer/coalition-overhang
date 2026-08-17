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

function projection(data, t = 0) {
  const poll = data.poll;
  const of120 = largestRemainder(poll);
  const natHaul = data.electorates.filter((e) => e.notionalWinner === "National").length;
  const natOverhang = Math.max(0, natHaul - of120.nat);
  const tactical = data.electorates.filter((e) => flipsAt(e, t)).length;
  const tpmElec = data.tpmElectoratesAssumed;
  const tpmOverhang = Math.max(0, tpmElec - (of120.tpm || 0));
  const natSeats = natHaul + tactical;
  return {
    poll,
    of120,
    natHaul,
    natOverhang,
    tactical,
    tpmElec,
    tpmOverhang,
    natSeats,
    coalition: natSeats + of120.act + of120.nzf,
    house: 120 + natOverhang + tactical + tpmOverhang,
    transfer: t,
  };
}

function votesNeeded(e) {
  if (e.actSeat || e.natLead == null) return null;
  if (e.natLead >= 0) return 0;
  return 1 - e.natLead;
}

function holder(e) {
  if (e.actSeat) return "ACT";
  return e.winner2023 || e.notionalWinner || "";
}

const CLOSE_SHORT = 2500;

function flipsAt(e, t) {
  if (e.actSeat || e.natLead == null) return false;
  const moved = Math.round((t / 100) * (e.pool || 0));
  return e.natLead + moved > 0 && holder(e) !== "National";
}

function closeTarget(e) {
  if (e.actSeat || e.natLead == null || e.natLead >= 0) return false;
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
  if (who === "ACT") return ["ACT holds this", "badge-act"];
  if (e.danger) return ["Probable overhang", "badge-danger"];
  if (who === "National") return ["National holds this", "badge-held"];
  if (flipsAt(e, t)) return [winnableLabel(e), "badge-flip"];
  if (closeTarget(e)) return [winnableLabel(e), "badge-maybe"];
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
  if (e.actSeat) {
    parts.push("Transfer does not apply. Epsom and Tāmaki stay with ACT.");
  } else if (pool === 0) {
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
  if (e.winnerChanged) parts.push("Notional winner flipped on the 2026 map.");
  return parts.join(" ");
}

function renderProjection(p) {
  $("#proj-nat").textContent = p.of120.nat;
  $("#proj-over").textContent = "+" + p.natOverhang;
  const tac = $("#proj-tac");
  tac.textContent = "+" + p.tactical;
  tac.parentElement.classList.toggle("is-hot", p.tactical > 0);
  $("#proj-coal").textContent = p.coalition;
  const poll = p.poll;
  const seatsWord = p.tactical === 1 ? "seat is" : "seats are";
  const tacticalLine = p.tactical
    ? `At ${p.transfer}% of the 2023 NZ First + ACT candidate pool, ${p.tactical} Labour/Green ${seatsWord} winnable.`
    : `At ${p.transfer}% of the 2023 NZ First + ACT candidate pool, no Labour or Green seat is winnable.`;
  $("#proj-note").innerHTML =
    `${poll.org}, ${poll.dates}: National ${poll.nat}% → <strong>${p.of120.nat} of 120</strong>. ` +
    `Holding all ${p.natHaul} notional electorates is <strong>Zero List Seats</strong> and a +${p.natOverhang} probable overhang. ` +
    `${tacticalLine} ` +
    `<a href="${poll.url}">Poll source</a>.`;
  const live = $("#transfer-live");
  if (live) {
    live.innerHTML =
      `Hypothetical at ${p.transfer}%: ` +
      `<b>+${p.natOverhang}</b> probable overhang, ` +
      `<b>+${p.tactical}</b> tactical.<br>` +
      `<b>${p.natSeats}</b> Nat + <b>${p.of120.nzf}</b> NZ First + <b>${p.of120.act}</b> ACT = <b>${p.coalition}</b>`;
  }
}

function margin(e) {
  return e.majority == null ? 999999 : e.majority;
}

function sortSeats(seats, dangerCount = 5) {
  const nat = [];
  const labGreen = [];
  const rest = [];
  for (const e of seats) {
    const who = holder(e);
    if (who === "National") nat.push(e);
    else if (who === "Labour" || who === "Green") labGreen.push(e);
    else rest.push(e);
  }
  nat.sort((a, b) => margin(a) - margin(b) || a.name.localeCompare(b.name, "en"));
  labGreen.sort((a, b) => margin(a) - margin(b) || a.name.localeCompare(b.name, "en"));
  const overhang = nat.slice(0, dangerCount).map((e) => Object.assign({}, e, { danger: true }));
  const leftoverNat = nat.slice(dangerCount).map((e) => Object.assign({}, e, { danger: false }));
  const labTagged = labGreen.map((e) => Object.assign({}, e, { danger: false }));
  const partyRank = { National: 0, ACT: 1, Green: 2 };
  const tail = leftoverNat.concat(rest).map((e) => Object.assign({}, e, { danger: false }));
  tail.sort((a, b) => {
    const pa = partyRank[holder(a)] ?? 9;
    const pb = partyRank[holder(b)] ?? 9;
    if (pa !== pb) return pa - pb;
    return margin(a) - margin(b) || a.name.localeCompare(b.name, "en");
  });
  return overhang.concat(labTagged, tail);
}

function matches(e, q) {
  if (!q) return true;
  return e.name.toLowerCase().includes(q) || e.oldName.toLowerCase().includes(q);
}

const FIRST_SEATS = 12;
const MORE_SEATS = 6;

function renderSeats(data, t, query, limit) {
  const q = query.trim().toLowerCase();
  const pinnedNames = new Set(data.pinned || []);
  const list = sortSeats(data.electorates, data.dangerCount || 5).filter((e) => matches(e, q));
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
    if (e.actSeat) el.classList.add("act");
    if (pinnedNames.has(e.name)) el.classList.add("pinned");
    const star = e.redraw ? ` <span class="star" title="Name or winner changed on the 2026 map">*</span>` : "";
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

async function main() {
  startCountdown();
  const data = await fetch("data/site.json").then((r) => r.json());
  fillDatalist(data);
  const slider = $("#transfer");
  const search = $("#q");
  const more = $("#show-more");
  let shown = FIRST_SEATS;
  const paint = () => {
    const t = Number(slider.value);
    $("#transfer-out").textContent = t + "%";
    renderProjection(projection(data, t));
    renderSeats(data, t, search.value, shown);
  };
  slider.addEventListener("input", paint);
  search.addEventListener("input", paint);
  more.addEventListener("click", () => {
    shown += MORE_SEATS;
    paint();
  });
  paint();
}

main().catch((err) => {
  console.error(err);
  const note = $("#proj-note");
  if (note) note.textContent = "Could not load data/site.json.";
});
