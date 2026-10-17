export type Side = 'BUY' | 'SELL';
export type Product = 'MIS' | 'CNC';
export type OrderType = 'MARKET' | 'LIMIT' | 'SL' | 'SL-M';
export type OrderStatus = 'OPEN' | 'EXECUTED' | 'CANCELLED' | 'REJECTED';
export type OrderTag = 'MANUAL' | 'CLOSE' | 'TARGET' | 'STOPLOSS' | 'SQUAREOFF';
export type Timeframe = '1m' | '5m' | '15m' | '30m' | '1H' | '1D';
export type ChartType = 'candles' | 'line' | 'area';

export interface Candle { time: number; open: number; high: number; low: number; close: number; volume: number }
export interface TickBar { open: number; high: number; low: number; close: number }

export interface ChargeBreakdown {
  turnover: number; brokerage: number; stt: number; exchange: number; gst: number; sebi: number; stamp: number; total: number;
}

export interface Order {
  id: string; time: number; symbol: string; side: Side; qty: number; product: Product; type: OrderType;
  price: number; trigger: number; status: OrderStatus; avgPrice: number; message: string;
  triggered: boolean; target?: number; stopLoss?: number; tag: OrderTag; execTime?: number;
}

/** qty is signed: positive = long, negative = short. Only MIS positions live here. */
export interface Position {
  symbol: string; product: Product; qty: number; avgPrice: number; realized: number; maxInvested: number;
}
export interface Holding { symbol: string; qty: number; avgPrice: number }

export interface Trade {
  id: string; orderId: string; time: number; symbol: string; side: Side; qty: number; price: number;
  product: Product; charges: number; breakdown: ChargeBreakdown; pnl: number; closing: boolean; tag: OrderTag;
}

export interface ExitRule { target?: number; stopLoss?: number }

export interface Account {
  startingCapital: number; cash: number; realizedPnl: number; chargesTotal: number;
  dayStartValue: number; dayRealized: number; dayCharges: number;
}

export interface Settings {
  startingCapital: number; theme: 'dark' | 'light'; beginnerMode: boolean; speed: number;
  chartType: ChartType; showCharges: boolean; showExplanations: boolean;
}

export interface EodLine { symbol: string; qty: number; price: number; pnl: number }
export interface EodSummary {
  date: number; squaredOff: EodLine[]; realizedToday: number; chargesToday: number;
  accountValue: number; dayPnl: number; tradesToday: number; cancelledOrders: number;
}

export interface EquityPoint { t: number; v: number }

export interface AppState {
  version: 1; account: Account; positions: Position[]; holdings: Holding[]; orders: Order[]; trades: Trade[];
  exits: Record<string, ExitRule>; watchlist: string[]; settings: Settings; equity: EquityPoint[];
  seq: { order: number; trade: number }; tutorialDone: boolean; startDay: number; selected: string;
  lastEod: EodSummary | null;
}

export interface AppEvent { kind: 'success' | 'error' | 'info' | 'warning'; title: string; message?: string }
