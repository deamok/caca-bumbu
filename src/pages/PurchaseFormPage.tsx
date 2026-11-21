import { useMemo, useState } from 'react';
import {
  ArrowRight,
  CalendarDays,
  Check,
  Plus,
  ReceiptText,
  Store,
  Trash2,
} from 'lucide-react';
import { useStore } from '../store/StoreContext';
import { useToast } from '../components/Toast';
import {
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Select,
  Textarea,
} from '../components/ui';
import { isoFromDateKey, todayKey } from '../lib/date';
import { formatMoney } from '../lib/format';
import type { PurchaseLineInput } from '../lib/domain';
import { navigate } from '../lib/router';

const CATEGORIES = ['Bumbu', 'Protein', 'Santan & Minyak', 'Pelengkap', 'Lainnya'];
const UNITS = ['kg', 'gram', 'liter', 'ml', 'pack', 'butir', 'ikat', 'pcs'];

interface Row {
  key: number;
  name: string;
  qty: number;
  unit: string;
  category: string;
  total: number;
}

function newRow(key: number): Row {
  return { key, name: '', qty: 1, unit: 'kg', category: 'Bumbu', total: 0 };
}

export function PurchaseFormPage() {
  const { state, addPurchase } = useStore();
  const { notify } = useToast();
  const [date, setDate] = useState(todayKey());
  const [supplier, setSupplier] = useState('');
  const [note, setNote] = useState('');
  const [rows, setRows] = useState<Row[]>([newRow(1)]);
  const [error, setError] = useState('');
  const nextKey = useMemo(() => Math.max(0, ...rows.map((row) => row.key)) + 1, [rows]);
  const total = rows.reduce((sum, row) => sum + (Number(row.total) || 0), 0);
  const itemCount = rows.filter((row) => row.name.trim() && row.qty > 0 && row.total > 0).length;

  const updateRow = (key: number, changes: Partial<Row>) => {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...changes } : row)));
    setError('');
  };

  const onNameChange = (key: number, value: string) => {
    const existing = state.ingredients.find((ingredient) => ingredient.name.toLowerCase() === value.trim().toLowerCase());
    updateRow(key, {
      name: value,
      ...(existing ? { unit: existing.unit, category: existing.category } : {}),
    });
  };

  const addRow = () => setRows((current) => [...current, newRow(nextKey)]);
  const removeRow = (key: number) => setRows((current) => current.filter((row) => row.key !== key));

  const save = () => {
    setError('');
    const validRows = rows.filter((row) => row.name.trim() && row.qty > 0 && row.total > 0);
    if (!validRows.length) {
      setError('Tambahkan minimal satu bahan dengan jumlah dan total harga.');
      return;
    }
    try {
      const items: PurchaseLineInput[] = validRows.map((row) => ({
        name: row.name.trim(),
        qty: row.qty,
        unit: row.unit,
        category: row.category,
        unitPrice: row.qty > 0 ? row.total / row.qty : 0,
        total: row.total,
      }));
      const result = addPurchase({
        date: isoFromDateKey(date, '08:30'),
        supplier,
        note,
        items,
      });
      notify('Belanja bahan tersimpan', { message: `${result.purchase.items.length} bahan · ${formatMoney(result.purchase.total)}` });
      navigate('/bahan');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Belanja belum bisa disimpan.');
    }
  };

  return (
    <div className="purchase-form-page">
      <PageHeader
        eyebrow="Bahan & belanja"
        title="Catat belanja bahan"
        description="Masukkan bahan yang dibeli hari ini agar pengeluaran usaha tercatat."
        back
        fallback="/bahan"
      />

      <div className="form-layout">
        <div className="form-layout__main">
          <Card className="form-section">
            <div className="form-section__head">
              <span className="step-badge">1</span>
              <div><h2>Detail belanja</h2><p>Tanggal, tempat belanja, dan catatan.</p></div>
            </div>
            <div className="form-grid form-grid--2">
              <Field label="Tanggal belanja" htmlFor="purchase-date">
                <Input id="purchase-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
              </Field>
              <Field label="Tempat / supplier" optional htmlFor="purchase-supplier">
                <Input id="purchase-supplier" value={supplier} onChange={(event) => setSupplier(event.target.value)} placeholder="Contoh: Pasar Pagi" />
              </Field>
            </div>
            <Field label="Catatan" optional htmlFor="purchase-note">
              <Textarea id="purchase-note" rows={2} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Contoh: harga cabai naik" />
            </Field>
          </Card>

          <Card className="form-section">
            <div className="form-section__head">
              <span className="step-badge">2</span>
              <div><h2>Bahan yang dibeli</h2><p>Tulis total harga sesuai nota atau yang dibayar.</p></div>
              <Button size="sm" variant="secondary" onClick={addRow} icon={<Plus size={15} />}>Tambah</Button>
            </div>
            <div className="purchase-rows">
              {rows.map((row, index) => {
                const unitPrice = row.qty > 0 ? row.total / row.qty : 0;
                return (
                  <div className="purchase-row" key={row.key}>
                    <div className="purchase-row__head">
                      <span>Bahan {index + 1}</span>
                      {rows.length > 1 ? (
                        <button type="button" onClick={() => removeRow(row.key)} aria-label="Hapus bahan"><Trash2 size={15} /></button>
                      ) : null}
                    </div>
                    <Field label="Nama bahan" htmlFor={`ingredient-${row.key}`}>
                      <Input
                        id={`ingredient-${row.key}`}
                        value={row.name}
                        onChange={(event) => onNameChange(row.key, event.target.value)}
                        placeholder="Contoh: Cabai merah"
                        list="ingredient-options"
                      />
                    </Field>
                    <div className="purchase-row__grid">
                      <Field label="Jumlah" htmlFor={`qty-${row.key}`}>
                        <Input
                          id={`qty-${row.key}`}
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="0.1"
                          value={row.qty}
                          onChange={(event) => updateRow(row.key, { qty: Number(event.target.value) || 0 })}
                        />
                      </Field>
                      <Field label="Satuan" htmlFor={`unit-${row.key}`}>
                        <Select id={`unit-${row.key}`} value={row.unit} onChange={(event) => updateRow(row.key, { unit: event.target.value })}>
                          {UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                        </Select>
                      </Field>
                      <Field label="Kategori" htmlFor={`category-${row.key}`}>
                        <Select id={`category-${row.key}`} value={row.category} onChange={(event) => updateRow(row.key, { category: event.target.value })}>
                          {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                        </Select>
                      </Field>
                    </div>
                    <div className="purchase-row__price">
                      <Field label="Total harga" htmlFor={`total-${row.key}`}>
                        <div className="input-prefix"><span>Rp</span><input id={`total-${row.key}`} type="number" inputMode="numeric" min={0} value={row.total} onChange={(event) => updateRow(row.key, { total: Number(event.target.value) || 0 })} /></div>
                      </Field>
                      <div className="unit-price-preview"><span>Harga satuan</span><strong>{formatMoney(unitPrice)} / {row.unit}</strong></div>
                    </div>
                  </div>
                );
              })}
            </div>
            <datalist id="ingredient-options">
              {state.ingredients.map((ingredient) => <option key={ingredient.id} value={ingredient.name} />)}
            </datalist>
            {error ? <div className="form-error" role="alert">{error}</div> : null}
          </Card>
        </div>

        <aside className="form-layout__side">
          <Card className="order-card">
            <span className="card-kicker">Ringkasan belanja</span>
            <h2>{formatMoney(total)}</h2>
            <p>{itemCount} bahan dari {rows.length} baris</p>
            <div className="order-card__lines">
              {rows.filter((row) => row.name.trim()).map((row) => (
                <div key={row.key}><span>{row.name} <small>{row.qty} {row.unit}</small></span><strong>{formatMoney(row.total)}</strong></div>
              ))}
            </div>
            <div className="order-card__total"><span>Total pengeluaran</span><strong>{formatMoney(total)}</strong></div>
            <div className="order-card__warung"><Store size={15} /><span>{supplier || 'Tempat belanja belum diisi'}</span></div>
            <div className="order-card__warung"><CalendarDays size={15} /><span>{date}</span></div>
            <Button full size="lg" onClick={save} icon={<Check size={17} />}>Simpan belanja</Button>
            <p className="order-card__note">Belanja bahan tercatat sebagai pengeluaran, bukan HPP otomatis.</p>
          </Card>
          <div className="side-tip">
            <ReceiptText size={17} />
            <p>Harga satuan dihitung otomatis dari total dibagi jumlah. Data ini dipakai di analisa bahan.</p>
          </div>
        </aside>
      </div>

      {rows.length ? (
        <div className="form-dock">
          <div><span>{itemCount} bahan</span><strong>{formatMoney(total)}</strong></div>
          <Button variant="gold" onClick={save} iconAfter={<ArrowRight size={16} />}>Simpan belanja</Button>
        </div>
      ) : null}
    </div>
  );
}
