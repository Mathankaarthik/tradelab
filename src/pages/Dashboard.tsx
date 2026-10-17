import { useApp } from '../store/AppContext';
import { accountValue, computeStats, unrealizedPnl } from '../engine/trading';
import EquityChart from '../components/EquityChart';
import { Hint, Stat } from '../components/ui';
import { fmtINR, fmtNum, fmtPct, fmtSigned, pnlClass } from '../utils/format';

export default function Dashboard() {
  const { state, ctx, setView } = useApp();
  const st = computeStats(state.trades); const un = unrealizedPnl(state, ctx);
  const value = accountValue(state, ctx); const day = value - state.account.dayStartValue;
  const realNet = state.account.realizedPnl - state.account.chargesTotal;
  const tiles: [string, React.ReactNode, number?, string?][] = [
    ['Virtual account value', fmtINR(value), value - state.account.startingCapital, `${fmtPct(((value - state.account.startingCapital) / state.account.startingCapital) * 100)} since start`],
    ["Today's P&L", fmtSigned(day), day, 'Account value change today, after charges'],
    ['Realized P&L', fmtSigned(state.account.realizedPnl), state.account.realizedPnl, `Net of charges ${fmtSigned(realNet)}`],
    ['Unrealized P&L', fmtSigned(un.total), un.total, 'Open positions and holdings'],
    ['Number of trades', String(st.trades), undefined, `${st.closedTrades} closing trades`],
    ['Win rate', st.closedTrades ? `${st.winRate.toFixed(1)}%` : '-', undefined, 'Closing trades profitable after charges'],
    ['Average profit', st.avgWin ? fmtSigned(st.avgWin) : '-', st.avgWin],
    ['Average loss', st.avgLoss ? fmtSigned(st.avgLoss) : '-', st.avgLoss],
    ['Largest profit', st.largestWin ? fmtSigned(st.largestWin) : '-', st.largestWin],
    ['Largest loss', st.largestLoss ? fmtSigned(st.largestLoss) : '-', st.largestLoss],
    ['Risk / reward ratio', st.riskReward ? `1 : ${fmtNum(st.riskReward)}` : '-', undefined, 'Average profit ÷ average loss'],
    ['Charges paid', fmtINR(state.account.chargesTotal), undefined, 'Simulated estimates'],
  ];
  return (
    <div className="mx-auto max-w-6xl space-y-4 p-3 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><h1 className="text-[18px] font-semibold">Dashboard</h1><button className="btn btn-buy" onClick={() => setView('terminal')}>Go to trading terminal</button></div>
      <div className="panel grid grid-cols-2 divide-x divide-y divide-line sm:grid-cols-3 lg:grid-cols-4 [&>*]:border-line">
        {tiles.map(([k, v, t, sub]) => <Stat key={k} label={k} value={v} tone={t} sub={sub} />)}
      </div>
      <div className="panel p-3"><h2 className="mb-2 text-[13px] font-semibold">Account equity</h2><EquityChart /></div>
      <Hint>Win rate alone does not tell the whole story. A trader who wins 40% of the time can still do well if the average profit is larger than the average loss (risk/reward above 1.5). Charges reduce every trade's result, so too many small trades can quietly drain an account.</Hint>
      <p className="text-[11px] text-mute">This is a simulation for educational purposes. Results here do not predict real market outcomes. <span className={pnlClass(0)}></span></p>
    </div>
  );
}
