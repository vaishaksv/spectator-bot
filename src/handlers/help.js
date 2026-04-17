function handleHelp() {
  return (
    `📖 *SpectatorBot — Commands*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `📋 *Bookings*\n` +
    `*/book* [room] [guests] [in] [out] [₹] [mode]\n` +
    `  _/book 101 1 12Apr 15Apr 1200 cash_\n\n` +
    `*/edit* [id] [field] [value]\n` +
    `  _/edit AG-0041 amount 1500_\n\n` +
    `*/cancel* [id]\n` +
    `  _/cancel AG-0041_\n\n` +
    `🏨 *Room Info*\n` +
    `*/status* [room] — Check room status\n` +
    `*/available* [date] — Free rooms on date\n\n` +
    `🧾 *Checkout*\n` +
    `*/checkout* [room] [mode]\n` +
    `  _/checkout 101 cash_\n` +
    `*/confirm* [id] — Complete checkout\n\n` +
    `🪪 *Guest ID*\n` +
    `*/id* [id] + attach photo\n` +
    `  _/id AG-0041 + photo_\n\n` +
    `📊 *Reports*\n` +
    `*/report today* — Today's summary\n` +
    `*/report month* — Monthly summary\n` +
    `*/report excel* — Download Excel\n` +
    `*/pending* — Unpaid bookings\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Date formats: 12Apr · 12/04 · today · tomorrow`
  );
}

module.exports = { handleHelp };
