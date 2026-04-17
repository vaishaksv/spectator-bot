const { bookingsCol, getAllRooms } = require('../services/firebase');
const { formatDate, todayISO, toISODate } = require('../utils/dates');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

// ─────────────────────────────────────────
// /report today
// ─────────────────────────────────────────
async function handleReportToday() {
  const today = todayISO();
  const allRooms = await getAllRooms();
  const totalRooms = allRooms.length;

  // All active bookings
  const activeSnap = await bookingsCol().where('status', 'in', ['active', 'checked_in']).get();
  const occupiedCount = activeSnap.size;

  // Checked out today
  const checkedOutSnap = await bookingsCol()
    .where('actual_checkout', '==', today)
    .where('status', '==', 'checked_out')
    .get();

  let totalRevenue = 0;
  let cashTotal = 0, upiTotal = 0, onlineTotal = 0;
  checkedOutSnap.docs.forEach((doc) => {
    const b = doc.data();
    totalRevenue += b.amount || 0;
    if (b.payment_mode === 'cash') cashTotal += b.amount;
    else if (b.payment_mode === 'upi') upiTotal += b.amount;
    else if (b.payment_mode === 'online') onlineTotal += b.amount;
  });

  // New bookings today (created_at == today — approximate via checkin)
  const newBookingsSnap = await bookingsCol()
    .where('checkin', '==', today)
    .get();
  const newBookings = newBookingsSnap.size;

  // Pending payments
  const pendingSnap = await bookingsCol()
    .where('payment_status', '==', 'pending')
    .where('status', 'in', ['active', 'checked_in'])
    .get();
  let pendingTotal = 0;
  pendingSnap.docs.forEach((doc) => {
    pendingTotal += doc.data().amount || 0;
  });

  if (checkedOutSnap.empty && activeSnap.empty && newBookingsSnap.empty) {
    return `📊 No bookings found for today.`;
  }

  return (
    `📊 *Report — ${formatDate(today)}*\n` +
    `━━━━━━━━━━━━━━━━━\n` +
    `💰 Total Revenue   : ₹${totalRevenue}\n` +
    `🏨 Rooms Occupied  : ${occupiedCount} / ${totalRooms}\n` +
    `📋 New Bookings    : ${newBookings}\n` +
    `━━━━━━━━━━━━━━━━━\n` +
    `💳 Payment Split:\n` +
    `  Cash   : ₹${cashTotal}\n` +
    `  UPI    : ₹${upiTotal}\n` +
    `  Online : ₹${onlineTotal}\n` +
    `━━━━━━━━━━━━━━━━━\n` +
    `⏳ Pending: ₹${pendingTotal} (${pendingSnap.size} bookings)`
  );
}

// ─────────────────────────────────────────
// /report month
// ─────────────────────────────────────────
async function handleReportMonth() {
  const now = new Date();
  const monthStart = toISODate(new Date(now.getFullYear(), now.getMonth(), 1));
  const monthEnd = toISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const allRooms = await getAllRooms();
  const totalRooms = allRooms.length;
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysSoFar = now.getDate();

  // All bookings this month (checked out this month)
  const snap = await bookingsCol()
    .where('status', '==', 'checked_out')
    .get();

  let totalRevenue = 0, bookingCount = 0;
  let cashTotal = 0, upiTotal = 0, onlineTotal = 0;

  snap.docs.forEach((doc) => {
    const b = doc.data();
    if (b.actual_checkout && b.actual_checkout >= monthStart && b.actual_checkout <= monthEnd) {
      totalRevenue += b.amount || 0;
      bookingCount++;
      if (b.payment_mode === 'cash') cashTotal += b.amount;
      else if (b.payment_mode === 'upi') upiTotal += b.amount;
      else if (b.payment_mode === 'online') onlineTotal += b.amount;
    }
  });

  // Active bookings for occupancy
  const activeSnap = await bookingsCol().where('status', 'in', ['active', 'checked_in']).get();
  const occupiedCount = activeSnap.size;
  const occupancyPct = totalRooms > 0 ? Math.round((occupiedCount / totalRooms) * 100) : 0;
  const avgPerDay = daysSoFar > 0 ? Math.round(totalRevenue / daysSoFar) : 0;

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    `📊 *Monthly Report — ${months[now.getMonth()]} ${now.getFullYear()}*\n` +
    `━━━━━━━━━━━━━━━━━\n` +
    `💰 Total Revenue   : ₹${totalRevenue}\n` +
    `📋 Total Bookings  : ${bookingCount}\n` +
    `📈 Avg/Day         : ₹${avgPerDay}\n` +
    `🏨 Occupancy       : ${occupancyPct}% (${occupiedCount}/${totalRooms})\n` +
    `━━━━━━━━━━━━━━━━━\n` +
    `💳 Payment Split:\n` +
    `  Cash   : ₹${cashTotal}\n` +
    `  UPI    : ₹${upiTotal}\n` +
    `  Online : ₹${onlineTotal}\n` +
    `━━━━━━━━━━━━━━━━━`
  );
}

