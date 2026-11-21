import { useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  ChevronRight,
  CircleAlert,
  Edit3,
  Package,
  Plus,
  RotateCcw,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { useStore } from '../store/StoreContext';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  ProductMark,
  SearchField,
  SectionHeader,
  Segmented,
  Stat,
} from '../components/ui';
import { EmptyBowl } from '../components/Brand';
import { ProductFormSheet } from '../components/ProductFormSheet';
import { navigate } from '../lib/router';
import { formatDate } from '../lib/date';
import { formatMoney } from '../lib/format';
import { allProductsTotalStock, lowStockProducts, stockValue } from '../lib/domain';
import type { Product, StockMoveType } from '../types';

type Filter = 'semua' | 'menipis' | 'nonaktif';

const MOVE_LABEL: Record<StockMoveType, string> = {
  awal: 'Stok awal',
  opname: 'Penyesuaian',
  jual: 'Penjualan',
  titip: 'Titipan',
  retur: 'Retur titipan',
  rusak: 'Rusak',
};

export function ProductsPage() {
  const { state } = useStore();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('semua');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | undefined>();
  const low = lowStockProducts(state);
  const nonactive = state.products.filter((product) => !product.active);
  const totalStock = allProductsTotalStock(state);
  const value = stockValue(state);

  const products = useMemo(() => {
    const term = search.trim().toLowerCase();
    return state.products
      .filter((product) => {
        if (!term) return true;
        return product.name.toLowerCase().includes(term);
      })
      .filter((product) => {
        if (filter === 'menipis') return product.active && product.stock <= state.settings.lowStockThreshold;
        if (filter === 'nonaktif') return !product.active;
        return product.active;
      })
      .sort((a, b) => {
        if (a.stock !== b.stock) return a.stock - b.stock;
        return a.name.localeCompare(b.name);
      });
  }, [state.products, state.settings.lowStockThreshold, search, filter]);

  const recentMoves = state.stockMoves.slice(0, 10);
  const openAdd = () => { setEditing(undefined); setFormOpen(true); };
  const openEdit = (product: Product) => { setEditing(product); setFormOpen(true); };

  return (
    <div className="products-page">
      <PageHeader
        eyebrow="Produk & stok"
        title="Bumbu dagangan"
        description="Atur harga, HPP, dan jumlah stok yang siap dijual."
        action={<Button onClick={openAdd} icon={<Plus size={17} />}>Tambah bumbu</Button>}
      />

      {state.meta.onboarded && state.products.every((product) => product.stock === 0) ? (
        <div className="setup-banner">
          <div className="setup-banner__icon"><Package size={21} /></div>
          <div><strong>Mulai dari stok awal</strong><p>Klik bumbu lalu isi jumlah pack yang siap dijual hari ini.</p></div>
          <Button size="sm" variant="secondary" onClick={() => openEdit(state.products[0])}>Isi stok</Button>
        </div>
      ) : null}

      <div className="stat-strip">
        <Stat label="Total stok" value={`${totalStock} pack`} icon={<Boxes size={18} />} tone="green" hint={`${state.products.filter((product) => product.active).length} bumbu aktif`} />
        <Stat label="Nilai stok" value={formatMoney(value)} icon={<Wallet size={18} />} hint="Perkiraan dari HPP" />
        <Stat label="Stok menipis" value={low.length} icon={<CircleAlert size={18} />} tone={low.length ? 'red' : 'plain'} hint={`Batas ${state.settings.lowStockThreshold} pack`} />
        <Stat label="Rata-rata harga" value={formatMoney(Math.round(state.products.reduce((sum, product) => sum + product.price, 0) / Math.max(1, state.products.length)))} icon={<Sparkles size={18} />} hint="Per pack" />
      </div>

      <div className="list-toolbar">
        <Segmented
          ariaLabel="Filter produk"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'semua', label: 'Aktif', count: state.products.filter((product) => product.active).length },
            { value: 'menipis', label: 'Menipis', count: low.length },
            { value: 'nonaktif', label: 'Nonaktif', count: nonactive.length },
          ]}
        />
        <div className="list-toolbar__search"><SearchField value={search} onChange={setSearch} placeholder="Cari bumbu…" /></div>
      </div>

      {products.length ? (
        <Card className="product-table-card">
          <div className="product-table">
            <div className="product-table__head">
              <span>Bumbu</span><span>Harga jual</span><span>HPP / laba</span><span>Stok</span><span />
            </div>
            {products.map((product) => {
              const margin = product.price - product.hpp;
              return (
                <button type="button" className="product-table__row" key={product.id} onClick={() => openEdit(product)}>
                  <span className="product-table__name">
                    <ProductMark name={product.name} tone={product.tone} size="sm" imageUrl={product.imageUrl} />
                    <span><strong>{product.name}</strong><small>per {product.unit}</small></span>
                  </span>
                  <span><strong>{formatMoney(product.price)}</strong></span>
                  <span>{product.hpp ? <><strong>{formatMoney(product.hpp)}</strong><small className={margin > 0 ? 'text-success' : 'text-danger'}>Laba {formatMoney(margin)}</small></> : <span className="muted-copy">Belum diisi</span>}</span>
                  <span>
                    <Badge tone={product.stock === 0 ? 'red' : product.stock <= state.settings.lowStockThreshold ? 'gold' : 'green'}>
                      {product.stock} {product.unit}
                    </Badge>
                  </span>
                  <span className="product-table__edit"><Edit3 size={16} /></span>
                </button>
              );
            })}
          </div>
        </Card>
      ) : (
        <Card className="no-border">
          <EmptyState
            illustration={<EmptyBowl size={54} />}
            title={search ? 'Bumbu tidak ditemukan' : filter === 'nonaktif' ? 'Tidak ada produk nonaktif' : 'Belum ada bumbu'}
            description={search ? 'Coba kata kunci lain.' : filter === 'menipis' ? 'Semua stok masih aman.' : 'Tambahkan bumbu untuk mulai berjualan.'}
            action={!search && filter === 'semua' ? <Button onClick={openAdd} icon={<Plus size={16} />}>Tambah bumbu</Button> : undefined}
          />
        </Card>
      )}

      <div className="products-lower">
        <Card>
          <SectionHeader title="Pergerakan stok terbaru" description="Jual, titip, retur, dan penyesuaian stok." />
          {recentMoves.length ? (
            <div className="stock-moves">
              {recentMoves.map((move) => {
                const product = state.products.find((item) => item.id === move.productId);
                const positive = move.qty > 0;
                return (
                  <div className="stock-move" key={move.id}>
                    <span className={`stock-move__icon ${positive ? 'is-in' : 'is-out'}`}>
                      {positive ? <ArrowDownToLine size={15} /> : <ArrowUpFromLine size={15} />}
                    </span>
                    <div><strong>{product?.name ?? 'Bumbu'}</strong><span>{MOVE_LABEL[move.type]} · {formatDate(move.date)}</span></div>
                    <strong className={positive ? 'text-success' : 'text-muted'}>{positive ? '+' : ''}{move.qty} pack</strong>
                  </div>
                );
              })}
            </div>
          ) : <p className="muted-copy">Belum ada pergerakan stok.</p>}
        </Card>

        <Card className="stock-help-card">
          <span className="stock-help-card__icon"><RotateCcw size={22} /></span>
          <h2>Stok berkurang otomatis</h2>
          <p>Penjualan langsung dan titipan mengurangi stok. Retur titipan otomatis menambah stok lagi.</p>
          <Button variant="secondary" size="sm" onClick={() => navigate('/bahan')} icon={<ChevronRight size={15} />}>Lihat bahan & belanja</Button>
        </Card>
      </div>

      <ProductFormSheet open={formOpen} onClose={() => setFormOpen(false)} product={editing} />
    </div>
  );
}
