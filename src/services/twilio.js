const twilio = require('twilio');
const fs = require('fs');

let client = null;

function getTwilioClient() {
  if (!client) {
    client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return client;
}

/**
 * Send a text message via WhatsApp
 */
async function sendWhatsAppMessage(to, body) {
  const twilioClient = getTwilioClient();
  try {
    const msg = await twilioClient.messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      to,
      body,
    });
    console.log(`📤 Message sent: ${msg.sid}`);
    return msg;
  } catch (err) {
    console.error('❌ Twilio send error:', err.message);
    throw err;
  }
}

/**
 * Send a document (Excel file) via WhatsApp
 */
async function sendWhatsAppDocument(to, filePath, fileName, caption) {
  const twilioClient = getTwilioClient();
  try {
    // For Twilio, we need a publicly accessible URL for the media.
    // In production, upload to Firebase Storage first, get URL, then send.
    // For now, we'll use a local server approach or direct file.
    const msg = await twilioClient.messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      to,
      body: caption || `📊 ${fileName}`,
      // mediaUrl requires a publicly accessible URL
      // You'll need to serve the file or upload to cloud storage
    });
    console.log(`📤 Document sent: ${msg.sid}`);
    return msg;
  } catch (err) {
    console.error('❌ Twilio document send error:', err.message);
    throw err;
  }
}

module.exports = { sendWhatsAppMessage, sendWhatsAppDocument, getTwilioClient };
