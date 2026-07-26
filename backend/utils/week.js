/**
 * Week utility — LumiLuna Smart Breakfast System
 *
 * Selection window: Saturday 7:00 PM IST → Sunday 11:59:59 PM IST
 * Menu week      : the Monday–Sunday starting after the selection window closes
 * weekId format  : "YYYY-WNN"
 */

const IST_OFFSET = 5.5 * 60 * 60 * 1000; // UTC+5:30 in ms

function nowIST() {
  return new Date(Date.now() + IST_OFFSET);
}

/** ISO week number for a given date */
function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/**
 * Returns weekId for the week students are currently selecting for.
 * During Sat 19:00–Sun 23:59 IST → next Monday's week
 * All other times → current active week
 */
function getCurrentWeekId() {
  const now = nowIST();
  const day  = now.getUTCDay();
  const hour = now.getUTCHours();
  const min  = now.getUTCMinutes();

  const inSelectionWindow =
    (day === 6 && (hour > 19 || (hour === 19 && min >= 0))) ||
    (day === 0);

  let targetDate = new Date(now);
  if (inSelectionWindow) {
    const daysToMonday = day === 6 ? 2 : 1;
    targetDate.setUTCDate(targetDate.getUTCDate() + daysToMonday);
  }

  const year = targetDate.getUTCFullYear();
  const week = getISOWeek(targetDate);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/**
 * Returns whether the selection window is currently open.
 * Window: Saturday 19:00:00 IST → Sunday 23:59:59 IST
 */
function isSelectionOpen() {
  const now  = nowIST();
  const day  = now.getUTCDay();
  const hour = now.getUTCHours();
  const min  = now.getUTCMinutes();

  const satOpen  = day === 6 && (hour > 19 || (hour === 19 && min >= 0));
  const sunOpen  = day === 0;
  return satOpen || sunOpen;
}

/**
 * Returns precise deadline info for the countdown timer.
 * Returns:
 *  {
 *    windowOpen: bool,
 *    deadlineMs: unix ms of when window closes (if open) or when it next opens,
 *    deadlineLabel: "Closes" | "Opens",
 *    weekId: string,
 *    nextWindowOpenMs: unix ms of next Saturday 19:00 IST
 *  }
 */
function getDeadlineInfo() {
  const now     = nowIST();
  const nowUtc  = Date.now();  // real UTC ms
  const day     = now.getUTCDay();
  const hour    = now.getUTCHours();
  const min     = now.getUTCMinutes();
  const sec     = now.getUTCSeconds();

  const open = isSelectionOpen();
  const weekId = getCurrentWeekId();

  if (open) {
    // Window is open — deadline is end of Sunday 23:59:59 IST
    // Find next Sunday midnight IST
    let deadline;
    if (day === 6) {
      // Saturday: Sunday midnight = today + (1 day) set to 23:59:59
      const sun = new Date(now);
      sun.setUTCDate(sun.getUTCDate() + 1);
      sun.setUTCHours(23, 59, 59, 0);
      deadline = sun.getTime() - IST_OFFSET; // back to real UTC
    } else {
      // Sunday: today at 23:59:59 IST
      const sun = new Date(now);
      sun.setUTCHours(23, 59, 59, 0);
      deadline = sun.getTime() - IST_OFFSET;
    }
    return { windowOpen: true, deadlineMs: deadline, deadlineLabel: "Selection closes in", weekId };
  } else {
    // Window is closed — find next Saturday 19:00:00 IST
    const daysUntilSat = ((6 - day) + 7) % 7 || 7; // days until next Saturday
    const nextSat = new Date(now);
    nextSat.setUTCDate(nextSat.getUTCDate() + daysUntilSat);
    nextSat.setUTCHours(19, 0, 0, 0); // 19:00 IST expressed in IST-shifted UTC
    const nextOpenMs = nextSat.getTime() - IST_OFFSET;
    return { windowOpen: false, deadlineMs: nextOpenMs, deadlineLabel: "Selection opens in", weekId };
  }
}

/** Manager menu input allowed: Thu, Fri, Sat, Sun */
function isMenuInputAllowed() {
  const day = nowIST().getUTCDay();
  return day >= 4 || day === 0;
}

module.exports = { getCurrentWeekId, isSelectionOpen, isMenuInputAllowed, nowIST, getDeadlineInfo };
