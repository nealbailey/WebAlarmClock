(() => {
  "use strict";

  const COMPACT = new URLSearchParams(location.search).has("compact");
  const $ = (id) => document.getElementById(id);

  const els = {
    app: document.querySelector(".app"),
    tabs: Array.from(document.querySelectorAll(".tab")),
    panels: Array.from(document.querySelectorAll(".panel")),
    dots: Array.from(document.querySelectorAll("[data-active-dot]")),
    popout: $("popout"),
    hint: $("hint"),
    clock12: $("clock-12"),
    clockDate: $("clock-date"),
    clock24: $("clock-24"),
    clockUtc: $("clock-utc"),
    swReadout: $("sw-readout"),
    swElapsedWhole: $("sw-elapsed-whole"),
    swElapsedMillis: $("sw-elapsed-ms"),
    swStatus: $("sw-status"),
    swPrimary: $("sw-primary"),
    swSecondary: $("sw-secondary"),
    swSplits: $("sw-splits"),
    swSplitsBody: $("sw-splits-body"),
    cdReadout: $("cd-readout"),
    cdRemaining: $("cd-remaining"),
    cdStatus: $("cd-status"),
    cdHours: $("cd-hours"),
    cdMinutes: $("cd-minutes"),
    cdSound: $("cd-sound"),
    cdPreview: $("cd-preview"),
    cdPrimary: $("cd-primary"),
    cdSecondary: $("cd-secondary"),
    audio: $("alarm-audio")
  };

  let audioMode = "idle"; // idle | preview | alarm
  let lastSplitCount = -1;

  // ── Derived state ──────────────────────────────────────

  const swRunning = (s) => s.stopwatch.startedAt !== null;

  const swElapsed = (s, now) =>
    s.stopwatch.accumulated + (swRunning(s) ? now - s.stopwatch.startedAt : 0);

  const cdRunning = (s) => s.countdown.targetAt !== null && !s.countdown.expired;

  const cdRinging = (s) => s.countdown.expired === true;

  // ── Audio ──────────────────────────────────────────────

  function stopAudio() {
    els.audio.pause();
    els.audio.currentTime = 0;
    els.audio.loop = false;
    audioMode = "idle";
    setHint();
  }

  function playSound(file, loop, mode) {
    els.audio.src = `sounds/${encodeURIComponent(file)}`;
    els.audio.loop = loop;
    audioMode = mode;
    els.audio.play().catch(() => {
      if (mode === "alarm") setHint("Time is up — click anywhere to play the alarm.", true);
    });
  }

  // Browsers only allow programmatic playback after a user gesture, so warm the
  // element up on the same click that starts the timer.
  function primeAudio() {
    if (audioMode !== "idle") return;
    els.audio.muted = true;
    const done = () => { els.audio.pause(); els.audio.currentTime = 0; els.audio.muted = false; };
    const attempt = els.audio.play();
    if (attempt) attempt.then(done).catch(done);
  }

  function setHint(text, warn = false) {
    if (!els.hint) return;
    els.hint.textContent = text || "Timers keep running after you close the browser.";
    els.hint.classList.toggle("warn", warn);
  }

  document.addEventListener("click", () => {
    if (audioMode === "alarm" && els.audio.paused) els.audio.play().catch(() => {});
  });

  // ── Tabs ───────────────────────────────────────────────

  function showTab(name) {
    els.tabs.forEach((t) => t.setAttribute("aria-selected", String(t.dataset.tab === name)));
    els.panels.forEach((p) => p.classList.toggle("is-active", p.dataset.panel === name));
  }

  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      Store.update((s) => { s.tab = tab.dataset.tab; });
      showTab(tab.dataset.tab);
    });
  });

  // ── Stopwatch ──────────────────────────────────────────

  els.swPrimary.addEventListener("click", () => {
    Store.update((s) => {
      const now = Date.now();
      if (swRunning(s)) {
        s.stopwatch.splits.push(swElapsed(s, now));
      } else {
        s.stopwatch.startedAt = now;
      }
    });
  });

  els.swSecondary.addEventListener("click", () => {
    Store.update((s) => {
      const now = Date.now();
      if (swRunning(s)) {
        s.stopwatch.accumulated = swElapsed(s, now);
        s.stopwatch.startedAt = null;
      } else {
        s.stopwatch.accumulated = 0;
        s.stopwatch.splits = [];
      }
    });
  });

  function renderSplits(s) {
    const splits = s.stopwatch.splits;
    if (splits.length === lastSplitCount) return;
    lastSplitCount = splits.length;

    els.swSplits.hidden = splits.length === 0;
    els.swSplitsBody.replaceChildren();

    splits.forEach((total, i) => {
      const delta = total - (i === 0 ? 0 : splits[i - 1]);
      const row = document.createElement("tr");
      [String(i + 1), formatDuration(delta, true), formatDuration(total, true)]
        .forEach((text) => {
          const cell = document.createElement("td");
          cell.textContent = text;
          row.append(cell);
        });
      els.swSplitsBody.prepend(row);
    });
  }

  // ── Countdown ──────────────────────────────────────────

  function readDuration() {
    const hours = Math.max(0, Math.min(99, parseInt(els.cdHours.value, 10) || 0));
    const minutes = Math.max(0, Math.min(59, parseInt(els.cdMinutes.value, 10) || 0));
    return (hours * 3600 + minutes * 60) * 1000;
  }

  function startCountdown() {
    const duration = readDuration();
    if (duration <= 0) {
      setHint("Set at least one minute before starting.", true);
      return;
    }
    primeAudio();
    stopAudio();
    Store.update((s) => {
      s.countdown.durationMs = duration;
      s.countdown.targetAt = Date.now() + duration;
      s.countdown.expired = false;
    });
  }

  els.cdPrimary.addEventListener("click", () => {
    if (cdRinging(Store.current)) {
      stopAudio();
      Store.update((s) => {
        s.countdown.targetAt = Date.now() + s.countdown.durationMs;
        s.countdown.expired = false;
      });
      return;
    }
    startCountdown();
  });

  els.cdSecondary.addEventListener("click", () => {
    stopAudio();
    Store.update((s) => {
      s.countdown.targetAt = null;
      s.countdown.expired = false;
    });
  });

  els.cdSound.addEventListener("change", () => {
    Store.update((s) => { s.countdown.sound = els.cdSound.value; });
  });

  els.cdPreview.addEventListener("click", () => {
    if (audioMode === "preview") {
      stopAudio();
      return;
    }
    stopAudio();
    playSound(els.cdSound.value, false, "preview");
  });

  els.audio.addEventListener("ended", () => {
    if (audioMode === "preview") audioMode = "idle";
  });

  [els.cdHours, els.cdMinutes].forEach((input) => {
    input.addEventListener("change", () => {
      Store.update((s) => { s.countdown.durationMs = readDuration() || s.countdown.durationMs; });
    });
  });

  // ── Pop-out window ─────────────────────────────────────

  const POPOUT_SIZE = { width: 340, height: 420 };

  async function openPopout() {
    const url = "index.html?compact=1";

    // Document Picture-in-Picture gives a chrome-less, always-on-top window.
    if ("documentPictureInPicture" in window) {
      try {
        const pip = await window.documentPictureInPicture.requestWindow(POPOUT_SIZE);
        const pageBackground = getComputedStyle(document.body).backgroundColor;

        pip.document.documentElement.style.cssText =
          `height:100%;color-scheme:${getComputedStyle(document.documentElement).colorScheme || "dark light"}`;
        pip.document.body.style.cssText =
          `margin:0;height:100%;overflow:hidden;background:${pageBackground}`;

        const frame = pip.document.createElement("iframe");
        frame.src = new URL(url, location.href).href;
        frame.allow = "autoplay";
        // position:fixed rather than height:100%, which collapses to the default iframe height.
        frame.style.cssText = "position:fixed;inset:0;width:100%;height:100%;border:0;display:block";
        pip.document.body.append(frame);
        return;
      } catch {
        // Fall through to a standard popup window.
      }
    }

    window.open(
      url,
      "WebAlarmPopout",
      `popup=yes,width=${POPOUT_SIZE.width},height=${POPOUT_SIZE.height},location=no,menubar=no,toolbar=no,status=no`
    );
  }

  els.popout.addEventListener("click", openPopout);

  // Each tab needs a different amount of room, so a pop-out shrinks and grows to
  // match rather than leaving dead space below the content. Covers both a scripted
  // popup window and the iframe hosted inside a Picture-in-Picture window.
  const popoutHost = !COMPACT ? null : window.opener !== null ? window : window.parent !== window ? window.parent : null;

  function fitWindowToContent() {
    if (!popoutHost) return;
    const body = getComputedStyle(document.body);
    const padding = parseFloat(body.paddingTop) + parseFloat(body.paddingBottom);
    const content = Math.ceil(els.app.getBoundingClientRect().height + padding);
    try {
      const chrome = popoutHost.outerHeight - popoutHost.innerHeight;
      const target = Math.max(160, Math.min(content + chrome, screen.availHeight - 60));
      if (Math.abs(popoutHost.outerHeight - target) > 2) {
        popoutHost.resizeTo(popoutHost.outerWidth, target);
      }
    } catch {
      // Some hosts refuse programmatic resizing; the layout still works, it just
      // leaves blank space below the content.
    }
  }

  // ── Rendering ──────────────────────────────────────────

  function syncControls(state) {
    const running = swRunning(state);
    const elapsed = swElapsed(state, Date.now());

    els.swPrimary.textContent = running ? "Split" : elapsed > 0 ? "Resume" : "Start";
    els.swSecondary.textContent = running ? "Stop" : "Clear";
    els.swSecondary.disabled = !running && elapsed === 0 && state.stopwatch.splits.length === 0;
    renderSplits(state);

    const ringing = cdRinging(state);
    const ticking = cdRunning(state);

    els.cdPrimary.textContent = ringing ? "Restart" : "Start";
    els.cdPrimary.disabled = ticking;
    els.cdSecondary.textContent = ringing ? "Dismiss" : "Stop";
    els.cdSecondary.disabled = !ticking && !ringing;

    [els.cdHours, els.cdMinutes, els.cdSound, els.cdPreview].forEach((el) => {
      el.disabled = ticking;
    });

    if (!ticking && document.activeElement !== els.cdHours && document.activeElement !== els.cdMinutes) {
      els.cdHours.value = Math.floor(state.countdown.durationMs / 3600000);
      els.cdMinutes.value = Math.floor(state.countdown.durationMs / 60000) % 60;
    }
    els.cdSound.value = state.countdown.sound;

    els.dots.forEach((dot) => {
      const active = dot.dataset.activeDot === "stopwatch" ? running : ticking || ringing;
      dot.classList.toggle("on", active);
      dot.classList.toggle("ringing", dot.dataset.activeDot === "countdown" && ringing);
    });
  }

  function render() {
    let state = Store.current;
    const now = Date.now();
    const date = new Date(now);

    if (cdRunning(state) && now >= state.countdown.targetAt) {
      Store.update((s) => { s.countdown.expired = true; });
      state = Store.current;
      playSound(state.countdown.sound, true, "alarm");
    }

    els.clock12.textContent = formatTime12(date);
    els.clockDate.textContent = formatLongDate(date);
    els.clock24.textContent = formatTime24(date);
    els.clockUtc.textContent = formatTimeUtc(date);

    const elapsed = swElapsed(state, now);
    const running = swRunning(state);
    els.swElapsedWhole.textContent = formatDuration(elapsed);
    els.swElapsedMillis.textContent = `.${pad(elapsed % 1000, 3)}`;
    els.swStatus.textContent = running
      ? "Running"
      : elapsed > 0 ? "Stopped" : "Ready";
    els.swReadout.classList.toggle("running", running);
    els.swReadout.classList.toggle("stopped", !running && elapsed > 0);

    const ringing = cdRinging(state);
    const ticking = cdRunning(state);
    const remaining = ticking ? state.countdown.targetAt - now : 0;

    els.cdRemaining.textContent = ringing
      ? "00:00:00"
      : formatRemaining(ticking ? remaining : state.countdown.durationMs);
    els.cdStatus.textContent = ringing
      ? "Time is up!"
      : ticking
        ? `Ends at ${formatTime12(new Date(state.countdown.targetAt))}`
        : "Ready";
    els.cdReadout.classList.toggle("running", ticking);
    els.cdReadout.classList.toggle("ringing", ringing);

    document.title = ringing
      ? "Time is up! — Web Alarm"
      : ticking ? `${formatRemaining(remaining)} — Web Alarm`
        : running ? `${formatDuration(elapsed)} — Web Alarm`
          : "Web Alarm";
  }

  // ── Startup ────────────────────────────────────────────

  function init() {
    if (COMPACT) document.body.classList.add("compact");

    SOUNDS.forEach(({ file, label }) => {
      els.cdSound.append(new Option(label, file));
    });

    const state = Store.load();
    showTab(state.tab);

    // A countdown that lapsed while the browser was closed should still announce itself.
    if (cdRunning(state) && Date.now() >= state.countdown.targetAt) {
      Store.update((s) => { s.countdown.expired = true; });
    }
    if (cdRinging(Store.current)) {
      playSound(Store.current.countdown.sound, true, "alarm");
    }

    Store.subscribe((next, external) => {
      syncControls(next);
      if (external) {
        showTab(next.tab);
        if (!cdRinging(next) && audioMode === "alarm") stopAudio();
      }
      render();
    });

    syncControls(Store.current);
    render();
    setInterval(render, 40);
    setInterval(() => syncControls(Store.current), 250);

    if (popoutHost) {
      new ResizeObserver(fitWindowToContent).observe(els.app);
      fitWindowToContent();
    }
  }

  init();
})();
