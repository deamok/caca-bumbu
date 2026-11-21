import { ChevronRight, Clock3, MapPin, PackageCheck } from 'lucide-react';
import type { Consignment, Warung } from '../types';
import { Avatar, Badge } from './ui';
import { dueLabel, formatDate, todayKey } from '../lib/date';
import { formatMoney } from '../lib/format';
import { consignmentOutstandingValue, consignmentTotal, paymentTotal } from '../lib/domain';
import type { AppState } from '../types';

export function ConsignmentCard({
  consignment,
  warung,
  state,
  onClick,
  showWarung = true,
}: {
  consignment: Consignment;
  warung?: Warung;
  state: AppState;
  onClick: () => void;
  showWarung?: boolean;
}) {
  const isActive = consignment.status === 'aktif';
  const late = isActive && dueLabel(consignment.dueDate).startsWith('Terlambat');
  const dueToday = isActive && consignment.dueDate === todayKey();
  const qty = consignment.items.reduce((sum, item) => sum + item.sentQty, 0);
  const total = isActive ? consignmentOutstandingValue(consignment) : consignmentTotal(consignment);
  const paid = paymentTotal(state, 'consignment', consignment.id);
  const outstanding = Math.max(0, total - paid);

  return (
    <button type="button" className={`consignment-card ${isActive ? 'is-active' : 'is-closed'} ${late ? 'is-late' : ''}`} onClick={onClick}>
      <div className="consignment-card__head">
        <div className="consignment-card__who">
          <Avatar name={warung?.name ?? 'Warung'} size="md" tone={late ? 'clay' : undefined} />
          <div>
            <strong>{showWarung ? warung?.name ?? 'Warung' : consignment.code}</strong>
            <span>{showWarung ? consignment.code : `${consignment.items.length} jenis · ${qty} pack`}</span>
          </div>
        </div>
        {isActive ? (
          <Badge tone={late ? 'red' : dueToday ? 'gold' : 'green'} dot>
            {late ? dueLabel(consignment.dueDate) : dueToday ? 'Jatuh tempo hari ini' : `Kunjungi ${dueLabel(consignment.dueDate)}`}
          </Badge>
        ) : (
          <Badge tone={outstanding > 0 ? 'gold' : 'green'}>{outstanding > 0 ? 'Sisa bayar' : 'Selesai'}</Badge>
        )}
      </div>

      <div className="consignment-card__meta">
        <span><Clock3 size={14} /> Titip {formatDate(consignment.date)}</span>
        {warung?.address && showWarung ? <span><MapPin size={14} /> {warung.address.split(',')[0]}</span> : null}
        <span><PackageCheck size={14} /> {consignment.items.length} jenis · {qty} pack</span>
      </div>

      <div className="consignment-card__items">
        {consignment.items.slice(0, 3).map((item) => (
          <span key={item.productId}>{item.name} <b>{item.sentQty}</b></span>
        ))}
        {consignment.items.length > 3 ? <span>+{consignment.items.length - 3} jenis</span> : null}
      </div>

      <div className="consignment-card__footer">
        <div>
          <small>{isActive ? 'Nilai dititipkan' : 'Total laku'}</small>
          <strong>{formatMoney(isActive ? total : consignmentTotal(consignment))}</strong>
        </div>
        <span className="consignment-card__cta">
          {isActive ? 'Hitung sekarang' : outstanding > 0 ? `Sisa ${formatMoney(outstanding, { compact: true })}` : 'Lihat rincian'}
          <ChevronRight size={15} />
        </span>
      </div>
    </button>
  );
}
