import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ColorType, CrosshairMode, IChartApi, ISeriesApi, LineStyle, createChart, UTCTimestamp, IPriceLine,
} from 'lightweight-charts';
import { useApp } from '../store/AppContext';
import type { Candle, ChartType, Timeframe } from '../types';
import { ema, rsi, sma, vwap } from '../utils/indicators';
import { fmtINR, fmtPct, fmtSigned, fmtVol, pnlClass } from '../utils/format';
import { posKey } from '../engine/trading';

const TFS: Timeframe[] = ['1m', '5m', '15m', '30m', '1H', '1D'];
const css = (v: string) => `rgb(${getComputedStyle(document.documentElement).getPropertyValue(v).trim().split(' ').join(',')})`;
const cssA = (v: string, a: number) => `rgba(${getComputedStyle(document.documentElement).getPropertyValue(v).trim().split(' ').join(',')},${a})`;
const T = (n: number) => n as UTCTimestamp;
const line = (c: Candle[], v: (number | null)[]) => c.flatMap((x, i) => (v[i] === null ? [] : [{ time: T(x.time), value: v[i] as number }]));

interface Handles {
  chart: IChartApi; main: ISeriesApi<'Candlestick'> | ISeriesApi<'Line'> | ISeriesApi<'Area'>; vol: ISeriesApi<'Histogram'>;
  ema: ISeriesApi<'Line'>; sma: ISeriesApi<'Line'>; vwap: ISeriesApi<'Line'>; type: ChartType;
}