// ─────────────────────────────────────────
// /report excel
// ─────────────────────────────────────────
async function handleReportExcel() {
  const snap = await bookingsCol().orderBy('booking_id').get();

  if (snap.empty) return { message: '📊 No bookings found to export.', filePath: null };

  const workbook = new ExcelJS.Workbook();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const now = new Date();
  const sheetName = `${months[now.getMonth()]} ${now.getFullYear()}`;
  const sheet = workbook.addWorksheet(sheetName);

  sheet.columns = [
    { header: 'Booking ID', key: 'booking_id', width: 14 },
    { header: 'Room', key: 'room', width: 8 },
    { header: 'Guests', key: 'guests', width: 8 },
    { header: 'Check-in', key: 'checkin', width: 14 },
    { header: 'Check-out', key: 'checkout', width: 14 },
    { header: 'Stay Days', key: 'stay_days', width: 10 },
    { header: 'Amount (₹)', key: 'amount', width: 12 },
    { header: 'Payment Mode', key: 'payment_mode', width: 14 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Checked Out By', key: 'checked_out_by', width: 18 },
    { header: 'Created At', key: 'created_at', width: 20 },
  ];

  // Style header row
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' },
  };
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  snap.docs.forEach((doc) => {
    const b = doc.data();
    sheet.addRow({
      booking_id: b.booking_id,
      room: b.room,
      guests: b.guests,
      checkin: b.checkin,
      checkout: b.checkout,
      stay_days: b.stay_days,
      amount: b.amount,
      payment_mode: b.payment_mode,
      status: b.status,
      checked_out_by: b.checked_out_by || '—',
      created_at: b.created_at?.toDate?.() ? b.created_at.toDate().toISOString() : '—',
    });
  });

  const fileName = `Antigravity_Report_${months[now.getMonth()]}_${now.getFullYear()}.xlsx`;
  const filePath = path.join('/tmp', fileName);
  await workbook.xlsx.writeFile(filePath);

  return { message: `📊 Excel report generated: ${fileName}`, filePath, fileName };
}

// ─────────────────────────────────────────
// /pending
// ─────────────────────────────────────────
async function handlePending() {
  const snap = await bookingsCol()
    .where('payment_status', '==', 'pending')
    .where('status', 'in', ['active', 'checked_in'])
    .get();

  if (snap.empty) return '✅ No pending payments. All bookings are paid.';

  let total = 0;
  let msg = `⏳ *Pending Payments — ${snap.size} booking(s)*\n━━━━━━━━━━━━━━━━━━━\n`;

  snap.docs.forEach((doc) => {
    const b = doc.data();
    const checkinDate = new Date(b.checkin);
    const now = new Date();
    const daysOverdue = Math.max(0, Math.floor((now - checkinDate) / (1000 * 60 * 60 * 24)));
    total += b.amount || 0;

    msg += `🏨 Room ${b.room} · ${b.booking_id}\n`;
    msg += `   ₹${b.amount} · Since ${formatDate(b.checkin)}`;
    if (daysOverdue > 0) msg += ` · ${daysOverdue}d overdue`;
    msg += '\n';
  });

  msg += `━━━━━━━━━━━━━━━━━━━\n💵 Total Due: ₹${total}`;
  return msg;
}

module.exports = { handleReportToday, handleReportMonth, handleReportExcel, handlePending };
