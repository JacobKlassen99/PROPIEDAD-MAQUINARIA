import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Edit2,
  MapPin,
  Phone,
  Plus,
  Search,
  Trash2,
  UserCheck,
  UserX,
  Wallet,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import type { Customer } from '../types';
import * as backend from '../services/backend';
import { useI18n } from '../services/i18n';
import { Switch } from '../components/Switch';

interface CustomersViewProps {
  customers: Customer[];
  onRefresh: () => Promise<void> | void;
  onBack: () => void;
  onOpenCustomerAccount?: (clienteId: string) => void;
  isRefreshing?: boolean;
}

function normalizeNameKey(val: string): string {
  return val
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  customers,
  onRefresh,
  onBack,
  onOpenCustomerAccount,
  isRefreshing = false,
}) => {
  const { t, bi } = useI18n();

  const [mode, setMode] = useState<'list' | 'form'>('list');
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');

  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteCustomer, setConfirmDeleteCustomer] = useState<Customer | null>(null);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const filteredCustomers = useMemo(() => {
    const q = normalizeNameKey(search);
    return customers
      .filter((c) => {
        if (!showInactive && !c.activo) return false;
        if (!q) return true;
        const hay = normalizeNameKey(`${c.nombre} ${c.telefono || ''} ${c.direccion || ''}`);
        return hay.includes(q);
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
  }, [customers, search, showInactive]);

  const inactiveCount = useMemo(() => customers.filter((c) => !c.activo).length, [customers]);

  const openCreateForm = () => {
    setEditingCustomer(null);
    setNombre('');
    setTelefono('');
    setDireccion('');
    setMessage(null);
    setMode('form');
  };

  const openEditForm = (c: Customer) => {
    setEditingCustomer(c);
    setNombre(c.nombre || '');
    setTelefono(c.telefono || '');
    setDireccion(c.direccion || '');
    setMessage(null);
    setMode('form');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const cleanName = nombre.trim().replace(/\s+/g, ' ');
    if (!cleanName) {
      setMessage({
        type: 'err',
        text: bi('El nombre del cliente es obligatorio.', 'Customer name is required.'),
      });
      return;
    }

    const nameKey = normalizeNameKey(cleanName);
    const duplicate = customers.find(
      (c) =>
        normalizeNameKey(c.nombre) === nameKey &&
        (!editingCustomer || String(c.id) !== String(editingCustomer.id))
    );
    if (duplicate) {
      setMessage({
        type: 'err',
        text: bi(
          `Ya existe un cliente registrado con el nombre "${duplicate.nombre}".`,
          `A customer with the name "${duplicate.nombre}" already exists.`
        ),
      });
      return;
    }

    setSaving(true);
    try {
      if (editingCustomer) {
        await backend.updateCustomer(editingCustomer.id, {
          nombre: cleanName,
          telefono: telefono.trim(),
          direccion: direccion.trim(),
          activo: editingCustomer.activo,
        });
        setMessage({
          type: 'ok',
          text: bi('Cliente actualizado correctamente.', 'Customer updated successfully.'),
        });
      } else {
        await backend.createCustomer({
          nombre: cleanName,
          telefono: telefono.trim(),
          direccion: direccion.trim(),
        });
        setMessage({
          type: 'ok',
          text: bi('Cliente registrado correctamente.', 'Customer registered successfully.'),
        });
      }
      await onRefresh();
      setMode('list');
      setEditingCustomer(null);
    } catch (err: any) {
      setMessage({
        type: 'err',
        text: err?.message || bi('No se pudo guardar el cliente.', 'Could not save customer.'),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (c: Customer) => {
    setBusyId(c.id);
    setMessage(null);
    try {
      await backend.toggleCustomerActive(c.id, !c.activo);
      await onRefresh();
      setMessage({
        type: 'ok',
        text: !c.activo
          ? bi('Cliente reactivado.', 'Customer reactivated.')
          : bi('Cliente desactivado.', 'Customer deactivated.'),
      });
    } catch (err: any) {
      setMessage({
        type: 'err',
        text: err?.message || bi('No se pudo actualizar el estado.', 'Could not update status.'),
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!confirmDeleteCustomer) return;
    const target = confirmDeleteCustomer;
    setConfirmDeleteCustomer(null);
    setBusyId(target.id);
    setMessage(null);
    try {
      const res = await backend.deleteCustomer(target.id);
      await onRefresh();
      if (res.deactivated) {
        setMessage({
          type: 'ok',
          text:
            res.message ||
            bi(
              'El cliente tiene registros históricos vinculados y fue desactivado en lugar de eliminarse.',
              'This customer has linked historical records and was deactivated instead of deleted.'
            ),
        });
      } else {
        setMessage({
          type: 'ok',
          text: bi('Cliente eliminado correctamente.', 'Customer deleted successfully.'),
        });
      }
    } catch (err: any) {
      setMessage({
        type: 'err',
        text: err?.message || bi('No se pudo eliminar el cliente.', 'Could not delete customer.'),
      });
    } finally {
      setBusyId(null);
    }
  };

  if (mode === 'form') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2.5 pb-2 border-b border-[#E7ECE8]">
          <button
            type="button"
            onClick={() => {
              setMode('list');
              setEditingCustomer(null);
              setMessage(null);
            }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#DCE2DD] bg-white text-[#26352D] hover:bg-[#F5F7F4] transition cursor-pointer"
            aria-label={t('common.back')}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-[#26352D] truncate">
              {editingCustomer ? t('customers.editTitle') : t('customers.newTitle')}
            </h2>
          </div>
        </div>

        {message && (
          <div
            className={`rounded-xl border px-3.5 py-2.5 text-xs font-medium flex items-start gap-2 ${
              message.type === 'ok'
                ? 'border-[#24875B]/30 bg-[#EAF5EE] text-[#1D5C3F]'
                : 'border-[#C44545]/30 bg-[#FCECEC] text-[#962D2D]'
            }`}
          >
            {message.type === 'ok' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-[#24875B]" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-[#C44545]" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="rounded-2xl border border-[#E2E7E3] bg-white p-4 space-y-3.5">
          <div>
            <label className="block text-[13px] font-semibold text-[#26352D] mb-1">
              {t('customers.name')} <span className="text-[#C44545]">*</span>
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder={bi('Ej. Estancia San Pedro / Juan Pérez', 'e.g. San Pedro Farm / John Smith')}
              required
              autoFocus
              className="w-full h-[40px] rounded-xl border border-[#CFD8D2] bg-white px-3 text-sm font-medium text-[#1F2D25] focus:border-[#24875B] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#26352D] mb-1">
              {t('customers.phone')}{' '}
              <span className="text-[#7A8780] font-normal">{t('common.optional')}</span>
            </label>
            <input
              type="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder={bi('Ej. +591 70000000', 'e.g. +591 70000000')}
              className="w-full h-[40px] rounded-xl border border-[#CFD8D2] bg-white px-3 text-sm font-medium text-[#1F2D25] focus:border-[#24875B] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#26352D] mb-1">
              {t('customers.address')}{' '}
              <span className="text-[#7A8780] font-normal">{t('common.optional')}</span>
            </label>
            <input
              type="text"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              placeholder={bi('Ej. Zona Norte, Km 18', 'e.g. North Zone, Km 18')}
              className="w-full h-[40px] rounded-xl border border-[#CFD8D2] bg-white px-3 text-sm font-medium text-[#1F2D25] focus:border-[#24875B] focus:outline-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setMode('list');
                setEditingCustomer(null);
                setMessage(null);
              }}
              className="h-[40px] px-4 rounded-xl border border-[#CFD8D2] bg-white text-sm font-semibold text-[#4B5A52] hover:bg-[#F5F7F4] transition cursor-pointer"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-[40px] px-5 rounded-xl bg-[#24875B] hover:bg-[#1D704B] text-sm font-bold text-white transition cursor-pointer disabled:opacity-60 inline-flex items-center gap-2"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>{saving ? t('common.saving') : t('common.save')}</span>
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#E7ECE8]">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#DCE2DD] bg-white text-[#26352D] hover:bg-[#F5F7F4] transition cursor-pointer"
            aria-label={t('common.back')}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-[#26352D] leading-snug">{t('customers.title')}</h2>
            <p className="text-xs text-[#64746B] tabular-nums">
              {customers.filter((c) => c.activo).length} {bi('activos', 'active')}
              {isRefreshing ? ` · ${bi('Actualizando...', 'Updating...')}` : ''}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={openCreateForm}
          className="h-[38px] px-3.5 rounded-xl bg-[#24875B] hover:bg-[#1D704B] text-white text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>{bi('Nuevo', 'New')}</span>
        </button>
      </div>

      {message && (
        <div
          className={`rounded-xl border px-3.5 py-2.5 text-xs font-medium flex items-start gap-2 ${
            message.type === 'ok'
              ? 'border-[#24875B]/30 bg-[#EAF5EE] text-[#1D5C3F]'
              : 'border-[#C44545]/30 bg-[#FCECEC] text-[#962D2D]'
          }`}
        >
          {message.type === 'ok' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-[#24875B]" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-[#C44545]" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Search + inactive filter */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7A8780]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={bi('Buscar cliente por nombre, teléfono o dirección...', 'Search customer by name, phone or address...')}
            className="w-full h-[40px] pl-9 pr-3 rounded-xl border border-[#CFD8D2] bg-white text-sm text-[#1F2D25] focus:border-[#24875B] focus:outline-none"
          />
        </div>
        {inactiveCount > 0 && (
          <div className="rounded-xl border border-[#E2E7E3] bg-white px-3.5 py-2">
            <Switch<boolean>
              inline
              label={bi(`Mostrar inactivos (${inactiveCount})`, `Show inactive (${inactiveCount})`)}
              value={showInactive}
              onChange={setShowInactive}
            />
          </div>
        )}
      </div>

      {/* Customers List */}
      {filteredCustomers.length === 0 ? (
        <div className="rounded-2xl border border-[#E2E7E3] bg-white px-4 py-8 text-center">
          <p className="text-sm font-medium text-[#5E6D64]">
            {search.trim()
              ? bi('No se encontraron clientes con ese criterio.', 'No customers match that search.')
              : bi('Aún no hay clientes registrados.', 'No customers registered yet.')}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-[#E2E7E3] bg-white divide-y divide-[#EEF2EF] overflow-hidden">
          {filteredCustomers.map((c) => {
            const isBusy = busyId === c.id;
            return (
              <div
                key={c.id}
                className={`px-3.5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                  !c.activo ? 'bg-[#F8FAF8] opacity-75' : ''
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-[#1F2D25] truncate">{c.nombre}</p>
                    {!c.activo && (
                      <span className="text-[11px] font-semibold text-[#7A8780]">
                        ({bi('Inactivo', 'Inactive')})
                      </span>
                    )}
                  </div>
                  {(c.telefono || c.direccion) && (
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[#64746B]">
                      {c.telefono && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3 w-3 shrink-0" />
                          <span>{c.telefono}</span>
                        </span>
                      )}
                      {c.direccion && (
                        <span className="inline-flex items-center gap-1 truncate">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{c.direccion}</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {onOpenCustomerAccount && (
                    <button
                      type="button"
                      onClick={() => onOpenCustomerAccount(c.id)}
                      className="h-8 px-2.5 rounded-lg border border-[#CFD8D2] bg-white hover:bg-[#EAF5EE] hover:border-[#24875B]/50 text-xs font-semibold text-[#1D5C3F] inline-flex items-center gap-1 transition cursor-pointer"
                      title={bi('Ver cuenta e historial de cobros', 'View account and payment history')}
                    >
                      <Wallet className="h-3.5 w-3.5" />
                      <span>{bi('Cuenta', 'Account')}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => openEditForm(c)}
                    className="h-8 w-8 rounded-lg border border-[#DCE2DD] bg-white hover:bg-[#F5F7F4] text-[#4B5A52] flex items-center justify-center transition cursor-pointer disabled:opacity-50"
                    title={t('common.edit')}
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleToggleActive(c)}
                    className="h-8 w-8 rounded-lg border border-[#DCE2DD] bg-white hover:bg-[#F5F7F4] text-[#4B5A52] flex items-center justify-center transition cursor-pointer disabled:opacity-50"
                    title={c.activo ? bi('Desactivar', 'Deactivate') : bi('Reactivar', 'Reactivate')}
                  >
                    {c.activo ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5 text-[#24875B]" />}
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => setConfirmDeleteCustomer(c)}
                    className="h-8 w-8 rounded-lg border border-[#DCE2DD] bg-white hover:bg-[#FCECEC] hover:border-[#C44545]/40 text-[#B42323] flex items-center justify-center transition cursor-pointer disabled:opacity-50"
                    title={t('common.delete')}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirm Delete inline modal */}
      {confirmDeleteCustomer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          onClick={() => setConfirmDeleteCustomer(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white border border-[#DCE2DD] p-4 space-y-3 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold text-[#26352D]">
              {bi('Eliminar cliente', 'Delete customer')}
            </h3>
            <p className="text-xs text-[#5E6D64] leading-relaxed">
              {bi(
                `¿Deseas eliminar a "${confirmDeleteCustomer.nombre}"? Si tiene trabajos, ventas o cobros vinculados, se desactivará para conservar el historial.`,
                `Delete "${confirmDeleteCustomer.nombre}"? If it has linked jobs, sales, or payments, it will be deactivated to preserve history.`
              )}
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmDeleteCustomer(null)}
                className="h-9 px-3.5 rounded-xl border border-[#CFD8D2] bg-white text-xs font-semibold text-[#4B5A52] hover:bg-[#F5F7F4] cursor-pointer"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirmed}
                className="h-9 px-4 rounded-xl bg-[#C44545] hover:bg-[#A93838] text-xs font-bold text-white cursor-pointer"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
