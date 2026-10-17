import { SIM } from '../config/sim';
import type { Product } from '../types';
/** Margin needed to hold a given notional value. MIS is leveraged, CNC is fully funded. */
export const calculateMargin = (value: number, product: Product) => value / SIM.leverage[product];
