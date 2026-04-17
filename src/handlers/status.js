const { getActiveBookingForRoom, getAllRooms, bookingsCol } = require('../services/firebase');
const { parseDate, formatDate, toISODate } = require('../utils/dates');

// ─────────────────────────────────────────
// /status [room]
// ─────────────────────────────────────────
async function handleStatus(args) {
  if (args.length < 1) return '❌ Format: /status [room]\nExample: /status 101';

  const roomId = args[0];
  const booking = await getActiveBookingForRoom(roomId);

  if (!booking) {
    return `🟢 Room ${roomId} is available.`;
  }

  const paidTag = booking.payment_status === 'paid' ? 'Paid ✅' : '⏳ Pending';
  return (
    `🔴 *Room ${roomId} — Occupied*\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `🔖 Booking: ${booking.booking_id}\n` +
    `📅 ${formatDate(booking.checkin)} → ${formatDate(booking.checkout)}\n` +
    `👥 Guests: ${booking.guests}\n` +
    `💵 ₹${booking.amount} · ${booking.payment_mode}\n` +
    `💳 ${paidTag}\n` +
    `━━━━━━━━━━━━━━━━━━━`
  );
}

// ─────────────────────────────────────────
// /available [date]
// ─────────────────────────────────────────
async function handleAvailable(args) {
  const dateStr = args.length > 0 ? args[0] : 'today';
  const date = parseDate(dateStr);
  if (!date) return '❌ Invalid date format. Try: 12Apr or 12/04 or today';

  const isoDate = toISODate(date);
  const allRooms = await getAllRooms();

  // Get all active bookings
  const snap = await bookingsCol()
    .where('status', 'in', ['active', 'checked_in'])
    .get();

  const occupiedRooms = new Set();
  snap.docs.forEach((doc) => {
    const b = doc.data();
    const checkDate = new Date(isoDate);
    const bIn = new Date(b.checkin);
    const bOut = new Date(b.checkout);
    // Room is occupied if: checkin <= date < checkout
    if (checkDate >= bIn && checkDate < bOut) {
      occupiedRooms.add(b.room);
    }
  });

  const available = allRooms.filter((r) => !occupiedRooms.has(r.room_id));

  if (available.length === 0) {
    return `❌ No rooms available on ${formatDate(date)}.`;
  }

  let msg = `🟢 *Available Rooms — ${formatDate(date)}*\n━━━━━━━━━━━━━━━━━━━\n`;
  available.forEach((r) => {
    msg += `🏨 Room ${r.room_id} (${r.type})\n`;
  });
  msg += `━━━━━━━━━━━━━━━━━━━\n${available.length} of ${allRooms.length} rooms free.`;

  return msg;
}

module.exports = { handleStatus, handleAvailable };
