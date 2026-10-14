"use strict";

var assert = require("node:assert/strict");
var test = require("node:test");
var Match = require("../www/match.js");

function add(match, player, amount) {
  return Match.advance(match, player, amount).match;
}

test("goal validation accepts bounded integers and rejects invalid input", function () {
  ["", " ", "0", "-1", "1.5", "1.0", "1000000", "Infinity", "1e2", "abc"].forEach(function (value) {
    assert.equal(Match.parseGoal(value), null, value);
  });
  assert.equal(Match.parseGoal("1"), 1);
  assert.equal(Match.parseGoal(" 10 "), 10);
  assert.equal(Match.parseGoal("999999"), 999999);
  assert.equal(Match.create().goal, 20);
  assert.equal(Match.create({ goal: 0 }).goal, 20);
  assert.equal(Match.create({ goal: 2.5 }).goal, 20);
  assert.equal(Match.create({ goal: 10 }).goal, 10, "a persisted chosen goal is preserved");
});

test("every multi-point button can cross or overshoot the goal with a single win event", function () {
  [2, 3, 4, 5, 6, 7].forEach(function (amount) {
    var m = Match.create({ p1: 9, p2: 8, goal: 10, winner: 0, d1: 4 });
    var result = Match.advance(m, 1, amount);
    assert.equal(result.event, "win");
    assert.equal(result.match.winner, 1);
    assert.equal(result.match.p1, 9 + amount);
    assert.equal(result.match.settled, true);
    assert.equal(m.p1, 9, "the input state is not mutated");
  });
});

test("the first winner persists through continued scoring and reload", function () {
  var m = add(Match.create({ goal: 10 }), 1, 10);
  var second = Match.advance(m, 2, 12);
  assert.equal(second.event, "goal");
  assert.equal(second.match.winner, 1);
  m = Match.create(JSON.parse(JSON.stringify(second.match)));
  assert.equal(m.winner, 1);
  assert.equal(add(m, 2, 7).p2, 19);
  assert.equal(add(m, 1, 7).p1, 17);
  assert.equal(Match.setGoal(m, 10).winner, 1, "saving the same goal keeps the first winner");
});

test("changed goals apply to current scores, including qualifying ties", function () {
  var m = Match.create({ p1: 12, p2: 14, goal: 10, winner: 1 });
  var changed = Match.setGoal(m, 11);
  assert.equal(changed.winner, 2);
  assert.equal(changed.p1, 12);
  assert.equal(changed.p2, 14);
  assert.equal(Match.setGoal(changed, 20).winner, 0);
  assert.equal(Match.setGoal(changed, 20).settled, false);

  var tied = Match.setGoal(Match.create({ p1: 7, p2: 7 }), 5);
  assert.equal(tied.winner, 0);
  assert.equal(tied.settled, true);
  assert.equal(Match.advance(tied, 1, 1).event, "lead");
  assert.equal(add(tied, 1, 1).winner, 0, "a qualifying tie cannot invent crossing order");
});

test("corrections invalidate stale wins without awarding a new winner", function () {
  var won = add(Match.create({ goal: 10 }), 1, 10);
  var corrected = Match.correct(won, 1, 9);
  assert.equal(corrected.winner, 0);
  assert.equal(corrected.settled, false);
  assert.equal(Match.advance(corrected, 1, 1).event, "win");

  var both = add(won, 2, 11);
  corrected = Match.correct(both, 1, 9);
  assert.equal(corrected.winner, 0);
  assert.equal(corrected.settled, true);
  assert.equal(Match.advance(corrected, 1, 1).event, "goal");
  assert.equal(Match.create(JSON.parse(JSON.stringify(corrected))).winner, 0);
  assert.equal(Match.correct(corrected, 1, 10).winner, 0, "undoing a subtraction is not a new win");
});

test("relative checkpoints and match point work on skipped values", function () {
  var m = Match.create({ goal: 20 });
  var halfway = Match.advance(m, 1, 11);
  assert.equal(halfway.event, "halfway");
  var near = Match.advance(halfway.match, 1, 6);
  assert.equal(near.event, "near");
  var point = Match.advance(near.match, 1, 2);
  assert.equal(point.event, "matchpoint");
  assert.equal(Match.advance(point.match, 1, 7).event, "win");
  assert.equal(Match.advance(Match.create({ goal: 1 }), 1, 1).event, "win");
  assert.equal(Match.advance(Match.create({ goal: 2 }), 1, 1).event, "matchpoint");
  assert.equal(Match.advance(Match.create({ goal: 3 }), 1, 1).event, null);
  assert.equal(Match.advance(Match.create({ goal: 999999, p1: 999998 }), 1, 7).event, "win");
});

