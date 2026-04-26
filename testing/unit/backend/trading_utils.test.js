const { normalizeTradingSymbol } = require('../../../backend/lib/tradingUtils');

describe('normalizeTradingSymbol', () => {
  test('adds USDT suffix when missing', () => {
    expect(normalizeTradingSymbol('BTC')).toBe('BTCUSDT');
    expect(normalizeTradingSymbol('eth')).toBe('ETHUSDT');
  });

  test('keeps USDT suffix if present', () => {
    expect(normalizeTradingSymbol('BTCUSDT')).toBe('BTCUSDT');
    expect(normalizeTradingSymbol('btcusdt')).toBe('BTCUSDT');
  });

  test('strips non-alphanumeric characters', () => {
    expect(normalizeTradingSymbol('btc/usdt')).toBe('BTCUSDT');
    expect(normalizeTradingSymbol(' b.t.c ')).toBe('BTCUSDT');
  });

  test('returns null for empty input', () => {
    expect(normalizeTradingSymbol('')).toBe(null);
    expect(normalizeTradingSymbol(null)).toBe(null);
    expect(normalizeTradingSymbol(undefined)).toBe(null);
  });
});

