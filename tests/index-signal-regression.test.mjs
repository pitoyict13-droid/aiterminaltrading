import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../index.html', import.meta.url), 'utf8');

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name}() not found in index.html`);
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`Could not extract ${name}()`);
}

const numFn = extractFunction('num');
const countryFn = extractFunction('countryCode');
const biasFn = extractFunction('goldBias');
const analyzeFn = extractFunction('analyze');
const analyze = new Function(`${numFn}\n${countryFn}\n${biasFn}\n${analyzeFn}\nreturn analyze;`)();

const cases = [
  [{Event:'Nonfarm Payrolls', Actual:150000, Forecast:200000}, 'long'],
  [{Event:'Nonfarm Payrolls', Actual:250000, Forecast:200000}, 'short'],
  [{Event:'Unemployment Rate', Actual:4.2, Forecast:4.0}, 'long'],
  [{Event:'Unemployment Rate', Actual:3.8, Forecast:4.0}, 'short'],
  [{Event:'Initial Jobless Claims', Actual:230000, Forecast:220000}, 'long'],
  [{Event:'Initial Jobless Claims', Actual:210000, Forecast:220000}, 'short'],
  [{Event:'CPI', Actual:2.8, Forecast:3.0}, 'long'],
  [{Event:'CPI', Actual:3.2, Forecast:3.0}, 'short'],
  [{Event:'Unknown Indicator', Actual:10, Forecast:9}, 'wait'],
  [{Event:'CPI', Actual:null, Forecast:3.0}, 'wait'],
];

for (const [input, expected] of cases) {
  assert.equal(analyze(input).dir, expected, JSON.stringify(input));
}

console.log(`Passed ${cases.length}/${cases.length} actual index.html signal tests`);

// Post-news regression: momentum is calculated per pair (not gold for every pair).
const tpSlFn = extractFunction('tpSl');
const pairRateFromFn = extractFunction('pairRateFrom');
const pairRateFn = extractFunction('pairRate');
const newsPhaseFn = extractFunction('newsPhase');
const momentumForFn = extractFunction('momentumFor');
const postNewsMomentumFn = extractFunction('postNewsMomentum');
const eventAssetsFn = extractFunction('eventAssets');
const pairCurrenciesFn = extractFunction('pairCurrencies');
const focusPairFn = extractFunction('focusPair');
const normalizeSnapshotFn = extractFunction('normalizeSnapshot');
const preNewsSnapshotFn = extractFunction('preNewsSnapshot');
const preNewsPriceFn = extractFunction('preNewsPrice');
const eventKeyFn = extractFunction('eventKey');
const dateEventKeyFn = extractFunction('dateEventKey');
const postNewsExpiryFn = extractFunction('postNewsExpiry');
const forecastBiasFn = extractFunction('forecastBias');
const preNewsBiasFn = extractFunction('preNewsBias');
const invertDirFn = extractFunction('invertDir');
const mapPairBiasFn = extractFunction('mapPairBias');
const indexRateFn = extractFunction('indexRate');

function buildTpSl(livePrice, forexRates, cryptoRates, store, preNews = {}, indexRates = defaultIndexRates) {
  const body = `
    const WITA = 'Asia/Makassar';
    const POST_NEWS_HOLD_MS = 6 * 60 * 60 * 1000;
    const NEWS_SETTLE_MS = 60 * 1000;
    const FOREX_MAJORS = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD'];
    const FOREX_CROSSES = ['GBP/JPY', 'EUR/JPY'];
    const FOREX_PAIRS = [...FOREX_MAJORS, ...FOREX_CROSSES];
    const INDICES = [
      { symbol: 'NAS100', name: 'Nasdaq 100', yahoo: '^NDX', slPct: 1.0, tpPct: 2.0 },
      { symbol: 'US500', name: 'S&P 500', yahoo: '^GSPC', slPct: 0.75, tpPct: 1.5 }
    ];
    const fmtDate = d => new Intl.DateTimeFormat('en-IN', { timeZone: WITA, weekday: 'short', day: '2-digit', month: 'short' }).format(d);
    const fmtTime = d => new Intl.DateTimeFormat('en-IN', { timeZone: WITA, hour: '2-digit', minute: '2-digit', hour12: false }).format(d) + ' WITA';
    const esc = s => String(s ?? '');
    ${numFn}
    ${countryFn}
    ${biasFn}
    ${normalizeSnapshotFn}
    ${dateEventKeyFn}
    ${eventKeyFn}
    ${preNewsSnapshotFn}
    ${preNewsPriceFn}
    ${newsPhaseFn}
    ${pairRateFromFn}
    ${pairRateFn}
    ${indexRateFn}
    ${momentumForFn}
    ${postNewsMomentumFn}
    ${pairCurrenciesFn}
    ${eventAssetsFn}
    ${focusPairFn}
    ${postNewsExpiryFn}
    ${forecastBiasFn}
    ${preNewsBiasFn}
    ${invertDirFn}
    ${mapPairBiasFn}
    ${tpSlFn}
    return tpSl;
  `;
  return new Function('LIVE_PRICE', 'FOREX_RATES', 'CRYPTO_RATES', 'localStorage', 'PRE_NEWS', 'INDEX_RATES', body)(livePrice, forexRates, cryptoRates, store, preNews, indexRates);
}

const forexRates = { EUR: 0.92, GBP: 0.79, JPY: 150, CHF: 0.88, AUD: 0.65, CAD: 1.36 };
const cryptoRates = { 'BTC/USD': 65000, 'ETH/USD': 3200 };
const defaultIndexRates = {
  NAS100: { price: 21000, previousClose: 20800, changePct: 0.96 },
  US500: { price: 5800, previousClose: 5760, changePct: 0.69 }
};
const noStore = { getItem: () => null, setItem: () => {} };
const jsonStore = value => ({ getItem: () => JSON.stringify(value), setItem: () => {} });
const baseSnapshot = {
  gold: 3900,
  forex: { EUR: 0.95, GBP: 0.80, JPY: 155, CHF: 0.90, AUD: 0.66, CAD: 1.38 },
  crypto: { 'BTC/USD': 62000, 'ETH/USD': 3000 },
  capturedAt: new Date().toISOString(),
};

const pastUsd = { Date: new Date(Date.now() - 60 * 60 * 1000).toISOString(), Event: 'CPI', Country: 'USD', Importance: 3, Forecast: '3.0%', Actual: '' };
const pastAud = { ...pastUsd, Event: 'CPI m/m', Country: 'AUD' };
const futureUsd = { Date: new Date(Date.now() + 60 * 60 * 1000).toISOString(), Event: 'Nonfarm Payrolls', Country: 'USD', Importance: 3, Forecast: '200K', Actual: '' };

const breakoutHtml = buildTpSl(4000, forexRates, cryptoRates, noStore)({ dir: 'wait', score: 40 }, pastUsd);
assert.match(breakoutHtml, /POST-NEWS/);
assert.match(breakoutHtml, /BUY/);
assert.match(breakoutHtml, /SELL/);
assert.match(breakoutHtml, /TP:/);
assert.match(breakoutHtml, /EUR\/USD/);
assert.match(breakoutHtml, /BTC\/USD/);

// USD event: every USD-quoted pair uses its own momentum.
const usdHtml = buildTpSl(4000, forexRates, cryptoRates, jsonStore(baseSnapshot))({ dir: 'wait', score: 40 }, pastUsd);
assert.match(usdHtml, /POST-NEWS/);
assert.match(usdHtml, /XAU\/USD \(Gold\) — BUY/);
assert.match(usdHtml, /dari 3900\.00/);
assert.match(usdHtml, /EUR\/USD <b>BUY<\/b>/);
assert.match(usdHtml, /USD\/JPY <b>SELL<\/b>/);
assert.match(usdHtml, /BTC\/USD <b>BUY<\/b>/);

// AUD event: only AUD/USD gets a directional signal; gold and crypto panels are hidden.
const audHtml = buildTpSl(4000, forexRates, cryptoRates, jsonStore(baseSnapshot))({ dir: 'wait', score: 40 }, pastAud);
assert.match(audHtml, /POST-NEWS/);
assert.match(audHtml, /AUD\/USD <b>BUY<\/b>/);
assert.match(audHtml, /\+1\.54%/);
assert.doesNotMatch(audHtml, /XAU\/USD/);
assert.doesNotMatch(audHtml, /BTC\/USD/);
assert.doesNotMatch(audHtml, /ETH\/USD/);
assert.doesNotMatch(audHtml, /POST-NEWS BREAKOUT \(OCO\)/);
assert.doesNotMatch(audHtml, /EUR\/USD <b>BUY<\/b>/);
assert.doesNotMatch(audHtml, /USD\/JPY <b>SELL<\/b>/);

// AUD pre-news: no gold straddle or crypto panel either.
const futureAud = { ...futureUsd, Event: 'CPI m/m', Country: 'AUD' };
const audStraddleHtml = buildTpSl(4000, forexRates, cryptoRates, noStore)({ dir: 'wait', score: 40 }, futureAud);
assert.match(audStraddleHtml, /AUD\/USD/);
assert.doesNotMatch(audStraddleHtml, /XAU\/USD/);
assert.doesNotMatch(audStraddleHtml, /STRATEGI STRADDLE \(OCO\)/);
assert.doesNotMatch(audStraddleHtml, /BTC\/USD/);
assert.doesNotMatch(audStraddleHtml, /ETH\/USD/);

// Directed AUD event must not leak a gold panel either.
const audDirectedHtml = buildTpSl(4000, forexRates, cryptoRates, jsonStore(baseSnapshot))({ dir: 'long', score: 70 }, pastAud);
assert.doesNotMatch(audDirectedHtml, /XAU\/USD/);
assert.doesNotMatch(audDirectedHtml, /BTC\/USD/);
assert.doesNotMatch(audDirectedHtml, /ETH\/USD/);

// Legacy localStorage snapshot (gold only) is merged with per-pair repo data.
const localGold = { getItem: () => '3900', setItem: () => {} };
const repoForex = { [`${pastUsd.Date}|CPI`]: { forex: baseSnapshot.forex, crypto: baseSnapshot.crypto } };
const mergedHtml = buildTpSl(4000, forexRates, cryptoRates, localGold, repoForex)({ dir: 'wait', score: 40 }, pastUsd);
assert.match(mergedHtml, /EUR\/USD <b>BUY<\/b>/);
assert.match(mergedHtml, /USD\/JPY <b>SELL<\/b>/);
assert.match(mergedHtml, /dari 3900\.00/);

// Legacy repo snapshot ({price}) is still treated as a gold base price.
const repoSnapshots = { [`${pastUsd.Date}|CPI`]: { price: 3950, capturedAt: pastUsd.Date } };
const repoHtml = buildTpSl(4000, forexRates, cryptoRates, noStore, repoSnapshots)({ dir: 'wait', score: 40 }, pastUsd);
assert.match(repoHtml, /XAU\/USD \(Gold\) — BUY/);
assert.match(repoHtml, /dari 3950\.00/);
assert.match(repoHtml, /EUR\/USD <b style="color:var\(--amber\)">BREAKOUT<\/b>/);

const straddleHtml = buildTpSl(4000, forexRates, cryptoRates, noStore)({ dir: 'wait', score: 40 }, futureUsd);
assert.match(straddleHtml, /STRADDLE/);
assert.match(straddleHtml, /BUY/);
assert.match(straddleHtml, /TP/);

// Pre-news forex majors: explicit market BUY/SELL bias from Forecast vs Previous.
const futureEurCpi = {
  Date: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
  Event: 'CPI Flash Estimate y/y', Country: 'EUR', Importance: 3,
  Forecast: '4.0%', Previous: '3.8%', Actual: ''
};
const eurPre = buildTpSl(4000, forexRates, cryptoRates, noStore)({ dir: 'wait', score: 40 }, futureEurCpi);
assert.match(eurPre, /PRE-NEWS BUY bias/);
assert.match(eurPre, /EUR\/USD <b>BUY<\/b>/);
assert.match(eurPre, /pre-news market/);
assert.match(eurPre, /Entry market pra-rilis BUY/);
assert.doesNotMatch(eurPre, /XAU\/USD/);
assert.doesNotMatch(eurPre, /BTC\/USD/);

const futureUsdCpi = { ...futureEurCpi, Event: 'CPI', Country: 'USD', Forecast: '3.2%', Previous: '3.0%' };
const usdPre = buildTpSl(4000, forexRates, cryptoRates, noStore)({ dir: 'wait', score: 40 }, futureUsdCpi);
assert.match(usdPre, /PRE-NEWS SELL bias/);
assert.match(usdPre, /EUR\/USD <b>SELL<\/b>/);
assert.match(usdPre, /GBP\/USD <b>SELL<\/b>/);
assert.match(usdPre, /USD\/JPY <b>BUY<\/b>/);
assert.match(usdPre, /USD\/CHF <b>BUY<\/b>/);
assert.match(usdPre, /pre-news market/);
// Crypto still waits for post-news momentum; gold keeps its pre-news straddle.
assert.match(usdPre, /BTC\/USD <b style="color:var\(--amber\)">STRADDLE<\/b>/);
assert.match(usdPre, /STRATEGI STRADDLE \(OCO\)/);
// USD event also drives the index panel.
assert.match(usdPre, /Indices \(Nasdaq 100 &amp; S&amp;P 500\)/);
assert.match(usdPre, /NAS100 <b>SELL<\/b>/);
assert.match(usdPre, /US500 <b>SELL<\/b>/);
assert.match(usdPre, /SL\/TP 1% \/ 2%/);
assert.match(usdPre, /SL\/TP 0\.75% \/ 1\.5%/);

const futureGbp = { ...futureEurCpi, Event: 'CPI y/y', Country: 'GBP', Forecast: '3.0%', Previous: '3.2%' };
const gbpPre = buildTpSl(4000, forexRates, cryptoRates, noStore)({ dir: 'wait', score: 40 }, futureGbp);
assert.match(gbpPre, /GBP\/USD <b>SELL<\/b>/);
assert.match(gbpPre, /GBP\/JPY <b>SELL<\/b>/);
assert.match(gbpPre, /USD\/JPY <b style="color:var\(--amber\)">STRADDLE<\/b>/);
assert.doesNotMatch(gbpPre, /EUR\/USD <b>BUY<\/b>/);

// Cross pairs follow the event currency leg.
assert.match(eurPre, /EUR\/JPY <b>BUY<\/b>/);
assert.match(usdPre, /GBP\/JPY <b>SELL<\/b>/);
assert.match(usdPre, /EUR\/JPY <b>SELL<\/b>/);
assert.doesNotMatch(eurPre, /NAS100/);

// Pure Forecast-vs-Previous bias and pair orientation mapping.
const forecastBias = new Function(`${numFn}\n${countryFn}\n${biasFn}\n${forecastBiasFn}\nreturn forecastBias;`)();
assert.equal(forecastBias({ Event: 'CPI', Country: 'USD', Forecast: '3.2%', Previous: '3.0%' }).dir, 'short');
assert.equal(forecastBias({ Event: 'CPI', Country: 'EUR', Forecast: '4.0%', Previous: '3.8%' }).dir, 'long');
assert.equal(forecastBias({ Event: 'CPI', Country: 'USD', Forecast: '3.0%', Previous: '3.0%' }), null);
assert.equal(forecastBias({ Event: 'CPI', Country: 'USD', Forecast: '', Previous: '3.0%' }), null);

const mapPairBias = new Function(`${countryFn}\n${invertDirFn}\n${mapPairBiasFn}\nreturn mapPairBias;`)();
assert.equal(mapPairBias('EUR/USD', 'short'), 'short');
assert.equal(mapPairBias('USD/JPY', 'short'), 'long');
assert.equal(mapPairBias('USD/CAD', 'long'), 'short');
assert.equal(mapPairBias('EUR/USD', 'wait'), null);
// Currency-aware crosses: event currency on the base leg keeps direction, quote leg inverts.
assert.equal(mapPairBias('GBP/JPY', 'long', 'GBP'), 'long');
assert.equal(mapPairBias('GBP/JPY', 'long', 'JPY'), 'short');
assert.equal(mapPairBias('EUR/JPY', 'short', 'EUR'), 'short');
assert.equal(mapPairBias('EUR/JPY', 'short', 'JPY'), 'long');
assert.equal(mapPairBias('GBP/JPY', 'long', 'USD'), 'long');
assert.equal(mapPairBias('EUR/JPY', 'short', 'USD'), 'short');

const pairRateFrom = new Function(`${pairRateFromFn}\nreturn pairRateFrom;`)();
assert.ok(Math.abs(pairRateFrom(forexRates, 'EUR/USD') - 1 / 0.92) < 1e-9);
assert.ok(Math.abs(pairRateFrom(forexRates, 'GBP/JPY') - 150 / 0.79) < 1e-9);
assert.ok(Math.abs(pairRateFrom(forexRates, 'EUR/JPY') - 150 / 0.92) < 1e-9);
assert.equal(pairRateFrom({}, 'GBP/JPY'), null);
assert.equal(pairRateFrom(forexRates, 'BADPAIR'), null);

// Direct OANDA pair quotes must win over reconstructed USD-base rates.
const pairRateDirect = new Function('FOREX_QUOTES', 'FOREX_RATES', `${pairRateFromFn}\n${pairRateFn}\nreturn pairRate;`)(
  { 'EUR/USD': { price: 1.2 } },
  forexRates
);
assert.equal(pairRateDirect('EUR/USD'), 1.2);
assert.ok(Math.abs(pairRateDirect('GBP/JPY') - 150 / 0.79) < 1e-9);

const liveHtml = buildTpSl(4000, forexRates, cryptoRates, noStore)({ dir: 'wait', score: 40 }, { ...pastUsd, Date: new Date(Date.now() - 30 * 1000).toISOString() });
assert.match(liveHtml, /Rilis berlangsung/);

const lowImpactHtml = buildTpSl(4000, forexRates, cryptoRates, noStore)({ dir: 'wait', score: 40 }, { ...pastUsd, Importance: 1 });
assert.equal(lowImpactHtml, '');

const staleHtml = buildTpSl(4000, forexRates, cryptoRates, noStore)({ dir: 'wait', score: 40 }, { ...pastUsd, Date: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString() });
assert.match(staleHtml, /kedaluwarsa/);
assert.doesNotMatch(staleHtml, /BUY/);

console.log('Passed post-news per-pair momentum + TP tests');

// Global crypto board: always visible outside event cards.
const boardStart = source.indexOf('id="cryptoBoard"');
const calendarStart = source.indexOf('id="calendar"');
assert.ok(boardStart > -1, 'crypto board section missing');
assert.ok(calendarStart > -1 && boardStart < calendarStart, 'crypto board must render before the calendar');

const cryptoBoardFn = extractFunction('cryptoBoardHtml');
const cryptoBoardHtml = new Function(`${cryptoBoardFn}\nreturn cryptoBoardHtml;`)();

const boardHtml = cryptoBoardHtml(
  { 'BTC/USD': 80934.65, 'ETH/USD': 3200.5 },
  { 'BTC/USD': 1.234, 'ETH/USD': -0.5 }
);
assert.match(boardHtml, /BTC\/USD/);
assert.match(boardHtml, /\$80,934\.65/);
assert.match(boardHtml, /\$3,200\.50/);
assert.match(boardHtml, /▲ \+1\.23% 24h/);
assert.match(boardHtml, /▼ -0\.50% 24h/);
assert.match(boardHtml, /SL\/TP 1% \/ 2%/);
assert.match(boardHtml, /SL\/TP 1\.5% \/ 3%/);

const boardNoChange = cryptoBoardHtml({ 'BTC/USD': 80000, 'ETH/USD': 3000 }, {});
assert.match(boardNoChange, /24h change n\/a/);
assert.doesNotMatch(boardNoChange, /NaN/);

const boardEmpty = cryptoBoardHtml({}, {});
assert.match(boardEmpty, /Menunggu harga crypto/);
assert.doesNotMatch(boardEmpty, /NaN|\$undefined/);

console.log('Passed global crypto board tests');

// Global forex board: always visible outside event cards.
const forexBoardStart = source.indexOf('id="forexBoard"');
assert.ok(forexBoardStart > -1, 'forex board section missing');
assert.ok(forexBoardStart < calendarStart, 'forex board must render before the calendar');

const forexBoardFn = extractFunction('forexBoardHtml');
const brokerLineFn = extractFunction('brokerLineHtml');
const forexBoardHtml = new Function(`const esc = s => String(s ?? '');\n${brokerLineFn}\n${forexBoardFn}\nreturn forexBoardHtml;`)();

const fxBoard = forexBoardHtml({ items: [
  { pair: 'EUR/USD', rate: 1.08696, dir: 'long', eventLabel: 'CPI · Kam 05 Nov 12:00 WITA', note: 'Forecast 4 vs Previous 3.8' },
  { pair: 'USD/JPY', rate: 157.88, dir: 'short', eventLabel: 'NFP · Jum 06 Nov 20:30 WITA', note: 'Forecast 65K vs Previous 29K' },
  { pair: 'USD/CAD', rate: 1.36, dir: null, eventLabel: '' }
] });
assert.match(fxBoard, /EUR\/USD/);
assert.match(fxBoard, /BUY · MARKET/);
assert.match(fxBoard, /Entry 1\.08696/);
assert.match(fxBoard, /USD\/JPY/);
assert.match(fxBoard, /SELL · MARKET/);
assert.match(fxBoard, /Entry 157\.880/);
assert.match(fxBoard, /USD\/CAD/);
assert.match(fxBoard, /WAIT/);
assert.match(fxBoard, /Tidak ada katalis/);
assert.doesNotMatch(fxBoard, /NaN|undefined/);

const fxBoardEmpty = forexBoardHtml({ items: [] });
assert.match(fxBoardEmpty, /Menunggu data forex/);
assert.doesNotMatch(fxBoardEmpty, /NaN|undefined/);

const fxBoardSourced = forexBoardHtml({
  items: [{ pair: 'EUR/USD', rate: 1.12, dir: 'buy' }],
  source: 'Harga acuan OANDA (TradingView live). GO Markets, FBS & CMC Markets: cek quote di terminal broker.'
});
assert.match(fxBoardSourced, /Harga acuan OANDA/);
assert.match(fxBoardSourced, /GO Markets, FBS & CMC Markets/);
assert.doesNotMatch(fxBoardSourced, /NaN|undefined/);

// Exact MT5 broker bid/ask: fresh quotes drive the entry side, stale ones only display.
const brokerQuote = { bid: 1.20010, ask: 1.20030, spreadPips: 2.0, stale: false, ageMin: 2, brokerName: 'FBS Markets Inc.', accountType: 'demo' };
const fxBuyBroker = forexBoardHtml({ items: [{ pair: 'EUR/USD', rate: 1.2, dir: 'long', broker: brokerQuote }] });
assert.match(fxBuyBroker, /Entry 1\.20030/, 'BUY must use the broker ask');
assert.match(fxBuyBroker, /SL 1\.19730/);
assert.match(fxBuyBroker, /TP 1\.20630/);
assert.match(fxBuyBroker, /bid 1\.20010 \/ ask 1\.20030/);
assert.match(fxBuyBroker, /spread 2\.0 pip/);
assert.match(fxBuyBroker, /FBS Markets Inc\. · demo/);
assert.doesNotMatch(fxBuyBroker, /STALE/);

const fxSellBroker = forexBoardHtml({ items: [{ pair: 'EUR/USD', rate: 1.2, dir: 'short', broker: brokerQuote }] });
assert.match(fxSellBroker, /Entry 1\.20010/, 'SELL must use the broker bid');
assert.match(fxSellBroker, /SL 1\.20310/);
assert.match(fxSellBroker, /TP 1\.19410/);

const fxWaitBroker = forexBoardHtml({ items: [{ pair: 'EUR/USD', rate: 1.2, dir: null, broker: brokerQuote }] });
assert.match(fxWaitBroker, /BUY 1\.20030/);
assert.match(fxWaitBroker, /SELL 1\.20010/);

const fxStaleBroker = forexBoardHtml({ items: [{ pair: 'EUR/USD', rate: 1.12345, dir: 'long', broker: { ...brokerQuote, stale: true, ageMin: 47 } }] });
assert.match(fxStaleBroker, /STALE 47 mnt/);
assert.match(fxStaleBroker, /Entry 1\.12345/, 'stale broker quote must not set the entry');
assert.match(fxStaleBroker, /bid 1\.20010 \/ ask 1\.20030/, 'stale quote is still displayed');
assert.doesNotMatch(fxStaleBroker, /NaN|undefined/);

// Broker payload parsing and freshness gate.
const brokerQuoteForFn = extractFunction('brokerQuoteFor');
const brokerQuoteFor = new Function('FOREX_BROKER', 'BROKER_QUOTE_MAX_AGE_MS', `${brokerQuoteForFn}\nreturn brokerQuoteFor;`);
const brokerPayload = {
  generatedAt: '2026-11-04T00:40:00Z',
  broker: { id: 'FBS', name: 'FBS', accountType: 'demo' },
  quotes: { 'EUR/USD': { bid: 1.2001, ask: 1.2003, spreadPips: 2 } }
};
const freshBroker = brokerQuoteFor(brokerPayload, 30 * 60 * 1000)('EUR/USD', Date.parse('2026-11-04T00:55:00Z'));
assert.equal(freshBroker.ask, 1.2003);
assert.equal(freshBroker.stale, false);
assert.equal(freshBroker.accountType, 'demo');
assert.equal(freshBroker.brokerName, 'FBS');
assert.ok(Math.abs(freshBroker.ageMin - 15) < 1e-9);
const staleBroker = brokerQuoteFor(brokerPayload, 30 * 60 * 1000)('EUR/USD', Date.parse('2026-11-04T01:20:00Z'));
assert.equal(staleBroker.stale, true);
const customAgeBroker = brokerQuoteFor({ ...brokerPayload, staleAfterSec: 900 }, 30 * 60 * 1000)('EUR/USD', Date.parse('2026-11-04T00:56:00Z'));
assert.equal(customAgeBroker.stale, true, 'payload staleAfterSec must override the 30 minute default');
const customAgeBrokerFresh = brokerQuoteFor({ ...brokerPayload, staleAfterSec: 1800 }, 30 * 60 * 1000)('EUR/USD', Date.parse('2026-11-04T00:56:00Z'));
assert.equal(customAgeBrokerFresh.stale, false);
assert.equal(brokerQuoteFor({ quotes: { 'EUR/USD': { bid: 0, ask: 1.2 } } }, 30 * 60 * 1000)('EUR/USD', Date.now()), null);
assert.equal(brokerQuoteFor({ quotes: { 'EUR/USD': { bid: 1.2, ask: 1.1 } } }, 30 * 60 * 1000)('EUR/USD', Date.now()), null);
assert.equal(brokerQuoteFor({}, 30 * 60 * 1000)('EUR/USD', Date.now()), null);

const brokerSourceTextFn = extractFunction('brokerSourceText');
const brokerSourceText = new Function('FOREX_BROKER', 'BROKER_QUOTE_MAX_AGE_MS', `${brokerSourceTextFn}\nreturn brokerSourceText;`)(brokerPayload, 30 * 60 * 1000);
assert.match(brokerSourceText(Date.parse('2026-11-04T00:55:00Z')), /Quote broker FBS \(demo\) fresh 15 mnt/);
assert.match(brokerSourceText(Date.parse('2026-11-04T01:20:00Z')), /stale 40 mnt/);

console.log('Passed global forex board tests');

// Global index board: Nasdaq 100 and S&P 500 driven by the USD catalyst.
const indicesBoardStart = source.indexOf('id="indicesBoard"');
assert.ok(indicesBoardStart > -1, 'indices board section missing');
assert.ok(indicesBoardStart < calendarStart, 'indices board must render before the calendar');

const indicesBoardFn = extractFunction('indicesBoardHtml');
const indicesBoardHtml = new Function(`const esc = s => String(s ?? '');\n${indicesBoardFn}\nreturn indicesBoardHtml;`)();

const idxBoard = indicesBoardHtml({
  status: 'active', phase: 'pre', event: 'CPI · Kam 05 Nov 12:00 WITA', note: 'Forecast 3.2 vs Previous 3.0',
  items: [
    { symbol: 'NAS100', name: 'Nasdaq 100', slPct: 1.0, tpPct: 2.0, price: 28180.26, changePct: 0.68, dir: 'short', momPct: null },
    { symbol: 'US500', name: 'S&P 500', slPct: 0.75, tpPct: 1.5, price: 7568.92, changePct: 0.36, dir: null, momPct: null }
  ]
});
assert.match(idxBoard, /NAS100/);
assert.match(idxBoard, /SELL · MARKET/);
assert.match(idxBoard, /Entry 28,180\.26/);
assert.match(idxBoard, /SL 28,462\.06/);
assert.match(idxBoard, /TP 27,616\.65/);
assert.match(idxBoard, /US500/);
assert.match(idxBoard, /WAIT/);
assert.match(idxBoard, /BUY &gt; 7,597\.30/);
assert.match(idxBoard, /SELL &lt; 7,540\.54/);
assert.match(idxBoard, /SL\/TP 1% \/ 2%/);
assert.match(idxBoard, /SL\/TP 0\.75% \/ 1\.5%/);
assert.doesNotMatch(idxBoard, /NaN|undefined/);

const idxBoardNoPrice = indicesBoardHtml({ status: 'loading', items: [{ symbol: 'NAS100', name: 'Nasdaq 100', slPct: 1, tpPct: 2, price: null }] });
assert.match(idxBoardNoPrice, /Menunggu harga index/);
assert.doesNotMatch(idxBoardNoPrice, /NaN|undefined/);

const idxStateFn = extractFunction('indicesBoardState');
const nextUsdCatalystFn = extractFunction('nextUsdCatalyst');
function buildIndicesState(evts, idxRates, now, analyzeBody = "() => ({ dir: 'wait' })", preBiasBody = '() => null', momentumBody = '() => null') {
  const body = `
    const WITA = 'Asia/Makassar';
    const NEWS_SETTLE_MS = 60 * 1000;
    const POST_NEWS_HOLD_MS = 6 * 60 * 60 * 1000;
    const INDICES = [
      { symbol: 'NAS100', name: 'Nasdaq 100', yahoo: '^NDX', slPct: 1.0, tpPct: 2.0 },
      { symbol: 'US500', name: 'S&P 500', yahoo: '^GSPC', slPct: 0.75, tpPct: 1.5 }
    ];
    const countryCode = c => String(c || 'USD').toUpperCase();
    const fmtDate = () => 'Kam 29 Okt';
    const fmtTime = () => '02:00 WITA';
    const postNewsExpiry = e => new Date(new Date(e.Date).getTime() + POST_NEWS_HOLD_MS);
    const newsPhase = e => {
      const t = new Date(e.Date).getTime();
      if (!Number.isFinite(t) || Date.now() < t) return 'pre';
      if (Date.now() < t + NEWS_SETTLE_MS) return 'live';
      return 'post';
    };
    const analyze = ${analyzeBody};
    const preNewsBias = ${preBiasBody};
    const momentumFor = ${momentumBody};
    ${nextUsdCatalystFn}
    ${idxStateFn}
    return indicesBoardState;
  `;
  return new Function('events', 'INDEX_RATES', body)(evts, idxRates)(now);
}

const idxRates = {
  NAS100: { price: 21000, previousClose: 20800, changePct: 0.96 },
  US500: { price: 5800, previousClose: 5760, changePct: 0.69 }
};
const idxNow = Date.now();
const idxFutureUsd = { Date: new Date(idxNow + 60 * 60 * 1000).toISOString(), Event: 'CPI', Country: 'USD', Importance: 3, Forecast: '3.2%', Previous: '3.0%' };
const idxPastUsd = { ...idxFutureUsd, Date: new Date(idxNow - 60 * 60 * 1000).toISOString() };

const idxPreState = buildIndicesState([idxFutureUsd], idxRates, idxNow, "() => ({ dir: 'wait' })", "() => ({ dir: 'short', forecast: 3.2, previous: 3.0 })");
assert.equal(idxPreState.status, 'active');
assert.equal(idxPreState.phase, 'pre');
assert.deepEqual(idxPreState.items.map(x => x.dir), ['short', 'short']);
assert.ok(/Forecast 3\.2 vs Previous 3/.test(idxPreState.note));

const idxWaitState = buildIndicesState([idxFutureUsd], idxRates, idxNow);
assert.deepEqual(idxWaitState.items.map(x => x.dir), [null, null]);

const idxPostDirected = buildIndicesState([idxPastUsd], idxRates, idxNow, "() => ({ dir: 'long' })");
assert.deepEqual(idxPostDirected.items.map(x => x.dir), ['long', 'long']);

const idxPostMomentum = buildIndicesState([idxPastUsd], idxRates, idxNow, "() => ({ dir: 'wait' })", '() => null', "(e, kind, symbol) => symbol === 'NAS100' ? { dir: 'long', changePct: 0.42 } : { dir: 'short', changePct: -0.21 }");
assert.deepEqual(idxPostMomentum.items.map(x => x.dir), ['long', 'short']);
assert.equal(idxPostMomentum.items[0].momPct, 0.42);
assert.equal(idxPostMomentum.items[1].momPct, -0.21);

const idxIdle = buildIndicesState([{ ...idxFutureUsd, Country: 'EUR' }], idxRates, idxNow);
assert.equal(idxIdle.status, 'idle');

const idxLive = buildIndicesState([{ ...idxPastUsd, Date: new Date(idxNow - 30 * 1000).toISOString() }], idxRates, idxNow);
assert.equal(idxLive.status, 'live');

const idxNoPrice = buildIndicesState([idxFutureUsd], {}, idxNow);
assert.ok(idxNoPrice.items.every(x => !Number.isFinite(x.price)));

console.log('Passed global index board tests');

// Global gold board: always visible outside event cards.
const goldStart = source.indexOf('id="goldBoard"');
assert.ok(goldStart > -1, 'gold board section missing');
assert.ok(goldStart < calendarStart, 'gold board must render before the calendar');

const goldBoardFn = extractFunction('goldBoardHtml');
const goldBoardHtml = new Function(`${goldBoardFn}\nreturn goldBoardHtml;`)();

const goldPre = goldBoardHtml(4042.4, {
  status: 'pre',
  event: 'FOMC · Kam 29 Okt 02:00 WITA',
  buy: { entry: 4048.46, sl: 4036.34, tp: 4072.72 },
  sell: { entry: 4036.34, sl: 4048.46, tp: 4012.06 }
});
assert.match(goldPre, /\$4,042\.40/);
assert.match(goldPre, /FOMC/);
assert.match(goldPre, /BUY STOP/);
assert.match(goldPre, /SELL STOP/);
assert.match(goldPre, /Entry 4048\.46/);
assert.match(goldPre, /SL 4036\.34/);
assert.match(goldPre, /TP 4072\.72/);
assert.match(goldPre, /Straddle OCO/);

const goldPostLong = goldBoardHtml(4042.4, {
  status: 'post', event: 'FOMC', dir: 'long', changePct: 0.42, validUntil: 'Kam 29 Okt 10:00 WITA',
  levels: { entry: 4042.4, sl: 4022.19, tp: 4082.82 }
});
assert.match(goldPostLong, /BUY • momentum \+0\.42%/);
assert.match(goldPostLong, /Entry 4042\.40/);
assert.match(goldPostLong, /SL 4022\.19/);
assert.match(goldPostLong, /TP 4082\.82/);
assert.match(goldPostLong, /valid s\/d Kam 29 Okt 10:00 WITA/);
assert.doesNotMatch(goldPostLong, /SELL/);

const goldPostShort = goldBoardHtml(4000, {
  status: 'post', event: 'CPI', dir: 'short',
  levels: { entry: 4000, sl: 4020, tp: 3960 }
});
assert.match(goldPostShort, /SELL/);
assert.doesNotMatch(goldPostShort, /• momentum/);
assert.doesNotMatch(goldPostShort, /NaN/);

const goldBreakout = goldBoardHtml(4000, {
  status: 'post', dir: null, validUntil: 'x',
  buy: { entry: 4010, sl: 3995, tp: 4040 },
  sell: { entry: 3990, sl: 4005, tp: 3960 }
});
assert.match(goldBreakout, /BUY BREAKOUT/);
assert.match(goldBreakout, /SELL BREAKOUT/);
assert.match(goldBreakout, /Post-news breakout OCO/);

assert.match(goldBoardHtml(4000, { status: 'live', event: 'FOMC' }), /Rilis berlangsung/);

const goldIdle = goldBoardHtml(4000, { status: 'idle', next: 'FOMC · Kam 29 Okt 02:00 WITA' });
assert.match(goldIdle, /Tidak ada katalis USD aktif/);
assert.match(goldIdle, /Berikutnya: FOMC/);

const goldNoPrice = goldBoardHtml(null, { status: 'loading' });
assert.match(goldNoPrice, /—/);
assert.match(goldNoPrice, /Menunggu harga gold live/);
assert.doesNotMatch(goldNoPrice, /NaN|\$undefined/);

// Gold board state picks the right phase and levels.
const stateFn = extractFunction('goldBoardState');
function buildGoldState(evts, price, now, analyzeBody = "() => ({ dir: 'wait' })", momentumBody = '() => null') {
  const body = `
    const WITA = 'Asia/Makassar';
    const NEWS_SETTLE_MS = 60 * 1000;
    const POST_NEWS_HOLD_MS = 6 * 60 * 60 * 1000;
    const countryCode = c => String(c || 'USD').toUpperCase();
    const esc = s => String(s);
    const fmtDate = () => 'Kam 29 Okt';
    const fmtTime = () => '02:00 WITA';
    const postNewsExpiry = e => new Date(new Date(e.Date).getTime() + POST_NEWS_HOLD_MS);
    const analyze = ${analyzeBody};
    const momentumFor = ${momentumBody};
    ${stateFn}
    return goldBoardState;
  `;
  return new Function('events', 'LIVE_PRICE', body)(evts, price)(now);
}

const now = Date.now();
const usdFuture = { Date: new Date(now + 60 * 60 * 1000).toISOString(), Event: 'FOMC', Country: 'USD', Importance: 3 };
const usdPast = { Date: new Date(now - 60 * 60 * 1000).toISOString(), Event: 'CPI', Country: 'USD', Importance: 3 };
const usdStale = { Date: new Date(now - 7 * 60 * 60 * 1000).toISOString(), Event: 'NFP', Country: 'USD', Importance: 3 };
const audFuture = { Date: new Date(now + 60 * 60 * 1000).toISOString(), Event: 'CPI m/m', Country: 'AUD', Importance: 3 };

const preState = buildGoldState([usdFuture], 4000, now);
assert.equal(preState.status, 'pre');
assert.ok(Math.abs(preState.buy.entry - 4006) < 1e-9);
assert.ok(Math.abs(preState.buy.sl - 3994) < 1e-9);
assert.ok(Math.abs(preState.buy.tp - 4030) < 1e-9);
assert.ok(Math.abs(preState.sell.entry - 3994) < 1e-9);
assert.ok(Math.abs(preState.sell.tp - 3970) < 1e-9);

const postBreakout = buildGoldState([usdPast], 4000, now);
assert.equal(postBreakout.status, 'post');
assert.equal(postBreakout.dir, null);
assert.ok(Math.abs(postBreakout.buy.entry - 4010) < 1e-9);
assert.ok(Math.abs(postBreakout.buy.sl - 3995) < 1e-9);
assert.ok(Math.abs(postBreakout.buy.tp - 4040) < 1e-9);

const postDirected = buildGoldState([usdPast], 4000, now, "() => ({ dir: 'short' })");
assert.equal(postDirected.status, 'post');
assert.equal(postDirected.dir, 'short');
assert.ok(Math.abs(postDirected.levels.sl - 4020) < 1e-9);
assert.ok(Math.abs(postDirected.levels.tp - 3960) < 1e-9);

const postMomentum = buildGoldState([usdPast], 4000, now, "() => ({ dir: 'wait' })", "() => ({ dir: 'long', changePct: 0.35 })");
assert.equal(postMomentum.dir, 'long');
assert.equal(postMomentum.changePct, 0.35);

const staleState = buildGoldState([usdStale], 4000, now);
assert.equal(staleState.status, 'idle');
assert.equal(staleState.next, '');

const audOnlyState = buildGoldState([audFuture], 4000, now);
assert.equal(audOnlyState.status, 'idle');
assert.equal(audOnlyState.next, '');

const liveState = buildGoldState([{ ...usdPast, Date: new Date(now - 30 * 1000).toISOString() }], 4000, now);
assert.equal(liveState.status, 'live');

const noPriceState = buildGoldState([usdFuture], null, now);
assert.equal(noPriceState.status, 'loading');

console.log('Passed global gold board tests');


