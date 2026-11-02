function generateReceiptNo() {
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const rand = Math.floor(100 + Math.random() * 900);
  return `RCPT-${stamp}-${rand}`;
}

function peso(amount) {
  return `₱${Number(amount).toFixed(2)}`;
}

function dateOnly(d) {
  return new Date(d).toISOString().slice(0, 10);
}

function formatDateTime(d) {
  if (!d) return '';
  const date = new Date(d);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

module.exports = { generateReceiptNo, peso, dateOnly, formatDateTime };
