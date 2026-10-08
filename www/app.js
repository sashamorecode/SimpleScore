(function () {
  "use strict";

  var KEY = "simplescore.v1";
  var NAMES_KEY = "simplescore.v1.names";
  var MAX_HISTORY = 200;

  /* ==========================================================
     FX ENGINE — canvas particles, fireworks, lightning, beams
     ========================================================== */
  var FX = (function () {
    var P1 = "#60a5fa";
    var P2 = "#fb7185";
    var EMOJI = ["🎉", "🔥", "⚡", "💥", "⭐", "✨", "🏆", "🚀", "💯", "🎯",
      "🍕", "👑", "💫", "🌈", "🍾", "🥳", "🤯", "👽", "🦄", "🐉", "💰",
      "🎸", "🕹️", "🧨", "🍩", "🦖", "🌮", "🧃", "🛸", "🐙"];

    var canvas, ctx, W = 0, H = 0, dpr = 1;
    var parts = [], rings = [], bolts = [], embers = [];
    var raf = 0, last = 0, started = false;
    var flashEl, bannerEl, boardEl;
    var rect1 = null, rect2 = null;
    var game = { p1: 0, p2: 0 };
    var beamMix = 0.5, beamTarget = 0.5, beamSag = 0, beamSagTarget = 10;
    var tieTimer = 0, sparkTimer = 0, emberTimer = 0;

    function rnd(a, b) { return a + Math.random() * (b - a); }
    function pick(a) { return a[(Math.random() * a.length) | 0]; }
    function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

    function init() {
      canvas = document.getElementById("fx");
      if (!canvas || !canvas.getContext) return;
      ctx = canvas.getContext("2d");
      flashEl = document.getElementById("flash");
      bannerEl = document.getElementById("banner");
      boardEl = document.getElementById("board");
      resize();
      window.addEventListener("resize", resize);
      window.addEventListener("orientationchange", function () {
        setTimeout(resize, 250);
      });
      started = true;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }

    function resize() {
      if (!canvas) return;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      measure();
    }

    function measure() {
      var a = document.querySelector('[data-score="1"]');
      var b = document.querySelector('[data-score="2"]');
      if (a) {
        var r = a.getBoundingClientRect();
        rect1 = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }
      if (b) {
        var r2 = b.getBoundingClientRect();
        rect2 = { x: r2.left + r2.width / 2, y: r2.top + r2.height / 2 };
      }
    }

    function tick(now) {
      raf = requestAnimationFrame(tick);
      var dt = now - last;
      last = now;
      if (dt > 48) dt = 48;
      if (dt < 0) dt = 16;
      var f = dt / 16.6667;
      update(f, dt, now);
      draw(now);
    }

    function update(f, dt, now) {
      beamMix += (beamTarget - beamMix) * clamp(0.1 * f, 0, 1);
      beamSag += (beamSagTarget - beamSag) * clamp(0.08 * f, 0, 1);
      updateParts(f);
      updateRings(f);
      updateBolts(f);
      updateEmbers(f);
    }

    function draw(now) {
      if (!ctx) return;
      ctx.clearRect(0, 0, W, H);
      drawBeam(now);
      drawEmbers();
      drawRings();
      drawParts();
      drawBolts();
    }

    /* ---- emitters ---- */
    function addPart(p) { if (parts.length < 900) parts.push(p); }

    function spark(x, y, color, o) {
      o = o || {};
      var ang = o.ang != null ? o.ang : rnd(0, Math.PI * 2);
      var sp = o.speed != null ? o.speed : rnd(2, 7);
      addPart({
        t: "spark", x: x, y: y, px: x, py: y,
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
        life: o.life || rnd(24, 50), age: 0,
        size: o.size || rnd(1.5, 4), color: color,
        grav: o.grav != null ? o.grav : 0.12,
        drag: o.drag || 0.97
      });
    }

    function confetti(x, y, color, o) {
      o = o || {};
      var s = o.spread || 1;
      addPart({
        t: "conf", x: x, y: y,
        vx: rnd(-6, 6) * s, vy: rnd(-13, -3) * s,
        life: rnd(55, 95), age: 0,
        w: rnd(5, 11), h: rnd(8, 16),
        rot: rnd(0, 6.28), vr: rnd(-0.3, 0.3),
        color: color, grav: 0.28, drag: 0.99
      });
    }

    function emojiP(x, y, o) {
      o = o || {};
      var sp = o.speed != null ? o.speed : rnd(3, 7);
      var ang = rnd(-Math.PI, 0);
      addPart({
        t: "emoji", x: x, y: y, text: pick(EMOJI),
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - rnd(1, 4),
        life: rnd(45, 80), age: 0,
        size: rnd(20, 42), rot: rnd(-0.6, 0.6), vr: rnd(-0.12, 0.12)
      });
    }

    function ring(x, y, color, o) {
      o = o || {};
      var r0 = o.r0 != null ? o.r0 : 4;
      rings.push({
        x: x, y: y, r0: r0, r1: o.r1 != null ? o.r1 : 90,
        r: r0, color: color, life: o.life || 34, age: 0, w: o.w || 4
      });
    }

    function makeBolt(x1, y1, x2, y2, color, jag) {
      var pts = [];
      var seg = 10;
      for (var i = 0; i <= seg; i++) {
        var t = i / seg;
        pts.push({
          x: x1 + (x2 - x1) * t + (i && i !== seg ? rnd(-jag, jag) : 0),
          y: y1 + (y2 - y1) * t + (i && i !== seg ? rnd(-jag, jag) : 0)
        });
      }
      bolts.push({ pts: pts, color: color, life: rnd(8, 16), age: 0, w: rnd(1.5, 3) });
    }

    /* ---- updates ---- */
    function updateParts(f) {
      for (var i = parts.length - 1; i >= 0; i--) {
        var p = parts[i];
        p.age += f;
        if (p.age >= p.life) { parts.splice(i, 1); continue; }
        if (p.t === "spark") {
          p.px = p.x; p.py = p.y;
          p.vx *= Math.pow(p.drag, f);
          p.vy = p.vy * Math.pow(p.drag, f) + p.grav * f;
          p.x += p.vx * f; p.y += p.vy * f;
        } else if (p.t === "conf") {
          p.vy += p.grav * f; p.vx *= Math.pow(p.drag, f);
          p.x += p.vx * f; p.y += p.vy * f; p.rot += p.vr * f;
        } else if (p.t === "emoji") {
          p.vy += 0.18 * f; p.vx *= Math.pow(0.99, f);
          p.x += p.vx * f; p.y += p.vy * f; p.rot += p.vr * f;
        }
      }
    }

    function updateRings(f) {
      for (var i = rings.length - 1; i >= 0; i--) {
        var r = rings[i];
        r.age += f;
        if (r.age >= r.life) { rings.splice(i, 1); continue; }
        var t = r.age / r.life;
        r.r = r.r0 + (r.r1 - r.r0) * (1 - Math.pow(1 - t, 3));
      }
    }

    function updateBolts(f) {
      for (var i = bolts.length - 1; i >= 0; i--) {
        bolts[i].age += f;
        if (bolts[i].age >= bolts[i].life) bolts.splice(i, 1);
      }
    }

    function updateEmbers(f) {
      emberTimer -= f;
      var target = Math.min(70, Math.floor((game.p1 + game.p2) / 5));
      if (emberTimer <= 0 && embers.length < target + 6) {
        emberTimer = rnd(3, 11);
        embers.push({
          x: rnd(0, W), y: H + 10,
          vx: rnd(-0.35, 0.35), vy: rnd(-0.5, -1.5),
          size: rnd(1, 2.8), phase: rnd(0, 6.28),
          color: Math.random() < 0.5 ? P1 : P2
        });
      }
      for (var i = embers.length - 1; i >= 0; i--) {
        var e = embers[i];
        e.x += e.vx * f; e.y += e.vy * f; e.phase += 0.05 * f;
        if (e.y < -20) embers.splice(i, 1);
      }
    }

    /* ---- drawing ---- */
    function drawBeam(now) {
      if (!rect1 || !rect2) return;
      var total = game.p1 + game.p2;
      if (total <= 0) return;
      var diff = game.p1 - game.p2;
      var close = Math.abs(diff) <= 3;
      var tie = diff === 0;
      beamSagTarget = tie ? 26 + Math.sin(now / 220) * 8 : 10;

      var baseY = (rect1.y + rect2.y) / 2;
      var x1 = rect1.x, x2 = rect2.x;
      var mx = x1 + (x2 - x1) * beamMix;
      var my = baseY + beamSag + 8;

      if (tie) {
        tieTimer -= 1;
        if (tieTimer <= 0) {
          tieTimer = rnd(6, 14);
          makeBolt(x1, baseY, mx, my, "#ffffff", 34);
          makeBolt(mx, my, x2, baseY, "#ffffff", 34);
          for (var i = 0; i < 10; i++) spark(mx, my, "#ffffff", { speed: rnd(2, 6) });
        }
      } else if (close) {
        sparkTimer -= 1;
        if (sparkTimer <= 0) {
          sparkTimer = rnd(2, 6);
          spark(mx, my, diff > 0 ? P1 : P2, { speed: rnd(1, 4) });
        }
      }
    }

    function drawEmbers() {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (var i = 0; i < embers.length; i++) {
        var e = embers[i];
        var tw = 0.5 + 0.5 * Math.sin(e.phase);
        ctx.globalAlpha = 0.22 + 0.4 * tw;
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.arc(e.x + Math.sin(e.phase) * 6, e.y, e.size, 0, 6.283);
        ctx.fill();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    function drawRings() {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (var i = 0; i < rings.length; i++) {
        var r = rings[i];
        var a = 1 - r.age / r.life;
        ctx.globalAlpha = a * 0.9;
        ctx.strokeStyle = r.color;
        ctx.lineWidth = r.w * (0.5 + a);
        ctx.beginPath();
        ctx.arc(r.x, r.y, Math.max(0.1, r.r), 0, 6.283);
        ctx.stroke();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    function drawParts() {
      var i, p;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";
      for (i = 0; i < parts.length; i++) {
        p = parts[i];
        if (p.t !== "spark") continue;
        ctx.globalAlpha = clamp(1 - p.age / p.life, 0, 1);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size;
        ctx.beginPath();
        ctx.moveTo(p.px, p.py);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.7, 0, 6.283);
        ctx.fill();
      }
      ctx.restore();
      for (i = 0; i < parts.length; i++) {
        p = parts[i];
        if (p.t !== "conf" && p.t !== "emoji") continue;
        var a2 = clamp(1 - p.age / p.life, 0, 1);
        ctx.save();
        ctx.globalAlpha = a2;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        if (p.t === "conf") {
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        } else {
          ctx.font = p.size + "px serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(p.text, 0, 0);
        }
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }

    function traceBolt(b) {
      ctx.beginPath();
      ctx.moveTo(b.pts[0].x, b.pts[0].y);
      for (var i = 1; i < b.pts.length; i++) ctx.lineTo(b.pts[i].x, b.pts[i].y);
    }

    function drawBolts() {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.lineJoin = "round";
      for (var i = 0; i < bolts.length; i++) {
        var b = bolts[i];
        var a = 1 - b.age / b.life;
        if (Math.random() < 0.35) a *= 0.4;
        ctx.globalAlpha = a;
        ctx.strokeStyle = b.color;
        ctx.lineWidth = b.w * 3;
        traceBolt(b);
        ctx.stroke();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = b.w;
        traceBolt(b);
        ctx.stroke();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    /* ---- public effects ---- */
    function setGame(p1, p2) {
      game.p1 = p1;
      game.p2 = p2;
      var total = p1 + p2;
      if (total > 0) {
        var share = p1 / total;
        beamTarget = clamp(0.5 + (share - 0.5) * 1.7, 0.14, 0.86);
      } else {
        beamTarget = 0.5;
      }
      if (!rect1) measure();
    }

    function hit(player, amount) {
      var r = player === 1 ? rect1 : rect2;
      var color = player === 1 ? P1 : P2;
      var x = r ? r.x : (player === 1 ? W * 0.25 : W * 0.75);
      var y = r ? r.y : H * 0.5;
      var big = Math.min(amount, 8);
      var i, n = 16 + big * 7;
      for (i = 0; i < n; i++) {
        spark(x, y, Math.random() < 0.5 ? color : "#ffffff",
          { speed: rnd(2, 5 + big * 1.4) });
      }
      var en = 2 + Math.floor(big / 2) + (Math.random() < 0.3 ? 2 : 0);
      for (i = 0; i < en; i++) emojiP(x, y, { speed: rnd(3, 6 + big) });
      if (amount >= 4) {
        for (i = 0; i < amount * 3; i++) confetti(x, y, color, { spread: 1 });
      }
      ring(x, y, color, { r1: 70 + big * 14, w: 3, life: 30 });
      ring(x, y, "rgba(255,255,255,.9)", { r1: 40 + big * 10, w: 2, life: 22 });
      shake(amount >= 6 ? "lg" : amount >= 3 ? "md" : "sm");
    }

    function subtract(player) {
      var r = player === 1 ? rect1 : rect2;
      var x = r ? r.x : W / 2, y = r ? r.y : H / 2;
      for (var i = 0; i < 14; i++) {
        spark(x, y, "#94a3b8", { speed: rnd(1, 4), grav: 0.2, life: rnd(16, 30) });
      }
      ring(x, y, "#94a3b8", { r1: 40, w: 2, life: 18 });
      shake("sm");
    }

    function fireworks(x, y, color) {
      var colors = [color, "#ffffff", "#fbbf24", "#a855f7", "#22d3ee"];
      for (var k = 0; k < 5; k++) {
        (function (k) {
          setTimeout(function () {
            var bx = clamp(x + rnd(-W * 0.36, W * 0.36), 20, W - 20);
            var by = clamp(y + rnd(-H * 0.34, H * 0.12), 40, H - 40);
            var c = pick(colors);
            ring(bx, by, c, { r1: rnd(60, 150), w: 3, life: 40 });
            for (var i = 0; i < 60; i++) {
              spark(bx, by, c, { speed: rnd(1, 9), life: rnd(30, 70), grav: 0.06, drag: 0.985 });
            }
            for (var j = 0; j < 8; j++) emojiP(bx, by, { speed: rnd(2, 7) });
          }, k * 230);
        })(k);
      }
    }

    function confettiStorm(color) {
      var colors = [color, "#fbbf24", "#a855f7", "#22d3ee", "#ffffff", "#34d399"];
      for (var i = 0; i < 150; i++) {
        confetti(rnd(0, W), rnd(-H * 0.25, 0), pick(colors), { spread: 1 });
      }
    }

    function boom(text, player) {
      var color = player === 1 ? P1 : P2;
      bannerText(text, color);
      flash(player === 1 ? "p1" : "p2");
      shake("lg");
      confettiStorm(color);
      var r = player === 1 ? rect1 : rect2;
      fireworks(r ? r.x : W / 2, r ? r.y : H / 2, color);
    }

    function reset() {
      bannerText("RESET!", "#e7ecf3");
      flash("white");
      shake("lg");
      var big = Math.max(W, H);
      ring(W / 2, H / 2, "#ffffff", { r0: big, r1: 0, w: 6, life: 34 });
      ring(W / 2, H / 2, "#a855f7", { r0: big * 0.8, r1: 0, w: 4, life: 40 });
      for (var i = 0; i < 90; i++) {
        spark(W / 2, H / 2, pick([P1, P2, "#ffffff", "#a855f7"]),
          { speed: rnd(3, 14), life: rnd(30, 70), grav: 0.05, drag: 0.97 });
      }
      for (i = 0; i < 40; i++) emojiP(W / 2, H * 0.5, { speed: rnd(4, 12) });
      setTimeout(function () { confettiStorm("#a855f7"); }, 220);
    }

    function shake(level) {
      if (!boardEl) return;
      var cls = "shake-" + (level || "sm");
      boardEl.classList.remove("shake-sm", "shake-md", "shake-lg");
      void boardEl.offsetWidth;
      boardEl.classList.add(cls);
      clearTimeout(shake._t);
      shake._t = setTimeout(function () { boardEl.classList.remove(cls); }, 660);
    }

    function flash(kind) {
      if (!flashEl) return;
      flashEl.className = "";
      void flashEl.offsetWidth;
      flashEl.classList.add(kind || "white");
      clearTimeout(flash._t);
      flash._t = setTimeout(function () { flashEl.className = ""; }, 540);
    }

    function bannerText(text, color) {
      if (!bannerEl) return;
      bannerEl.textContent = text;
      bannerEl.style.color = color || "#fff";
      bannerEl.classList.remove("show");
      void bannerEl.offsetWidth;
      bannerEl.classList.add("show");
      clearTimeout(bannerText._t);
      bannerText._t = setTimeout(function () { bannerEl.classList.remove("show"); }, 1550);
    }

    return {
      init: init,
      measure: measure,
      setGame: setGame,
      hit: hit,
      subtract: subtract,
      boom: boom,
      reset: reset,
      shake: shake,
      flash: flash,
      banner: bannerText
    };
  })();

  var state = { 1: 0, 2: 0 };
  var names = { 1: "Player 1", 2: "Player 2" };
  var history = { 1: [], 2: [] };

  try {
    var saved = JSON.parse(localStorage.getItem(KEY) || "null");
    if (saved) {
      state[1] = Math.max(0, saved.p1 | 0);
      state[2] = Math.max(0, saved.p2 | 0);
    }
  } catch (e) {}

  try {
    var savedNames = JSON.parse(localStorage.getItem(NAMES_KEY) || "null");
    if (savedNames) {
      if (savedNames.p1) names[1] = savedNames.p1;
      if (savedNames.p2) names[2] = savedNames.p2;
    }
  } catch (e) {}

  var els = {
    1: {
      root: document.querySelector(".p1"),
      mid: document.querySelector(".p1 .mid"),
      score: document.querySelector('[data-score="1"]'),
      name: document.querySelector('[data-name="1"]'),
      undo: document.querySelector('[data-undo="1"]'),
    },
    2: {
      root: document.querySelector(".p2"),
      mid: document.querySelector(".p2 .mid"),
      score: document.querySelector('[data-score="2"]'),
      name: document.querySelector('[data-name="2"]'),
      undo: document.querySelector('[data-undo="2"]'),
    },
  };

  function persist() {
    localStorage.setItem(
      KEY,
      JSON.stringify({ p1: state[1], p2: state[2] })
    );
  }

  function persistNames() {
    localStorage.setItem(
      NAMES_KEY,
      JSON.stringify({ p1: names[1], p2: names[2] })
    );
  }

  function render(i) {
    els[i].score.textContent = state[i];
    els[i].name.textContent = names[i];
  }

  function updateUndo(i) {
    els[i].undo.disabled = history[i].length === 0;
  }

  function buzz(ms) {
    if (navigator.vibrate) navigator.vibrate(ms);
  }

  function bump(i) {
    var root = els[i].root;
    root.classList.remove("pop");
    void root.offsetWidth;
    root.classList.add("pop");
    setTimeout(function () {
      root.classList.remove("pop");
    }, 130);
  }

  function slam(i) {
    var root = els[i].root;
    root.classList.remove("slam");
    void root.offsetWidth;
    root.classList.add("slam");
    setTimeout(function () {
      root.classList.remove("slam");
    }, 380);
  }

  function updateLeader() {
    var a = state[1], b = state[2];
    els[1].root.classList.remove("leading", "trailing");
    els[2].root.classList.remove("leading", "trailing");
    if (a === b) {
      document.body.classList.remove("overdrive");
      return;
    }
    var lead = a > b ? 1 : 2;
    var other = lead === 1 ? 2 : 1;
    els[lead].root.classList.add("leading");
    els[other].root.classList.add("trailing");
    if (Math.max(a, b) >= 100) document.body.classList.add("overdrive");
    else document.body.classList.remove("overdrive");
  }

  var MILESTONES = {
    10: "NICE",
    25: "ON FIRE",
    42: "THE ANSWER",
    50: "HALF CENTURY",
    69: "NICE.",
    100: "CENTURY!",
    150: "UNSTOPPABLE",
    200: "GODLIKE",
    250: "LEGENDARY",
    300: "MAXIMUM POWER",
    420: "BLAZE IT",
    500: "HALF MILLENNIUM",
    777: "JACKPOT",
    1000: "A THOUSAND"
  };

  function checkMilestone(i, after) {
    var label = MILESTONES[after];
    if (label) FX.boom(label, i);
  }

  function ripple(host, clientX, clientY) {
    var rect = host.getBoundingClientRect();
    var size = Math.max(rect.width, rect.height) * 2;
    var s = document.createElement("span");
    s.className = "ripple";
    s.style.width = s.style.height = size + "px";
    s.style.left = clientX - rect.left + "px";
    s.style.top = clientY - rect.top + "px";
    if (getComputedStyle(host).position === "static") host.style.position = "relative";
    host.style.overflow = "hidden";
    host.appendChild(s);
    setTimeout(function () { s.remove(); }, 580);
  }

  function floatPlus(i, amount) {
    var span = document.createElement("span");
    span.className = "plus";
    span.textContent = (amount > 0 ? "+" : "") + amount;
    span.style.color = i === 1 ? "var(--p1)" : "var(--p2)";
    els[i].root.appendChild(span);
    setTimeout(function () {
      span.remove();
    }, 700);
  }

  function change(i, delta) {
    if (!delta) return;
    var before = state[i];
    history[i].push(before);
    if (history[i].length > MAX_HISTORY) history[i].shift();
    state[i] = Math.max(0, state[i] + delta);
    var applied = state[i] !== before;
    render(i);
    persist();
    updateUndo(i);
    updateLeader();
    FX.setGame(state[1], state[2]);
    if (delta > 0) {
      slam(i);
      floatPlus(i, delta);
      buzz(12);
      FX.hit(i, delta);
      if (applied) checkMilestone(i, state[i]);
    } else {
      buzz(8);
      FX.subtract(i);
    }
  }

  function undo(i) {
    if (!history[i].length) return;
    state[i] = history[i].pop();
    render(i);
    persist();
    updateUndo(i);
    slam(i);
    updateLeader();
    FX.setGame(state[1], state[2]);
    FX.flash(i === 1 ? "p1" : "p2");
    buzz(8);
  }

  var dialog = document.getElementById("dialog");

  function openReset() {
    dialog.hidden = false;
    pinDialogs();
  }

  function closeReset() {
    dialog.hidden = true;
  }

  function performReset() {
    closeReset();
    state[1] = 0;
    state[2] = 0;
    history[1] = [];
    history[2] = [];
    render(1);
    render(2);
    persist();
    updateUndo(1);
    updateUndo(2);
    updateLeader();
    FX.setGame(0, 0);
    FX.reset();
    buzz(20);
  }

  var nameDialog = document.getElementById("name-dialog");
  var nameInput = document.getElementById("name-input");
  var editingName = null;

  function openName(i) {
    editingName = i;
    nameInput.value = names[i];
    nameDialog.hidden = false;
    pinDialogs();
    setTimeout(function () {
      nameInput.focus({ preventScroll: true });
      nameInput.select();
      pinDialogs();
    }, 0);
  }

  function closeName() {
    nameDialog.hidden = true;
    editingName = null;
  }

  function saveName() {
    if (editingName !== null) {
      var value = nameInput.value.trim();
      if (value) {
        names[editingName] = value;
        render(editingName);
        persistNames();
      }
    }
    closeName();
  }

  var vv = window.visualViewport;

  function pinDialogs() {
    if (!vv) return;
    var box = { top: vv.offsetTop, height: vv.height };
    [dialog, nameDialog].forEach(function (d) {
      d.style.top = box.top + "px";
      d.style.height = box.height + "px";
      d.style.bottom = "auto";
    });
  }

  if (vv) {
    vv.addEventListener("resize", pinDialogs);
    vv.addEventListener("scroll", pinDialogs);
  }


  [1, 2].forEach(function (i) {
    els[i].mid.addEventListener("click", function () {
      change(i, 1);
    });

    els[i].root
      .querySelector(".minus")
      .addEventListener("click", function (e) {
        e.stopPropagation();
        change(i, -1);
      });

    els[i].root.querySelectorAll(".add").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        change(i, parseInt(btn.getAttribute("data-add"), 10));
      });
    });

    els[i].undo.addEventListener("click", function (e) {
      e.stopPropagation();
      undo(i);
    });

    els[i].name.addEventListener("click", function (e) {
      e.stopPropagation();
      openName(i);
    });
  });

  document.getElementById("reset").addEventListener("click", function (e) {
    e.stopPropagation();
    openReset();
  });

  document.getElementById("dialog-confirm").addEventListener("click", performReset);
  document.getElementById("dialog-cancel").addEventListener("click", closeReset);
  dialog.addEventListener("click", function (e) {
    if (e.target === dialog) closeReset();
  });

  document.getElementById("name-save").addEventListener("click", saveName);
  document.getElementById("name-cancel").addEventListener("click", closeName);
  nameDialog.addEventListener("click", function (e) {
    if (e.target === nameDialog) closeName();
  });

  document.addEventListener("keydown", function (e) {
    if (!nameDialog.hidden) {
      if (e.key === "Escape") closeName();
      else if (e.key === "Enter") saveName();
      return;
    }
    if (!dialog.hidden) {
      if (e.key === "Escape") closeReset();
      else if (e.key === "Enter") performReset();
      return;
    }
    if (e.key === "a" || e.key === "ArrowLeft") change(1, 1);
    else if (e.key === "l" || e.key === "ArrowRight") change(2, 1);
    else if (e.key === "Backspace") openReset();
  });

  render(1);
  render(2);
  updateUndo(1);
  updateUndo(2);
  updateLeader();

  Array.prototype.slice
    .call(document.querySelectorAll(".add, .minus, .undo, #reset"))
    .forEach(function (b) {
      b.addEventListener("pointerdown", function (e) {
        ripple(b, e.clientX, e.clientY);
      });
    });

  FX.init();
  FX.setGame(state[1], state[2]);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { FX.measure(); });
  }
})();
