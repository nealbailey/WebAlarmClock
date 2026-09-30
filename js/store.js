const STORAGE_KEY = "webalarm.state.v1";

const defaultState = () => ({
  tab: "clock",
  stopwatch: { startedAt: null, accumulated: 0, splits: [] },
  countdown: { targetAt: null, durationMs: 5 * 60000, sound: DEFAULT_SOUND, expired: false }
});

const Store = (() => {
  let state = defaultState();
  const listeners = new Set();

  function sanitize(raw) {
    const base = defaultState();
    if (!raw || typeof raw !== "object") return base;

    const sw = raw.stopwatch || {};
    const cd = raw.countdown || {};

    return {
      tab: ["clock", "stopwatch", "countdown"].includes(raw.tab) ? raw.tab : base.tab,
      stopwatch: {
        startedAt: Number.isFinite(sw.startedAt) ? sw.startedAt : null,
        accumulated: Number.isFinite(sw.accumulated) && sw.accumulated >= 0 ? sw.accumulated : 0,
        splits: Array.isArray(sw.splits) ? sw.splits.filter(Number.isFinite) : []
      },
      countdown: {
        targetAt: Number.isFinite(cd.targetAt) ? cd.targetAt : null,
        durationMs: Number.isFinite(cd.durationMs) && cd.durationMs > 0 ? cd.durationMs : base.countdown.durationMs,
        sound: SOUNDS.some((s) => s.file === cd.sound) ? cd.sound : DEFAULT_SOUND,
        expired: cd.expired === true
      }
    };
  }

  function load() {
    try {
      state = sanitize(JSON.parse(localStorage.getItem(STORAGE_KEY)));
    } catch {
      state = defaultState();
    }
    return state;
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Private-browsing or quota failure: the session still works, it just won't survive a restart.
    }
  }

  function notify(external) {
    listeners.forEach((fn) => fn(state, external));
  }

  // Mutate through here so every change is persisted and broadcast exactly once.
  function update(mutator) {
    mutator(state);
    persist();
    notify(false);
  }

  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    try {
      state = sanitize(JSON.parse(event.newValue));
    } catch {
      return;
    }
    notify(true);
  });

  return {
    load,
    update,
    subscribe: (fn) => listeners.add(fn),
    get current() { return state; }
  };
})();
