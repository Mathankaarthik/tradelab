import { useEffect, useRef } from 'react';
import { ColorType, IChartApi, ISeriesApi, UTCTimestamp, createChart } from 'lightweight-charts';
import { useApp } from '../store/AppContext';
import { Empty } from './ui';

const rgb = (v: string, a = 1) => `rgba(${getComputedStyle(document.documentElement).getPropertyValue(v).trim().split(' ').join(',')},${a})`;

export default function EquityChart() {
  const { state, version } = useApp();
  const el = useRef<HTMLDivElement>(null); const chart = useRef<IChartApi | null>(null); const series = useRef<ISeriesApi<'Area'> | null>(null);
  const theme = state.settings.theme;
  useEffect(() => {
    if (!el.current) return;
    const c = createChart(el.current, {
      autoSize: true, layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: rgb('--c-mute'), fontSize: 11 },
      grid: { vertLines: { color: rgb('--c-line', 0.4) }, horzLines: { color: rgb('--c-line', 0.4) } },
      rightPriceScale: { borderColor: rgb('--c-line') }, timeScale: { borderColor: rgb('--c-line'), timeVisible: true }, localization: { locale: 'en-IN' },
    });
    series.current = c.addAreaSeries({ lineColor: rgb('--c-buy'), topColor: rgb('--c-buy', 0.3), bottomColor: rgb('--c-buy', 0.02), lineWidth: 2 });
    chart.current = c; return () => { c.remove(); chart.current = null; series.current = null; };
  }, [theme]);
  useEffect(() => {
    if (!series.current) return;
    // de-duplicate timestamps (chart needs strictly ascending times)
    const pts: { time: UTCTimestamp; value: number }[] = [];
    for (const p of state.equity) { const t = Math.floor(p.t / 1000) as UTCTimestamp; if (pts.length && pts[pts.length - 1].time >= t) pts[pts.length - 1] = { time: pts[pts.length - 1].time, value: p.v }; else pts.push({ time: t, value: p.v }); }
    series.current.setData(pts); chart.current?.timeScale().fitContent();
  }, [state.equity, version, theme]);
  return (
    <div className="relative h-64">
      {state.equity.length < 2 && <div className="absolute inset-0 z-10"><Empty>Your equity curve appears here as the simulated market runs and you trade.</Empty></div>}
      <div ref={el} className="absolute inset-0" role="img" aria-label="Account equity chart" />
    </div>
  );
}
