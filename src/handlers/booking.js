const {
  bookingsCol,
  generateBookingId,
  getRoom,
  getBookingById,
  updateBooking,
  updateRoom,
  checkOverlap,
} = require('../services/firebase');
const { parseDate, formatDate, toISODate, calcNights } = require('../utils/dates');
const { validatePaymentMode } = require('../utils/parser');
const admin = require('firebase-admin');

// ─────────────────────────────────────────
// /book [room] [guests] [in] [out] [₹] [mode] [status]
// ─────────────────────────────────────────
async function handleBook(args, staff) {
  if (args.length < 6) {
    return (
      '❌ Missing fields. Format:\n' +
      '*/book [room] [guests] [in] [out] [₹] [mode]*\n' +
      'Example: /book 101 1 12Apr 15Apr 1200 cash'
    );
  }

  const [roomId, guestsStr, checkinStr, checkoutStr, amountStr, modeStr, statusStr] = args;
  const guests = parseInt(guestsStr, 10);
  const amount = parseInt(amountStr, 10);
  const mode = validatePaymentMode(modeStr);
  const paymentStatus = statusStr?.toLowerCase() === 'pending' ? 'pending' : 'paid';

  // Validate guests
  if (isNaN(guests) || guests < 1) return '❌ Invalid guest count. Must be 1 or more.';

  // Validate amount
  if (isNaN(amount) || amount <= 0) return '❌ Invalid amount. Enter a valid ₹ number.';

  // Validate payment mode
  if (!mode) return '❌ Invalid payment mode. Use: cash, upi, or online.';

  // Parse dates
  const checkin = parseDate(checkinStr);
  const checkout = parseDate(checkoutStr);
  if (!checkin) return '❌ Invalid check-in date. Try: 12Apr or 12/04';
  if (!checkout) return '❌ Invalid check-out date. Try: 15Apr or 15/04';
  if (checkout <= checkin) return '❌ Check-out must be after check-in.';

  // Validate room exists
  const room = await getRoom(roomId);
  if (!room) return `❌ Room ${roomId} does not exist. Check the room number.`;

  // Room type validation (guest capacity)
  if (room.type === 'single' && guests > 1) {
    return `❌ Room ${roomId} is a *single* room. Max 1 guest allowed.`;
  }
  if (room.type === 'double' && guests > 2) {
    return `❌ Room ${roomId} is a *double* room. Max 2 guests allowed.`;
  }

  // Double-booking check
  const conflict = await checkOverlap(roomId, toISODate(checkin), toISODate(checkout));
  if (conflict) {
    return (
      '❌ *Double Booking Blocked!*\n' +
      `Room ${roomId} is already booked from ${formatDate(conflict.checkin)} → ${formatDate(conflict.checkout)} (ID: ${conflict.booking_id}).\n` +
      'Choose a different room or different dates.'
    );
  }

  // Generate booking
  const bookingId = await generateBookingId();
  const stayDays = calcNights(checkin, checkout);

  const booking = {
    booking_id: bookingId,
    room: roomId,
    guests,
    checkin: toISODate(checkin),
    checkout: toISODate(checkout),
    actual_checkout: null,
    stay_days: stayDays,
    amount,
    payment_mode: mode,
    payment_status: paymentStatus,
    status: 'active',
    id_url: null,
    id_uploaded_at: null,
    staff_number: staff.phone,
    staff_name: staff.name,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    checked_out_by: null,
    checkout_at: null,
  };

  await bookingsCol().add(booking);

  // Mark room occupied
  await updateRoom(roomId, { room_status: 'occupied' });

  const paidTag = paymentStatus === 'paid' ? 'Paid ✅' : '⏳ Pending';
  return (
    '✅ *Booking Confirmed!*\n' +
    `🏨 Room ${roomId} · ${guests} Guest(s)\n` +
    `📅 ${formatDate(checkin)} → ${formatDate(checkout)} (${stayDays} nights)\n` +
    `💵 Amount: ₹${amount}\n` +
    `💳 Payment: ${mode} · ${paidTag}\n` +
    `🔖 Booking ID: ${bookingId}`
  );
}

// ─────────────────────────────────────────
// /edit [booking-id] [field] [new-value]
// ─────────────────────────────────────────
async function handleEdit(args) {
  if (args.length < 3) {
    return '❌ Format: /edit [booking-id] [field] [value]\nExample: /edit AG-0041 amount 1500';
  }

  const [idStr, field, ...valueParts] = args;
  const bookingId = idStr.toUpperCase();
  const value = valueParts.join(' ');

  const booking = await getBookingById(bookingId);
  if (!booking) return `❌ Booking ${bookingId} not found. Check the ID and try again.`;
  if (booking.status === 'checked_out') return `❌ Cannot edit ${bookingId}. It is already checked out.`;
  if (booking.status === 'cancelled') return `❌ Cannot edit ${bookingId}. It is cancelled.`;

  const editableFields = ['amount', 'status', 'checkout', 'mode', 'guests'];
  const f = field.toLowerCase();
  if (!editableFields.includes(f)) {
    return `❌ Cannot edit "${field}". Editable fields: ${editableFields.join(', ')}`;
  }

  const updates = {};

  switch (f) {
    case 'amount': {
      const amt = parseInt(value, 10);
      if (isNaN(amt) || amt <= 0) return '❌ Invalid amount.';
      updates.amount = amt;
      break;
    }
    case 'status': {
      const s = value.toLowerCase();
      if (!['paid', 'pending'].includes(s)) return '❌ Status must be: paid or pending.';
      updates.payment_status = s;
      break;
    }
    case 'checkout': {
      const d = parseDate(value);
      if (!d) return '❌ Invalid date. Try: 17Apr or 17/04';
      updates.checkout = toISODate(d);
      updates.stay_days = calcNights(booking.checkin, toISODate(d));
      break;
    }
    case 'mode': {
      const m = validatePaymentMode(value);
      if (!m) return '❌ Invalid payment mode. Use: cash, upi, or online.';
      updates.payment_mode = m;
      break;
    }
    case 'guests': {
      const g = parseInt(value, 10);
      if (isNaN(g) || g < 1) return '❌ Invalid guest count.';
      // Check room capacity
      const room = await getRoom(booking.room);
      if (room?.type === 'single' && g > 1) return `❌ Room ${booking.room} is a single room. Max 1 guest.`;
      if (room?.type === 'double' && g > 2) return `❌ Room ${booking.room} is a double room. Max 2 guests.`;
      updates.guests = g;
      break;
    }
  }

  await updateBooking(bookingId, updates);
  return `✅ ${bookingId} updated. *${field}* → ${value}`;
}

// ─────────────────────────────────────────
// /cancel [booking-id]
// ─────────────────────────────────────────
async function handleCancel(args) {
  if (args.length < 1) return '❌ Format: /cancel [booking-id]\nExample: /cancel AG-0041';

  const bookingId = args[0].toUpperCase();
  const booking = await getBookingById(bookingId);
  if (!booking) return `❌ Booking ${bookingId} not found. Check the ID and try again.`;
  if (booking.status === 'checked_out') return `❌ ${bookingId} is already checked out. Cannot cancel.`;
  if (booking.status === 'cancelled') return `❌ ${bookingId} is already cancelled.`;

  await updateBooking(bookingId, { status: 'cancelled' });
  await updateRoom(booking.room, { room_status: 'vacant' });

  return `✅ Booking ${bookingId} cancelled. Room ${booking.room} is now free.`;
}

module.exports = { handleBook, handleEdit, handleCancel };
