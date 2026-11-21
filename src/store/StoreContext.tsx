import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { AppState, Product, Settings, Warung } from '../types';
import { createDemoState, createInitialState } from '../data/seed';
import {
  addPayment as domainAddPayment,
  adjustProductStock,
  closeConsignment,
  createConsignment,
  createProduct,
  createPurchase,
  createSale,
  createWarung,
  updateProduct,
  updateWarung,
  type CloseConsignmentInput,
  type ConsignmentInput,
  type PaymentInput,
  type PurchaseInput,
  type SaleInput,
} from '../lib/domain';
import { clearStoredState, loadState, saveState } from '../lib/storage';

interface StoreValue {
  state: AppState;
  start: (mode: 'demo' | 'clean') => void;
  resetAll: () => void;
  replaceState: (state: AppState) => void;
  sell: (input: SaleInput) => ReturnType<typeof createSale>;
  addConsignment: (input: ConsignmentInput) => ReturnType<typeof createConsignment>;
  settleConsignment: (input: CloseConsignmentInput) => ReturnType<typeof closeConsignment>;
  pay: (input: PaymentInput) => void;
  addWarung: (input: Pick<Warung, 'name' | 'owner' | 'phone' | 'address' | 'notes'>) => Warung;
  editWarung: (id: string, changes: Partial<Omit<Warung, 'id' | 'createdAt'>>) => void;
  addProduct: (input: { name: string; price: number; hpp?: number; stock?: number; unit?: string; tone?: Product['tone'] }) => Product;
  editProduct: (
    id: string,
    changes: Partial<Pick<Product, 'name' | 'price' | 'hpp' | 'stock' | 'unit' | 'tone' | 'active'>>,
  ) => void;
  setStock: (productId: string, stock: number, note?: string) => void;
  addPurchase: (input: PurchaseInput) => ReturnType<typeof createPurchase>;
  updateSettings: (changes: Partial<Settings>) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => loadState());
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
    saveState(state);
  }, [state]);

  const replace = useCallback((next: AppState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const start = useCallback((mode: 'demo' | 'clean') => {
    if (mode === 'demo') {
      replace(createDemoState());
      return;
    }
    const initial = createInitialState();
    replace({ ...initial, meta: { ...initial.meta, onboarded: true, demo: false } });
  }, [replace]);

  const resetAll = useCallback(() => {
    clearStoredState();
    const initial = createInitialState();
    stateRef.current = initial;
    setState(initial);
  }, []);

  const sell = useCallback((input: SaleInput) => {
    const result = createSale(stateRef.current, input);
    replace(result.state);
    return result;
  }, [replace]);

  const addConsignment = useCallback((input: ConsignmentInput) => {
    const result = createConsignment(stateRef.current, input);
    replace(result.state);
    return result;
  }, [replace]);

  const settleConsignment = useCallback((input: CloseConsignmentInput) => {
    const result = closeConsignment(stateRef.current, input);
    replace(result.state);
    return result;
  }, [replace]);

  const pay = useCallback((input: PaymentInput) => {
    replace(domainAddPayment(stateRef.current, input));
  }, [replace]);

  const addWarung = useCallback((input: Pick<Warung, 'name' | 'owner' | 'phone' | 'address' | 'notes'>) => {
    const result = createWarung(stateRef.current, input);
    replace(result.state);
    return result.warung;
  }, [replace]);

  const editWarung = useCallback((id: string, changes: Partial<Omit<Warung, 'id' | 'createdAt'>>) => {
    replace(updateWarung(stateRef.current, id, changes));
  }, [replace]);

  const addProduct = useCallback((input: { name: string; price: number; hpp?: number; stock?: number; unit?: string; tone?: Product['tone'] }) => {
    const result = createProduct(stateRef.current, input);
    replace(result.state);
    return result.product;
  }, [replace]);

  const editProduct = useCallback((
    id: string,
    changes: Partial<Pick<Product, 'name' | 'price' | 'hpp' | 'stock' | 'unit' | 'tone' | 'active'>>,
  ) => {
    replace(updateProduct(stateRef.current, id, changes));
  }, [replace]);

  const setStock = useCallback((productId: string, stock: number, note?: string) => {
    replace(adjustProductStock(stateRef.current, productId, stock, note));
  }, [replace]);

  const addPurchase = useCallback((input: PurchaseInput) => {
    const result = createPurchase(stateRef.current, input);
    replace(result.state);
    return result;
  }, [replace]);

  const updateSettings = useCallback((changes: Partial<Settings>) => {
    replace({
      ...stateRef.current,
      settings: { ...stateRef.current.settings, ...changes },
    });
  }, [replace]);

  const value = useMemo<StoreValue>(() => ({
    state,
    start,
    resetAll,
    replaceState: replace,
    sell,
    addConsignment,
    settleConsignment,
    pay,
    addWarung,
    editWarung,
    addProduct,
    editProduct,
    setStock,
    addPurchase,
    updateSettings,
  }), [
    state,
    start,
    resetAll,
    replace,
    sell,
    addConsignment,
    settleConsignment,
    pay,
    addWarung,
    editWarung,
    addProduct,
    editProduct,
    setStock,
    addPurchase,
    updateSettings,
  ]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore harus dipakai di dalam StoreProvider');
  return context;
}
