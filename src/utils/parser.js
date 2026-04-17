const VALID_COMMANDS = [
  'book', 'edit', 'cancel', 'status', 'available',
  'checkout', 'confirm', 'id', 'report', 'pending', 'help',
];

const VALID_PAYMENT_MODES = ['cash', 'upi', 'online'];

/**
 * Parse an incoming WhatsApp message into { command, args }
 * Returns null if not a recognized command.
 */
function parseCommand(body) {
  if (!body || typeof body !== 'string') return null;
  const trimmed = body.trim();

  // Must start with /
  if (!trimmed.startsWith('/')) return null;

  const parts = trimmed.slice(1).split(/\s+/);
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);

  if (!VALID_COMMANDS.includes(command)) return null;

  return { command, args, raw: trimmed };
}

function validatePaymentMode(mode) {
  if (!mode) return null;
  const m = mode.toLowerCase();
  return VALID_PAYMENT_MODES.includes(m) ? m : null;
}

module.exports = { parseCommand, validatePaymentMode, VALID_PAYMENT_MODES };
