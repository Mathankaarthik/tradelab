import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { MarketEngine } from '../engine/market';
import {
  Ctx, OrderInput, Result, cancelOrder, closePosition, createInitialState, endOfDay, modifyOrder,
  placeOrder, processTick, setExit, startNewDay,
} from '../engine/trading';
import type { AppEvent, AppState, ExitRule, Product, Settings, Side, Timeframe } from '../types';
import { currentIstDay, isMarketOpen, minuteOfDay, OPEN_MIN } from '../utils/marketTime';
import { clearAll, loadMarket, loadState, saveMarket, saveState } from './storage';

export type View = 'terminal' | 'dashboard' | 'orders' | 'positions' | 'holdings' | 'funds' | 'history' | 'learn' | 'practice' | 'risk' | 'settings';
export type MobileTab = 'watchlist' | 'chart' | 'portfolio';
export type BottomTab = 'positions' | 'orders' | 'holdings' | 'history' | 'funds';
export interface Toast extends AppEvent { id: number }
export interface TicketPreset { qty?: number; product?: Product; symbol?: string }
export interface Indicators { ema: boolean; sma: boolean; vwap: boolean; rsi: boolean }

interface AppCtx {
  state: AppState; engine: MarketEngine; version: number; running: boolean; ctx: Ctx;
  // ui
  view: View; setView: (v: View) => void; mobileTab: MobileTab; setMobileTab: (t: MobileTab) => void;
  bottomTab: BottomTab; setBottomTab: (t: BottomTab) => void;
  timeframe: Timeframe; setTimeframe: (t: Timeframe) => void; indicators: Indicators; toggleIndicator: (k: keyof Indicators) => void;
  ticketOpen: boolean; ticketSide: Side; ticketPreset: TicketPreset | null; ticketNonce: number;
  openTicket: (side: Side, preset?: TicketPreset) => void; closeTicket: () => void;
  select: (symbol: string) => void; toggleWatch: (symbol: string) => void;
  toasts: Toast[]; dismissToast: (id: number) => void; toast: (e: AppEvent) => void;
  tutorialOpen: boolean; startTutorial: () => void; endTutorial: () => void;
  eodOpen: boolean; closeEod: () => void;
  // trading
  place: (i: OrderInput) => Result; cancel: (id: string) => void; modify: (id: string, c: { qty?: number; price?: number; trigger?: number }) => Result;
  close: (symbol: string, product: Product) => void; saveExit: (key: string, rule: ExitRule) => Result;
  // simulation
  start: () => void; pause: () => void; nextTick: () => void; nudge: (d: number) => void; jump: (minutes: number) => void;
  skipToOpen: () => void; nextDay: () => void; setSpeed: (n: number) => void;
  // account
  resetAccount: () => void; updateSettings: (p: Partial<Settings>) => void;
}

const Ctx_ = createContext<AppCtx | null>(null);
export const useApp = () => { const c = useContext(Ctx_); if (!c) throw new Error('useApp outside provider'); return c; };

