import assert from 'node:assert/strict';
import {
  eventIsoHint,
  titleKey,
  mergedActual,
  buildActualIndex,
  mergeActuals,
  fetchTradingViewActuals,
  reactionFromBars,
  buildReactionPayload
} from '../scripts/fetch-calendar.mjs';

const RELEASE_ISO = '2026-11-04T08:00:00.000Z';
const NOW = Date.parse(RELEASE_ISO) + 40 * 60 * 1000;

const ff = (over = {}) => ({
  Date: '2026-11-04T03:00:00-05:00',
  Event: 'Spanish Services PMI',
  Country: 'EUR',
  Importance: 1,
  Forecast: '57.6',
  Previous: '58.3',
  Actual: '',
  ...over
});
const tv = (over = {}) => ({
  title: 'S&P Global Services PMI',
  country: 'ES',
  currency: 'EUR',
  date: RELEASE_ISO,
  importance: 1,
  previous: '58.3',
  forecast: '57.6',
  actual: '57.1',
  ...over
});

// Title normalisation must bridge ForexFactory ("Spanish …") and TradingView ("Spain …").
assert.equal(eventIsoHint('Spanish Services PMI'), 'ES');
assert.equal(eventIsoHint('Retail Sales m/m'), '');
assert.equal(titleKey('S&P Global Spain Services PMI'), titleKey('Spanish Services PMI'));
assert.equal(titleKey('Germany Manufacturing PMI'), titleKey('German Manufacturing PMI'));

// (a) Different wording, same release -> matched and filled.
{
  const { events, stats } = mergeActuals([ff()], [tv()], NOW);
  assert.equal(stats.matched, 1, JSON.stringify(stats));
  assert.equal(events[0].Actual, '57.1');
}

// Future events never receive an Actual, even when a source already carries a number.
{
  const future = ff({ Date: '2026-11-06T03:00:00-05:00' });
  const { events, stats } = mergeActuals([future], [tv({ date: '2026-11-06T08:00:00Z' })], NOW);
  assert.equal(stats.matched, 0);
  assert.equal(events[0].Actual, '');
}

// (b) Same currency, same minute, two series: the reference value breaks the tie.
{
  const event = ff({ Event: 'French Consumer Confidence', Forecast: '', Previous: '97.0' });
  const a = tv({ title: 'French Consumer Confidence', country: 'FR', previous: '97.0', actual: '98.4' });
  const b = tv({ title: 'French Consumer Confidence', country: 'FR', previous: '101.3', actual: '99.1' });
  const { events, stats } = mergeActuals([event], [b, a], NOW);
  assert.equal(stats.ambiguous, 0);
  assert.equal(events[0].Actual, '98.4');
}

// Two equally scored candidates with different numbers must not be guessed.
{
  const event = ff({ Event: 'French Consumer Confidence', Forecast: '', Previous: '97.0' });
  const a = tv({ title: 'French Consumer Confidence', country: 'FR', previous: '97.0', actual: '98.4' });
  const b = tv({ title: 'French Consumer Confidence', country: 'FR', previous: '97.0', actual: '99.1' });
  const { events, stats } = mergeActuals([event], [a, b], NOW);
  assert.equal(stats.ambiguous, 1);
  assert.equal(events[0].Actual, '');
}

// A neighbouring country with a near-identical title must never leak into the calendar.
{
  const event = ff({ Event: 'German Services PMI', Forecast: '56.1', Previous: '57.0', Actual: '' });
  const { events, stats } = mergeActuals([event], [tv({ title: 'French Services PMI', country: 'FR', actual: '59.9', previous: '58.0' })], NOW);
  assert.equal(stats.matched, 0);
  assert.equal(events[0].Actual, '');
}

// (c) Only blank Actual fields are written; ForexFactory values win.
{
  const filled = ff({ Actual: '55.5' });
  const { events, stats } = mergeActuals([filled], [tv({ actual: '57.1' })], NOW);
  assert.equal(stats.filled, 0);
  assert.equal(events[0].Actual, '55.5');
}

// (d) Percent suffix from ForexFactory is re-applied to the TradingView number.
{
  const event = ff({ Event: 'Spanish Services PMI', Forecast: '2.5%', Previous: '2.4%', Actual: '' });
  const candidate = tv({ previous: '2.4%', actual: '2.6' });
  const { events } = mergeActuals([event], [candidate], NOW);
  assert.equal(events[0].Actual, '2.6%');
}

// (e) Unit trap: TradingView publishes thousands while ForexFactory prints full numbers.
{
  const event = ff({ Event: 'Austrian Unemployed persons', Country: 'EUR', Forecast: '', Previous: '306600' });
  const candidate = tv({ title: 'Austrian Unemployed persons', country: 'AT', previous: '306.6', forecast: '', actual: '314.5' });
  const { events } = mergeActuals([event], [candidate], NOW);
  assert.equal(events[0].Actual, '314500');
}