test("competitive events outrank checkpoints, and wins outrank comebacks", function () {
  var m = Match.create({ p1: 7, p2: 9, goal: 10, winner: 0, d1: 3 });
  assert.equal(Match.advance(m, 1, 2).event, "comeback");
  assert.equal(Match.advance(m, 1, 3).event, "win");
  m.d1 = 1;
  assert.equal(Match.advance(m, 1, 2).event, "tie");
  m = Match.create({ p1: 7, p2: 8, goal: 10, winner: 0 });
  assert.equal(Match.advance(m, 1, 2).event, "lead");
});

test("comeback deficit persists across reload and is consumed on recovery", function () {
  var m = add(Match.create({ goal: 20 }), 1, 2);
  m = add(m, 2, 7);
  m = Match.create(JSON.parse(JSON.stringify(m)));
  assert.equal(m.d1, 5);
  var recovered = Match.advance(m, 1, 5);
  assert.equal(recovered.event, "comeback");
  assert.equal(recovered.match.d1, 0);
  m = add(recovered.match, 2, 1);
  assert.equal(Match.advance(m, 1, 1).event, "tie", "a fresh one-point gap is not another comeback");
  var large = Match.create({ p1: 1, p2: 20, goal: 100, winner: 0, d1: 19 });
  assert.equal(Match.advance(large, 1, 19).event, "tie");
  large.p2 = 21;
  large.d1 = 20;
  assert.equal(Match.advance(large, 1, 20).event, "comeback");
});

test("opening points and correction history do not manufacture comebacks", function () {
  assert.equal(Match.advance(Match.create(), 1, 1).event, null);
  var m = add(Match.create(), 1, 2);
  var openingTie = Match.advance(m, 2, 2);
  assert.equal(openingTie.event, "tie");
  assert.equal(openingTie.match.d2, 0);
  m = Match.create({ p1: 2, p2: 7, goal: 20, d1: 5 });
  m = Match.correct(m, 2, 3);
  assert.equal(m.d1, 0);
  assert.equal(Match.advance(m, 1, 1).event, "tie");
  m = Match.correct(m, 2, 7); // Undoing a subtraction also starts fresh tracking.
  assert.equal(Match.advance(m, 1, 5).event, "tie");
  m = add(m, 1, 1);
  m = Match.create(JSON.parse(JSON.stringify(m)));
  assert.equal(Match.advance(m, 1, 4).event, "tie", "partial recovery cannot adopt a correction-created deficit");
  m = Match.correct(m, 2, 10);
  m = add(m, 2, 1);
  assert.equal(Match.advance(m, 1, 8).event, "tie", "one new opponent point is below the comeback threshold");
});

test("ties, lead changes and comebacks continue after the match is won", function () {
  var m = Match.create({ p1: 14, p2: 12, goal: 10, winner: 1, d2: 2 });
  var recovered = Match.advance(m, 2, 2);
  assert.equal(recovered.event, "comeback");
  assert.equal(recovered.match.winner, 1);
  var lead = Match.advance(recovered.match, 2, 1);
  assert.equal(lead.event, "lead");
  var tie = Match.advance(lead.match, 1, 1);
  assert.equal(tie.event, "tie");
  assert.equal(tie.match.winner, 1);
});

test("reset preserves the goal and clears scores and match metadata", function () {
  var m = Match.create({ p1: 31, p2: 14, goal: 30, winner: 1, d2: 17 });
  assert.deepEqual(Match.reset(m), { p1: 0, p2: 0, goal: 30, winner: 0,
    settled: false, d1: 0, d2: 0, b1: 0, b2: 0 });
});

test("legacy saves migrate without fabricating a winner for tied scores", function () {
  assert.equal(Match.create({ p1: 24, p2: 22 }).winner, 1);
  assert.equal(Match.create({ p1: 22, p2: 24 }).winner, 2);
  assert.equal(Match.create({ p1: 14, p2: 12 }).winner, 0);
  var tied = Match.create({ p1: 24, p2: 24 });
  assert.equal(tied.winner, 0);
  assert.equal(tied.settled, true);
});
