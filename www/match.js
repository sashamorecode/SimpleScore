(function (root) {
  "use strict";

  var DEFAULT_GOAL = 20;
  var MAX_GOAL = 999999;

  function validGoal(value) {
    return typeof value === "number" && isFinite(value) &&
      value >= 1 && value <= MAX_GOAL && Math.floor(value) === value;
  }

  function parseGoal(text) {
    text = String(text).trim();
    if (!/^\d+$/.test(text) || !validGoal(Number(text))) return null;
    return Number(text);
  }

  function score(value) {
    return typeof value === "number" && isFinite(value) ?
      Math.min(9007199254740991, Math.max(0, Math.floor(value))) : 0;
  }

  function copy(m) {
    return { p1: m.p1, p2: m.p2, goal: m.goal, winner: m.winner,
      settled: m.settled, d1: m.d1, d2: m.d2, b1: m.b1, b2: m.b2 };
  }

  function reconcile(m) {
    if (m.winner && m["p" + m.winner] < m.goal) m.winner = 0;
    m.settled = !!m.winner || m.p1 >= m.goal || m.p2 >= m.goal;
    return m;
  }

  function create(saved) {
    saved = saved || {};
    var m = { p1: score(saved.p1), p2: score(saved.p2),
      goal: validGoal(saved.goal) ? saved.goal : DEFAULT_GOAL,
      winner: saved.winner === 1 || saved.winner === 2 ? saved.winner : 0,
      settled: false, d1: score(saved.d1), d2: score(saved.d2),
      b1: Math.min(score(saved.b1), Math.max(0, score(saved.p2) - score(saved.p1))),
      b2: Math.min(score(saved.b2), Math.max(0, score(saved.p1) - score(saved.p2))) };
    // Old score-only saves have no crossing order; use the qualifying leader.
    if (!Object.prototype.hasOwnProperty.call(saved, "winner")) {
      if (m.p1 > m.p2 && m.p1 >= m.goal) m.winner = 1;
      else if (m.p2 > m.p1 && m.p2 >= m.goal) m.winner = 2;
    }
    return reconcile(m);
  }

  function setGoal(m, goal) {
    if (!validGoal(goal) || goal === m.goal) return copy(m);
    var next = copy(m);
    next.goal = goal;
    next.winner = 0;
    next.d1 = next.d2 = 0;
    next.b1 = Math.max(0, next.p2 - next.p1);
    next.b2 = Math.max(0, next.p1 - next.p2);
    if (next.p1 > next.p2 && next.p1 >= goal) next.winner = 1;
    else if (next.p2 > next.p1 && next.p2 >= goal) next.winner = 2;
    return reconcile(next);
  }

  function correct(m, player, value) {
    var next = copy(m);
    next["p" + player] = score(value);
    // Corrections are not competitive play: start fresh comeback tracking.
    next.d1 = next.d2 = 0;
    next.b1 = Math.max(0, next.p2 - next.p1);
    next.b2 = Math.max(0, next.p1 - next.p2);
    return reconcile(next);
  }

  function advance(m, player, amount) {
    var next = copy(m);
    var other = player === 1 ? 2 : 1;
    var before = m["p" + player];
    var opponent = m["p" + other];
    var after = score(before + amount);
    next["p" + player] = after;
    var event = null;
    var caughtUp = before < opponent && after >= opponent;
    var recovered = before > 0 && caughtUp &&
      m["d" + player] >= Math.max(2, Math.ceil(m.goal * 0.2));

    if (after > before) {
      if (before < m.goal && after >= m.goal) {
        if (!m.settled) {
          next.winner = player;
          event = "win";
        } else event = "goal";
      }
      if (!event && recovered) event = "comeback";
      if (!event && after === opponent && before !== opponent) event = "tie";
      if (!event && after > opponent && before <= opponent && opponent > 0) event = "lead";
      if (!event && m.goal >= 2 && before < m.goal - 1 && after === m.goal - 1) event = "matchpoint";
      if (!event && m.goal >= 6 && before < Math.ceil(m.goal * 0.8) &&
          after >= Math.ceil(m.goal * 0.8) && after < m.goal) event = "near";
      if (!event && m.goal >= 4 && before < Math.ceil(m.goal * 0.5) &&
          after >= Math.ceil(m.goal * 0.5) && after < m.goal) event = "halfway";
    }

    if (caughtUp) next["d" + player] = 0;
    // Baselines exclude deficits introduced by corrections or a new goal.
    // They shrink as a player scores; only a fresh competitive gap counts.
    next.b1 = Math.min(next.b1, Math.max(0, next.p2 - next.p1));
    next.b2 = Math.min(next.b2, Math.max(0, next.p1 - next.p2));
    next.d1 = Math.max(next.d1, next.p2 - next.p1 - next.b1, 0);
    next.d2 = Math.max(next.d2, next.p1 - next.p2 - next.b2, 0);
    return { match: reconcile(next), event: event };
  }

  function reset(m) {
    return create({ goal: m.goal, winner: 0 });
  }

  var api = { create: create, parseGoal: parseGoal, setGoal: setGoal,
    advance: advance, correct: correct, reset: reset };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.SimpleScoreMatch = api;
})(this);
