import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const PRE_NEWS_FILE = 'data/prenews.json';
const PRE_NEWS_HOLD_MS = 7 * 24 * 60 * 60 * 1000;
const PRE_NEWS_WINDOW_MS = 2 * 60 * 60 * 1000;
const FOREX_SYMBOLS = ['EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD'];
const FOREX_PAIRS = [
  ['EUR/USD', 'EURUSD'],
  ['GBP/USD', 'GBPUSD'],
  ['USD/JPY', 'USDJPY'],
  ['USD/CHF', 'USDCHF'],
  ['AUD/USD', 'AUDUSD'],
  ['USD/CAD', 'USDCAD'],
  ['GBP/JPY', 'GBPJPY'],
  ['EUR/JPY', 'EURJPY']
];

// OANDA adalah anchor harga live. Broker lain dipakai sebagai cross-check.
// GO Markets, FBS dan CMC Markets tidak membuka endpoint quote publik, jadi
// ketiganya tetap dicoba (kalau feed-nya tersedia) dan statusnya dilaporkan.
export const FOREX_FEEDS = [
  { id: 'OANDA', name: 'OANDA', prefix: 'OANDA' },
  { id: 'GOMARKETS', name: 'GO Markets', prefix: 'GOMARKETS' },
  { id: 'CMCMARKETS', name: 'CMC Markets', prefix: 'CMCMARKETS' },
  { id: 'FBS', name: 'FBS', prefix: 'FBS' },
  { id: 'SAXO', name: 'Saxo', prefix: 'SAXO' },
  { id: 'FOREXCOM', name: 'FOREX.com', prefix: 'FOREXCOM' },
  { id: 'CAPITALCOM', name: 'Capital.com', prefix: 'CAPITALCOM' },
  { id: 'PEPPERSTONE', name: 'Pepperstone', prefix: 'PEPPERSTONE' },
  { id: 'VANTAGE', name: 'Vantage', prefix: 'VANTAGE' },
  { id: 'FPMARKETS', name: 'FP Markets', prefix: 'FPMARKETS' },
  { id: 'EIGHTCAP', name: 'Eightcap', prefix: 'EIGHTCAP' },
  { id: 'BLACKBULL', name: 'BlackBull Markets', prefix: 'BLACKBULL' },
  { id: 'THINKMARKETS', name: 'ThinkMarkets', prefix: 'THINKMARKETS' },
  { id: 'SKILLING', name: 'Skilling', prefix: 'SKILLING' }
];
const INDICES = [
  { symbol: 'NAS100', name: 'Nasdaq 100', yahoo: '^NDX' },
  { symbol: 'US500', name: 'S&P 500', yahoo: '^GSPC' }
];

function normalizeMarket(market) {
  if (market && typeof market === 'object') {
    const gold = Number(market.price ?? market.gold);
    return {
      gold: Number.isFinite(gold) && gold > 0 ? gold : null,
      forex: market.forex && typeof market.forex === 'object' ? market.forex : null,
      crypto: market.crypto && typeof market.crypto === 'object' ? market.crypto : null,
      indices: market.indices && typeof market.indices === 'object' ? market.indices : null
    };
  }
  const gold = Number(market);
  return { gold: Number.isFinite(gold) && gold > 0 ? gold : null, forex: null, crypto: null, indices: null };
}