export function AppProvider({ children }: { children: ReactNode }) {
  const [init] = useState(() => {
    const st = loadState() ?? createInitialState(100000, currentIstDay());
    return { st, market: loadMarket() };
  });
  const [state, setState] = useState<AppState>(init.st);
  const stateRef = useRef(state);
  const engineRef = useRef<MarketEngine>(null as unknown as MarketEngine);
  if (!engineRef.current) engineRef.current = new MarketEngine(init.st.startDay, init.market);
  const engine = engineRef.current;
  const [version, setVersion] = useState(0);
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);

  // ---- ui state
  const [view, setView] = useState<View>('terminal');
  const [mobileTab, setMobileTab] = useState<MobileTab>('chart');
  const [bottomTab, setBottomTab] = useState<BottomTab>('positions');
  const [timeframe, setTimeframe] = useState<Timeframe>('5m');
  const [indicators, setIndicators] = useState<Indicators>({ ema: false, sma: false, vwap: false, rsi: false });
  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticketSide, setTicketSide] = useState<Side>('BUY');
  const [ticketPreset, setTicketPreset] = useState<TicketPreset | null>(null);
  const [ticketNonce, setTicketNonce] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [tutorialOpen, setTutorialOpen] = useState(() => !init.st.tutorialDone);
  const [eodOpen, setEodOpen] = useState(() => !!init.st.lastEod);
  const toastId = useRef(0);

  const toast = useCallback((e: AppEvent) => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-3), { ...e, id }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), e.kind === 'error' ? 6000 : 4200);
  }, []);
  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const mkCtx = useCallback((): Ctx => ({
    price: (s) => engine.price(s), prevClose: (s) => engine.prevClose(s), time: engine.time, isOpen: isMarketOpen(engine.time),
  }), [engine]);

  const commit = useCallback((next: AppState, events: AppEvent[]) => {
    if (next !== stateRef.current) { stateRef.current = next; setState(next); }
    events.forEach(toast);
  }, [toast]);
  const apply = useCallback((r: Result) => { commit(r.state, r.events); return r; }, [commit]);

  // ---- simulation
  const advance = useCallback((n: number) => {
    if (engine.isDayOver()) { toast({ kind: 'info', title: 'Market Closed', message: 'Start the next trading day to continue.' }); setRunning(false); runningRef.current = false; return; }
    let st = stateRef.current; const evs: AppEvent[] = [];
    if (minuteOfDay(engine.time) < OPEN_MIN) { engine.skipToOpen(); evs.push({ kind: 'info', title: 'Market Open', message: 'The simulated clock moved to 9:15 AM.' }); }
    for (let i = 0; i < n; i++) {
      const r = engine.step();
      if (r.ticks) { const res = processTick(st, r.ticks, mkCtx()); st = res.state; evs.push(...res.events); }
      if (r.dayEnded) {
        const res = endOfDay(st, mkCtx()); st = res.state; evs.push(...res.events);
        setRunning(false); runningRef.current = false; setEodOpen(true); break;
      }
    }
    commit(st, evs); setVersion((v) => v + 1);
  }, [engine, commit, mkCtx, toast]);

  const speed = state.settings.speed;
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => advance(1), Math.max(40, 1000 / speed));
    return () => clearInterval(id);
  }, [running, speed, advance]);

  const start = useCallback(() => { setRunning(true); runningRef.current = true; }, []);
  const pause = useCallback(() => { setRunning(false); runningRef.current = false; }, []);
  const nextTick = useCallback(() => { pause(); advance(1); }, [advance, pause]);
  const jump = useCallback((minutes: number) => advance(minutes * 12), [advance]);
  const skipToOpen = useCallback(() => {
    if (minuteOfDay(engine.time) < OPEN_MIN) { engine.skipToOpen(); setVersion((v) => v + 1); toast({ kind: 'info', title: 'Market Open', message: 'The simulated clock moved to 9:15 AM.' }); }
  }, [engine, toast]);
  const nudge = useCallback((d: number) => {
    const sym = stateRef.current.selected; const bar = engine.nudge(sym, d);
    if (!bar) { toast({ kind: 'error', title: isMarketOpen(engine.time) ? 'Price cannot move further (circuit limit).' : 'Market is closed. Price nudges work only while the market is open.' }); return; }
    const res = processTick(stateRef.current, { [sym]: bar }, mkCtx());
    commit(res.state, res.events); setVersion((v) => v + 1);
  }, [engine, commit, mkCtx, toast]);
  const nextDay = useCallback(() => {
    if (!engine.isDayOver()) { toast({ kind: 'info', title: 'The trading day is still in progress.', message: 'Fast-forward to 3:30 PM first.' }); return; }
    engine.startNextDay();
    const res = startNewDay(stateRef.current, mkCtx()); commit(res.state, res.events);
    setEodOpen(false); setVersion((v) => v + 1);
  }, [engine, commit, mkCtx, toast]);
  const setSpeed = useCallback((n: number) => setState((s) => { const ns = { ...s, settings: { ...s.settings, speed: n } }; stateRef.current = ns; return ns; }), []);

  // ---- trading actions
  const place = useCallback((i: OrderInput) => apply(placeOrder(stateRef.current, i, mkCtx())), [apply, mkCtx]);
  const cancel = useCallback((id: string) => { apply(cancelOrder(stateRef.current, id)); }, [apply]);
  const modify = useCallback((id: string, c: { qty?: number; price?: number; trigger?: number }) => apply(modifyOrder(stateRef.current, id, c, mkCtx())), [apply, mkCtx]);
  const close = useCallback((symbol: string, product: Product) => { apply(closePosition(stateRef.current, symbol, product, mkCtx())); }, [apply, mkCtx]);
  const saveExit = useCallback((key: string, rule: ExitRule) => apply(setExit(stateRef.current, key, rule, mkCtx())), [apply, mkCtx]);

  // ---- selection & ui actions
  const mutate = useCallback((fn: (s: AppState) => AppState) => { const ns = fn(stateRef.current); stateRef.current = ns; setState(ns); }, []);
  const select = useCallback((symbol: string) => { mutate((s) => ({ ...s, selected: symbol })); }, [mutate]);
  const toggleWatch = useCallback((symbol: string) => mutate((s) => ({ ...s, watchlist: s.watchlist.includes(symbol) ? s.watchlist.filter((x) => x !== symbol) : [...s.watchlist, symbol] })), [mutate]);
  const openTicket = useCallback((side: Side, preset?: TicketPreset) => {
    if (preset?.symbol) mutate((s) => ({ ...s, selected: preset.symbol! }));
    setTicketSide(side); setTicketPreset(preset ?? null); setTicketNonce((n) => n + 1); setTicketOpen(true); setView('terminal');
  }, [mutate]);
  const closeTicket = useCallback(() => setTicketOpen(false), []);
  const toggleIndicator = useCallback((k: keyof Indicators) => setIndicators((i) => ({ ...i, [k]: !i[k] })), []);
  const updateSettings = useCallback((p: Partial<Settings>) => mutate((s) => ({ ...s, settings: { ...s.settings, ...p } })), [mutate]);

  const startTutorial = useCallback(() => { setView('terminal'); setTutorialOpen(true); }, []);
  const endTutorial = useCallback(() => { setTutorialOpen(false); mutate((s) => ({ ...s, tutorialDone: true })); }, [mutate]);
  const closeEod = useCallback(() => setEodOpen(false), []);

  const resetAccount = useCallback(() => {
    pause(); clearAll();
    const old = stateRef.current; const cap = old.settings.startingCapital || 100000;
    const fresh = createInitialState(cap, old.startDay, { settings: { ...old.settings, startingCapital: cap }, watchlist: old.watchlist, tutorialDone: true, selected: old.selected });
    engineRef.current.reset();
    stateRef.current = fresh; setState(fresh); setEodOpen(false); setTicketOpen(false); setVersion((v) => v + 1);
    saveState(fresh);
    toast({ kind: 'success', title: 'Account reset', message: `Virtual capital restored to ₹${cap.toLocaleString('en-IN')}.` });
  }, [pause, toast]);

  // ---- persistence
  useEffect(() => { const id = setTimeout(() => saveState(state), 350); return () => clearTimeout(id); }, [state]);
  const lastMarketSave = useRef(0);
  useEffect(() => { if (Date.now() - lastMarketSave.current > 2500) { lastMarketSave.current = Date.now(); saveMarket(engine.snapshot()); } }, [version, engine]);
  useEffect(() => {
    const flush = () => { saveState(stateRef.current); saveMarket(engine.snapshot()); };
    window.addEventListener('beforeunload', flush); document.addEventListener('visibilitychange', flush);
    return () => { window.removeEventListener('beforeunload', flush); document.removeEventListener('visibilitychange', flush); };
  }, [engine]);
  useEffect(() => { document.documentElement.dataset.theme = state.settings.theme; }, [state.settings.theme]);

  const value: AppCtx = useMemo(() => ({
    state, engine, version, running, ctx: mkCtx(),
    view, setView, mobileTab, setMobileTab, bottomTab, setBottomTab, timeframe, setTimeframe, indicators, toggleIndicator,
    ticketOpen, ticketSide, ticketPreset, ticketNonce, openTicket, closeTicket, select, toggleWatch,
    toasts, dismissToast, toast, tutorialOpen, startTutorial, endTutorial, eodOpen, closeEod,
    place, cancel, modify, close, saveExit, start, pause, nextTick, nudge, jump, skipToOpen, nextDay, setSpeed, resetAccount, updateSettings,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [state, version, running, view, mobileTab, bottomTab, timeframe, indicators, ticketOpen, ticketSide, ticketPreset, ticketNonce, toasts, tutorialOpen, eodOpen]);

  return <Ctx_.Provider value={value}>{children}</Ctx_.Provider>;
}
