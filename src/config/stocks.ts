export interface StockInfo {
  symbol: string;
  name: string;
  sector: string;
  /** Simulated starting price (not a live quote). */
  price: number;
  /** Typical daily volatility (fraction). */
  dailyVol: number;
  /** Typical daily volume in shares. */
  avgVolume: number;
}

const s = (symbol: string, name: string, sector: string, price: number, dailyVol: number, avgVolume: number): StockInfo =>
  ({ symbol, name, sector, price, dailyVol, avgVolume });

export const STOCKS: StockInfo[] = [
  s('RELIANCE', 'Reliance Industries', 'Energy', 1425.5, 0.013, 7_500_000),
  s('TCS', 'Tata Consultancy Services', 'IT', 3245, 0.011, 2_200_000),
  s('INFY', 'Infosys', 'IT', 1520, 0.012, 6_000_000),
  s('HDFCBANK', 'HDFC Bank', 'Banking', 1680, 0.011, 9_000_000),
  s('ICICIBANK', 'ICICI Bank', 'Banking', 1235, 0.012, 8_000_000),
  s('SBIN', 'State Bank of India', 'Banking', 810, 0.014, 12_000_000),
  s('ITC', 'ITC', 'FMCG', 435, 0.011, 14_000_000),
  s('LT', 'Larsen & Toubro', 'Infrastructure', 3550, 0.013, 1_800_000),
  s('BHARTIARTL', 'Bharti Airtel', 'Telecom', 1820, 0.012, 4_000_000),
  s('TATAMOTORS', 'Tata Motors', 'Auto', 710, 0.016, 11_000_000),
  s('ADANIENT', 'Adani Enterprises', 'Conglomerate', 2480, 0.02, 2_500_000),
  s('MARUTI', 'Maruti Suzuki', 'Auto', 12400, 0.012, 500_000),
  s('SUNPHARMA', 'Sun Pharmaceutical', 'Pharma', 1740, 0.012, 2_400_000),
  s('AXISBANK', 'Axis Bank', 'Banking', 1150, 0.013, 6_500_000),
  s('WIPRO', 'Wipro', 'IT', 265, 0.013, 7_000_000),
  s('HINDUNILVR', 'Hindustan Unilever', 'FMCG', 2380, 0.009, 1_500_000),
  s('KOTAKBANK', 'Kotak Mahindra Bank', 'Banking', 1980, 0.011, 3_000_000),
  s('BAJFINANCE', 'Bajaj Finance', 'Finance', 8900, 0.015, 800_000),
  s('ASIANPAINT', 'Asian Paints', 'Consumer', 2350, 0.011, 1_200_000),
  s('TITAN', 'Titan Company', 'Consumer', 3380, 0.013, 1_100_000),
  s('NTPC', 'NTPC', 'Power', 345, 0.012, 10_000_000),
  s('ONGC', 'Oil & Natural Gas Corp', 'Energy', 255, 0.013, 9_000_000),
  s('POWERGRID', 'Power Grid Corp', 'Power', 305, 0.011, 8_000_000),
  s('COALINDIA', 'Coal India', 'Mining', 410, 0.012, 7_000_000),
  s('HCLTECH', 'HCL Technologies', 'IT', 1560, 0.012, 3_500_000),
  s('ULTRACEMCO', 'UltraTech Cement', 'Cement', 11200, 0.012, 400_000),
  s('TATASTEEL', 'Tata Steel', 'Metals', 155, 0.015, 25_000_000),
  s('JSWSTEEL', 'JSW Steel', 'Metals', 985, 0.014, 3_000_000),
  s('HINDALCO', 'Hindalco Industries', 'Metals', 640, 0.014, 5_000_000),
  s('CIPLA', 'Cipla', 'Pharma', 1490, 0.011, 2_000_000),
];

export const STOCK_MAP: Record<string, StockInfo> = Object.fromEntries(STOCKS.map((x) => [x.symbol, x]));

export const DEFAULT_WATCHLIST = [
  'RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'SBIN', 'ITC', 'LT',
  'BHARTIARTL', 'TATAMOTORS', 'ADANIENT', 'MARUTI', 'SUNPHARMA', 'AXISBANK', 'WIPRO',
];