export function updatePreNewsStore(store, events, market, now = Date.now()) {
  const next = {};
  for (const [key, entry] of Object.entries(store || {})) {
    const capturedAt = entry && typeof entry === 'object' ? entry.capturedAt : null;
    const t = new Date(capturedAt || key.split('|')[0]).getTime();
    if (Number.isFinite(t) && now - t <= PRE_NEWS_HOLD_MS) next[key] = entry;
  }

  const { gold, forex, crypto, indices } = normalizeMarket(market);
  const hasPrices = gold != null || (forex && Object.keys(forex).length) || (crypto && Object.keys(crypto).length) || (indices && Object.keys(indices).length);
  if (!hasPrices) return next;

  for (const ev of events || []) {
    if (Number(ev.Importance) < 2) continue;
    const t = new Date(ev.Date).getTime();
    if (!Number.isFinite(t) || t <= now || t - now > PRE_NEWS_WINDOW_MS) continue;
    const key = `${ev.Date}|${ev.Event}`;
    const prevRaw = next[key] && typeof next[key] === 'object' ? next[key] : {};
    const prev = { ...prevRaw };
    if (prev.gold == null && prev.price != null) prev.gold = Number(prev.price);
    delete prev.price;
    const snap = { ...prev, capturedAt: new Date(now).toISOString() };
    if (gold != null) snap.gold = gold;
    if (forex) snap.forex = { ...(prev.forex || {}), ...forex };
    if (crypto) snap.crypto = { ...(prev.crypto || {}), ...crypto };
    if (indices) snap.indices = { ...(prev.indices || {}), ...indices };
    next[key] = snap;
  }
  return next;
}

async function readPreNews() {
  try {
    return JSON.parse(await fs.readFile(PRE_NEWS_FILE, 'utf8')) || {};
  } catch {
    return {};
  }
}

// 1. AMBIL DATA KALENDER (ForexFactory)
async function fetchCalendar() {
  const urls = [
    'https://nfs.faireconomy.media/ff_calendar_thisweek.json',
    'https://nfs.faireconomy.media/ff_calendar_nextweek.json'
  ];
  
  const batches = await Promise.all(urls.map(async u => {
    try {
      const r = await fetch(u, { headers: { 'user-agent': 'Mozilla/5.0' } });
      return r.ok ? await r.json() : [];
    } catch { return []; }
  }));

  const rank = { Low: 1, Medium: 2, High: 3 };
  
  // FILTER KANADA & MINYAK/ENERGI DITAMBAHKAN DI SINI
  const keywords = /fed|fomc|interest rate|inflation|cpi|pce|payroll|employment|unemployment|jobless|gdp|pmi|ism|retail sales|consumer confidence|jolts|durable goods|powell|treasury|oil|crude|energy|gas|opec|eia|rig|inventories|distillate|gasoline/i;
  const allowedCountries = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'NZD', 'CAD'];

  const events = batches.flat()
    .filter(e => allowedCountries.includes(String(e.country || '').toUpperCase()) && keywords.test(e.title || ''))
    .map(e => ({
      Date: e.date,
      Event: e.title,
      Country: e.country,
      Importance: rank[e.impact] || 1,
      Forecast: e.forecast || '',
      Previous: e.previous || '',
      Actual: e.actual || ''
    }));

  await fs.writeFile('data/calendar.json', JSON.stringify(events, null, 2));
  console.log('Berhasil menyimpan calendar.json dengan', events.length, 'berita.');
  return events;
}

// 2. AMBIL HARGA EMAS (Gold API)
async function fetchMarket() {
  try {
    const r = await fetch('https://api.gold-api.com/price/XAU');
    const j = await r.json();
    const price = Number(j.price);
    if (price > 0) {
      await fs.writeFile('data/market.json', JSON.stringify({
        generatedAt: new Date().toISOString(),
        symbol: "XAU/USD",
        price: String(price),
        change: "",
        percentChange: "",
        previousClose: ""
      }, null, 2));
      console.log('Berhasil menyimpan market.json dengan harga', price);
      return price;
    }
  } catch (e) {
    console.error('Gagal mengambil harga emas', e);
  }
  return null;
}