function buildChart(el: HTMLElement, type: ChartType): Handles {
  const text = css('--c-mute'); const grid = cssA('--c-line', 0.5);
  const chart = createChart(el, {
    autoSize: true,
    layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: text, fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 11 },
    grid: { vertLines: { color: grid }, horzLines: { color: grid } },
    crosshair: { mode: CrosshairMode.Normal },
    rightPriceScale: { borderColor: css('--c-line'), scaleMargins: { top: 0.08, bottom: 0.25 } },
    timeScale: { borderColor: css('--c-line'), timeVisible: true, secondsVisible: false, rightOffset: 6 },
    localization: { locale: 'en-IN', priceFormatter: (p: number) => p.toFixed(2) },
  });
  const up = css('--c-gain'); const down = css('--c-loss');
  const main = type === 'candles'
    ? chart.addCandlestickSeries({ upColor: up, downColor: down, wickUpColor: up, wickDownColor: down, borderVisible: false })
    : type === 'line'
      ? chart.addLineSeries({ color: css('--c-buy'), lineWidth: 2 })
      : chart.addAreaSeries({ lineColor: css('--c-buy'), topColor: cssA('--c-buy', 0.35), bottomColor: cssA('--c-buy', 0.02), lineWidth: 2 });
  const vol = chart.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: 'vol', lastValueVisible: false, priceLineVisible: false });
  chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
  const mk = (color: string) => chart.addLineSeries({ color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
  return { chart, main, vol, ema: mk('#f0b132'), sma: mk('#a78bfa'), vwap: mk('#22d3ee'), type };
}

export default function Chart() {
  const { state, engine, version, timeframe, setTimeframe, indicators, toggleIndicator, openTicket, updateSettings } = useApp();
  const sym = state.selected; const theme = state.settings.theme; const chartType = state.settings.chartType;
  const host = useRef<HTMLDivElement>(null); const rsiHost = useRef<HTMLDivElement>(null);
  const h = useRef<Handles | null>(null); const rsiChart = useRef<IChartApi | null>(null); const rsiSeries = useRef<ISeriesApi<'Line'> | null>(null);
  const keyRef = useRef(''); const lines = useRef<IPriceLine[]>([]); const lineSig = useRef('');
  const [built, setBuilt] = useState(0);
  const [hover, setHover] = useState<Candle | null>(null);
  const candlesRef = useRef<Candle[]>([]);

  // (re)create main chart when type or theme changes
  useEffect(() => {
    if (!host.current) return;
    const handles = buildChart(host.current, chartType); h.current = handles; keyRef.current = ''; lineSig.current = ''; lines.current = [];
    handles.chart.subscribeCrosshairMove((p) => {
      const d = p.seriesData.get(handles.main) as { time?: number } | undefined;
      if (!p.time || !d) { setHover(null); return; }
      const c = candlesRef.current.find((x) => x.time === (p.time as number)); setHover(c ?? null);
    });
    setBuilt((n) => n + 1);
    return () => { handles.chart.remove(); h.current = null; };
  }, [chartType, theme]);

  // RSI sub-chart (only when enabled)
  useEffect(() => {
    if (!indicators.rsi || !rsiHost.current || !h.current) return;
    const c = createChart(rsiHost.current, {
      autoSize: true, handleScroll: false, handleScale: false,
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: css('--c-mute'), fontSize: 11 },
      grid: { vertLines: { color: cssA('--c-line', 0.4) }, horzLines: { color: cssA('--c-line', 0.4) } },
      rightPriceScale: { borderColor: css('--c-line'), scaleMargins: { top: 0.1, bottom: 0.1 } },
      localization: { locale: 'en-IN' }, timeScale: { visible: false }, crosshair: { mode: CrosshairMode.Normal },
    });
    const s = c.addLineSeries({ color: '#a78bfa', lineWidth: 1, priceLineVisible: false });
    s.createPriceLine({ price: 70, color: cssA('--c-loss', 0.6), lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: false, title: '' });
    s.createPriceLine({ price: 30, color: cssA('--c-gain', 0.6), lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: false, title: '' });
    rsiChart.current = c; rsiSeries.current = s;
    const main = h.current.chart;
    const sync = (r: { from: number; to: number } | null) => { if (r) c.timeScale().setVisibleLogicalRange(r); };
    main.timeScale().subscribeVisibleLogicalRangeChange(sync);
    const r0 = main.timeScale().getVisibleLogicalRange(); if (r0) c.timeScale().setVisibleLogicalRange(r0);
    keyRef.current = '';
    return () => { main.timeScale().unsubscribeVisibleLogicalRangeChange(sync); c.remove(); rsiChart.current = null; rsiSeries.current = null; };
  }, [indicators.rsi, built]);

  // push data
  useEffect(() => {
    const hd = h.current; if (!hd) return;
    const candles = engine.getCandles(sym, timeframe); candlesRef.current = candles;
    if (!candles.length) return;
    const key = `${sym}|${timeframe}|${built}|${indicators.rsi}`;
    const last = candles[candles.length - 1];
    const toMain = (c: Candle) => (hd.type === 'candles' ? { time: T(c.time), open: c.open, high: c.high, low: c.low, close: c.close } : { time: T(c.time), value: c.close });
    const toVol = (c: Candle) => ({ time: T(c.time), value: c.volume, color: c.close >= c.open ? cssA('--c-gain', 0.4) : cssA('--c-loss', 0.4) });
    if (keyRef.current !== key) {
      keyRef.current = key;
      (hd.main as ISeriesApi<'Line'>).setData(candles.map(toMain) as never);
      hd.vol.setData(candles.map(toVol));
      const n = candles.length; const span = timeframe === '1D' ? 120 : 110;
      hd.chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, n - span), to: n + 6 });
    } else {
      (hd.main as ISeriesApi<'Line'>).update(toMain(last) as never); hd.vol.update(toVol(last));
    }
    const closes = candles.map((c) => c.close);
    hd.ema.setData(indicators.ema ? line(candles, ema(closes, 20)) : []);
    hd.sma.setData(indicators.sma ? line(candles, sma(closes, 50)) : []);
    hd.vwap.setData(indicators.vwap && timeframe !== '1D' ? line(candles, vwap(candles)) : []);
    if (rsiSeries.current) rsiSeries.current.setData(indicators.rsi ? line(candles, rsi(closes, 14)) : []);
  }, [version, sym, timeframe, built, indicators, engine]);

  // entry / stop-loss / target lines for the selected stock
  const pos = state.positions.find((p) => p.symbol === sym && p.qty !== 0);
  const hold = state.holdings.find((x) => x.symbol === sym);
  const exit = state.exits[posKey(sym, pos ? 'MIS' : 'CNC')];
  const entry = pos?.avgPrice ?? hold?.avgPrice;
  const sig = `${sym}|${entry ?? ''}|${exit?.stopLoss ?? ''}|${exit?.target ?? ''}|${built}`;
  useEffect(() => {
    const hd = h.current; if (!hd || lineSig.current === sig) return; lineSig.current = sig;
    const main = hd.main as ISeriesApi<'Line'>;
    lines.current.forEach((l) => main.removePriceLine(l)); lines.current = [];
    const add = (price: number | undefined, color: string, title: string) => { if (price) lines.current.push(main.createPriceLine({ price, color, lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title })); };
    add(entry, css('--c-buy'), 'Entry'); add(exit?.stopLoss, css('--c-loss'), 'Stop-loss'); add(exit?.target, css('--c-gain'), 'Target');
  }, [sig, exit, entry]);

  const q = engine.quote(sym); const info = engine.info(sym);
  const shown = useMemo(() => hover ?? candlesRef.current[candlesRef.current.length - 1] ?? null, [hover, version]);
  return (
    <section className="flex h-full min-h-0 flex-col bg-panel" aria-label={`${sym} chart`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-3 py-2">
        <div data-tour="price" className="flex items-baseline gap-3">
          <div><div className="text-[14px] font-semibold leading-tight">{sym}</div><div className="max-w-[160px] truncate text-[10.5px] text-mute">{info?.name} · NSE (simulated)</div></div>
          <div className="text-[19px] font-semibold leading-none" aria-live="off">{fmtINR(q.ltp)}</div>
          <div className={`text-[12px] ${pnlClass(q.change)}`}>{fmtSigned(q.change)} ({fmtPct(q.changePct)})</div>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <button className="btn btn-buy btn-sm px-4" data-tour="buy" onClick={() => openTicket('BUY')} title="Shortcut: B">BUY</button>
          <button className="btn btn-sell btn-sm px-4" onClick={() => openTicket('SELL')} title="Shortcut: S">SELL</button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-1">
        <div className="flex" role="group" aria-label="Timeframe">
          {TFS.map((t) => (
            <button key={t} aria-pressed={timeframe === t} onClick={() => setTimeframe(t)} className={`rounded px-2 py-1 text-[12px] ${timeframe === t ? 'bg-buy/20 font-semibold text-buy' : 'text-mute hover:text-ink'}`}>{t}</button>
          ))}
        </div>
        <span className="h-4 w-px bg-line" aria-hidden="true" />
        <select className="rounded border border-line bg-app px-1 py-0.5 text-[12px]" aria-label="Chart type" value={chartType} onChange={(e) => updateSettings({ chartType: e.target.value as ChartType })}>
          <option value="candles">Candles</option><option value="line">Line</option><option value="area">Area</option>
        </select>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Indicators (off by default)">
          {([['ema', 'EMA 20'], ['sma', 'SMA 50'], ['vwap', 'VWAP'], ['rsi', 'RSI 14']] as const).map(([k, l]) => (
            <button key={k} aria-pressed={indicators[k]} onClick={() => toggleIndicator(k)} className={`rounded border px-1.5 py-0.5 text-[11.5px] ${indicators[k] ? 'border-buy bg-buy/15 text-buy' : 'border-line text-mute hover:text-ink'}`}>{l}</button>
          ))}
        </div>
        {shown && (
          <div className="ml-auto hidden text-[11.5px] text-mute md:block">
            O <b className="text-ink">{shown.open.toFixed(2)}</b> H <b className="text-ink">{shown.high.toFixed(2)}</b> L <b className="text-ink">{shown.low.toFixed(2)}</b> C <b className="text-ink">{shown.close.toFixed(2)}</b> Vol <b className="text-ink">{fmtVol(shown.volume)}</b>
          </div>
        )}
      </div>
      <div className="relative min-h-0 flex-1">
        <div ref={host} className="absolute inset-0" role="img" aria-label={`${timeframe} candlestick chart for ${sym}, simulated data`} />
      </div>
      {indicators.rsi && <div ref={rsiHost} className="h-[90px] shrink-0 border-t border-line" aria-label="RSI 14" />}
    </section>
  );
}
