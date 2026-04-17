const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/**
 * Parse flexible date formats: 12Apr, 12apr, 12/04, 12-04, 2024-04-12, today, tomorrow
 * Returns a Date object (midnight IST) or null on failure.
 */
function parseDate(input) {
  if (!input) return null;
  const s = input.trim().toLowerCase();
  const now = new Date();

  // "today" / "tomorrow"
  if (s === 'today') return stripTime(now);
  if (s === 'tomorrow') {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return stripTime(d);
  }

  // "12Apr" or "12apr" or "2Apr"
  const monthNameMatch = s.match(/^(\d{1,2})(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)$/);
  if (monthNameMatch) {
    const day = parseInt(monthNameMatch[1], 10);
    const month = MONTHS[monthNameMatch[2]];
    const year = inferYear(month, day);
    return new Date(year, month, day);
  }

  // "12/04" or "12-04" (DD/MM)
  const slashMatch = s.match(/^(\d{1,2})[/-](\d{1,2})$/);
  if (slashMatch) {
    const day = parseInt(slashMatch[1], 10);
    const month = parseInt(slashMatch[2], 10) - 1;
    const year = inferYear(month, day);
    return new Date(year, month, day);
  }

  // "2024-04-12" (ISO format)
  const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
  }

  return null; // unparseable
}

/**
 * Infer the year: if the month/day combo has already passed this year, use next year.
 */
function inferYear(month, day) {
  const now = new Date();
  const thisYear = now.getFullYear();
  const candidate = new Date(thisYear, month, day);
  // If the date is more than 30 days in the past, assume next year
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  if (candidate < thirtyDaysAgo) {
    return thisYear + 1;
  }
  return thisYear;
}

function stripTime(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Format a Date to "12 Apr 2024"
 */
function formatDate(d) {
  if (!d) return '—';
  if (typeof d === 'string') d = new Date(d);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Format to ISO "YYYY-MM-DD" for Firestore storage
 */
function toISODate(d) {
  if (!d) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Calculate nights between two dates
 */
function calcNights(checkin, checkout) {
  const d1 = new Date(checkin);
  const d2 = new Date(checkout);
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
}

/**
 * Get today's date as ISO string
 */
function todayISO() {
  return toISODate(new Date());
}

module.exports = { parseDate, formatDate, toISODate, calcNights, todayISO, stripTime };
