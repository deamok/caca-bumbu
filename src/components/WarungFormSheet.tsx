import { useEffect, useState } from 'react';
import { Check, Store } from 'lucide-react';
import type { Warung } from '../types';
import { useStore } from '../store/StoreContext';
import { useToast } from './Toast';
import { Button, Field, Input, Sheet, Textarea } from './ui';

export function WarungFormSheet({
  open,
  onClose,
  warung,
}: {
  open: boolean;
  onClose: () => void;
  warung?: Warung;
}) {
  const { addWarung, editWarung } = useStore();
  const { notify } = useToast();
  const [name, setName] = useState('');
  const [owner, setOwner] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(warung?.name ?? '');
    setOwner(warung?.owner ?? '');
    setPhone(warung?.phone ?? '');
    setAddress(warung?.address ?? '');
    setNotes(warung?.notes ?? '');
    setError('');
  }, [open, warung]);

  const save = () => {
    if (!name.trim()) {
      setError('Nama warung wajib diisi.');
      return;
    }
    try {
      if (warung) {
        editWarung(warung.id, { name: name.trim(), owner: owner.trim(), phone: phone.trim(), address: address.trim(), notes: notes.trim() });
        notify('Data warung diperbarui', { message: name.trim() });
      } else {
        addWarung({ name: name.trim(), owner: owner.trim(), phone: phone.trim(), address: address.trim(), notes: notes.trim() });
        notify('Warung baru ditambahkan', { message: name.trim() });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Data warung belum bisa disimpan.');
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={warung ? 'Edit warung' : 'Tambah warung'}
      description="Data ini membantu Ibu mengingat langganan dan tujuan titipan."
      footer={<Button full size="lg" onClick={save} icon={<Check size={17} />}>{warung ? 'Simpan perubahan' : 'Tambah warung'}</Button>}
    >
      <div className="warung-form">
        <div className="form-section__head compact">
          <span className="step-badge"><Store size={15} /></span>
          <div><h2>Informasi warung</h2><p>Cukup nama dan kontak yang biasa dipakai.</p></div>
        </div>
        <Field label="Nama warung" htmlFor="warung-name">
          <Input id="warung-name" value={name} onChange={(event) => { setName(event.target.value); setError(''); }} placeholder="Contoh: Warung Bu Sari" autoFocus />
        </Field>
        <div className="form-grid form-grid--2">
          <Field label="Nama pemilik" optional htmlFor="warung-owner">
            <Input id="warung-owner" value={owner} onChange={(event) => setOwner(event.target.value)} placeholder="Contoh: Sari" />
          </Field>
          <Field label="Nomor WhatsApp" optional htmlFor="warung-phone">
            <Input id="warung-phone" type="tel" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="08xx…" />
          </Field>
        </div>
        <Field label="Alamat" optional htmlFor="warung-address">
          <Input id="warung-address" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Contoh: Jl. Cempaka No. 12" />
        </Field>
        <Field label="Catatan" optional htmlFor="warung-notes">
          <Textarea id="warung-notes" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Contoh: titip tiap Senin, suka rendang" />
        </Field>
        {error ? <div className="form-error" role="alert">{error}</div> : null}
      </div>
    </Sheet>
  );
}
