# Feriha Intelligence

<p align="center">
  <a href="[https://MarketForgeX.github.io/xauusd-ai-terminal]" target="_blank" rel="noopener noreferrer"><strong>🚀 CHECK LIVE TERMINAL</strong></a>
</p>

## Publish

1. Copy these files to the repository root and push.
2. Regenerate the exposed Twelve Data key, then add the new key in GitHub Actions secrets as `TWELVE_DATA_API_KEY`.
3. Run the `Update live economic calendar` workflow once.
4. Enable GitHub Pages from `main` and `/ (root)`.

The calendar uses Forex Factory's free public weekly export; no calendar key is required. The workflow merges each refresh into the current month and updates XAU/USD price every 15 minutes. All displayed times use Waktu Indonesia Tengah (`Asia/Makassar`, UTC+8). Never put the private API key in public HTML. LONG/SHORT is scenario analysis, not a prediction.

## Forex majors, JPY crosses & indices pre-news BUY/SELL

The terminal has an always-visible **Forex Majors & JPY Crosses** board for EUR/USD, GBP/USD, USD/JPY, USD/CHF, AUD/USD, USD/CAD, GBP/JPY and EUR/JPY under the gold/crypto boards. Before each medium/high-impact release it shows an explicit **BUY · MARKET** or **SELL · MARKET** entry with Entry/SL/TP (30/60 pips, 1:2 RR). The direction comes from the event's Forecast vs Previous using the same economic mapping as the gold bias:

- Higher US inflation/payrolls → USD stronger → SELL EUR/USD, GBP/USD, AUD/USD; BUY USD/JPY, USD/CHF, USD/CAD.
- Higher non-US inflation/employment → that currency stronger → BUY its XXX/USD pair; SELL its USD/XXX pair.
- Higher US jobless claims/unemployment → USD weaker → BUY XXX/USD; SELL USD/XXX.
- For crosses, the event currency decides the leg: GBP/JPY follows GBP news directly and JPY news inversely; EUR/JPY follows EUR directly and JPY inversely. A USD event is treated as risk-on/off.
- If Forecast equals Previous, the board borrows the nearest same-currency medium/high event within 6 hours; otherwise it shows **WAIT** with straddle levels.

The **Nasdaq 100 & S&P 500** board (`NAS100`, `US500`) follows the same USD catalyst: BUY means risk-on/stronger index, SELL means risk-off/weaker index. Risk template is NAS100 1%/2% and US500 0.75%/1.5%. Prices come from Yahoo Finance via `data/indices.json` (refreshed by GitHub Actions), with a live CORS-proxy fallback in the browser.

Event cards also show the pre-news market bias for affected forex majors, crosses and indices, and the card's signal badge changes from WAIT to BUY/SELL. This is an execution scenario, not a guarantee: wait for the release if the forecast edge is flat.

## Auto order grid (forex major)

`scripts/mt5_grid_hft.py` is a breakout-grid executor for EUR/USD, GBP/USD and USD/JPY: lot 0.01, grid/SL 15 pips, TP 30 pips (RR 1:2), breakeven at +1R, daily loss stop $5. News behaviour: entries are blocked ±30 minutes around impact>=2 events, and for 60 minutes after an impact>=3 event the grid/SL/TP are widened ×1.5. It is DRY-RUN by default (paper book); orders are only sent to a DEMO account with `--enable`.

    start-grid.bat                :: dry-run
    start-grid.bat --enable       :: kirim order ke akun DEMO

Do not run it at the same time as `start.bat` (news executor) on the same terminal. Logs: `bridge/grid_orders.csv`; state: `bridge/grid_state.json`. Parameters: `python scripts\mt5_grid_hft.py --help`.

# aiterminaltrading
