import { BottomTab, useApp } from '../store/AppContext';
import Funds from './Funds';
import Holdings from './Holdings';
import Orders from './Orders';
import Positions from './Positions';
import TradeHistory from './TradeHistory';
import { Tabs } from './ui';

export default function BottomPanel() {
  const { bottomTab, setBottomTab, state } = useApp();
  const open = state.orders.filter((o) => o.status === 'OPEN').length;
  const pos = state.positions.filter((p) => p.qty !== 0).length;
  return (
    <section className="flex h-full min-h-0 flex-col border-t border-line bg-panel" aria-label="Portfolio">
      <div className="border-b border-line px-1">
        <Tabs<BottomTab> label="Portfolio sections" value={bottomTab} onChange={setBottomTab} tabs={[
          { id: 'positions', label: 'Positions', count: pos }, { id: 'orders', label: 'Orders', count: open }, { id: 'holdings', label: 'Holdings', count: state.holdings.length },
          { id: 'history', label: 'Trade history' }, { id: 'funds', label: 'Funds' },
        ]} />
      </div>
      <div className="min-h-0 flex-1 overflow-hidden px-2 pt-1">
        {bottomTab === 'positions' && <Positions compact />}
        {bottomTab === 'orders' && <Orders compact />}
        {bottomTab === 'holdings' && <Holdings compact />}
        {bottomTab === 'history' && <TradeHistory compact />}
        {bottomTab === 'funds' && <Funds compact />}
      </div>
    </section>
  );
}
