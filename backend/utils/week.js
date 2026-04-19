/**
 * Week utility for LumiLuna mess system.
 *
 * Selection window: Saturday 7:00 PM → Sunday 11:59 PM (IST)
 * Menu week: the 7 days starting from the NEXT Monday after the selection window.
 *
 * weekId format: "YYYY-WNN" (ISO week number of the upcoming week)
 */

const IST_OFFSET = 5.5 * 60 * 60 * 1000; // UTC+5:30

function nowIST() {
  return new Date(Date.now() + IST_OFFSET);
}

/** Returns ISO week number for a given date (using UTC fields) */
function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7; // Mon=1 ... Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/**
 * Returns the weekId for the week the manager is currently editing.
 *
 * Logic:
 *  - Sat 19:00 IST → Sun 23:59 IST  (selection window): target = next Monday's week
 *  - Mon–Sat before 19:00            : target = current week (Mon already started)
 *  - Any other time                  : target = current week
 *
 * The key fix: Sunday is always treated as "next week" since the mess week
 * starts on Monday and Sunday belongs to the upcoming week's planning window.
 */
function getCurrentWeekId() {
  const now = nowIST();
  const day  = now.getUTCDay();   // 0=Sun, 1=Mon … 6=Sat
  const hour = now.getUTCHours();
  const min  = now.getUTCMinutes();

  // Selection window: Sat after 19:00  OR  all of Sunday
  const inSelectionWindow =
    (day === 6 && (hour > 19 || (hour === 19 && min >= 0))) ||
    (day === 0); // entire Sunday → next week

  let targetDate = new Date(now);
  if (inSelectionWindow) {
    // Advance to next Monday
    const daysToMonday = day === 6 ? 2 : 1;
    targetDate.setUTCDate(targetDate.getUTCDate() + daysToMonday);
  }

  const year = targetDate.getUTCFullYear();
  const week = getISOWeek(targetDate);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/**
 * Is the selection window currently open?
 * Sat 19:00 IST → Sun 23:59 IST
 */
function isSelectionOpen() {
  const now  = nowIST();
  const day  = now.getUTCDay();
  const hour = now.getUTCHours();
  const min  = now.getUTCMinutes();
  return (
    (day === 6 && (hour > 19 || (hour === 19 && min >= 0))) ||
    (day === 0 && (hour < 23 || (hour === 23 && min <= 59)))
  );
}

/**
 * Is the manager allowed to input the menu?
 * Allow Thu, Fri, Sat, Sun (gives time before the selection window).
 */
function isMenuInputAllowed() {
  const now = nowIST();
  const day = now.getUTCDay();
  return day >= 4 || day === 0; // Thu=4, Fri=5, Sat=6, Sun=0
}

module.exports = { getCurrentWeekId, isSelectionOpen, isMenuInputAllowed, nowIST };
