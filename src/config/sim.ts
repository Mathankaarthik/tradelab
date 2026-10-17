/** Simulation constants. Change here to tune the engine. */
export const SIM = {
  tickSize: 0.05,
  /** Slippage applied to market orders (0.0003 = 0.03%). 500 -> 500.15 for a BUY. */
  slippagePct: 0.0003,
  /** Circuit limit as a fraction of previous close. */
  circuitPct: 0.2,
  /** Margin leverage by product. MIS gets 5x, delivery is fully funded. */
  leverage: { MIS: 5, CNC: 1 } as const,
  /** Simulated seconds per engine tick. */
  tickSeconds: 5,
  /** Pull-back toward the day's open so prices don't drift away unrealistically. */
  meanRevert: 0.0002,
  defaultCapital: 100000,
};
