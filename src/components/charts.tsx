import { useId } from 'react';
import type { DailyPoint } from '../lib/analytics';
import { formatDayMonth, formatWeekdayShort } from '../lib/date';
import { formatMoney } from '../lib/format';

export function RevenueBars({
  data,
  height = 150,
  showValue = false,
}: {
  data: DailyPoint[];
  height?: number;
  showValue?: boolean;
}) {
  const max = Math.max(1, ...data.map((point) => point.revenue));
  const today = data[data.length - 1]?.key;

  return (
    <div className="revenue-bars" style={{ height }}>
      <div className="revenue-bars__grid" aria-hidden="true">
        <i /><i /><i />
      </div>
      {data.map((point) => {
        const ratio = point.revenue / max;
        return (
          <div className={`revenue-bar ${point.key === today ? 'is-today' : ''}`} key={point.key}>
            <div className="revenue-bar__value">
              {showValue && point.revenue > 0 ? <span>{formatMoney(point.revenue, { compact: true })}</span> : null}
            </div>
            <div className="revenue-bar__track">
              <div
                className="revenue-bar__fill"
                style={{ height: `${Math.max(point.revenue > 0 ? 7 : 2, Math.round(ratio * 100))}%` }}
                title={`${formatDayMonth(point.key)}: ${formatMoney(point.revenue)}`}
              />
            </div>
            <span className="revenue-bar__label">{formatWeekdayShort(point.key)}</span>
          </div>
        );
      })}
    </div>
  );
}

export function RevenueArea({ data, idPrefix = 'area' }: { data: DailyPoint[]; idPrefix?: string }) {
  const gradientId = useId().replace(/:/g, '');
  const width = 720;
  const height = 210;
  const padX = 8;
  const padTop = 18;
  const padBottom = 30;
  const chartHeight = height - padTop - padBottom;
  const max = Math.max(1, ...data.map((point) => point.revenue));
  const step = data.length > 1 ? (width - padX * 2) / (data.length - 1) : width;
  const points = data.map((point, index) => ({
    x: padX + index * step,
    y: padTop + chartHeight - (point.revenue / max) * chartHeight,
    ...point,
  }));
  const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
  const area = `${line} L${(padX + (data.length - 1) * step).toFixed(1)},${padTop + chartHeight} L${padX},${padTop + chartHeight} Z`;

  return (
    <div className="revenue-area">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Grafik omzet ${data.length} hari terakhir`}>
        <defs>
          <linearGradient id={`${idPrefix}-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2b6b50" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#2b6b50" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((ratio) => (
          <line
            key={ratio}
            x1={padX}
            x2={width - padX}
            y1={padTop + chartHeight * ratio}
            y2={padTop + chartHeight * ratio}
            stroke="#e4dccb"
            strokeDasharray="3 6"
            strokeWidth="1"
          />
        ))}
        <path d={area} fill={`url(#${idPrefix}-${gradientId})`} />
        <path d={line} fill="none" stroke="#1f5a42" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point, index) => (
          <g key={point.key}>
            {index === points.length - 1 || point.revenue === max ? (
              <circle cx={point.x} cy={point.y} r="5.2" fill="#f4e4c9" stroke="#1f5a42" strokeWidth="2.4" />
            ) : null}
            <circle cx={point.x} cy={point.y} r="9" fill="transparent">
              <title>{`${formatDayMonth(point.key)}: ${formatMoney(point.revenue)}`}</title>
            </circle>
          </g>
        ))}
        {data.map((point, index) => {
          if (data.length > 14 && index % Math.ceil(data.length / 6) !== 0 && index !== data.length - 1) return null;
          return (
            <text
              key={`label-${point.key}`}
              x={points[index].x}
              y={height - 8}
              textAnchor={index === 0 ? 'start' : index === data.length - 1 ? 'end' : 'middle'}
              fill="#7b8179"
              fontSize="11"
              fontFamily="Plus Jakarta Sans, sans-serif"
            >
              {formatDayMonth(point.key)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

export function PurchaseBars({
  data,
  height = 120,
}: {
  data: Array<{ key: string; total: number }>;
  height?: number;
}) {
  const max = Math.max(1, ...data.map((point) => point.total));
  return (
    <div className="purchase-bars" style={{ height }}>
      {data.map((point) => (
        <div className="purchase-bar" key={point.key}>
          <div
            className="purchase-bar__fill"
            style={{ height: `${Math.max(point.total > 0 ? 6 : 2, Math.round((point.total / max) * 100))}%` }}
            title={`${formatDayMonth(point.key)}: ${formatMoney(point.total)}`}
          />
          <span>{formatDayMonth(point.key)}</span>
        </div>
      ))}
    </div>
  );
}

export function Donut({
  direct,
  consignment,
  size = 160,
}: {
  direct: number;
  consignment: number;
  size?: number;
}) {
  const total = direct + consignment;
  const directPercent = total ? Math.round((direct / total) * 100) : 0;
  const consignmentPercent = total ? 100 - directPercent : 0;
  return (
    <div
      className="donut"
      style={{
        width: size,
        height: size,
        background: total
          ? `conic-gradient(#1f5a42 0 ${directPercent}%, #e8a23e ${directPercent}% 100%)`
          : '#e7dfd0',
      }}
    >
      <div className="donut__hole">
        <strong>{total ? formatMoney(total, { compact: true }) : '—'}</strong>
        <span>total omzet</span>
      </div>
      <span className="sr-only">Langsung {directPercent}%, titipan {consignmentPercent}%</span>
    </div>
  );
}