export function parseTradingViewForex(payload) {
  const feeds = {};
  const rows = payload && Array.isArray(payload.data) ? payload.data : [];
  for (const row of rows) {
    const [feed, symbol] = String(row && row.s || '').split(':');
    if (!feed || !symbol) continue;
    if (!FOREX_FEEDS.some(f => f.id === feed)) continue;
    const pair = FOREX_PAIRS.find(([, s]) => s === symbol);
    if (!pair) continue;
    const price = Number(row.d && row.d[1]);
    if (!Number.isFinite(price) || price <= 0) continue;
    const change = Number(row.d && row.d[2]);
    (feeds[feed] ||= {})[pair[0]] = {
      price,
      changePct: Number.isFinite(change) ? change : null
    };
  }
  return feeds;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function ratesFromQuotes(quotes) {
  const rates = { USD: 1 };
  for (const [pair, quote] of Object.entries(quotes || {})) {
    const price = Number(quote && quote.price);
    if (!Number.isFinite(price) || price <= 0) continue;
    const [base, term] = pair.split('/');
    if (!base || !term) continue;
    if (term === 'USD' && base !== 'USD') rates[base] = 1 / price;
    else if (base === 'USD' && term !== 'USD') rates[term] = price;
  }
  return rates;
}

export function buildForexPayload(feeds, now = new Date()) {
  const quotes = {};
  for (const [pair] of FOREX_PAIRS) {
    const prices = [];
    const providers = {};
    for (const feed of FOREX_FEEDS) {
      const quote = feeds && feeds[feed.id] && feeds[feed.id][pair];
      const price = Number(quote && quote.price);
      if (!Number.isFinite(price) || price <= 0) continue;
      providers[feed.id] = price;
      prices.push(price);
    }
    if (!prices.length) continue;

    const oanda = Number(feeds && feeds.OANDA && feeds.OANDA[pair] && feeds.OANDA[pair].price);
    const primary = Number.isFinite(oanda) && oanda > 0;
    const anchor = primary ? oanda : median(prices);
    const references = prices.filter(p => Math.abs(p - anchor) > 1e-12);
    const crossCheckPct = references.length
      ? Math.max(...references.map(p => (Math.abs(p - anchor) / anchor) * 100))
      : 0;
    const change = feeds && feeds.OANDA && feeds.OANDA[pair] && feeds.OANDA[pair].changePct;

    quotes[pair] = {
      price: anchor,
      consensus: median(prices),
      source: primary ? 'OANDA' : 'broker consensus',
      changePct: Number.isFinite(Number(change)) ? Number(change) : null,
      crossCheckPct: Number(crossCheckPct.toFixed(3)),
      providers,
      updatedAt: now.toISOString()
    };
  }

  const providers = {};
  for (const feed of FOREX_FEEDS) {
    const count = feeds && feeds[feed.id] ? Object.keys(feeds[feed.id]).length : 0;
    providers[feed.id] = {
      name: feed.name,
      status: count > 0 ? 'ok' : 'unavailable',
      pairs: count
    };
  }

  return {
    generatedAt: now.toISOString(),
    source: 'OANDA (TradingView live)',
    anchor: 'OANDA',
    quotes,
    rates: ratesFromQuotes(quotes),
    providers
  };
}

async function fetchTradingViewForex() {
  const tickers = [];
  for (const feed of FOREX_FEEDS) {
    for (const [, symbol] of FOREX_PAIRS) tickers.push(`${feed.prefix}:${symbol}`);
  }
  const r = await fetch('https://scanner.tradingview.com/forex/scan', {
    method: 'POST',
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'content-type': 'application/json',
      origin: 'https://www.tradingview.com',
      referer: 'https://www.tradingview.com/'
    },
    body: JSON.stringify({
      symbols: { tickers },
      columns: ['name', 'close', 'change', 'update_mode']
    })
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return parseTradingViewForex(await r.json());
}

async function fetchForex() {
  try {
    const feeds = await fetchTradingViewForex();
    const payload = buildForexPayload(feeds);
    if (!Object.keys(payload.quotes).length) throw new Error('quote kosong');
    await fs.writeFile('data/forex.json', JSON.stringify(payload, null, 2));
    console.log('Berhasil menyimpan forex.json:', Object.entries(payload.quotes)
      .map(([pair, q]) => `${pair}=${q.price}`)
      .join(', '));
    return payload;
  } catch (e) {
    console.error('Gagal mengambil harga forex live (TradingView/OANDA)', e.message || e);
  }

  // Fallback terakhir: kurs harian er-api. Client akan memberi label "harian".
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/USD');
    const j = await r.json();
    const sourceRates = j && j.rates;
    if (!sourceRates) return null;
    const rates = { USD: 1 };
    for (const s of FOREX_SYMBOLS) {
      const v = Number(sourceRates[s]);
      if (Number.isFinite(v) && v > 0) rates[s] = v;
    }
    if (Object.keys(rates).length < 2) return null;
    const payload = {
      generatedAt: new Date().toISOString(),
      source: 'er-api (daily fallback)',
      anchor: 'er-api',
      quotes: {},
      rates,
      providers: {
        'er-api': { name: 'open.er-api.com', status: 'fallback', pairs: Object.keys(rates).length - 1 }
      }
    };
    await fs.writeFile('data/forex.json', JSON.stringify(payload, null, 2));
    console.log('forex.json memakai fallback kurs harian er-api');
    return payload;
  } catch (e) {
    console.error('Gagal mengambil kurs forex fallback', e);
    return null;
  }
}

async function fetchCrypto() {
  try {
    const r = await fetch('https://api.binance.com/api/v3/ticker/price?symbols=["BTCUSDT","ETHUSDT"]');
    const j = await r.json();
    if (Array.isArray(j)) {
      const btc = j.find(x => x.symbol === 'BTCUSDT');
      const eth = j.find(x => x.symbol === 'ETHUSDT');
      const out = { 'BTC/USD': Number(btc && btc.price), 'ETH/USD': Number(eth && eth.price) };
      if (out['BTC/USD'] > 0 && out['ETH/USD'] > 0) return out;
    }
  } catch (e) {
    console.error('Binance crypto gagal', e);
  }
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd');
    const j = await r.json();
    const out = { 'BTC/USD': Number(j.bitcoin && j.bitcoin.usd), 'ETH/USD': Number(j.ethereum && j.ethereum.usd) };
    if (out['BTC/USD'] > 0 && out['ETH/USD'] > 0) return out;
  } catch (e) {
    console.error('CoinGecko crypto gagal', e);
  }
  return null;
}