// Garbage scaling (no reference agreement) is rejected instead of written.
{
  const event = ff({ Event: 'Austrian Unemployed persons', Forecast: '', Previous: '306600' });
  const candidate = buildActualIndex([tv({ title: 'Austrian Unemployed persons', country: 'AT', previous: '7.7', forecast: '', actual: '314.5' })]).all[0];
  assert.equal(mergedActual(event, candidate), '');
}

// A candidate without any reference number cannot prove a 10^n scale, so it is refused.
{
  const event = ff({ Event: 'Austrian Unemployed persons', Forecast: '', Previous: '306600' });
  const candidate = buildActualIndex([tv({ title: 'Austrian Unemployed persons', country: 'AT', previous: '', forecast: '', actual: '314.5' })]).all[0];
  assert.equal(mergedActual(event, candidate), '');
}

// (f) More than five minutes of drift is a different release.
{
  const { events, stats } = mergeActuals([ff()], [tv({ date: '2026-11-04T08:07:00Z' })], NOW);
  assert.equal(stats.matched, 0);
  assert.equal(events[0].Actual, '');
}

// buildActualIndex ignores rows without an actual value.
{
  const index = buildActualIndex([tv(), tv({ actual: '' }), tv({ actual: null })]);
  assert.equal(index.all.length, 1);
}

// fetchTradingViewActuals must never throw: the cron job keeps the old calendar.
async function expectEmpty(fetchImpl, mustLog = true) {
  const errors = [];
  const original = console.error;
  console.error = (...a) => errors.push(a.join(' '));
  try {
    const rows = await fetchTradingViewActuals(Date.parse(RELEASE_ISO), Date.parse(RELEASE_ISO) + 3600 * 1000, { fetchImpl });
    assert.deepEqual(rows, []);
  } finally {
    console.error = original;
  }
  if (mustLog) assert.ok(errors.length, 'failure must be logged');
  return errors;
}

await expectEmpty(async () => ({ ok: false, status: 403, json: async () => ({}) }));
await expectEmpty(async () => { throw new Error('socket hang up'); });
await expectEmpty(async () => ({ ok: true, status: 200, json: async () => 'not-an-object' }));
{
  const errors = [];
  const original = console.error;
  console.error = (...a) => errors.push(a.join(' '));
  const rows = await fetchTradingViewActuals(
    Date.parse(RELEASE_ISO),
    Date.parse(RELEASE_ISO) + 3600 * 1000,
    { fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ total: 1, result: [tv()] }) }) }
  );
  console.error = original;
  assert.equal(rows.length, 1);
  assert.equal(errors.length, 0);
}

// ---- Reaksi harga dari bar 1 menit --------------------------------------------
// markets.json menyimpan bar per menit dengan `k` = menit unix.
const RELEASE_MS = Date.parse(RELEASE_ISO);
const barSeries = points => points.map(([minute, close]) => ({ k: Math.round((RELEASE_MS + minute * 60000) / 60000), c: close }));
{
  const reaction = reactionFromBars(barSeries([[-20, 1.1240], [-2, 1.1242], [16, 1.1256], [45, 1.1260]]), RELEASE_MS);
  assert.ok(reaction, 'closing bars across the release must produce a reaction');
  assert.equal(reaction.baseClose, 1.1242);
  assert.equal(reaction.dir, 'long');
  assert.ok(reaction.movePct > 0.03);
  assert.equal(reaction.minutes, 45);

  // Nothing inside the settle window yet -> no measurement.
  assert.equal(reactionFromBars(barSeries([[-20, 1.1240], [-2, 1.1242], [5, 1.1250]]), RELEASE_MS), null);
  // No bar before the release -> nothing to compare against.
  assert.equal(reactionFromBars(barSeries([[20, 1.1250], [40, 1.1260]]), RELEASE_MS), null);
  // Pre-release close too old to be the reference price.
  assert.equal(reactionFromBars(barSeries([[-40, 1.1240], [20, 1.1260]]), RELEASE_MS), null);
  // Movement below the noise floor -> measured but undirected.
  const flat = reactionFromBars(barSeries([[-2, 1.1240], [20, 1.12405]]), RELEASE_MS);
  assert.ok(flat);
  assert.equal(flat.dir, null);
  // Down-move.
  assert.equal(reactionFromBars(barSeries([[-2, 1.1242], [30, 1.1220]]), RELEASE_MS).dir, 'short');
}

// buildReactionPayload keys reactions by Date|Event, the same key the page uses.
{
  const bars = barSeries([[-20, 1.1240], [-2, 1.1242], [16, 1.1256], [45, 1.1260]]);
  const payload = buildReactionPayload(
    [ff(), ff({ Event: 'Belanda Services PMI', Date: new Date(RELEASE_MS + 3 * 24 * 3600 * 1000).toISOString() })],
    { pairs: { 'EUR/USD': { bars } } },
    NOW
  );
  const keys = Object.keys(payload.events);
  assert.deepEqual(keys, ['2026-11-04T03:00:00-05:00|Spanish Services PMI']);
  assert.equal(payload.events[keys[0]].pairs['EUR/USD'].dir, 'long');
  assert.equal(buildReactionPayload([ff()], {}, NOW).generatedAt, null);
}

console.log('Passed calendar actual-backfill + price reaction tests');
