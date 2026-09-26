/* ==========================================================================
   CONCURRA — Interactive Concurrency Lab
   Vanilla JavaScript: workspace router, learning progress, experiment labs,
   visual instruments, assessment. No backend, no dependencies.
   ========================================================================== */

(function () {
  "use strict";

  /* ======================================================================
     1. Helpers
     ====================================================================== */

  function $(selector, ctx) {
    return (ctx || document).querySelector(selector);
  }

  function $$(selector, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(selector));
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function pad(value, size) {
    var text = String(value);
    while (text.length < size) { text = "0" + text; }
    return text;
  }

  /* 00:00.000 style timestamp for event streams */
  function fmtClock(seconds) {
    var total = Math.max(0, seconds);
    var mins = Math.floor(total / 60);
    var secs = Math.floor(total % 60);
    var millis = Math.floor((total - Math.floor(total)) * 1000);
    return pad(mins, 2) + ":" + pad(secs, 2) + "." + pad(millis, 3);
  }

  /* 02.41s style value for live telemetry */
  function fmtSecs(seconds) {
    var total = Math.max(0, seconds);
    var secs = Math.floor(total);
    var cents = Math.floor((total - secs) * 100);
    return pad(secs, 2) + "." + pad(cents, 2) + "s";
  }

  function oneDecimal(value) {
    return (Math.round(value * 10) / 10).toFixed(1);
  }

  function randomBetween(min, max) {
    var value = min + Math.random() * (max - min);
    return Math.round(value * 10) / 10;
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function sleep(ms) {
    return new Promise(function (resolve) { window.setTimeout(resolve, ms); });
  }

  function setText(selector, value) {
    var el = $(selector);
    if (el) { el.textContent = value; }
  }

  function clearTimers(list) {
    list.forEach(function (id) { window.clearTimeout(id); });
    list.length = 0;
  }

  function later(list, fn, ms) {
    list.push(window.setTimeout(fn, ms));
  }

  /* ======================================================================
     2. State (localStorage)
     ====================================================================== */

  var STORAGE_KEY = "concurra.state.v1";

  var LESSONS = [
    {
      id: "l1", title: "Introduction to Threads", target: "topic-threads", module: "Module 01",
      minutes: 8,
      blurb: "Start with the smallest unit a scheduler can run on its own: the thread. This topic sets the vocabulary the rest of the workspace uses — tasks, lanes, states and the moments where the CPU changes hands."
    },
    {
      id: "l2", title: "Threads and Processes", target: "topic-compare", module: "Module 01",
      minutes: 10,
      blurb: "Compare what a thread shares with what a process owns: memory, open files, and the creation cost that decides which one a program should use."
    },
    {
      id: "l3", title: "Synchronization", target: "topic-sync", module: "Module 03",
      minutes: 11,
      blurb: "Locks, semaphores and critical sections — the tools that make one shared resource safe to touch from more than one task at a time."
    },
    {
      id: "l4", title: "Race Conditions", target: "topic-race", module: "Module 04",
      minutes: 12,
      blurb: "Watch two workers read the same value and overwrite each other, then reproduce the lost update yourself in the shared counter experiment."
    },
    {
      id: "l5", title: "Deadlocks", target: "topic-deadlock", module: "Module 04",
      minutes: 10,
      blurb: "Circular waiting in its simplest form: two workers, two resources and no way forward — until every worker requests them in the same order."
    },
    {
      id: "l6", title: "Practical Threading", target: "topic-practical", module: "Module 05",
      minutes: 13,
      blurb: "Python threads, the GIL, and the everyday decision of when a thread, a process or an async task is the right tool for the job."
    }
  ];

  var MODULES = [
    { id: "m1", name: "Foundations", title: "Execution Fundamentals" },
    { id: "m2", name: "Concurrency", title: "Concurrent Execution" },
    { id: "m3", name: "Shared state", title: "Shared Resources" },
    { id: "m4", name: "Problems", title: "Concurrency Problems" },
    { id: "m5", name: "Practical", title: "Practical Threading" }
  ];

  function defaultState() {
    return {
      theme: "light",
      collapsed: false,
      lastView: "overview",
      lessons: [],
      modules: [],
      visited: [],
      experiments: 0,
      customRuns: 0,
      latest: null,
      history: [],
      assessment: { answers: {}, best: 0 }
    };
  }

  var state = defaultState();

  function loadState() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) { return; }
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") { return; }

      state.theme = parsed.theme === "dark" ? "dark" : "light";
      state.collapsed = parsed.collapsed === true;
      state.lastView = typeof parsed.lastView === "string" ? parsed.lastView : "overview";
      state.lessons = Array.isArray(parsed.lessons) ? parsed.lessons : [];
      state.modules = Array.isArray(parsed.modules) ? parsed.modules : [];
      state.visited = Array.isArray(parsed.visited) ? parsed.visited : [];
      state.experiments = typeof parsed.experiments === "number" ? parsed.experiments : 0;
      state.customRuns = typeof parsed.customRuns === "number" ? parsed.customRuns : 0;
      state.latest = parsed.latest && typeof parsed.latest === "object" ? parsed.latest : null;
      state.history = Array.isArray(parsed.history) ? parsed.history.slice(0, 8) : [];
      state.assessment = parsed.assessment && typeof parsed.assessment === "object"
        ? { answers: parsed.assessment.answers || {}, best: parsed.assessment.best || 0 }
        : { answers: {}, best: 0 };
    } catch (error) { /* fall back to defaults */ }
  }

  function saveState() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) { /* storage unavailable */ }
  }

  function inList(list, id) { return list.indexOf(id) !== -1; }

  function addToList(list, id) {
    if (!inList(list, id)) { list.push(id); saveState(); }
  }

  /* ======================================================================
     3. Theme
     ====================================================================== */

  function applyTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute("data-theme", theme);
    var label = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
    ["themeToggle", "themeToggleTop"].forEach(function (id) {
      var btn = document.getElementById(id);
      if (btn) { btn.setAttribute("aria-label", label); btn.setAttribute("title", label); }
    });
    saveState();
  }

  function toggleTheme() {
    applyTheme(state.theme === "dark" ? "light" : "dark");
  }

  function initTheme() {
    ["themeToggle", "themeToggleTop"].forEach(function (id) {
      var btn = document.getElementById(id);
      if (btn) { btn.addEventListener("click", toggleTheme); }
    });
    applyTheme(state.theme);
  }

  /* ======================================================================
     4. Navigation rail + mobile drawer
     ====================================================================== */

  var rail = $("#rail");
  var scrim = $("#scrim");
  var menuBtn = $("#menuBtn");

  function isMobile() {
    return window.matchMedia("(max-width: 767px)").matches;
  }

  function openDrawer() {
    document.body.classList.add("nav-open");
    if (scrim) { scrim.hidden = false; }
    if (menuBtn) { menuBtn.setAttribute("aria-expanded", "true"); }
  }

  function closeDrawer() {
    document.body.classList.remove("nav-open");
    if (scrim) { scrim.hidden = true; }
    if (menuBtn) { menuBtn.setAttribute("aria-expanded", "false"); }
  }

  function initRail() {
    if (state.collapsed) { document.body.classList.add("rail-collapsed"); }

    var toggle = $("#railToggle");
    if (toggle) {
      toggle.addEventListener("click", function () {
        var collapsed = document.body.classList.toggle("rail-collapsed");
        state.collapsed = collapsed;
        toggle.setAttribute("aria-expanded", String(!collapsed));
        toggle.setAttribute("aria-label", collapsed ? "Expand sidebar" : "Collapse sidebar");
        toggle.setAttribute("title", collapsed ? "Expand sidebar" : "Collapse sidebar");
        saveState();
      });
      toggle.setAttribute("aria-expanded", String(!document.body.classList.contains("rail-collapsed")));
    }

    if (menuBtn) {
      menuBtn.addEventListener("click", function () {
        if (document.body.classList.contains("nav-open")) { closeDrawer(); }
        else { openDrawer(); }
      });
    }

    if (scrim) { scrim.addEventListener("click", closeDrawer); }

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && document.body.classList.contains("nav-open")) { closeDrawer(); }
    });

    window.addEventListener("resize", function () {
      if (!isMobile() && document.body.classList.contains("nav-open")) { closeDrawer(); }
    });
  }

  /* ======================================================================
     5. View router
     ====================================================================== */

  var VIEW_META = {
    overview: { root: "Workspace", leaf: "Overview" },
    learn: { root: "Workspace", leaf: "Learn" },
    lab: { root: "Workspace", leaf: "Experiments" },
    visual: { root: "Workspace", leaf: "Visual Lab" },
    assessment: { root: "Workspace", leaf: "Assessment" },
    about: { root: "Workspace", leaf: "About" }
  };

  var currentView = "overview";

  function showView(name, options) {
    if (!VIEW_META[name]) { name = "overview"; }
    var opts = options || {};

    $$(".view").forEach(function (panel) {
      var active = panel.getAttribute("data-view") === name;
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
    });

    $$(".rail-item[data-view]").forEach(function (item) {
      var active = item.getAttribute("data-view") === name;
      item.classList.toggle("is-active", active);
      if (active) { item.setAttribute("aria-current", "page"); }
      else { item.removeAttribute("aria-current"); }
    });

    currentView = name;
    setText("#crumbRoot", VIEW_META[name].root);
    setText("#crumbLeaf", VIEW_META[name].leaf);

    if (state.lastView !== name) {
      state.lastView = name;
      saveState();
    }

    if (!opts.keepScroll) {
      window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    }

    if (isMobile()) { closeDrawer(); }
  }

  function initRouter() {
    document.addEventListener("click", function (event) {
      if (!event.target || !event.target.closest) { return; }

      var viewTrigger = event.target.closest("[data-view]");
      if (viewTrigger && !viewTrigger.classList.contains("view")) {
        event.preventDefault();
        showView(viewTrigger.getAttribute("data-view"));
        return;
      }

      var actionTrigger = event.target.closest("[data-action]");
      if (actionTrigger) {
        event.preventDefault();
        handleAction(actionTrigger.getAttribute("data-action"));
        return;
      }

      var scrollTrigger = event.target.closest("[data-scroll]");
      if (scrollTrigger) {
        event.preventDefault();
        scrollToId(scrollTrigger.getAttribute("data-scroll"));
      }
    });
  }

  function scrollToId(id) {
    var el = document.getElementById(id);
    if (!el) { return; }
    var top = el.getBoundingClientRect().top + window.scrollY - 74;
    window.scrollTo({ top: top, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }

  function nextLesson() {
    for (var i = 0; i < LESSONS.length; i++) {
      if (!inList(state.lessons, LESSONS[i].id)) { return LESSONS[i]; }
    }
    return null;
  }

  function handleAction(action) {
    if (action === "continue-lesson" || action === "new-lesson") {
      var lesson = nextLesson() || LESSONS[LESSONS.length - 1];
      openLesson(lesson);
    } else if (action === "new-experiment") {
      showView("lab");
    }
  }

  function openLesson(lesson) {
    if (!lesson) { return; }
    showView("learn", { keepScroll: true });
    addToList(state.lessons, lesson.id);
    window.setTimeout(function () { scrollToId(lesson.target); }, 80);
    renderProgress();
  }

  /* ======================================================================
     6. Utility header — hide on scroll down, show on scroll up
     ====================================================================== */

  function initTopbar() {
    var topbar = $("#topbar");
    if (!topbar) { return; }
    var lastY = window.scrollY;
    var ticking = false;

    window.addEventListener("scroll", function () {
      if (ticking) { return; }
      ticking = true;
      window.requestAnimationFrame(function () {
        var y = window.scrollY;
        if (y > 150 && y > lastY + 6) {
          topbar.classList.add("is-hidden");
        } else if (y < lastY - 6 || y < 150) {
          topbar.classList.remove("is-hidden");
        }
        lastY = y;
        ticking = false;
      });
    }, { passive: true });
  }

  /* ======================================================================
     7. Progress + dashboard rendering
     ====================================================================== */

  function completionPercent() {
    var done = state.lessons.length + state.modules.length + (state.assessment.best >= 7 ? 1 : 0);
    return Math.round((done / (LESSONS.length + MODULES.length + 1)) * 100);
  }

  function moduleStatus(id) {
    if (inList(state.modules, id)) { return "complete"; }
    if (inList(state.visited, id)) { return "progress"; }
    return "none";
  }

  function timeLabel(ts) {
    var date = new Date(ts);
    var now = new Date();
    var startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    if (ts >= startOfToday) { return "Today"; }
    if (ts >= startOfToday - 86400000) { return "Yesterday"; }
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function addHistory(entry) {
    state.history.unshift({
      title: entry.title,
      meta: entry.meta,
      result: entry.result,
      time: Date.now()
    });
    state.history = state.history.slice(0, 8);
    saveState();
  }

  function renderHistory() {
    var list = $("#historyList");
    if (!list) { return; }
    list.innerHTML = "";

    if (!state.history.length) {
      var empty = document.createElement("li");
      empty.className = "empty";
      empty.textContent = "Completed experiments appear here with their settings and outcome.";
      list.appendChild(empty);
      return;
    }

    state.history.forEach(function (entry) {
      var li = document.createElement("li");
      var title = document.createElement("span");
      title.className = "hist-title";
      title.textContent = entry.title;
      var meta = document.createElement("span");
      meta.className = "hist-meta";
      meta.textContent = entry.meta + " · " + entry.result;
      var time = document.createElement("span");
      time.className = "hist-time";
      time.textContent = timeLabel(entry.time);
      li.appendChild(title);
      li.appendChild(meta);
      li.appendChild(time);
      list.appendChild(li);
    });
  }

  function renderRecent() {
    var box = $("#recentExp");
    if (!box) { return; }
    box.innerHTML = "";

    if (!state.history.length) {
      var empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "No experiment has been run yet. The concurrency lab starts with five simulated tasks in concurrent mode.";
      box.appendChild(empty);
      return;
    }

    var entry = state.history[0];
    var title = document.createElement("p");
    title.className = "recent-title";
    title.textContent = entry.title;
    var note = document.createElement("p");
    note.className = "recent-note";
    note.textContent = entry.meta + " — " + entry.result;
    var line = document.createElement("div");
    line.className = "recent-line";
    [entry.meta, entry.result, timeLabel(entry.time)].forEach(function (text) {
      var tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = text;
      line.appendChild(tag);
    });

    box.appendChild(title);
    box.appendChild(note);
    box.appendChild(line);
  }

  function renderNextTopic() {
    var box = $("#nextTopic");
    if (!box) { return; }
    box.innerHTML = "";

    var lesson = nextLesson();
    if (lesson) {
      var title = document.createElement("p");
      title.className = "next-topic-title";
      title.textContent = lesson.title;
      var meta = document.createElement("p");
      meta.className = "next-topic-meta";
      meta.textContent = lesson.module + " · " + lesson.id.toUpperCase();
      var text = document.createElement("p");
      text.className = "panel-text";
      text.textContent = "Continue with this topic to keep the learning path moving. It opens at the matching section inside the module.";
      var actions = document.createElement("div");
      actions.className = "panel-actions";
      var btn = document.createElement("button");
      btn.className = "btn btn-primary";
      btn.type = "button";
      btn.textContent = "Open topic";
      btn.addEventListener("click", function () { openLesson(lesson); });
      actions.appendChild(btn);
      box.appendChild(title);
      box.appendChild(meta);
      box.appendChild(text);
      box.appendChild(actions);
      return;
    }

    var doneTitle = document.createElement("p");
    doneTitle.className = "next-topic-title";
    doneTitle.textContent = "Path complete";
    var doneText = document.createElement("p");
    doneText.className = "panel-text";
    doneText.textContent = "You have viewed every topic on the learning path. Reinforce the material with an experiment or take the assessment.";
    var doneActions = document.createElement("div");
    doneActions.className = "panel-actions";
    var labBtn = document.createElement("button");
    labBtn.className = "btn btn-secondary";
    labBtn.type = "button";
    labBtn.textContent = "Open the lab";
    labBtn.setAttribute("data-view", "lab");
    var quizBtn = document.createElement("button");
    quizBtn.className = "btn btn-primary";
    quizBtn.type = "button";
    quizBtn.textContent = "Take assessment";
    quizBtn.setAttribute("data-view", "assessment");
    doneActions.appendChild(labBtn);
    doneActions.appendChild(quizBtn);
    box.appendChild(doneTitle);
    box.appendChild(doneText);
    box.appendChild(doneActions);
  }

  function renderCurrentLesson(lesson) {
    var actionBtn = $('[data-action="continue-lesson"]');

    if (lesson) {
      setText("#clTitle", lesson.title);
      setText("#clText", lesson.blurb);
      setText("#clMeta", lesson.module + " · " + lesson.title + " · " + lesson.minutes + " min read");
      if (actionBtn) { actionBtn.textContent = "Continue lesson"; }
      return;
    }

    setText("#clTitle", "Learning path complete");
    setText("#clText",
      "Every topic on the path has been opened. Revisit any section from the module outline, run " +
      "another experiment, or finish with the assessment to lock in the material.");
    setText("#clMeta", LESSONS.length + " of " + LESSONS.length + " topics viewed");
    if (actionBtn) { actionBtn.textContent = "Review lessons"; }
  }

  function renderProgress() {
    var percent = completionPercent();
    var lessonCount = state.lessons.length;
    var moduleCount = state.modules.length;

    /* ring + meters */
    var ring = $("#ringFill");
    if (ring) {
      var circumference = 339.29;
      ring.style.strokeDashoffset = String(circumference * (1 - percent / 100));
    }
    setText("#ringValue", percent + "%");
    setText("#meterValue", percent + "%");
    setText("#railMeterValue", String(percent));
    var meterFill = $("#meterFill");
    if (meterFill) { meterFill.style.width = percent + "%"; }
    var railFill = $("#railMeterFill");
    if (railFill) { railFill.style.width = percent + "%"; }

    setText("#ovLessons", lessonCount + " / " + LESSONS.length);
    setText("#ovModules", moduleCount + " / " + MODULES.length);
    setText("#ovAssess", state.assessment.best > 0 ? state.assessment.best + " / 10 best" : "Not taken");

    var lessonTrack = $("#lessonTrack");
    if (lessonTrack) {
      lessonTrack.style.width = Math.round((lessonCount / LESSONS.length) * 100) + "%";
    }

    setText("#pathPercent", percent + "%");
    setText("#pathCount", lessonCount + " of " + LESSONS.length);

    /* learning path items */
    var currentMarked = false;
    $$("#pathList .path-item").forEach(function (item) {
      var id = item.getAttribute("data-lesson");
      var done = inList(state.lessons, id);
      item.classList.toggle("is-done", done);
      var stateText = $(".path-state", item);
      if (done) {
        if (stateText) { stateText.textContent = "Completed"; }
        item.classList.remove("is-current");
      } else {
        if (stateText) { stateText.textContent = "Not started"; }
        if (!currentMarked) {
          item.classList.add("is-current");
          if (stateText) { stateText.textContent = "Current"; }
          currentMarked = true;
        } else {
          item.classList.remove("is-current");
        }
      }
    });

    /* ledger */
    setText("#ledLessons", lessonCount + " of " + LESSONS.length);
    setText("#ledExperiments", String(state.experiments));
    setText("#ledLatest", state.latest ? state.latest.label : "None yet");
    setText("#ledAssessment", state.assessment.best > 0 ? state.assessment.best + " / 10" : "Not taken");

    /* strip hints */
    var next = nextLesson();
    setText("#stripLesson", next ? next.module : "Path complete");
    var answered = Object.keys(state.assessment.answers).length;
    setText("#stripScore", answered + " of 10 answered");

    /* outline + checklist */
    MODULES.forEach(function (mod) {
      var status = moduleStatus(mod.id);
      var toc = document.getElementById("toc-" + mod.id);
      if (toc) {
        toc.textContent = status === "complete" ? "Complete"
          : status === "progress" ? "In progress" : "Not started";
        toc.classList.toggle("is-done", status === "complete");
        toc.classList.toggle("is-progress", status === "progress");
      }

      var row = $('#moduleChecklist li[data-module="' + mod.id + '"]');
      if (row) {
        row.classList.toggle("is-complete", status === "complete");
        row.classList.toggle("is-progress", status === "progress");
        var label = $(".cl-state", row);
        if (label) {
          label.textContent = status === "complete" ? "Complete"
            : status === "progress" ? "In progress" : "Not started";
        }
      }

      var chip = $('[data-complete-module="' + mod.id + '"]');
      if (chip) {
        var done = status === "complete";
        chip.classList.toggle("is-done", done);
        chip.textContent = done ? "Completed" : "Mark complete";
        chip.setAttribute("aria-pressed", String(done));
      }
    });

    setText("#assessPct", percent + "%");
    setText("#assessBest", state.assessment.best > 0 ? state.assessment.best + " / 10" : "Not attempted");
    setText("#assessAnswered", answered + " of 10");

    /* current focus on the dashboard */
    var focus = next ? next.title : "Review and assessment";
    setText("#ovFocus", focus);
    renderCurrentLesson(next);

    renderHistory();
    renderRecent();
    renderNextTopic();
  }

  /* ======================================================================
     8. Learn — path, modules, outline, copy, highlighting
     ====================================================================== */

  function initLearn() {
    $$("#pathList .path-item").forEach(function (item) {
      var button = $(".path-hit", item);
      if (!button) { return; }
      button.addEventListener("click", function () {
        var id = item.getAttribute("data-lesson");
        var lesson = null;
        LESSONS.forEach(function (entry) { if (entry.id === id) { lesson = entry; } });
        if (lesson) { openLesson(lesson); }
      });
    });

    $$("[data-complete-module]").forEach(function (chip) {
      chip.addEventListener("click", function () {
        var id = chip.getAttribute("data-complete-module");
        if (inList(state.modules, id)) {
          state.modules = state.modules.filter(function (entry) { return entry !== id; });
        } else {
          state.modules.push(id);
          addToList(state.visited, id);
        }
        saveState();
        renderProgress();
      });
    });

    $$(".module").forEach(function (module) {
      var id = module.getAttribute("data-module");
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            addToList(state.visited, id);
            renderProgress();
          }
        });
      }, { threshold: 0.25 });
      observer.observe(module);
    });

    initCopyButtons();
    highlightPython($("#codeWorkbench"));
  }

  function initCopyButtons() {
    $$("[data-copy-target]").forEach(function (button) {
      button.addEventListener("click", function () {
        var target = document.getElementById(button.getAttribute("data-copy-target"));
        if (!target) { return; }
        var text = target.textContent;
        var done = function () {
          var original = button.dataset.idleLabel || button.textContent;
          button.dataset.idleLabel = original;
          button.textContent = "Copied";
          window.setTimeout(function () {
            button.textContent = button.dataset.idleLabel;
          }, 1500);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done).catch(function () { fallbackCopy(text, done); });
        } else {
          fallbackCopy(text, done);
        }
      });
    });
  }

  function fallbackCopy(text, callback) {
    var area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    try { document.execCommand("copy"); callback(); } catch (error) { /* ignore */ }
    document.body.removeChild(area);
  }

  /* lightweight Python tokeniser — safe: single pass over escaped source */
  function highlightPython(pre) {
    if (!pre || pre.dataset.highlighted === "true") { return; }
    var source = pre.textContent
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    var pattern = /(#[^\n]*)|(f?"(?:[^"\\]|\\.)*")|\b(import|def|for|in|if|elif|else|return|while|not|and|or|True|False|None|with|as|from)\b|\b(\d+(?:\.\d+)?)\b|\b([A-Za-z_]\w*)(?=\s*\()/g;

    var html = source.replace(pattern, function (match, comment, str, keyword, num, fn) {
      if (comment) { return '<span class="tk-com">' + comment + "</span>"; }
      if (str) { return '<span class="tk-str">' + str + "</span>"; }
      if (keyword) { return '<span class="tk-kw">' + keyword + "</span>"; }
      if (num) { return '<span class="tk-num">' + num + "</span>"; }
      if (fn) { return '<span class="tk-fn">' + fn + "</span>"; }
      return match;
    });

    pre.innerHTML = html;
    pre.dataset.highlighted = "true";
  }

  /* ======================================================================
     9. Radio group helper
     ====================================================================== */

  function syncRadioRows() {
    $$(".radio-row").forEach(function (row) {
      var input = $("input[type=radio]", row);
      if (input) { row.classList.toggle("is-checked", input.checked); }
    });
  }

  function initRadioRows() {
    $$(".radio-row input[type=radio]").forEach(function (input) {
      input.addEventListener("change", syncRadioRows);
    });
    syncRadioRows();
  }

  function radioValue(name) {
    var checked = $('input[name="' + name + '"]:checked');
    return checked ? checked.value : null;
  }

  /* ======================================================================
     10. Event streams
     ====================================================================== */

  function streamPush(list, timeText, message) {
    if (!list) { return; }
    var empty = $(".stream-empty", list);
    if (empty) { empty.remove(); }
    var li = document.createElement("li");
    var time = document.createElement("span");
    time.className = "stream-time";
    time.textContent = timeText;
    var msg = document.createElement("span");
    msg.className = "stream-msg";
    msg.innerHTML = message;
    li.appendChild(time);
    li.appendChild(msg);
    list.insertBefore(li, list.firstChild);
    while (list.children.length > 40) { list.removeChild(list.lastChild); }
  }

  function streamReset(list, hint) {
    if (!list) { return; }
    list.innerHTML = "";
    var li = document.createElement("li");
    li.className = "stream-empty";
    li.innerHTML = hint || "Waiting…";
    list.appendChild(li);
  }

  function streamLive(list, on) {
    if (list) { list.classList.toggle("is-live", !!on); }
  }

  /* ======================================================================
     11. Experiment 01 — task execution (lanes)
     ====================================================================== */

  var sim = {
    tasks: [],
    mode: "concurrent",
    running: false,
    paused: false,
    elapsed: 0,
    startedAt: 0,
    raf: 0,
    total: 0,
    lastTelem: 0,
    hasRun: false
  };

  function laneStateLabel(state) {
    return state.charAt(0).toUpperCase() + state.slice(1);
  }

  function createLane(task, index) {
    var lane = document.createElement("div");
    lane.className = "lane";
    lane.setAttribute("data-state", task.state);

    var info = document.createElement("div");
    var id = document.createElement("span");
    id.className = "lane-id";
    id.textContent = "T-" + pad(index + 1, 2);
    var name = document.createElement("span");
    name.className = "lane-name";
    name.textContent = task.name;
    var dur = document.createElement("span");
    dur.className = "lane-dur";
    dur.textContent = oneDecimal(task.dur) + "s";
    info.appendChild(id);
    info.appendChild(name);
    info.appendChild(dur);

    var track = document.createElement("div");
    track.className = "lane-track";
    var fill = document.createElement("span");
    fill.className = "lane-fill";
    var head = document.createElement("span");
    head.className = "lane-head";
    track.appendChild(fill);
    track.appendChild(head);

    var label = document.createElement("span");
    label.className = "lane-state";
    label.textContent = laneStateLabel(task.state);

    lane.appendChild(info);
    lane.appendChild(track);
    lane.appendChild(label);

    task.el = lane;
    task.fillEl = fill;
    task.headEl = head;
    task.stateEl = label;
    return lane;
  }

  function readLabSettings() {
    var countInput = $("#tasksCount");
    var minInput = $("#minDelay");
    var maxInput = $("#maxDelay");
    var count = clamp(parseInt(countInput ? countInput.value : "5", 10) || 5, 2, 10);
    var min = parseFloat(minInput ? minInput.value : "1") || 1;
    var max = parseFloat(maxInput ? maxInput.value : "3") || 3;
    if (max < min) { max = min; }
    return { count: count, min: min, max: max, mode: radioValue("labMode") || "concurrent" };
  }

  function buildTaskSet(settings) {
    var tasks = [];
    for (var i = 0; i < settings.count; i++) {
      tasks.push({
        name: "Task " + String.fromCharCode(65 + (i % 26)),
        dur: randomBetween(settings.min, settings.max),
        start: 0,
        state: "ready",
        loggedStart: false,
        loggedDone: false,
        el: null, fillEl: null, headEl: null, stateEl: null
      });
    }
    return tasks;
  }

  function scheduleTasks(tasks, mode) {
    var cursor = 0;
    tasks.forEach(function (task) {
      if (mode === "sequential") {
        task.start = cursor;
        cursor += task.dur;
      } else {
        task.start = 0;
      }
    });
    sim.total = mode === "sequential"
      ? cursor
      : Math.max.apply(null, tasks.map(function (t) { return t.start + t.dur; }));
  }

  function renderLanes(tasks) {
    var lanes = $("#lanes");
    if (!lanes) { return; }
    lanes.innerHTML = "";
    tasks.forEach(function (task, index) {
      lanes.appendChild(createLane(task, index));
    });
    var empty = $("#lanesEmpty");
    if (empty) { empty.hidden = true; }
  }

  function setLaneState(task, state) {
    if (task.state === state) { return; }
    task.state = state;
    if (task.el) { task.el.setAttribute("data-state", state); }
    if (task.stateEl) { task.stateEl.textContent = laneStateLabel(state); }
  }

  function updateTelemetry(force) {
    var now = performance.now();
    if (!force && now - sim.lastTelem < 90) { return; }
    sim.lastTelem = now;

    var active = 0, waiting = 0, done = 0, finishedTotal = 0;
    sim.tasks.forEach(function (task) {
      if (task.state === "active") { active++; }
      else if (task.state === "waiting" || task.state === "ready") { waiting++; }
      if (task.state === "done") {
        done++;
        finishedTotal += task.dur;
      }
    });

    setText("#liveTasks", String(sim.tasks.length));
    setText("#liveActive", String(active));
    setText("#liveWaiting", String(waiting));
    setText("#liveDone", String(done));
    setText("#liveElapsed", fmtSecs(sim.elapsed));
    setText("#liveAvg", fmtSecs(done ? finishedTotal / done : averageDuration()));

    if (sim.paused) { setText("#liveElapsed", fmtSecs(sim.elapsed) + " paused"); }
  }

  function averageDuration() {
    if (!sim.tasks.length) { return 0; }
    var sum = sim.tasks.reduce(function (acc, task) { return acc + task.dur; }, 0);
    return sum / sim.tasks.length;
  }

  function labFrame(now) {
    if (!sim.running || sim.paused) { return; }
    sim.elapsed = (now - sim.startedAt) / 1000;

    var allDone = true;
    sim.tasks.forEach(function (task) {
      if (task.state === "done") { return; }
      var end = task.start + task.dur;
      var progress = clamp((sim.elapsed - task.start) / task.dur, 0, 1);

      if (sim.elapsed < task.start) {
        allDone = false;
        setLaneState(task, sim.mode === "sequential" ? "waiting" : "ready");
        return;
      }

      if (sim.elapsed >= end) {
        setLaneState(task, "done");
        if (task.fillEl) { task.fillEl.style.width = "100%"; }
        if (task.headEl) { task.headEl.style.left = "100%"; }
        if (!task.loggedDone) {
          task.loggedDone = true;
          streamPush($("#eventStream"), fmtClock(sim.elapsed),
            "<strong>" + task.name + "</strong> completed · " + oneDecimal(task.dur) + "s");
        }
        return;
      }

      allDone = false;
      setLaneState(task, "active");
      if (task.fillEl) { task.fillEl.style.width = (progress * 100).toFixed(2) + "%"; }
      if (task.headEl) { task.headEl.style.left = (progress * 100).toFixed(2) + "%"; }
      if (!task.loggedStart) {
        task.loggedStart = true;
        streamPush($("#eventStream"), fmtClock(sim.elapsed),
          "<strong>" + task.name + "</strong> started");
      }
    });

    updateTelemetry(false);

    if (allDone) {
      finishExperiment();
      return;
    }
    sim.raf = window.requestAnimationFrame(labFrame);
  }

  function startExperiment() {
    if (sim.running && !sim.paused) { return; }
    if (sim.paused) { resumeExperiment(); return; }

    var settings = readLabSettings();
    var tasks = buildTaskSet(settings);
    sim.tasks = tasks;
    sim.mode = settings.mode;
    sim.elapsed = 0;
    sim.paused = false;
    sim.running = true;
    sim.total = 0;
    sim.lastTelem = 0;

    scheduleTasks(tasks, settings.mode);
    renderLanes(tasks);
    streamReset($("#eventStream"), "Waiting for the first event…");
    streamLive($("#eventStream"), true);

    setText("#labModeTag", settings.mode === "concurrent" ? "Concurrent mode" : "Sequential mode");
    setText("#liveTasks", String(tasks.length));
    setText("#liveActive", "0");
    setText("#liveWaiting", String(tasks.length));
    setText("#liveDone", "0");
    setText("#liveElapsed", "00.00s");
    setText("#liveAvg", fmtSecs(averageDuration()));

    streamPush($("#eventStream"), fmtClock(0),
      "Experiment initialized · <strong>" + settings.count + " tasks</strong> · " +
      (settings.mode === "concurrent" ? "concurrent" : "sequential") + " mode");

    $("#labRun").textContent = "Running…";
    $("#labRun").disabled = true;
    $("#labPause").disabled = false;
    $("#labPause").textContent = "Pause";

    updateTelemetry(true);
    sim.startedAt = performance.now();
    sim.raf = window.requestAnimationFrame(labFrame);
  }

  function pauseExperiment() {
    if (!sim.running) { return; }
    if (sim.paused) { resumeExperiment(); return; }
    sim.paused = true;
    window.cancelAnimationFrame(sim.raf);
    var btn = $("#labPause");
    btn.textContent = "Resume";
    streamPush($("#eventStream"), fmtClock(sim.elapsed), "Execution paused by user");
    updateTelemetry(true);
  }

  function resumeExperiment() {
    if (!sim.running) { return; }
    sim.paused = false;
    sim.startedAt = performance.now() - sim.elapsed * 1000;
    $("#labPause").textContent = "Pause";
    streamPush($("#eventStream"), fmtClock(sim.elapsed), "Execution resumed");
    sim.raf = window.requestAnimationFrame(labFrame);
  }

  function resetExperiment(keepMessage) {
    window.cancelAnimationFrame(sim.raf);
    sim.running = false;
    sim.paused = false;
    sim.elapsed = 0;
    sim.tasks = [];

    var lanes = $("#lanes");
    if (lanes) { lanes.innerHTML = ""; }
    var empty = $("#lanesEmpty");
    if (empty) { empty.hidden = false; }

    var run = $("#labRun");
    if (run) { run.disabled = false; run.textContent = "Run experiment"; }
    var pause = $("#labPause");
    if (pause) { pause.disabled = true; pause.textContent = "Pause"; }

    setText("#liveTasks", "0");
    setText("#liveActive", "0");
    setText("#liveWaiting", "0");
    setText("#liveDone", "0");
    setText("#liveElapsed", "00.00s");
    setText("#liveAvg", "00.00s");

    streamLive($("#eventStream"), false);
    if (!keepMessage) {
      streamReset($("#eventStream"), "Events appear here while an experiment runs.");
    }

    var cmp = $("#cmpRun");
    if (cmp) { cmp.disabled = true; }
  }

  function finishExperiment() {
    window.cancelAnimationFrame(sim.raf);
    sim.running = false;
    sim.paused = false;
    sim.elapsed = sim.total;
    sim.hasRun = true;

    updateTelemetry(true);

    var label = sim.mode === "concurrent" ? "Concurrent test" : "Sequential test";
    var meta = sim.tasks.length + " tasks · " + fmtSecs(sim.total);

    streamPush($("#eventStream"), fmtClock(sim.total),
      "Experiment finished · total <strong>" + fmtSecs(sim.total) + "</strong>");
    streamLive($("#eventStream"), false);

    state.experiments += 1;
    state.latest = { label: label, meta: meta };
    addHistory({
      title: "Task execution",
      meta: (sim.mode === "concurrent" ? "Concurrent" : "Sequential") + " · " + sim.tasks.length + " tasks",
      result: fmtSecs(sim.total)
    });
    saveState();

    var run = $("#labRun");
    if (run) { run.disabled = false; run.textContent = "Run again"; }
    var pause = $("#labPause");
    if (pause) { pause.disabled = true; pause.textContent = "Pause"; }

    var cmp = $("#cmpRun");
    if (cmp) { cmp.disabled = false; }

    renderProgress();
  }

  function initLabControls() {
    var countInput = $("#tasksCount");
    var minInput = $("#minDelay");
    var maxInput = $("#maxDelay");

    function syncOutputs() {
      if (minInput) { setText("#minDelayOut", oneDecimal(parseFloat(minInput.value)) + "s"); }
      if (maxInput) { setText("#maxDelayOut", oneDecimal(parseFloat(maxInput.value)) + "s"); }
    }

    $("#tasksMinus").addEventListener("click", function () {
      countInput.value = String(clamp((parseInt(countInput.value, 10) || 5) - 1, 2, 10));
    });
    $("#tasksPlus").addEventListener("click", function () {
      countInput.value = String(clamp((parseInt(countInput.value, 10) || 5) + 1, 2, 10));
    });
    countInput.addEventListener("change", function () {
      countInput.value = String(clamp(parseInt(countInput.value, 10) || 5, 2, 10));
    });

    minInput.addEventListener("input", function () {
      if (parseFloat(minInput.value) > parseFloat(maxInput.value)) {
        maxInput.value = minInput.value;
      }
      syncOutputs();
    });
    maxInput.addEventListener("input", function () {
      if (parseFloat(maxInput.value) < parseFloat(minInput.value)) {
        minInput.value = maxInput.value;
      }
      syncOutputs();
    });
    syncOutputs();

    $("#labRun").addEventListener("click", startExperiment);
    $("#labPause").addEventListener("click", pauseExperiment);
    $("#labReset").addEventListener("click", function () { resetExperiment(false); });
    $("#labPause").disabled = true;

    $("#streamClear").addEventListener("click", function () {
      streamReset($("#eventStream"), "Events appear here while an experiment runs.");
    });

    var cmp = $("#cmpRun");
    cmp.disabled = true;
    cmp.addEventListener("click", runCompare);
  }

  /* ======================================================================
     12. Experiment 02 — compare
     ====================================================================== */

  function renderCompareColumn(container, tasks, startOf, span, showBar) {
    container.innerHTML = "";
    tasks.forEach(function (task) {
      var row = document.createElement("div");
      row.className = "cmp-row";
      var name = document.createElement("span");
      name.className = "cmp-name";
      name.textContent = task.name;
      var track = document.createElement("div");
      track.className = "cmp-track";
      if (showBar) {
        var bar = document.createElement("span");
        bar.className = "cmp-bar" + (showBar === "seq" ? " cmp-bar--seq" : "");
        bar.style.left = ((startOf(task) / span) * 100).toFixed(2) + "%";
        bar.style.width = ((task.dur / span) * 100).toFixed(2) + "%";
        track.appendChild(bar);
      }
      row.appendChild(name);
      row.appendChild(track);
      container.appendChild(row);
    });
  }

  function runCompare() {
    if (!sim.tasks.length) { return; }
    var tasks = sim.tasks.map(function (task) {
      return { name: task.name, dur: task.dur };
    });

    var concTotal = Math.max.apply(null, tasks.map(function (t) { return t.dur; }));
    var cursor = 0;
    var starts = tasks.map(function (task) {
      var start = cursor;
      cursor += task.dur;
      return start;
    });
    var seqTotal = cursor;

    renderCompareColumn($("#cmpConcurrent"), tasks, function () { return 0; }, concTotal, false);
    renderCompareColumn($("#cmpSequential"), tasks, function (task) {
      return starts[tasks.indexOf(task)];
    }, seqTotal, "seq");

    setText("#cmpConcurrentTotal", oneDecimal(concTotal) + " seconds");
    setText("#cmpSequentialTotal", oneDecimal(seqTotal) + " seconds");
    $("#cmpOut").hidden = false;
    $("#cmpExplain").hidden = false;

    streamPush($("#eventStream"), fmtClock(sim.elapsed || 0),
      "Comparison computed · concurrent <strong>" + oneDecimal(concTotal) +
      "s</strong> vs sequential <strong>" + oneDecimal(seqTotal) + "s</strong>");
  }

  /* ======================================================================
     13. Presets + custom builder
     ====================================================================== */

  var PRESETS = {
    web: [
      ["Fetch data", 1.4], ["Render view", 2.2], ["Send notification", 0.9], ["Write log", 0.6]
    ],
    files: [
      ["Read file", 1.8], ["Transform", 2.6], ["Compress", 3.2], ["Write file", 1.5], ["Verify", 1.1]
    ],
    db: [
      ["Query rows", 2.1], ["Join tables", 2.9], ["Update index", 1.6], ["Build report", 2.4]
    ],
    background: [
      ["Sync contacts", 2.7], ["Backup", 4.1], ["Telemetry", 1.2], ["Cleanup", 1.9], ["Warm cache", 2.3]
    ]
  };

  var builderTasks = PRESETS.web.map(function (row) {
    return { name: row[0], dur: row[1] };
  });

  function renderBuilder() {
    var list = $("#builderList");
    if (!list) { return; }
    list.innerHTML = "";

    builderTasks.forEach(function (task, index) {
      var row = document.createElement("div");
      row.className = "b-row";
      row.setAttribute("data-index", String(index));

      var name = document.createElement("input");
      name.className = "b-name";
      name.type = "text";
      name.value = task.name;
      name.setAttribute("aria-label", "Task " + (index + 1) + " name");

      var dur = document.createElement("input");
      dur.className = "b-dur";
      dur.type = "number";
      dur.min = "0.1";
      dur.max = "20";
      dur.step = "0.1";
      dur.value = oneDecimal(task.dur);
      dur.setAttribute("aria-label", "Task " + (index + 1) + " duration in seconds");

      var remove = document.createElement("button");
      remove.className = "b-remove";
      remove.type = "button";
      remove.textContent = "\u2715";
      remove.setAttribute("aria-label", "Remove " + task.name);
      remove.disabled = builderTasks.length <= 1;

      name.addEventListener("input", function () { task.name = name.value; });
      dur.addEventListener("input", function () {
        var value = parseFloat(dur.value);
        if (!isNaN(value)) { task.dur = clamp(value, 0.1, 20); }
      });
      dur.addEventListener("blur", function () { dur.value = oneDecimal(task.dur); });
      remove.addEventListener("click", function () {
        if (builderTasks.length <= 1) { return; }
        builderTasks.splice(index, 1);
        renderBuilder();
      });

      row.appendChild(name);
      row.appendChild(dur);
      row.appendChild(remove);
      list.appendChild(row);
    });

    setText("#builderCount", builderTasks.length + " of 10 tasks");
    $("#builderAdd").disabled = builderTasks.length >= 10;
  }

  function loadPreset(key) {
    var rows = PRESETS[key];
    if (!rows) { return; }
    builderTasks = rows.map(function (row) { return { name: row[0], dur: row[1] }; });
    renderBuilder();
    $("#builderResults").hidden = true;
    $$("#presetList .preset").forEach(function (btn) {
      var loaded = btn.getAttribute("data-preset") === key;
      btn.classList.toggle("is-loaded", loaded);
      $(".preset-go", btn).textContent = loaded ? "Loaded" : "Load";
    });
  }

  function runCustomExperiment() {
    if (!builderTasks.length) { return; }
    var mode = radioValue("labMode") || "concurrent";

    var tasks = builderTasks.map(function (task) {
      return {
        name: task.name || "Untitled",
        dur: clamp(task.dur, 0.1, 20),
        start: 0, state: "ready", loggedStart: false, loggedDone: false,
        el: null, fillEl: null, headEl: null, stateEl: null
      };
    });

    window.cancelAnimationFrame(sim.raf);
    sim.tasks = tasks;
    sim.mode = mode;
    sim.elapsed = 0;
    sim.paused = false;
    sim.running = true;
    sim.total = 0;
    sim.lastTelem = 0;

    scheduleTasks(tasks, mode);
    renderLanes(tasks);
    streamReset($("#eventStream"), "Waiting for the first event…");
    streamLive($("#eventStream"), true);
    streamPush($("#eventStream"), fmtClock(0),
      "Custom experiment initialized · <strong>" + tasks.length + " tasks</strong> · " +
      (mode === "concurrent" ? "concurrent" : "sequential") + " mode");

    setText("#labModeTag", mode === "concurrent" ? "Concurrent mode" : "Sequential mode");
    setText("#liveTasks", String(tasks.length));

    $("#labRun").disabled = true;
    $("#labRun").textContent = "Running…";
    $("#labPause").disabled = false;
    updateTelemetry(true);

    state.customRuns += 1;
    saveState();
    renderBuilderResults();
    updateTelemetry(true);
    sim.startedAt = performance.now();
    sim.raf = window.requestAnimationFrame(labFrame);
  }

  function renderBuilderResults() {
    var cursor = 0;
    var rows = builderTasks.map(function (task) {
      var start = cursor;
      cursor += task.dur;
      return { name: task.name || "Untitled", dur: task.dur, seqStart: start };
    });
    var conc = Math.max.apply(null, rows.map(function (row) { return row.dur; }));
    var seq = rows.reduce(function (acc, row) { return acc + row.dur; }, 0);

    var body = $("#builderRows");
    body.innerHTML = "";
    rows.forEach(function (row) {
      var tr = document.createElement("tr");
      var cells = [
        row.name,
        oneDecimal(row.dur) + "s",
        "ends " + oneDecimal(row.dur) + "s",
        "starts " + oneDecimal(row.seqStart) + "s"
      ];
      cells.forEach(function (text, i) {
        var td = document.createElement("td");
        if (i > 0) { td.className = "num"; }
        td.textContent = text;
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });

    setText("#builderConc", oneDecimal(conc) + "s");
    setText("#builderSeq", oneDecimal(seq) + "s");
    setText("#builderWork", oneDecimal(seq) + "s");
    $("#builderResults").hidden = false;
  }

  function initBuilder() {
    renderBuilder();
    $("#builderAdd").addEventListener("click", function () {
      if (builderTasks.length >= 10) { return; }
      builderTasks.push({ name: "Task " + (builderTasks.length + 1), dur: 1.5 });
      renderBuilder();
      var rows = $$("#builderList .b-row");
      var last = rows[rows.length - 1];
      if (last) { $(".b-name", last).focus(); }
    });
    $("#builderRun").addEventListener("click", runCustomExperiment);

    $$("#presetList .preset").forEach(function (btn) {
      btn.addEventListener("click", function () { loadPreset(btn.getAttribute("data-preset")); });
    });
  }

  /* ======================================================================
     14. Experiment 04 — shared counter
     ====================================================================== */

  var counterTimers = [];

  function counterSetWorker(el, state, stateText) {
    if (!el) { return; }
    el.classList.remove("is-active", "is-waiting", "is-holding", "is-done");
    if (state) { el.classList.add(state); }
    var label = $(".worker-state", el);
    if (label) { label.textContent = stateText; }
  }

  function counterReset() {
    clearTimers(counterTimers);
    counterSetWorker($("#workerA"), "", "Idle");
    counterSetWorker($("#workerB"), "", "Idle");

    var gate = $("#gate");
    if (gate) { gate.classList.remove("is-locked"); }
    setText("#gateState", "Open");
    setText("#gateOwner", "No owner");
    setText("#counterValue", "0");
    setText("#counterModeTag", "Not run");

    var verdict = $("#counterVerdict");
    if (verdict) { verdict.hidden = true; }
    var actual = $("#counterActual");
    if (actual) { actual.classList.add("split-stat-value--wrong"); }
    setText("#counterExplain", "");
    streamReset($("#counterStream"),
      "Choose <strong>Run unsafe</strong> or <strong>Run protected</strong> to record the read and write order.");

    $("#counterUnsafe").disabled = false;
    $("#counterProtected").disabled = false;
  }

  function counterFinish(mode, actual, verdictTitle, explain) {
    setText("#counterActual", String(actual));
    setText("#counterModeOut", mode);
    setText("#counterVerdictTitle", verdictTitle);
    setText("#counterExplain", explain);
    setText("#counterModeTag", mode + " mode");
    $("#counterVerdict").hidden = false;

    var actualEl = $("#counterActual");
    if (mode === "Protected") { actualEl.classList.remove("split-stat-value--wrong"); }
    else { actualEl.classList.add("split-stat-value--wrong"); }

    state.experiments += 1;
    state.latest = { label: "Shared counter (" + mode.toLowerCase() + ")", meta: "Actual " + actual + " of 2" };
    addHistory({
      title: "Shared counter",
      meta: mode + " mode",
      result: actual === 2 ? "Result correct" : "Lost update"
    });
    saveState();
    renderProgress();

    $("#counterUnsafe").disabled = false;
    $("#counterProtected").disabled = false;
  }

  function runCounter(mode) {
    clearTimers(counterTimers);
    counterSetWorker($("#workerA"), "", "Idle");
    counterSetWorker($("#workerB"), "", "Idle");
    var gate = $("#gate");
    gate.classList.remove("is-locked");
    setText("#gateState", "Open");
    setText("#gateOwner", "No owner");
    setText("#counterValue", "0");
    $("#counterVerdict").hidden = true;
    streamReset($("#counterStream"), "Recording read and write order…");
    streamLive($("#counterStream"), true);
    setText("#counterModeTag", "Running");

    $("#counterUnsafe").disabled = true;
    $("#counterProtected").disabled = true;

    var a = $("#workerA");
    var b = $("#workerB");
    var t = counterTimers;

    if (mode === "Unsafe") {
      streamPush($("#counterStream"), "00:00.000", "Unsafe run · both workers start without a gate");

      later(t, function () {
        counterSetWorker(a, "is-active", "Reading");
        streamPush($("#counterStream"), "00:00.320", "<strong>Worker A</strong> reads counter → <strong>0</strong>");
      }, 320);

      later(t, function () {
        counterSetWorker(b, "is-active", "Reading");
        streamPush($("#counterStream"), "00:00.640", "<strong>Worker B</strong> reads counter → <strong>0</strong>");
      }, 640);

      later(t, function () {
        counterSetWorker(a, "is-active", "Writing");
        setText("#counterValue", "1");
        streamPush($("#counterStream"), "00:01.100", "<strong>Worker A</strong> writes 1 → counter is <strong>1</strong>");
      }, 1100);

      later(t, function () {
        counterSetWorker(b, "is-active", "Writing");
        setText("#counterValue", "1");
        streamPush($("#counterStream"), "00:01.560", "<strong>Worker B</strong> writes 1 → counter stays <strong>1</strong>");
      }, 1560);

      later(t, function () {
        counterSetWorker(a, "is-done", "Finished");
        counterSetWorker(b, "is-done", "Finished");
        streamLive($("#counterStream"), false);
        streamPush($("#counterStream"), "00:02.000",
          "Run finished · lost update detected · counter is <strong>1</strong>");
        counterFinish("Unsafe", 1, "Race condition observed",
          "Both workers used the same previous value before either update was safely protected. " +
          "The second write overwrote the first instead of building on it, so one increment was lost.");
      }, 2000);
    } else {
      streamPush($("#counterStream"), "00:00.000", "Protected run · read-modify-write goes through the gate");

      later(t, function () {
        gate.classList.add("is-locked");
        setText("#gateState", "Locked");
        setText("#gateOwner", "Worker A");
        counterSetWorker(a, "is-active", "Updating");
        streamPush($("#counterStream"), "00:00.280", "<strong>Worker A</strong> acquires the resource gate");
      }, 280);

      later(t, function () {
        counterSetWorker(b, "is-waiting", "Waiting");
        streamPush($("#counterStream"), "00:00.620", "<strong>Worker B</strong> requests the gate → waits");
      }, 620);

      later(t, function () {
        streamPush($("#counterStream"), "00:00.980", "<strong>Worker A</strong> reads counter → <strong>0</strong>");
      }, 980);

      later(t, function () {
        setText("#counterValue", "1");
        streamPush($("#counterStream"), "00:01.340", "<strong>Worker A</strong> writes 1 → counter is <strong>1</strong>");
      }, 1340);

      later(t, function () {
        gate.classList.remove("is-locked");
        setText("#gateState", "Open");
        setText("#gateOwner", "No owner");
        counterSetWorker(a, "is-done", "Finished");
        streamPush($("#counterStream"), "00:01.720", "<strong>Worker A</strong> releases the gate");
      }, 1720);

      later(t, function () {
        gate.classList.add("is-locked");
        setText("#gateState", "Locked");
        setText("#gateOwner", "Worker B");
        counterSetWorker(b, "is-active", "Updating");
        streamPush($("#counterStream"), "00:02.100", "<strong>Worker B</strong> acquires the resource gate");
      }, 2100);

      later(t, function () {
        streamPush($("#counterStream"), "00:02.460", "<strong>Worker B</strong> reads counter → <strong>1</strong>");
      }, 2460);

      later(t, function () {
        setText("#counterValue", "2");
        streamPush($("#counterStream"), "00:02.820", "<strong>Worker B</strong> writes 2 → counter is <strong>2</strong>");
      }, 2820);

      later(t, function () {
        gate.classList.remove("is-locked");
        setText("#gateState", "Open");
        setText("#gateOwner", "No owner");
        counterSetWorker(b, "is-done", "Finished");
        streamLive($("#counterStream"), false);
        streamPush($("#counterStream"), "00:03.200",
          "Run finished · protected update complete · counter is <strong>2</strong>");
        counterFinish("Protected", 2, "Result correct — protected",
          "The gate forces one read-modify-write to finish before the other begins, so the second " +
          "worker reads the updated value. This is exactly what a mutex protects in real code.");
      }, 3200);
    }
  }

  function initCounter() {
    $("#counterUnsafe").addEventListener("click", function () { runCounter("Unsafe"); });
    $("#counterProtected").addEventListener("click", function () { runCounter("Protected"); });
    $("#counterReset").addEventListener("click", counterReset);
  }

  /* ======================================================================
     15. Experiment 05 — resource waiting lab
     ====================================================================== */

  var dlTimers = [];

  function dlClear() {
    clearTimers(dlTimers);
    ["dlAOwn", "dlBOwn"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) { el.classList.remove("is-held"); }
    });
    ["dlANeed", "dlBNeed"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) { el.classList.remove("is-blocked"); }
    });
    $$("#deadlockPanel .dl-arrow").forEach(function (arrow) { arrow.classList.remove("is-blocked"); });
    var center = $("#deadlockPanel .dl-center");
    if (center) { center.classList.remove("is-stuck", "is-safe"); }
    setText("#dlStatus", "Waiting for a scenario");
    setText("#dlTag", "Idle");
    $("#dlVerdict").hidden = true;
    $("#safeOrder").hidden = true;
    $("#dlRun").disabled = false;
    $("#dlSafe").disabled = false;
    streamReset($("#dlStream"),
      "Press <strong>Run scenario</strong> to watch both workers take and request resources.");
  }

  function runDeadlock() {
    dlClear();
    streamLive($("#dlStream"), true);
    setText("#dlTag", "Running");
    $("#dlRun").disabled = true;
    $("#dlSafe").disabled = true;
    var t = dlTimers;

    streamPush($("#dlStream"), "00:00.000", "Both workers start with one resource each");

    later(t, function () {
      $("#dlAOwn").classList.add("is-held");
      $("#dlBOwn").classList.add("is-held");
      setText("#dlStatus", "Both workers hold one resource");
      streamPush($("#dlStream"), "00:00.400", "Worker A takes Resource 1 · Worker B takes Resource 2");
    }, 400);

    later(t, function () {
      $$("#deadlockPanel .dl-arrow").forEach(function (arrow) { arrow.classList.add("is-blocked"); });
      setText("#dlStatus", "Each worker waits for the other");
      streamPush($("#dlStream"), "00:00.900", "Worker A requests Resource 2 · Worker B requests Resource 1");
    }, 900);

    later(t, function () {
      $("#dlANeed").classList.add("is-blocked");
      $("#dlBNeed").classList.add("is-blocked");
      var center = $("#deadlockPanel .dl-center");
      center.classList.add("is-stuck");
      setText("#dlStatus", "Circular wait · no forward progress");
      setText("#dlTag", "Stuck");
      streamLive($("#dlStream"), false);
      streamPush($("#dlStream"), "00:01.400", "Neither worker can proceed — deadlock reached");

      setText("#dlVerdictTitle", "No forward progress");
      setText("#dlVerdictText",
        "A deadlock occurs because each worker is waiting for a resource currently held by the other. " +
        "All four conditions hold at once: mutual exclusion, hold and wait, no preemption and circular wait.");
      $("#dlVerdict").hidden = false;

      state.experiments += 1;
      state.latest = { label: "Resource waiting lab", meta: "Circular wait" };
      addHistory({ title: "Resource waiting lab", meta: "Circular wait", result: "No forward progress" });
      saveState();
      renderProgress();
      $("#dlRun").disabled = false;
      $("#dlSafe").disabled = false;
    }, 1400);
  }

  function runSafeOrdering() {
    dlClear();
    $("#safeOrder").hidden = false;
    setText("#dlTag", "Safe");
    streamLive($("#dlStream"), true);
    $("#dlRun").disabled = true;
    $("#dlSafe").disabled = true;
    var center = $("#deadlockPanel .dl-center");
    center.classList.add("is-safe");
    var t = dlTimers;

    streamPush($("#dlStream"), "00:00.000", "Both workers now request Resource 1 first");

    later(t, function () {
      $("#dlAOwn").classList.add("is-held");
      setText("#dlStatus", "Worker A holds Resource 1");
      streamPush($("#dlStream"), "00:00.350", "Worker A acquires Resource 1");
    }, 350);

    later(t, function () {
      $("#dlANeed").classList.add("is-held");
      $("#dlANeed").classList.remove("is-blocked");
      setText("#dlStatus", "Worker A holds both resources");
      streamPush($("#dlStream"), "00:00.750", "Worker A acquires Resource 2 — no conflict possible");
    }, 750);

    later(t, function () {
      $("#dlAOwn").classList.remove("is-held");
      $("#dlANeed").classList.remove("is-held");
      setText("#dlStatus", "Worker A finished and released both");
      streamPush($("#dlStream"), "00:01.150", "Worker A releases both resources");
    }, 1150);

    later(t, function () {
      $("#dlBOwn").classList.add("is-held");
      $("#dlBNeed").classList.add("is-held");
      $("#dlBNeed").classList.remove("is-blocked");
      setText("#dlStatus", "Worker B acquires both in the same order");
      streamPush($("#dlStream"), "00:01.550", "Worker B acquires Resource 1 then Resource 2");
    }, 1550);

    later(t, function () {
      $("#dlBOwn").classList.remove("is-held");
      $("#dlBNeed").classList.remove("is-held");
      setText("#dlStatus", "Both workers completed without deadlock");
      streamLive($("#dlStream"), false);
      streamPush($("#dlStream"), "00:01.950", "Sequence finished · no circular wait");
      setText("#dlTag", "Complete");
      state.experiments += 1;
      state.latest = { label: "Resource waiting lab", meta: "Consistent ordering" };
      addHistory({ title: "Resource waiting lab", meta: "Consistent request order", result: "Both completed" });
      saveState();
      renderProgress();
      $("#dlRun").disabled = false;
      $("#dlSafe").disabled = false;
    }, 1950);
  }

  function initDeadlock() {
    $("#dlRun").addEventListener("click", runDeadlock);
    $("#dlSafe").addEventListener("click", runSafeOrdering);
    $("#dlReset").addEventListener("click", dlClear);
  }

  /* ======================================================================
     16. Visual instrument — CPU turn
     ====================================================================== */

  var cpuSequence = [
    { task: "A", steps: 4 }, { task: "B", steps: 2 }, { task: "C", steps: 3 },
    { task: "A", steps: 2 }, { task: "B", steps: 3 }
  ];

  var cpu = { index: -1, timer: 0, running: false, blocks: [] };

  function cpuRender() {
    var seq = $("#cpuSeq");
    seq.innerHTML = "";
    cpu.blocks = [];
    cpuSequence.forEach(function (group, groupIndex) {
      if (groupIndex > 0) {
        var sep = document.createElement("span");
        sep.className = "cpu-sep";
        seq.appendChild(sep);
      }
      for (var i = 0; i < group.steps; i++) {
        var blk = document.createElement("span");
        blk.className = "cpu-blk";
        blk.textContent = group.task;
        seq.appendChild(blk);
        cpu.blocks.push({ el: blk, task: group.task, group: groupIndex });
      }
    });
    $("#cpuEmpty").hidden = true;
  }

  function cpuApply() {
    cpu.blocks.forEach(function (block, index) {
      block.el.classList.toggle("is-current", index === cpu.index);
      block.el.classList.toggle("is-done", index < cpu.index);
    });
  }

  function cpuTick() {
    cpu.index += 1;
    if (cpu.index >= cpu.blocks.length) {
      cpuApply();
      cpuStop();
      setText("#cpuEvent", "Sequence complete");
      setText("#cpuTag", "Complete");
      return;
    }

    var block = cpu.blocks[cpu.index];
    var previous = cpu.index > 0 ? cpu.blocks[cpu.index - 1] : null;
    cpuApply();

    setText("#cpuCurrent", "Task " + block.task);
    setText("#cpuPrevious", previous ? "Task " + previous.task : "None");
    setText("#cpuEvent", previous && previous.task !== block.task
      ? "Context switch: " + previous.task + " → " + block.task
      : "Executing task " + block.task);
    setText("#cpuClock", oneDecimal(cpu.index * 0.4) + "s");
    setText("#cpuTag", previous && previous.task !== block.task ? "Context switch" : "Running");

    cpu.timer = window.setTimeout(cpuTick, 460);
  }

  function cpuStop() {
    cpu.running = false;
    window.clearTimeout(cpu.timer);
    var pause = $("#cpuPause");
    if (pause) { pause.textContent = "Pause"; }
  }

  function initCpu() {
    cpuRender();

    $("#cpuPlay").addEventListener("click", function () {
      if (cpu.running) { return; }
      if (cpu.index < 0 || cpu.index >= cpu.blocks.length - 1) { cpuRestart(); }
      cpu.running = true;
      setText("#cpuTag", "Running");
      $("#cpuPause").textContent = "Pause";
      cpu.timer = window.setTimeout(cpuTick, 460);
    });

    $("#cpuPause").addEventListener("click", function () {
      if (!cpu.running) { return; }
      cpuStop();
      setText("#cpuTag", "Paused");
      setText("#cpuEvent", "Paused by user");
    });

    $("#cpuRestart").addEventListener("click", cpuRestart);
  }

  function cpuRestart() {
    cpuStop();
    cpu.index = -1;
    cpuApply();
    setText("#cpuCurrent", "None");
    setText("#cpuPrevious", "None");
    setText("#cpuEvent", "Ready");
    setText("#cpuClock", "00.0s");
    setText("#cpuTag", "Idle");
  }

  /* ======================================================================
     17. Visual instrument — task lifecycle
     ====================================================================== */

  var LC_STATES = [
    {
      key: "new", name: "New",
      desc: "The task object exists in memory but has not been scheduled yet. No instructions have run and no resources are held.",
      trigger: "Task is created"
    },
    {
      key: "ready", name: "Ready",
      desc: "The task is prepared to run and waits in the ready queue. Everything it needs is available — only CPU time is missing.",
      trigger: "Scheduler admits the task"
    },
    {
      key: "active", name: "Active",
      desc: "The scheduler handed the CPU to this task, so its instructions are executing right now. Only one task per core runs in this state.",
      trigger: "Context switch to the task"
    },
    {
      key: "waiting", name: "Waiting",
      desc: "The task paused for something outside its control — input, a lock, or a slow resource — and gave the CPU back voluntarily.",
      trigger: "Blocking operation starts"
    },
    {
      key: "ready2", name: "Ready",
      desc: "The event the task waited for has arrived. It returns to the ready queue and waits for the scheduler to choose it again.",
      trigger: "Waited-for event completes"
    },
    {
      key: "terminated", name: "Terminated",
      desc: "The task has finished. Its results are available and its resources are released; only bookkeeping records remain.",
      trigger: "Task returns or crashes"
    }
  ];

  var lc = { index: 0, timer: 0, walking: false };

  function lcSelect(index) {
    lc.index = clamp(index, 0, LC_STATES.length - 1);
    var state = LC_STATES[lc.index];

    $$("#lcFlow .lc-node").forEach(function (node, i) {
      node.classList.toggle("is-selected", i === lc.index);
      if (i <= lc.index) { node.classList.add("is-visited"); }
    });

    setText("#lcKicker", "State " + (lc.index + 1) + " of " + LC_STATES.length);
    setText("#lcTag", "Step " + (lc.index + 1) + " of " + LC_STATES.length);
    setText("#lcStateName", state.name);
    setText("#lcStateDesc", state.desc);
    setText("#lcStateTrigger", state.trigger);
  }

  function initLifecycle() {
    $$("#lcFlow .lc-node").forEach(function (node, index) {
      $("button", node).addEventListener("click", function () {
        lcStopWalk();
        lcSelect(index);
      });
    });

    $("#lcPlay").addEventListener("click", function () {
      if (lc.walking) { lcStopWalk(); return; }
      lc.walking = true;
      $("#lcPlay").textContent = "Stop walk";
      if (lc.index >= LC_STATES.length - 1) {
        $$("#lcFlow .lc-node").forEach(function (node) { node.classList.remove("is-visited", "is-selected"); });
        lc.index = 0;
      }
      lcSelect(lc.index);
      lc.timer = window.setInterval(function () {
        if (lc.index >= LC_STATES.length - 1) {
          lcStopWalk();
          setText("#lcTag", "Walk complete");
          return;
        }
        lcSelect(lc.index + 1);
      }, 1600);
    });

    $("#lcReset").addEventListener("click", function () {
      lcStopWalk();
      $$("#lcFlow .lc-node").forEach(function (node) { node.classList.remove("is-visited", "is-selected"); });
      lcSelect(0);
    });

    lcSelect(0);
  }

  function lcStopWalk() {
    lc.walking = false;
    window.clearInterval(lc.timer);
    var btn = $("#lcPlay");
    if (btn) { btn.textContent = "Walk through states"; }
  }

  /* ======================================================================
     18. Visual instrument — scheduling playground
     ====================================================================== */

  var DEFAULT_SCHED = [
    { name: "A", arrival: 0, dur: 3 },
    { name: "B", arrival: 1, dur: 2 },
    { name: "C", arrival: 2, dur: 4 }
  ];

  var schedTasks = DEFAULT_SCHED.map(function (task) { return { name: task.name, arrival: task.arrival, dur: task.dur }; });

  function renderSchedList() {
    var list = $("#schedList");
    list.innerHTML = "";

    schedTasks.forEach(function (task, index) {
      var row = document.createElement("div");
      row.className = "s-row";

      var name = document.createElement("input");
      name.type = "text";
      name.className = "s-name";
      name.value = task.name;
      name.maxLength = 12;
      name.setAttribute("aria-label", "Task " + (index + 1) + " name");

      var arrival = document.createElement("input");
      arrival.type = "number";
      arrival.className = "s-arr";
      arrival.min = "0"; arrival.max = "20"; arrival.step = "0.5";
      arrival.value = oneDecimal(task.arrival);
      arrival.setAttribute("aria-label", "Task " + (index + 1) + " arrival time");

      var dur = document.createElement("input");
      dur.type = "number";
      dur.className = "s-dur";
      dur.min = "0.5"; dur.max = "20"; dur.step = "0.5";
      dur.value = oneDecimal(task.dur);
      dur.setAttribute("aria-label", "Task " + (index + 1) + " duration");

      var remove = document.createElement("button");
      remove.className = "s-remove";
      remove.type = "button";
      remove.textContent = "\u2715";
      remove.setAttribute("aria-label", "Remove task " + task.name);
      remove.disabled = schedTasks.length <= 1;

      name.addEventListener("input", function () { task.name = name.value || "T"; });
      arrival.addEventListener("input", function () {
        var v = parseFloat(arrival.value);
        if (!isNaN(v)) { task.arrival = clamp(v, 0, 20); }
      });
      dur.addEventListener("input", function () {
        var v = parseFloat(dur.value);
        if (!isNaN(v)) { task.dur = clamp(v, 0.5, 20); }
      });
      arrival.addEventListener("blur", function () { arrival.value = oneDecimal(task.arrival); });
      dur.addEventListener("blur", function () { dur.value = oneDecimal(task.dur); });
      remove.addEventListener("click", function () {
        if (schedTasks.length <= 1) { return; }
        schedTasks.splice(index, 1);
        renderSchedList();
      });

      row.appendChild(name);
      row.appendChild(arrival);
      row.appendChild(dur);
      row.appendChild(remove);
      list.appendChild(row);
    });

    setText("#schedCount", schedTasks.length + " of 6 tasks");
    $("#schedAdd").disabled = schedTasks.length >= 6;
  }

  function simulateFCFS(tasks) {
    var pool = tasks.slice().sort(function (a, b) {
      return a.arrival - b.arrival;
    });
    var time = 0;
    var segments = [];
    var order = [];
    var log = [];

    pool.forEach(function (task) {
      if (time < task.arrival) {
        segments.push({ idle: true, from: time, to: task.arrival });
        log.push("CPU idle " + oneDecimal(time) + "s → " + oneDecimal(task.arrival) + "s (no task arrived)");
        time = task.arrival;
      }
      segments.push({ name: task.name, from: time, to: time + task.dur });
      time += task.dur;
      order.push({ name: task.name, at: time });
      log.push("Task " + task.name + " runs " + oneDecimal(time - task.dur) + "s → " + oneDecimal(time) + "s");
    });

    return { segments: segments, total: time, order: order, log: log };
  }

  function simulateRR(tasks, quantum) {
    var pool = tasks.map(function (task) {
      return { name: task.name, arrival: task.arrival, remaining: task.dur, queued: false };
    });
    var queue = [];
    var time = 0;
    var segments = [];
    var order = [];
    var log = [];
    var guard = 0;

    function arrive() {
      pool.forEach(function (task) {
        if (!task.queued && task.remaining > 0 && task.arrival <= time) {
          task.queued = true;
          queue.push(task);
        }
      });
    }

    while (order.length < pool.length && guard < 400) {
      guard += 1;
      arrive();

      if (!queue.length) {
        var next = Infinity;
        pool.forEach(function (task) {
          if (task.remaining > 0 && task.arrival > time && task.arrival < next) { next = task.arrival; }
        });
        if (next === Infinity) { break; }
        segments.push({ idle: true, from: time, to: next });
        log.push("CPU idle " + oneDecimal(time) + "s → " + oneDecimal(next) + "s");
        time = next;
        continue;
      }

      var task = queue.shift();
      task.queued = false;
      var slice = Math.min(quantum, task.remaining);
      segments.push({ name: task.name, from: time, to: time + slice });
      time += slice;
      task.remaining -= slice;

      /* mark before arrive() so the yielding task is not queued twice */
      if (task.remaining > 0) { task.queued = true; }
      arrive();
      if (task.remaining > 0) {
        queue.push(task);
        log.push("Task " + task.name + " uses " + oneDecimal(slice) + "s slice → returns to queue");
      } else {
        order.push({ name: task.name, at: time });
        log.push("Task " + task.name + " completes at " + oneDecimal(time) + "s");
      }
    }

    return { segments: segments, total: time, order: order, log: log };
  }

  function renderSchedule(result, policyLabel) {
    var strip = $("#schedStrip");
    strip.innerHTML = "";

    result.segments.forEach(function (segment, index) {
      var slice = document.createElement("span");
      slice.className = "s-slice";
      if (segment.idle) { slice.classList.add("s-slice--idle"); }
      else if (index % 2 === 1) { slice.classList.add("s-slice--alt"); }
      slice.style.setProperty("--d", String(Math.max(0.1, segment.to - segment.from)));
      slice.textContent = segment.idle ? "idle" : segment.name;
      slice.title = (segment.idle ? "idle" : "Task " + segment.name) + " · " +
        oneDecimal(segment.from) + "s → " + oneDecimal(segment.to) + "s";
      strip.appendChild(slice);
    });

    $("#schedEmpty").hidden = true;
    setText("#schedClock", oneDecimal(result.total) + "s");

    var order = $("#schedOrder");
    order.innerHTML = "";
    if (!result.order.length) {
      var empty = document.createElement("li");
      empty.className = "stream-empty";
      empty.textContent = "No task completed.";
      order.appendChild(empty);
    }
    result.order.forEach(function (item) {
      var li = document.createElement("li");
      li.textContent = "Task " + item.name;
      var muted = document.createElement("span");
      muted.className = "muted";
      muted.textContent = "completed " + oneDecimal(item.at) + "s";
      li.appendChild(document.createTextNode(" "));
      li.appendChild(muted);
      order.appendChild(li);
    });

    var log = $("#schedLog");
    streamReset(log, "Waiting for a schedule.");
    streamLive(log, true);
    streamPush(log, "00:00.000", "Policy selected · <strong>" + policyLabel + "</strong>");
    result.log.slice(0, 6).forEach(function (line, i) {
      streamPush(log, "00:00." + pad((i + 1) * 140, 3), line);
    });
    streamPush(log, "00:01.000", "Total CPU time <strong>" + oneDecimal(result.total) + "s</strong>");
    streamLive(log, false);
  }

  function runSchedule() {
    var policy = radioValue("schedMode") || "fcfs";
    var result;
    var label;

    if (policy === "rr") {
      var quantum = parseFloat($("#quantum").value) || 1;
      result = simulateRR(schedTasks, quantum);
      label = "Round robin · " + oneDecimal(quantum) + "s slice";
    } else {
      result = simulateFCFS(schedTasks);
      label = "First come, first served";
    }

    renderSchedule(result, policy === "rr" ? "round robin" : "first come, first served");

    state.experiments += 1;
    state.latest = { label: "Scheduling playground", meta: label };
    addHistory({ title: "Scheduling playground", meta: label, result: oneDecimal(result.total) + "s" });
    saveState();
    renderProgress();
  }

  function resetSched() {
    schedTasks = DEFAULT_SCHED.map(function (task) { return { name: task.name, arrival: task.arrival, dur: task.dur }; });
    renderSchedList();
    $("#schedStrip").innerHTML = "";
    $("#schedEmpty").hidden = false;
    setText("#schedClock", "0.0s");
    $("#schedOrder").innerHTML = '<li class="stream-empty">Run a schedule to see the order.</li>';
    streamReset($("#schedLog"), "Waiting for a schedule.");
  }

  function initSched() {
    renderSchedList();

    $("#schedAdd").addEventListener("click", function () {
      if (schedTasks.length >= 6) { return; }
      schedTasks.push({ name: String.fromCharCode(65 + schedTasks.length), arrival: 0, dur: 2 });
      renderSchedList();
      var rows = $$("#schedList .s-row");
      var last = rows[rows.length - 1];
      if (last) { $(".s-name", last).focus(); }
    });

    var quantum = $("#quantum");
    function syncQuantum() {
      setText("#quantumOut", oneDecimal(parseFloat(quantum.value)) + "s");
      $("#quantumGroup").hidden = radioValue("schedMode") !== "rr";
    }
    quantum.addEventListener("input", syncQuantum);
    $$('input[name="schedMode"]').forEach(function (input) {
      input.addEventListener("change", syncQuantum);
    });
    syncQuantum();

    $("#schedRun").addEventListener("click", runSchedule);
    $("#schedReset").addEventListener("click", resetSched);
  }

  /* ======================================================================
     19. Assessment
     ====================================================================== */

  var QUESTIONS = [
    {
      type: "Multiple choice",
      text: "What is the main difference between a thread and a process?",
      options: [
        "A process owns resources; a thread runs inside a process",
        "A thread owns resources; a process runs inside a thread",
        "They are two names for the same concept",
        "Processes can never run in parallel"
      ],
      answer: 0,
      explain: "A process has its own address space and resources, while threads live inside a process and share its memory."
    },
    {
      type: "Multiple choice",
      text: "Two tasks update the same variable at the same time and the final value is wrong. What happened?",
      options: ["Deadlock", "Race condition", "Context switch", "Starvation"],
      answer: 1,
      explain: "The outcome depends on the unpredictable order of interleaved steps — the definition of a race condition."
    },
    {
      type: "True or false",
      text: "Concurrency and parallelism mean exactly the same thing.",
      options: ["True", "False"],
      answer: 1,
      explain: "Concurrency is about structuring overlapping tasks; parallelism is about executing them at the same instant on separate cores."
    },
    {
      type: "Multiple choice",
      text: "Which condition is required for a deadlock to occur?",
      options: [
        "Mutual exclusion, hold and wait, no preemption, circular wait",
        "Round-robin scheduling with a short time slice",
        "A single-core processor",
        "Threads with higher priority than processes"
      ],
      answer: 0,
      explain: "All four conditions must hold at the same time — which is also why breaking any one of them prevents deadlock."
    },
    {
      type: "Multiple choice",
      text: "What does a mutex guarantee?",
      options: [
        "Tasks finish faster",
        "Only one holder enters the critical section at a time",
        "Deadlock becomes impossible",
        "Shared memory is copied automatically"
      ],
      answer: 1,
      explain: "A mutex serialises access: one owner at a time. It does not make execution faster and does not by itself prevent deadlock."
    },
    {
      type: "Short scenario",
      text: "A worker reads counter = 0, another worker reads counter = 0, both write 1. What is the observed result?",
      options: ["2", "1", "0", "An error is raised"],
      answer: 1,
      explain: "The second write overwrote the first — one increment was lost, so the counter ends at 1 instead of 2."
    },
    {
      type: "Multiple choice",
      text: "In round-robin scheduling, what happens when a task's time slice ends?",
      options: [
        "The task is terminated",
        "The task is preempted and moved to the back of the queue",
        "The task keeps the CPU until it finishes",
        "The scheduler switches to first-come, first-served"
      ],
      answer: 1,
      explain: "Preemption moves the still-running task to the back of the ready queue so every task gets a fair share of the CPU."
    },
    {
      type: "True or false",
      text: "A context switch saves the current task's state before loading the next task's state.",
      options: ["True", "False"],
      answer: 0,
      explain: "Register state and program counters are saved, then restored for the incoming task — that is what a context switch is."
    },
    {
      type: "Short scenario",
      text: "Two workers always request Resource 1 first and Resource 2 second. Why is this safe?",
      options: [
        "Resources are automatically duplicated",
        "Circular wait cannot form when everyone requests in the same order",
        "The lock is released after the first request",
        "Waiting tasks are given CPU priority"
      ],
      answer: 1,
      explain: "A consistent global order removes the circular wait condition, so one worker obtains both resources and finishes."
    },
    {
      type: "Multiple choice",
      text: "In CPython, what does the global interpreter lock (GIL) limit?",
      options: [
        "Number of processes a program may create",
        "Execution of Python bytecode to one thread at a time",
        "Memory available to each thread",
        "Use of threading in general"
      ],
      answer: 1,
      explain: "The GIL lets only one thread execute Python bytecode at once, so CPU-bound threads do not run in parallel — I/O-bound work can still overlap."
    }
  ];

  function answerCount() {
    return Object.keys(state.assessment.answers).length;
  }

  function correctCount() {
    var correct = 0;
    Object.keys(state.assessment.answers).forEach(function (key) {
      var q = QUESTIONS[parseInt(key, 10)];
      if (q && state.assessment.answers[key] === q.answer) { correct += 1; }
    });
    return correct;
  }

  function renderQuestions() {
    var list = $("#questions");
    list.innerHTML = "";

    QUESTIONS.forEach(function (question, index) {
      var answered = Object.prototype.hasOwnProperty.call(state.assessment.answers, index);
      var chosen = state.assessment.answers[index];
      var correct = answered && chosen === question.answer;

      var li = document.createElement("li");
      li.className = "q" + (answered ? (correct ? " is-correct" : " is-wrong") : "");

      var head = document.createElement("div");
      head.className = "q-head";
      var num = document.createElement("span");
      num.className = "q-num";
      num.textContent = pad(index + 1, 2);
      var text = document.createElement("p");
      text.className = "q-text";
      text.textContent = question.text;
      var type = document.createElement("span");
      type.className = "q-type";
      type.textContent = question.type;
      head.appendChild(num);
      head.appendChild(text);
      head.appendChild(type);

      var opts = document.createElement("div");
      opts.className = "q-opts";

      question.options.forEach(function (option, optIndex) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "opt";
        var key = document.createElement("span");
        key.className = "opt-key";
        key.textContent = String.fromCharCode(65 + optIndex);
        var label = document.createElement("span");
        label.textContent = option;
        btn.appendChild(key);
        btn.appendChild(label);

        if (answered) {
          btn.disabled = true;
          if (optIndex === question.answer) { btn.classList.add("is-correct"); }
          else if (optIndex === chosen) { btn.classList.add("is-wrong"); }
        } else {
          btn.addEventListener("click", function () {
            state.assessment.answers[index] = optIndex;
            var total = QUESTIONS.length;
            var count = answerCount();
            var score = correctCount();
            if (count === total && score > state.assessment.best) {
              state.assessment.best = score;
            }
            saveState();
            renderQuestions();
            renderProgress();
          });
        }

        opts.appendChild(btn);
      });

      li.appendChild(head);
      li.appendChild(opts);

      if (answered) {
        var feedback = document.createElement("p");
        feedback.className = "q-feedback";
        feedback.innerHTML = (correct ? "<strong>Correct.</strong> " : "<strong>Not quite.</strong> ") +
          question.explain;
        li.appendChild(feedback);
      }

      list.appendChild(li);
    });

    setText("#quizScore", correctCount() + " correct");
  }

  function initAssessment() {
    renderQuestions();

    $("#quizReset").addEventListener("click", function () {
      state.assessment.answers = {};
      saveState();
      renderQuestions();
      renderProgress();
    });
  }

  /* ======================================================================
     20. About — export + reset
     ====================================================================== */

  function progressSummary() {
    var lines = [
      "CONCURRA — progress summary",
      "Overall completion: " + completionPercent() + "%",
      "Lessons viewed: " + state.lessons.length + " of " + LESSONS.length,
      "Modules complete: " + state.modules.length + " of " + MODULES.length,
      "Experiments run: " + state.experiments + " (custom builds: " + state.customRuns + ")",
      "Assessment: " + answerCount() + " of " + QUESTIONS.length + " answered · " +
        correctCount() + " correct · best " + state.assessment.best + "/" + QUESTIONS.length,
      "Recent activity:"
    ];
    if (!state.history.length) { lines.push("  (no experiments recorded yet)"); }
    state.history.forEach(function (entry) {
      lines.push("  · " + entry.title + " — " + entry.meta + " — " + entry.result + " (" + timeLabel(entry.time) + ")");
    });
    return lines.join("\n");
  }

  function initAbout() {
    var exportBtn = $("#aboutExport");
    exportBtn.addEventListener("click", function () {
      var text = progressSummary();
      var done = function () {
        exportBtn.textContent = "Copied";
        window.setTimeout(function () { exportBtn.textContent = "Copy progress summary"; }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(function () { fallbackCopy(text, done); });
      } else {
        fallbackCopy(text, done);
      }
    });

    $("#aboutReset").addEventListener("click", function () {
      try { window.localStorage.removeItem(STORAGE_KEY); } catch (error) { /* ignore */ }
      $("#aboutResetNote").hidden = false;
      window.setTimeout(function () { window.location.reload(); }, 900);
    });
  }

  /* ======================================================================
     21. Boot
     ====================================================================== */

  function init() {
    loadState();
    initTheme();

    initRail();
    initTopbar();
    initRouter();
    initRadioRows();
    initLabControls();
    initBuilder();
    initCounter();
    initDeadlock();
    initCpu();
    initLifecycle();
    initSched();
    initAssessment();
    initAbout();
    initLearn();

    resetExperiment(true);

    var historyClear = $("#historyClear");
    if (historyClear) {
      historyClear.addEventListener("click", function () {
        state.history = [];
        saveState();
        renderProgress();
      });
    }

    renderProgress();
    showView(state.lastView, { keepScroll: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
