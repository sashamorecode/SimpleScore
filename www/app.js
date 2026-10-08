(function () {
  "use strict";

  var KEY = "simplescore.v1";
  var NAMES_KEY = "simplescore.v1.names";
  var MAX_HISTORY = 200;

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
    history[i].push(state[i]);
    if (history[i].length > MAX_HISTORY) history[i].shift();
    state[i] = Math.max(0, state[i] + delta);
    render(i);
    persist();
    updateUndo(i);
    if (delta > 0) {
      bump(i);
      floatPlus(i, delta);
      buzz(12);
    } else {
      buzz(8);
    }
  }

  function undo(i) {
    if (!history[i].length) return;
    state[i] = history[i].pop();
    render(i);
    persist();
    updateUndo(i);
    bump(i);
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
})();
