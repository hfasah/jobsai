// Campaign send-window logic. Windows are expressed in the campaign's own
// timezone (IANA name); business_days_only skips Sat/Sun. Pure functions.

export interface SendWindow {
  send_window_start: number | null; // 0-23 local hour, inclusive
  send_window_end: number | null;   // 1-24 local hour, exclusive
  send_timezone: string | null;     // IANA tz, defaults to UTC
  business_days_only: boolean;
}

function localParts(now: Date, timeZone: string): { hour: number; weekday: number } {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hour12: false, weekday: "short" });
    const parts = fmt.formatToParts(now);
    const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10) % 24;
    const wd = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
    const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);
    return { hour, weekday: weekday < 0 ? 1 : weekday };
  } catch {
    return { hour: now.getUTCHours(), weekday: now.getUTCDay() };
  }
}

export function isWithinSendWindow(window: SendWindow, now: Date = new Date()): boolean {
  const tz = window.send_timezone || "UTC";
  const { hour, weekday } = localParts(now, tz);
  if (window.business_days_only && (weekday === 0 || weekday === 6)) return false;
  const start = window.send_window_start;
  const end = window.send_window_end;
  if (start === null || end === null) return true; // no hour restriction
  if (start < end) return hour >= start && hour < end;
  // overnight window (e.g. 22 -> 6)
  return hour >= start || hour < end;
}

// Next time the window opens after `now` — used to park deferred enrollments
// so the cron doesn't re-scan them every run. Coarse (hour resolution) is fine.
export function nextWindowOpen(window: SendWindow, now: Date = new Date()): Date {
  const probe = new Date(now.getTime());
  for (let i = 0; i < 24 * 8; i++) {
    probe.setTime(probe.getTime() + 3_600_000);
    if (isWithinSendWindow(window, probe)) return probe;
  }
  return new Date(now.getTime() + 86_400_000); // defensive fallback: tomorrow
}
