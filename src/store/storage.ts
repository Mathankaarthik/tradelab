import type { AppState } from '../types';
import type { MarketSnapshot } from '../engine/market';

const KEY_STATE = 'tradelab:v1:state';
const KEY_MARKET = 'tradelab:v1:market';

export function loadState(): AppState | null {
  try {
    const raw = localStorage.getItem(KEY_STATE); if (!raw) return null;
    const s = JSON.parse(raw) as AppState;
    return s && s.version === 1 && s.account && Array.isArray(s.orders) ? s : null;
  } catch { return null; }
}
export function loadMarket(): MarketSnapshot | null {
  try { const raw = localStorage.getItem(KEY_MARKET); return raw ? (JSON.parse(raw) as MarketSnapshot) : null; } catch { return null; }
}
export function saveState(s: AppState) { try { localStorage.setItem(KEY_STATE, JSON.stringify(s)); } catch { /* storage full or blocked */ } }
export function saveMarket(m: MarketSnapshot) { try { localStorage.setItem(KEY_MARKET, JSON.stringify(m)); } catch { /* ignore */ } }
export function clearAll() { try { localStorage.removeItem(KEY_STATE); localStorage.removeItem(KEY_MARKET); } catch { /* ignore */ } }
