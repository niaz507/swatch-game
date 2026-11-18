/* The bench. Mixing and scoring live in colour.js. */
(function () {
  "use strict";

  var C = window.SwatchColour;
  if (!C) return;

  var THEME_KEY = "niaz-swatch-theme";
  var BEST_KEY = "niaz-swatch-best";

  var els = {
    play: document.getElementById("play"),
    proof: document.getElementById("proof"),
    pips: document.getElementById("pips"),
    kicker: document.getElementById("kicker"),
    colourName: document.getElementById("colour-name"),
    lede: document.getElementById("lede"),
    target: document.getElementById("target-swatch"),
    mix: document.getElementById("mix-swatch"),
    bare: document.getElementById("bare"),
    pigments: document.getElementById("pigments"),
    result: document.getElementById("result"),
    resultScore: document.getElementById("result-score"),
    resultNote: document.getElementById("result-note"),
    soFar: document.getElementById("so-far"),
    clear: document.getElementById("clear"),
    lock: document.getElementById("lock"),
    rank: document.getElementById("rank"),
    total: document.getElementById("total"),
    shareLine: document.getElementById("share-line"),
    copy: document.getElementById("copy"),
    shareBtn: document.getElementById("share-btn"),
    bestLine: document.getElementById("best-line"),
    proofList: document.getElementById("proof-list"),
    again: document.getElementById("again"),
    footerBest: document.getElementById("footer-best"),
    themeToggle: document.getElementById("themeToggle")
  };

  var state = {
    index: 0,
    locked: false,
    showingProof: false,
    amounts: C.emptyAmounts(),
    results: [],
    target: C.GROUND.slice(),
    mix: C.GROUND.slice()
  };

  var copyTimer = 0;

  function motionOK() {
    return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function paint(el, rgb, label) {
    el.style.background = C.hex(rgb);
    el.setAttribute("aria-label", label);
  }

  function readBest() {
    try {
      var raw = localStorage.getItem(BEST_KEY);
      if (raw == null || raw === "") return null;
      var n = Number(raw);
      if (!Number.isInteger(n) || n < 0 || n > 1000) return null;
      return n;
    } catch (e) {
      return null;
    }
  }

  function writeBest(total) {
    try { localStorage.setItem(BEST_KEY, String(total)); } catch (e) {}
  }

  function renderBestFooter() {
    var best = readBest();
    els.footerBest.textContent = best == null ? "Best · none yet" : "Best · " + best;
  }

  function runningTotal() {
    var total = 0;
    for (var i = 0; i < state.results.length; i++) total += state.results[i].score;
    return total;
  }

  function pigmentById(id) {
    for (var i = 0; i < C.PIGMENTS.length; i++) {
      if (C.PIGMENTS[i].id === id) return C.PIGMENTS[i];
    }
    return null;
  }

  function syncPigment(pigment) {
    var value = state.amounts[pigment.id];
    var input = document.getElementById("pig-" + pigment.id);
    var row = input.closest(".pigment");
    input.value = String(value);
    input.disabled = state.locked;
    input.setAttribute(
      "aria-valuetext",
      pigment.name + ", " + value + (value === 1 ? " drop" : " drops")
    );
    row.querySelector(".fill").style.width = "calc((100% - 16px) * " + (value / 100) + ")";
    row.querySelector(".drops").textContent = pad(value);
    var buttons = row.querySelectorAll(".drop");
    for (var i = 0; i < buttons.length; i++) {
      var dir = Number(buttons[i].getAttribute("data-dir"));
      buttons[i].disabled = state.locked || (dir < 0 && value <= 0) || (dir > 0 && value >= 100);
    }
  }

  function syncAll() {
    for (var i = 0; i < C.PIGMENTS.length; i++) syncPigment(C.PIGMENTS[i]);
    els.clear.disabled = state.locked;
  }

  function renderMix() {
    var rgb = C.mix(state.amounts);
    state.mix = rgb;
    var bare = C.totalDrops(state.amounts) === 0;
    paint(
      els.mix,
      rgb,
      bare ? "Your mix, bare panel, " + C.hex(rgb) : "Your mix, " + C.hex(rgb)
    );
    els.bare.hidden = !bare;
  }

  function renderPips() {
    els.pips.replaceChildren();
    for (var i = 0; i < C.ROUNDS.length; i++) {
      var round = C.ROUNDS[i];
      var li = document.createElement("li");
      li.textContent = String(i + 1);
      var result = state.results[i];
      if (result) {
        li.className = "is-done";
        li.setAttribute("aria-label", "Round " + (i + 1) + ", " + round.name + ", " + result.score + " points");
      } else if (i === state.index && !state.showingProof) {
        li.className = "is-current";
        li.setAttribute("aria-current", "step");
        li.setAttribute("aria-label", "Round " + (i + 1) + ", " + round.name + ", in progress");
      } else {
        li.setAttribute("aria-label", "Round " + (i + 1) + ", not played");
      }
      els.pips.appendChild(li);
    }
  }

  function setAmount(id, value) {
    if (state.locked) return;
    var n = Math.round(Number(value));
    if (!Number.isFinite(n)) n = 0;
    state.amounts[id] = Math.min(100, Math.max(0, n));
    syncPigment(pigmentById(id));
    renderMix();
  }

  function startRound(index, focusHeading) {
    state.index = index;
    state.locked = false;
    state.showingProof = false;
    state.amounts = C.emptyAmounts();
    var round = C.ROUNDS[index];
    document.title = "Swatch · " + round.name;
    els.kicker.textContent = "Round " + pad(index + 1) + " / 08";
    els.colourName.textContent = round.name;
    els.lede.textContent = round.lede;
    state.target = C.mix(round.recipe);
    paint(els.target, state.target, "Target, " + round.name + ", " + C.hex(state.target));
    els.result.hidden = true;
    els.resultScore.textContent = "";
    els.resultNote.textContent = "";
    els.lock.textContent = "Lock the mix";
    els.play.hidden = false;
    els.proof.hidden = true;
    syncAll();
    renderMix();
    renderPips();
    els.soFar.textContent = "So far " + runningTotal();
    if (focusHeading) els.colourName.focus();
  }

  function lockMix() {
    if (state.locked || state.showingProof) return;
    state.locked = true;
    var round = C.ROUNDS[state.index];
    var judged = C.judge(state.target, state.mix);
    state.results.push({
      name: round.name,
      target: state.target.slice(),
      mix: state.mix.slice(),
      dE: judged.dE,
      score: judged.score,
      text: judged.text
    });
    els.result.hidden = false;
    els.resultScore.textContent = judged.score + " / " + C.ROUND_MAX;
    els.resultNote.textContent = judged.text + " Distance " + judged.dE.toFixed(1) + ".";
    els.lock.textContent = state.index === C.ROUNDS.length - 1 ? "See the proof" : "Next colour";
    syncAll();
    renderPips();
    els.soFar.textContent = "So far " + runningTotal();
    els.result.focus();
  }

  function showProof() {
    state.showingProof = true;
    var total = runningTotal();
    var rank = C.rankFor(total);
    var previous = readBest();
    var record = previous == null || total > previous;
    if (record) writeBest(total);
    document.title = "Swatch · " + total + " / 1000";
    els.play.hidden = true;
    els.proof.hidden = false;
    els.rank.textContent = rank;
    els.total.textContent = String(total);
    els.shareLine.value = C.shareLine(total);
    if (previous == null || total > previous) {
      els.bestLine.textContent = "Best in this browser · " + total + ". A new record.";
    } else if (total === previous) {
      els.bestLine.textContent = "Best in this browser · " + total + ", matched.";
    } else {
      els.bestLine.textContent = "Best in this browser · " + previous + ".";
    }
    renderProof(total);
    renderBestFooter();
    window.scrollTo({ top: 0, behavior: motionOK() ? "smooth" : "auto" });
    els.rank.focus();
  }

  function renderProof() {
    els.proofList.replaceChildren();
    for (var i = 0; i < state.results.length; i++) {
      var row = state.results[i];
      var li = document.createElement("li");
      var top = document.createElement("div");
      top.className = "proof-top";
      var idx = document.createElement("span");
      idx.className = "idx";
      idx.textContent = pad(i + 1);
      var name = document.createElement("span");
      name.className = "nm";
      name.textContent = row.name;
      var pts = document.createElement("span");
      pts.className = "pts";
      pts.textContent = String(row.score);
      top.append(idx, name, pts);
      var meta = document.createElement("div");
      meta.className = "proof-meta";
      meta.append(
        chip(row.target, row.name + " target"),
        chip(row.mix, row.name + " mix")
      );
      var de = document.createElement("span");
      de.className = "de";
      de.textContent = "Distance " + row.dE.toFixed(1);
      meta.appendChild(de);
      li.append(top, meta);
      els.proofList.appendChild(li);
    }
  }

  function chip(rgb, label) {
    var el = document.createElement("span");
    el.className = "mini";
    el.style.background = C.hex(rgb);
    el.setAttribute("role", "img");
    el.setAttribute("aria-label", label + ", " + C.hex(rgb));
    return el;
  }

  function advance() {
    if (!state.locked) {
      lockMix();
      return;
    }
    if (state.index >= C.ROUNDS.length - 1) showProof();
    else {
      startRound(state.index + 1, true);
      window.scrollTo({ top: 0, behavior: motionOK() ? "smooth" : "auto" });
    }
  }

  function markCopy(text) {
    els.copy.textContent = text;
    window.clearTimeout(copyTimer);
    copyTimer = window.setTimeout(function () { els.copy.textContent = "Copy"; }, 2400);
  }

  function renderPigments() {
    for (var i = 0; i < C.PIGMENTS.length; i++) {
      var pigment = C.PIGMENTS[i];
      var id = "pig-" + pigment.id;
      var row = document.createElement("div");
      row.className = "pigment";

      var top = document.createElement("div");
      top.className = "pigment-top";
      var label = document.createElement("label");
      label.htmlFor = id;
      var swatch = document.createElement("span");
      swatch.className = "chip";
      swatch.style.background = C.hex(pigment.rgb);
      swatch.setAttribute("aria-hidden", "true");
      var pname = document.createElement("span");
      pname.className = "pname";
      pname.textContent = pigment.name;
      var index = document.createElement("span");
      index.className = "index";
      index.textContent = pigment.index;
      label.append(swatch, pname, index);
      var drops = document.createElement("span");
      drops.className = "drops";
      drops.textContent = "00";
      top.append(label, drops);

      var note = document.createElement("p");
      note.className = "note";
      note.id = id + "-note";
      note.textContent = pigment.note;

      var controls = document.createElement("div");
      controls.className = "controls";
      controls.append(
        dropButton(-1, "Remove one drop of " + pigment.name),
        slider(id, pigment, note.id),
        dropButton(1, "Add one drop of " + pigment.name)
      );
      row.append(top, note, controls);
      els.pigments.appendChild(row);
    }
  }

  function dropButton(dir, label) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "drop";
    button.setAttribute("data-dir", String(dir));
    button.setAttribute("aria-label", label);
    button.textContent = dir < 0 ? "\u2212" : "+";
    return button;
  }

  function slider(id, pigment, noteId) {
    var wrap = document.createElement("div");
    wrap.className = "slider";
    wrap.style.setProperty("--pigment", C.hex(pigment.rgb));
    var groove = document.createElement("span");
    groove.className = "groove";
    groove.setAttribute("aria-hidden", "true");
    var fill = document.createElement("span");
    fill.className = "fill";
    fill.setAttribute("aria-hidden", "true");
    var input = document.createElement("input");
    input.type = "range";
    input.id = id;
    input.min = "0";
    input.max = "100";
    input.step = "1";
    input.value = "0";
    input.setAttribute("aria-describedby", noteId);
    wrap.append(groove, fill, input);
    return wrap;
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;
    var meta = document.getElementById("themeColor");
    if (meta) meta.setAttribute("content", theme === "dark" ? "#131313" : "#E4E4E1");
    var dark = theme === "dark";
    els.themeToggle.setAttribute("aria-pressed", dark ? "true" : "false");
    els.themeToggle.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
  }

  function onKey(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (state.showingProof) return;
    var target = e.target;

    if (e.key >= "1" && e.key <= "5") {
      var pigment = C.PIGMENTS[Number(e.key) - 1];
      var input = document.getElementById("pig-" + pigment.id);
      if (input && !input.disabled) {
        input.focus();
        e.preventDefault();
      }
      return;
    }

    if (target && target.type === "range" && (e.key === "+" || e.key === "=" || e.key === "-" || e.key === "_")) {
      e.preventDefault();
      var step = e.key === "-" || e.key === "_" ? -1 : 1;
      setAmount(target.id.replace("pig-", ""), Number(target.value) + step);
      return;
    }

    if (target && target.type === "range" && e.shiftKey &&
      (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      var dir = e.key === "ArrowLeft" || e.key === "ArrowDown" ? -5 : 5;
      setAmount(target.id.replace("pig-", ""), Number(target.value) + dir);
      return;
    }

    if (e.key === "Enter" && !e.repeat) {
      if (target && target.closest && target.closest("button, a")) return;
      e.preventDefault();
      advance();
    }
  }

  renderPigments();
  if (navigator.share) els.shareBtn.hidden = false;
  applyTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");
  renderBestFooter();
  startRound(0, false);

  els.pigments.addEventListener("input", function (e) {
    if (!e.target || e.target.type !== "range") return;
    setAmount(e.target.id.replace("pig-", ""), e.target.value);
  });

  els.pigments.addEventListener("click", function (e) {
    var button = e.target.closest(".drop");
    if (!button) return;
    var input = button.closest(".pigment").querySelector("input");
    setAmount(input.id.replace("pig-", ""), state.amounts[input.id.replace("pig-", "")] + Number(button.getAttribute("data-dir")));
  });

  els.clear.addEventListener("click", function () {
    if (state.locked) return;
    state.amounts = C.emptyAmounts();
    syncAll();
    renderMix();
  });

  els.lock.addEventListener("click", advance);
  els.again.addEventListener("click", function () {
    state.results = [];
    startRound(0, true);
    window.scrollTo({ top: 0, behavior: motionOK() ? "smooth" : "auto" });
  });

  function legacyCopy(text) {
    els.shareLine.focus();
    els.shareLine.select();
    try {
      if (document.execCommand("copy")) return Promise.resolve(text);
    } catch (e) {}
    return Promise.reject(new Error("copy"));
  }

  els.copy.addEventListener("click", function () {
    var text = els.shareLine.value;
    markCopy("Copied");
    var attempt = navigator.clipboard && navigator.clipboard.writeText
      ? navigator.clipboard.writeText(text).catch(function () { return legacyCopy(text); })
      : legacyCopy(text);
    attempt.catch(function () {
      els.shareLine.focus();
      els.shareLine.select();
      markCopy("Select the line");
    });
  });

  els.shareBtn.addEventListener("click", function () {
    if (!navigator.share) return;
    navigator.share({ text: els.shareLine.value }).catch(function (err) {
      if (err && err.name === "AbortError") return;
    });
  });

  els.themeToggle.addEventListener("click", function () {
    var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
  });

  var scheme = window.matchMedia("(prefers-color-scheme: dark)");
  if (scheme.addEventListener) {
    scheme.addEventListener("change", function (e) {
      var saved = null;
      try { saved = localStorage.getItem(THEME_KEY); } catch (err) {}
      if (saved === "light" || saved === "dark") return;
      applyTheme(e.matches ? "dark" : "light");
    });
  }

  document.addEventListener("keydown", onKey);
})();
