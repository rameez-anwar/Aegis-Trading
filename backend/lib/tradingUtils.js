function normalizeTradingSymbol(symbol) {
  if (!symbol) return null;
  const s = String(symbol).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (s.endsWith('USDT')) return s;
  return `${s}USDT`;
}

module.exports = { normalizeTradingSymbol };

