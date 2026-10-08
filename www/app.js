(function () {
  "use strict";

  var KEY = "simplescore.v1";
  var NAMES_KEY = "simplescore.v1.names";

  var state = { 1: 0, 2: 0 };
  var names = { 1: "Player 1", 2: "Player 2" };

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
      score: document.querySelector('[data-score="1"]'),
      name: document.querySelector('[data-name="1"]'),
    },
    2: {
      root: document.querySelector(".p2"),
      score: document.querySelector('[data-score="2"]'),
      name: document.querySelector('[data-name="2"]'),
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

  function buzz(ms) {
    if (navigator.vibrate) navigator.vibrate(ms);
  }

  function pop(i) {
    var root = els[i].root;
    root.classList.remove("pop");
    void root.offsetWidth;
    root.classList.add("pop");
    setTimeout(function () {
      root.classList.remove("pop");
    }, 130);
  }

  function floatPlus(i) {
    var span = document.createElement("span");
    span.className = "plus";
    span.textContent = "+1";
    span.style.color = i === 1 ? "var(--p1)" : "var(--p2)";
    els[i].root.appendChild(span);
    setTimeout(function () {
      span.remove();
    }, 700);
  }

  function change(i, delta) {
    state[i] = Math.max(0, state[i] + delta);
    render(i);
    persist();
    if (delta > 0) {
      pop(i);
      floatPlus(i);
      buzz(12);
    } else {
      buzz(8);
    }
  }

  function reset() {
    if (!window.confirm("Reset both scores?")) return;
    state[1] = 0;
    state[2] = 0;
    render(1);
    render(2);
    persist();
    buzz(20);
  }

  [1, 2].forEach(function (i) {
    els[i].root.addEventListener("click", function () {
      change(i, 1);
    });

    els[i].root
      .querySelector(".minus")
      .addEventListener("click", function (e) {
        e.stopPropagation();
        change(i, -1);
      });

    els[i].name.addEventListener("click", function (e) {
      e.stopPropagation();
      var value = window.prompt("Player name", names[i]);
      if (value !== null && value.trim()) {
        names[i] = value.trim();
        render(i);
        persistNames();
      }
    });
  });

  document.getElementById("reset").addEventListener("click", function (e) {
    e.stopPropagation();
    reset();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "a" || e.key === "ArrowLeft") change(1, 1);
    else if (e.key === "l" || e.key === "ArrowRight") change(2, 1);
    else if (e.key === "Backspace") reset();
  });

  render(1);
  render(2);
})();
