const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase-service-account.json';
const serviceAccount = require(path.resolve(serviceAccountPath));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

// ── Collections ──
const bookingsCol = () => db.collection('bookings');
const roomsCol = () => db.collection('rooms');
const staffCol = () => db.collection('staff');
const metaCol = () => db.collection('meta');

// ── Booking ID Generator ──
async function generateBookingId() {
  const metaRef = metaCol().doc('counters');
  const result = await db.runTransaction(async (t) => {
    const doc = await t.get(metaRef);
    let lastId = 0;
    if (doc.exists) {
      lastId = doc.data().last_booking_id || 0;
    }
    const newId = lastId + 1;
    t.set(metaRef, { last_booking_id: newId }, { merge: true });
    return newId;
  });
  return `AG-${String(result).padStart(4, '0')}`;
}

// ── Staff Auth ──
async function getStaffMember(phone) {
  // Normalize: strip "whatsapp:" prefix if present
  const cleanPhone = phone.replace('whatsapp:', '');
  const snap = await staffCol().where('phone', '==', cleanPhone).limit(1).get();
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

// ── Room Helpers ──
async function getRoom(roomId) {
  const snap = await roomsCol().where('room_id', '==', roomId).limit(1).get();
  if (snap.empty) return null;
  return { docId: snap.docs[0].id, ...snap.docs[0].data() };
}

async function getAllRooms() {
  const snap = await roomsCol().orderBy('room_id').get();
  return snap.docs.map((d) => ({ docId: d.id, ...d.data() }));
}

async function updateRoom(roomId, data) {
  const room = await getRoom(roomId);
  if (!room) return false;
  await roomsCol().doc(room.docId).update(data);
  return true;
}

// ── Booking Helpers ──
async function getBookingById(bookingId) {
  const snap = await bookingsCol().where('booking_id', '==', bookingId.toUpperCase()).limit(1).get();
  if (snap.empty) return null;
  return { docId: snap.docs[0].id, ...snap.docs[0].data() };
}

async function getActiveBookingForRoom(roomId) {
  const snap = await bookingsCol()
    .where('room', '==', roomId)
    .where('status', 'in', ['active', 'checked_in'])
    .limit(1)
    .get();
  if (snap.empty) return null;
  return { docId: snap.docs[0].id, ...snap.docs[0].data() };
}

async function updateBooking(bookingId, data) {
  const booking = await getBookingById(bookingId);
  if (!booking) return false;
  await bookingsCol().doc(booking.docId).update(data);
  return true;
}

// ── Overlap Check ──
async function checkOverlap(roomId, checkin, checkout, excludeBookingId = null) {
  const snap = await bookingsCol()
    .where('room', '==', roomId)
    .where('status', 'in', ['active', 'checked_in'])
    .get();

  for (const doc of snap.docs) {
    const b = doc.data();
    if (excludeBookingId && b.booking_id === excludeBookingId) continue;
    const existIn = new Date(b.checkin);
    const existOut = new Date(b.checkout);
    const reqIn = new Date(checkin);
    const reqOut = new Date(checkout);
    // Overlap: reqIn < existOut AND reqOut > existIn
    if (reqIn < existOut && reqOut > existIn) {
      return b; // conflicting booking
    }
  }
  return null; // no conflict
}

module.exports = {
  db,
  admin,
  bucket,
  bookingsCol,
  roomsCol,
  staffCol,
  metaCol,
  generateBookingId,
  getStaffMember,
  getRoom,
  getAllRooms,
  updateRoom,
  getBookingById,
  getActiveBookingForRoom,
  updateBooking,
  checkOverlap,
};
