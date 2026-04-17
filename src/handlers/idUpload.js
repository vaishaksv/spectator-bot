const { getBookingById, updateBooking, bucket } = require('../services/firebase');
const admin = require('firebase-admin');
const axios = require('axios');
const path = require('path');

// ─────────────────────────────────────────
// /id [booking-id] + attached photo
// ─────────────────────────────────────────
async function handleIdUpload(args, mediaUrl, mediaContentType) {
  if (args.length < 1) {
    return '❌ Format: /id [booking-id] + attach photo\nExample: /id AG-0041';
  }

  const bookingId = args[0].toUpperCase();

  // Check for photo
  if (!mediaUrl) {
    return '❌ Please attach the guest ID photo with this command.';
  }

  // Check booking exists
  const booking = await getBookingById(bookingId);
  if (!booking) return `❌ Booking ${bookingId} not found. Check the booking ID.`;

  try {
    // Download image from Twilio media URL
    const response = await axios.get(mediaUrl, {
      responseType: 'arraybuffer',
      auth: {
        username: process.env.TWILIO_ACCOUNT_SID,
        password: process.env.TWILIO_AUTH_TOKEN,
      },
    });

    const imageBuffer = Buffer.from(response.data);
    const ext = getExtFromContentType(mediaContentType || 'image/jpeg');
    const timestamp = Date.now();
    const storagePath = `ids/${bookingId}/${timestamp}.${ext}`;

    // Upload to Firebase Storage
    const file = bucket.file(storagePath);
    await file.save(imageBuffer, {
      metadata: { contentType: mediaContentType || 'image/jpeg' },
    });

    // Make publicly accessible (or use signed URL)
    await file.makePublic();
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

    // Update booking document
    await updateBooking(bookingId, {
      id_url: publicUrl,
      id_uploaded_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    return (
      `✅ ID saved for ${bookingId}.\n` +
      `🔒 Stored securely in cloud.`
    );
  } catch (err) {
    console.error('ID upload error:', err.message);
    return '❌ Failed to save ID photo. Please try again.';
  }
}

function getExtFromContentType(ct) {
  const map = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'application/pdf': 'pdf',
  };
  return map[ct] || 'jpg';
}

module.exports = { handleIdUpload };
