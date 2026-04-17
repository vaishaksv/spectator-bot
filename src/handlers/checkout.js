const {
  getActiveBookingForRoom,
  getBookingById,
  updateBooking,
  updateRoom,
} = require('../services/firebase');
const { formatDate, calcNights, todayISO } = require('../utils/dates');
const { validatePaymentMode } = require('../utils/parser');
const admin = require('firebase-admin');

// In-memory map to store pending checkout context: bookingId → { room, mode }
const pendingCheckouts = new Map();

// ─────────────────────────────────────────
// /checkout [room] [mode] [early?]
// ─────────────────────────────────────────
async function handleCheckout(args, staff) {
  if (args.length < 2) {
    return '❌ Format: /checkout [room] [mode]\nExample: /checkout 101 cash';
  }

  const [roomId, modeStr] = args;
  const isEarly = args.some((a) => a.toLowerCase() === 'early');
  const mode = validatePaymentMode(modeStr);
  if (!mode) return '❌ Invalid payment mode. Use: cash, upi, or online.';

  // Step 1: Fetch active booking
  const booking = await getActiveBookingForRoom(roomId);
  if (!booking) return `❌ No active booking for Room ${roomId}.`;

  // Already checked out?
  if (booking.status === 'checked_out') {
    return `❌ Room ${roomId} already checked out (${booking.booking_id} on ${formatDate(booking.actual_checkout)}).`;
  }

  const today = todayISO();
  const stayDays = calcNights(booking.checkin, today);
  const originalCheckout = new Date(booking.checkout);
  const todayDate = new Date(today);

  // Store pending checkout context
  pendingCheckouts.set(booking.booking_id, { room: roomId, mode, staff });

  // Build bill summary
  let msg =
    `🧾 *Checkout Bill — Room ${roomId}*\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `Booking ID  : ${booking.booking_id}\n` +
    `Check-in    : ${formatDate(booking.checkin)}\n` +
    `Check-out   : ${formatDate(today)}\n` +
    `Stay        : ${stayDays} nights\n` +
    `Guests      : ${booking.guests}\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `Amount Due  : ₹${booking.amount}\n` +
    `Mode        : ${mode}\n` +
    `━━━━━━━━━━━━━━━━━━━\n`;

  // Step 3: Early checkout detection
  if (todayDate < originalCheckout) {
    const daysEarly = calcNights(today, booking.checkout);
    msg +=
      `\n⚠️ *Early Checkout* — ${daysEarly} day(s) early\n` +
      `Original checkout was ${formatDate(booking.checkout)}\n\n`;
    msg +=
      `Type */confirm ${booking.booking_id}* to checkout at ₹${booking.amount}\n` +
      `Type */edit ${booking.booking_id} amount [new]* to adjust first`;
  } else {
    msg +=
      `\nType */confirm ${booking.booking_id}* to complete.\n` +
      `Type */cancel checkout* to go back.`;
  }

  return msg;
}

// ─────────────────────────────────────────
// /confirm [booking-id]
// ─────────────────────────────────────────
async function handleConfirm(args, staff) {
  if (args.length < 1) return '❌ Format: /confirm [booking-id]\nExample: /confirm AG-0041';

  // Handle "/cancel checkout"
  if (args[0].toLowerCase() === 'checkout') {
    return '✅ Checkout cancelled. No changes made.';
  }

  const bookingId = args[0].toUpperCase();
  const booking = await getBookingById(bookingId);
  if (!booking) return `❌ Booking ${bookingId} not found. Check the ID and try again.`;
  if (booking.status === 'checked_out') return `❌ ${bookingId} is already checked out.`;

  // Get pending checkout context or fallback
  const ctx = pendingCheckouts.get(bookingId);
  const mode = ctx?.mode || booking.payment_mode;

  const today = todayISO();

  // (a) Update booking
  await updateBooking(bookingId, {
    status: 'checked_out',
    payment_status: 'paid',
    payment_mode: mode,
    actual_checkout: today,
    checked_out_by: staff.phone,
    checkout_at: admin.firestore.FieldValue.serverTimestamp(),
  });

  // (b) Update room
  await updateRoom(booking.room, {
    room_status: 'vacant',
    last_checkout: today,
  });

  // Clean up pending context
  pendingCheckouts.delete(bookingId);

  return (
    '✅ *Checkout Complete!*\n' +
    `🏨 Room ${booking.room} → Now Vacant\n` +
    `💵 ₹${booking.amount} collected · ${mode}\n` +
    `🔖 ${bookingId} · Closed\n` +
    `Room ${booking.room} is available for new bookings.`
  );
}

module.exports = { handleCheckout, handleConfirm, pendingCheckouts };
