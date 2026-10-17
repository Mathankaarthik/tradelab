/**
 * ALL charge rates live here. Rates are fractions (0.001 = 0.1%).
 * They are simulated estimates for education and may not match any broker's current rates.
 */
export interface ChargeConfig {
  brokerage: {
    intraday: { pct: number; max: number };
    delivery: { pct: number; max: number };
  };
  stt: { intradaySell: number; deliveryBuy: number; deliverySell: number };
  exchange: number;
  sebi: number;
  gst: number;
  stamp: { intradayBuy: number; deliveryBuy: number };
}

export const CHARGE_CONFIG: ChargeConfig = {
  brokerage: {
    intraday: { pct: 0.0003, max: 20 }, // lower of 0.03% or Rs 20 per order
    delivery: { pct: 0, max: 0 }, // free delivery in this simulation
  },
  stt: { intradaySell: 0.00025, deliveryBuy: 0.001, deliverySell: 0.001 },
  exchange: 0.0000297, // 0.00297% on turnover
  sebi: 0.000001, // Rs 10 per crore
  gst: 0.18, // on brokerage + exchange + SEBI
  stamp: { intradayBuy: 0.00003, deliveryBuy: 0.00015 }, // buy side only
};

export const CHARGES_DISCLAIMER =
  'Charges are simulated estimates for educational purposes and may not reflect current broker rates.';
