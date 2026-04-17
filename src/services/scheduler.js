const cron = require('node-cron');
const { bookingsCol } = require('../services/firebase');
const { formatDate, todayISO } = require('../utils/dates');

/**
 * Start the daily 8 AM alert scheduler.
 * @param {Function} sendMessage - function(to, body) to send WhatsApp message
 */
function startAlertScheduler(sendMessage) {
  const ownerNumber = process.env.OWNER_WHATSAPP;
  if (!ownerNumber) {
    console.warn('⚠️ OWNER_WHATSAPP not set. Daily alerts disabled.');
    return;
  }

  // Run every day at 08:00 AM IST
  cron.schedule(
    '0 8 * * *',
    async () => {
      console.log('⏰ Running daily morning alerts...');
      try {
        const today = todayISO();
        let alertMsg = '';

        // ── Alert 1: Checkouts today ──
        const checkoutSnap = await bookingsCol()
          .where('checkout', '==', today)
          .where('status', 'in', ['active', 'checked_in'])
          .get();

        if (!checkoutSnap.empty) {
          alertMsg += `🔔 *Checkout Reminder — ${formatDate(today)}*\n━━━━━━━━━━━━━━━━\n`;
          checkoutSnap.docs.forEach((doc) => {
            const b = doc.data();
            const paidTag = b.payment_status === 'paid' ? 'Paid ✅' : '⏳ Pending';
            alertMsg += `🏨 Room ${b.room} · ${b.booking_id} · ${b.guests} guest(s)\n`;
            alertMsg += `   Amount: ₹${b.amount} · ${paidTag}\n`;
          });
          alertMsg += `━━━━━━━━━━━━━━━━\nType */checkout [room] [mode]* to process.\n\n`;
        }

        // ── Alert 2: Pending payments ──
        const pendingSnap = await bookingsCol()
          .where('payment_status', '==', 'pending')
          .where('status', 'in', ['active', 'checked_in'])
          .get();

        if (!pendingSnap.empty) {
          let pendingTotal = 0;
          pendingSnap.docs.forEach((doc) => {
            pendingTotal += doc.data().amount || 0;
          });
          alertMsg += `⏳ *Pending Payments:* ${pendingSnap.size} booking(s) · ₹${pendingTotal} due\n`;
          alertMsg += `Type */pending* to see full list.`;
        }

        // Only send if there's something to alert
        if (alertMsg.trim()) {
          await sendMessage(ownerNumber, alertMsg.trim());
          console.log('✅ Daily alert sent to owner.');
        } else {
          console.log('ℹ️ No alerts for today. Skipping message.');
        }
      } catch (err) {
        console.error('❌ Alert scheduler error:', err.message);
      }
    },
    { timezone: process.env.TIMEZONE || 'Asia/Kolkata' }
  );

  console.log('🔔 Daily alert scheduler started (08:00 AM IST)');
}

module.exports = { startAlertScheduler };
