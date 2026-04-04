/**
 * Week utility for LumiLuna mess system.
 *
 * Selection window: Saturday 7:00 PM → Sunday 7:00 PM (IST)
 * Menu week: the 7 days starting from the NEXT Monday after the selection window.
 *
 * weekId format: "YYYY-WNN" (ISO week number of the upcoming week)
 */

const IST_OFFSET = 5.5 * 60 * 60 * 1000; // UTC+5:30

function nowIST() {
  return new Date(Date.now() + IST_OFFSET);
}

/** Returns ISO week number for a given date */
function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/**
 * Returns the weekId for the UPCOMING week's menu.
 * On Sat 7pm–Sun 7pm: returns next week's id.
 * Otherwise: returns current week's id.
 */
function getCurrentWeekId() {
  const now = nowIST();
  const day = now.getUTCDay(); // 0=Sun,6=Sat
  const hour = now.getUTCHours();

  // Selection window: Sat (6) after 19:00 OR Sun (0) before 19:00
  const inSelectionWindow =
    (day === 6 && hour >= 19) ||
    (day === 0 && hour < 19);

  let targetDate = new Date(now);
  if (inSelectionWindow) {
    // Point to next Monday
    const daysToMonday = day === 6 ? 2 : 1;
    targetDate.setUTCDate(targetDate.getUTCDate() + daysToMonday);
  }

  const year = targetDate.getUTCFullYear();
  const week = getISOWeek(targetDate);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/**
 * Is the selection window currently open?
 * Sat 19:00 IST → Sun 19:00 IST
 */
function isSelectionOpen() {
  const now = nowIST();
  const day = now.getUTCDay();
  const hour = now.getUTCHours();
  return (day === 6 && hour >= 19) || (day === 0 && hour < 19);
}

/**
 * Is the manager allowed to input the menu?
 * Allow from Thursday onwards (to give time before Saturday).
 */
function isMenuInputAllowed() {
  const now = nowIST();
  const day = now.getUTCDay(); // 0=Sun,1=Mon,...,4=Thu,5=Fri,6=Sat
  return day >= 4 || day === 0; // Thu, Fri, Sat, Sun
}

module.exports = { getCurrentWeekId, isSelectionOpen, isMenuInputAllowed, nowIST };
