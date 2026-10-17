import { useApp } from '../store/AppContext';
import { fmtINR, fmtSigned, pnlClass } from '../utils/format';
import { fmtDate } from '../utils/marketTime';
import { Modal } from './ui';

export default function EodModal() {
  const { state, closeEod, nextDay } = useApp();
  const e = state.lastEod; if (!e) return null;
  return (
    <Modal title="Market Closed · End-of-day summary" onClose={closeEod}
      footer={<><button className="btn" onClick={closeEod}>Review account</button><button data-autofocus className="btn btn-buy" onClick={nextDay}>Start next trading day</button></>}>
      <p className="mb-3 text-[12.5px] text-mute">{fmtDate(e.date)} · The simulated market closed at 3:30 PM. Open intraday (MIS) positions were squared off automatically. Delivery (CNC) holdings stay.</p>
      <dl className="space-y-1.5 text-[13px]">
        <div className="flex justify-between"><dt className="text-mute">Realized P&L today</dt><dd className={`font-medium ${pnlClass(e.realizedToday)}`}>{fmtSigned(e.realizedToday)}</dd></div>
        <div className="flex justify-between"><dt className="text-mute">Charges today (simulated)</dt><dd>{fmtINR(e.chargesToday)}</dd></div>
        <div className="flex justify-between"><dt className="text-mute">Day P&L after charges</dt><dd className={`font-medium ${pnlClass(e.dayPnl)}`}>{fmtSigned(e.dayPnl)}</dd></div>
        <div className="flex justify-between"><dt className="text-mute">Trades today</dt><dd>{e.tradesToday}</dd></div>
        <div className="flex justify-between"><dt className="text-mute">Pending orders expired</dt><dd>{e.cancelledOrders}</dd></div>
        <div className="flex justify-between border-t border-line pt-1.5"><dt className="font-medium">Account value</dt><dd className="font-semibold">{fmtINR(e.accountValue)}</dd></div>
      </dl>
      {e.squaredOff.length > 0 && (
        <div className="mt-3"><h3 className="mb-1 text-[12.5px] font-medium">Auto square-off</h3>
          <ul className="space-y-1 text-[12.5px]">{e.squaredOff.map((l) => <li key={l.symbol} className="flex justify-between"><span>{l.symbol} {l.qty > 0 ? 'sold' : 'bought back'} {Math.abs(l.qty)} @ {fmtINR(l.price)}</span><span className={pnlClass(l.pnl)}>{fmtSigned(l.pnl)}</span></li>)}</ul></div>
      )}
      <p className="mt-3 text-[11px] text-mute">Simulation for educational purposes only. Virtual money.</p>
    </Modal>
  );
}
