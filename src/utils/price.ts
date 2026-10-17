import { SIM } from '../config/sim';
export const round2 = (n: number) => Math.round(n * 100) / 100;
export const roundTick = (p: number) => round2(Math.round(p / SIM.tickSize) * SIM.tickSize);
export const isOnTick = (p: number) => Math.abs(p / SIM.tickSize - Math.round(p / SIM.tickSize)) < 1e-6;
export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
