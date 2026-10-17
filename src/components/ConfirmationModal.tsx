import type { ReactNode } from 'react';
import { Modal } from './ui';

export default function ConfirmationModal({ title, children, confirmLabel, cancelLabel = 'Cancel', tone = 'danger', onConfirm, onCancel }: {
  title: string; children: ReactNode; confirmLabel: string; cancelLabel?: string; tone?: 'buy' | 'sell' | 'danger'; onConfirm: () => void; onCancel: () => void;
}) {
  const cls = tone === 'buy' ? 'btn-buy' : tone === 'sell' ? 'btn-sell' : 'btn-sell';
  return (
    <Modal title={title} onClose={onCancel}
      footer={<><button className="btn" onClick={onCancel}>{cancelLabel}</button><button data-autofocus className={`btn ${cls}`} onClick={onConfirm}>{confirmLabel}</button></>}>
      {children}
    </Modal>
  );
}