async function fetchIndices() {
  const items = [];
  for (const cfg of INDICES) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(cfg.yahoo)}?interval=1m&range=1d`;
      const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      const meta = j && j.chart && j.chart.result && j.chart.result[0] && j.chart.result[0].meta;
      if (!meta) throw new Error('meta missing');
      const price = Number(meta.regularMarketPrice);
      const previousClose = Number(meta.chartPreviousClose ?? meta.previousClose);
      if (!Number.isFinite(price) || price <= 0) throw new Error('price missing');
      items.push({
        symbol: cfg.symbol,
        name: cfg.name,
        yahoo: cfg.yahoo,
        price,
        previousClose: Number.isFinite(previousClose) && previousClose > 0 ? previousClose : null,
        changePct: Number.isFinite(previousClose) && previousClose > 0
          ? Number((((price - previousClose) / previousClose) * 100).toFixed(2))
          : null
      });
    } catch (e) {
      console.error('Gagal mengambil index', cfg.symbol, e.message || e);
    }
  }
  if (!items.length) return null;
  await fs.writeFile('data/indices.json', JSON.stringify({
    generatedAt: new Date().toISOString(),
    items
  }, null, 2));
  console.log('Berhasil menyimpan indices.json:', items.map(x => `${x.symbol}=${x.price}`).join(', '));
  return items;
}

export async function main() {
  const events = await fetchCalendar();
  const [price, forexData, crypto, indices] = await Promise.all([fetchMarket(), fetchForex(), fetchCrypto(), fetchIndices()]);
  const forex = forexData && forexData.rates;
  const indexPrices = indices
    ? Object.fromEntries(indices.map(x => [x.symbol, x.price]))
    : null;
  const store = updatePreNewsStore(await readPreNews(), events, { price, forex, crypto, indices: indexPrices });
  await fs.writeFile(PRE_NEWS_FILE, JSON.stringify(store, null, 2));
  console.log('Snapshot harga pra-news tersimpan:', Object.keys(store).length, 'event.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
