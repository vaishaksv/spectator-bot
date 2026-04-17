/**
 * Seed Script — Run once to initialize Firestore collections.
 *
 * Usage:
 *   node src/seed.js
 *
 * This creates:
 *   - rooms collection with your hotel's room inventory
 *   - staff collection with authorized WhatsApp numbers
 *   - meta/counters document with booking ID counter
 *
 * ⚠️ Edit the ROOMS and STAFF arrays below before running!
 */

require('dotenv').config();
const { db, roomsCol, staffCol, metaCol } = require('./services/firebase');

// ──────────────────────────────────────────
// CONFIGURE YOUR HOTEL ROOMS HERE
// ──────────────────────────────────────────
const ROOMS = [
  { room_id: '101', type: 'single', floor: 1, room_status: 'vacant', last_checkout: null, notes: '' },
  { room_id: '102', type: 'single', floor: 1, room_status: 'vacant', last_checkout: null, notes: '' },
  { room_id: '103', type: 'double', floor: 1, room_status: 'vacant', last_checkout: null, notes: '' },
  { room_id: '104', type: 'double', floor: 1, room_status: 'vacant', last_checkout: null, notes: '' },
  { room_id: '201', type: 'single', floor: 2, room_status: 'vacant', last_checkout: null, notes: '' },
  { room_id: '202', type: 'single', floor: 2, room_status: 'vacant', last_checkout: null, notes: '' },
  { room_id: '203', type: 'double', floor: 2, room_status: 'vacant', last_checkout: null, notes: '' },
  { room_id: '204', type: 'double', floor: 2, room_status: 'vacant', last_checkout: null, notes: '' },
  { room_id: '301', type: 'double', floor: 3, room_status: 'vacant', last_checkout: null, notes: 'Corner room' },
  { room_id: '302', type: 'double', floor: 3, room_status: 'vacant', last_checkout: null, notes: 'Sea view' },
];

// ──────────────────────────────────────────
// CONFIGURE AUTHORIZED STAFF HERE
// ──────────────────────────────────────────
const STAFF = [
  { phone: '+919876543210', name: 'Owner', role: 'owner' },
  { phone: '+919876543211', name: 'Ravi', role: 'staff' },
  { phone: '+919876543212', name: 'Priya', role: 'staff' },
];

async function seed() {
  console.log('🌱 Seeding Firestore...\n');

  // Seed rooms
  console.log('🏨 Creating rooms...');
  for (const room of ROOMS) {
    await roomsCol().doc(room.room_id).set(room);
    console.log(`  ✅ Room ${room.room_id} (${room.type})`);
  }

  // Seed staff
  console.log('\n👥 Creating staff...');
  for (const member of STAFF) {
    await staffCol().doc(member.phone).set(member);
    console.log(`  ✅ ${member.name} (${member.role})`);
  }

  // Initialize booking ID counter
  console.log('\n🔢 Initializing booking counter...');
  await metaCol().doc('counters').set({ last_booking_id: 0 });
  console.log('  ✅ Counter set to AG-0000');

  console.log('\n✅ Seed complete! Your hotel is ready.\n');
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
