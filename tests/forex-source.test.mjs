import assert from 'node:assert/strict';
import {
  buildForexPayload,
  parseTradingViewForex,
  ratesFromQuotes,
  FOREX_FEEDS
} from '../scripts/fetch-calendar.mjs';

const payload = {
  totalCount: 7,
  data: [
    { s: 'OANDA:EURUSD', d: ['EURUSD', 1.12, 0.25, 'streaming'] },
    { s: 'OANDA:USDJPY', d: ['USDJPY', 150.5, -0.1, 'streaming'] },
    { s: 'SAXO:EURUSD', d: ['EURUSD', 1.1202, 0.25, 'streaming'] },
    { s: 'FOREXCOM:EURUSD', d: ['EURUSD', 1.1198, 0.25, 'streaming'] },
    { s: 'FBS:EURUSD', d: ['EURUSD', null, 0.25, 'streaming'] },
    { s: 'OANDA:BADPAIR', d: ['BADPAIR', 1.5, 0, 'streaming'] },
    { s: 'NOT_A_FEED:EURUSD', d: ['EURUSD', 9.99, 0, 'streaming'] }
  ]
};

const feeds = parseTradingViewForex(payload);
assert.equal(feeds.OANDA['EUR/USD'].price, 1.12);
assert.equal(feeds.OANDA['USD/JPY'].price, 150.5);
assert.equal(feeds.SAXO['EUR/USD'].price, 1.1202);
assert.equal(feeds.FBS, undefined, 'feed with only invalid prices must be dropped');
assert.equal(feeds.OANDA['BADPAIR'], undefined, 'unknown pair must be dropped');
assert.equal(feeds.NOT_A_FEED, undefined, 'unknown feed is ignored');
assert.equal(feeds.OANDA['EUR/USD'].changePct, 0.25);

assert.ok(FOREX_FEEDS.some(f => f.id === 'OANDA'), 'OANDA feed must be configured');
assert.ok(FOREX_FEEDS.some(f => f.id === 'GOMARKETS'), 'GO Markets probe must be configured');
assert.ok(FOREX_FEEDS.some(f => f.id === 'CMCMARKETS'), 'CMC Markets probe must be configured');
assert.ok(FOREX_FEEDS.some(f => f.id === 'FBS'), 'FBS probe must be configured');

const built = buildForexPayload(feeds, new Date('2026-11-04T06:30:00Z'));
const eur = built.quotes['EUR/USD'];
assert.equal(eur.price, 1.12, 'OANDA must be the anchor when present');
assert.equal(eur.source, 'OANDA');
assert.equal(eur.consensus, 1.12);
assert.equal(eur.crossCheckPct, 0.018);
assert.equal(eur.providers.OANDA, 1.12);
assert.equal(eur.providers.SAXO, 1.1202);
assert.equal(eur.changePct, 0.25);

const jpy = built.quotes['USD/JPY'];
assert.equal(jpy.price, 150.5);
assert.equal(jpy.source, 'OANDA');

assert.equal(built.rates.USD, 1);
assert.ok(Math.abs(built.rates.EUR - 1 / 1.12) < 1e-12, 'EUR/USD must invert into USD-base rate');
assert.equal(built.rates.JPY, 150.5, 'USD/JPY must stay as JPY per USD');

assert.equal(built.providers.OANDA.status, 'ok');
assert.equal(built.providers.SAXO.status, 'ok');
assert.equal(built.providers.GOMARKETS.status, 'unavailable');
assert.equal(built.providers.CMCMARKETS.status, 'unavailable');
assert.equal(built.providers.FBS.status, 'unavailable');
assert.equal(built.source, 'OANDA (TradingView live)');
assert.equal(built.generatedAt, '2026-11-04T06:30:00.000Z');

// When OANDA is missing, fall back to the broker consensus instead of dropping the pair.
const consensus = buildForexPayload({
  SAXO: { 'EUR/USD': { price: 1.2, changePct: 0.1 } },
  FOREXCOM: { 'EUR/USD': { price: 1.2002, changePct: 0.1 } }
}, new Date('2026-11-04T06:30:00Z'));
assert.equal(consensus.quotes['EUR/USD'].source, 'broker consensus');
assert.ok(Math.abs(consensus.quotes['EUR/USD'].price - 1.2001) < 1e-12);

const empty = buildForexPayload({});
assert.deepEqual(empty.quotes, {});
assert.deepEqual(empty.rates, { USD: 1 });
assert.equal(empty.providers.OANDA.status, 'unavailable');

const rates = ratesFromQuotes({
  'GBP/USD': { price: 1.25 },
  'USD/CHF': { price: 0.8 },
  'EUR/JPY': { price: 160 },
  'BAD': { price: 1 }
});
assert.equal(rates.GBP, 0.8);
assert.equal(rates.CHF, 0.8);
assert.equal(rates.JPY, undefined, 'cross rates must not be invented');

console.log('Passed forex live-source tests');
