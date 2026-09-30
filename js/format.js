const pad = (n, width = 2) => String(Math.floor(n)).padStart(width, "0");

// HH:MM:SS, optionally with .mmm
function formatDuration(ms, withMillis = false) {
  const total = Math.max(0, ms);
  const hours = Math.floor(total / 3600000);
  const minutes = Math.floor(total / 60000) % 60;
  const seconds = Math.floor(total / 1000) % 60;
  const base = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return withMillis ? `${base}.${pad(total % 1000, 3)}` : base;
}

// Round up so a timer started at 5:00 reads "05:00" rather than "04:59"
function formatRemaining(ms) {
  return formatDuration(Math.ceil(Math.max(0, ms) / 1000) * 1000);
}

const formatTime12 = (date) =>
  date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

const formatLongDate = (date) =>
  date.toLocaleDateString(undefined, {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });

const formatTime24 = (date) =>
  `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

const formatTimeUtc = (date) =>
  `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
