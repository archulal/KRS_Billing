import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import {
  X, Printer, MessageCircle, Plus, Scale, Wallet, FileText,
  Trash2, CheckCircle2, AlertCircle, Loader2, Pencil, Phone, MapPin,
  ArrowDownRight, BookOpen, Send, ChevronRight
} from 'lucide-react';
import krsLogoPrint from '../assets/krs_banana_tree_print.png';

const pad = (n) => String(n).padStart(2, '0');

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const inr = (value) => {
  const n = Number(value || 0);
  const sign = n < 0 ? '-' : '';
  return `${sign}₹${Math.abs(n).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

export default function CustomerLedger({ customer, settings, onClose, onLedgerChanged }) {
  const { lang, t } = useLanguage();
  const whatsappEnabled = settings?.whatsapp_enabled !== 'false';

  const [ledger, setLedger] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [notice, setNotice] = useState(null);

  // Payment / adjustment modal
  const [isEntryOpen, setIsEntryOpen] = useState(false);
  const [entryKind, setEntryKind] = useState('payment'); // payment | credit | debit
  const [entryAmount, setEntryAmount] = useState('');
  const [entryDate, setEntryDate] = useState(todayISO());
  const [entryNote, setEntryNote] = useState('');
  const [isSavingEntry, setIsSavingEntry] = useState(false);

  // Opening balance modal
  const [isOpeningOpen, setIsOpeningOpen] = useState(false);
  const [openingAmount, setOpeningAmount] = useState('');
  const [openingDate, setOpeningDate] = useState(todayISO());
  const [isSavingOpening, setIsSavingOpening] = useState(false);

  // WhatsApp confirmation
  const [showWaConfirm, setShowWaConfirm] = useState(false);
  const [waStatus, setWaStatus] = useState(null);

  const showNotice = (type, message) => {
    setNotice({ type, message });
    setTimeout(() => setNotice(null), 5000);
  };

  const fetchLedger = useCallback(async () => {
    if (!customer?.id) return;
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);
      const qs = params.toString();
      const res = await fetch(`/api/customers/${customer.id}/ledger${qs ? `?${qs}` : ''}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load ledger');
      setLedger(data);
    } catch (err) {
      console.error('Ledger load error:', err);
      setError(err.message || 'Failed to load ledger');
    } finally {
      setIsLoading(false);
    }
  }, [customer?.id, fromDate, toDate]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !isEntryOpen && !isOpeningOpen && !showWaConfirm) onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isEntryOpen, isOpeningOpen, showWaConfirm, onClose]);

  const activeCustomer = ledger?.customer || customer || {};
  const summary = ledger?.summary || {};
  const lifetime = ledger?.lifetime || {};
  const entries = ledger?.entries || [];

  const displayName = useMemo(() => {
    if (activeCustomer.shop_name && activeCustomer.name) {
      return `${activeCustomer.shop_name} (${activeCustomer.name})`;
    }
    return activeCustomer.shop_name || activeCustomer.name || t('customer');
  }, [activeCustomer, t]);

  const closing = round2(summary.closing_balance ?? lifetime.outstanding ?? 0);
  const isAdvance = closing < 0;
  const billCount = lifetime.bills_count ?? 0;
  const billUnit = lang === 'ml' ? 'ബിൽ' : billCount === 1 ? 'Bill' : 'Bills';

  const formatDate = (value) => {
    if (!value) return '—';
    const d = new Date(String(value).replace(' ', 'T'));
    if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
    return d.toLocaleDateString(lang === 'ml' ? 'ml-IN' : 'en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  };

  const rowParticulars = (row) => {
    if (row.kind === 'opening') {
      return fromDate ? t('broughtForward') : t('openingEntry');
    }
    if (row.kind === 'bill') {
      return `${t('billEntry')} ${row.bill_number || `#${row.ref_id}`}`;
    }
    if (row.kind === 'payment') {
      return row.note ? row.note : t('paymentEntry');
    }
    if (row.kind === 'bill_payment') {
      return `${t('paidOnBill')} ${row.bill_number || `#${row.ref_id}`}`;
    }
    return row.note ? row.note : t('adjustmentEntry');
  };

  const rowTypeLabel = (row) => {
    if (row.kind === 'opening') return t('openingEntry');
    if (row.kind === 'bill') return t('billEntry');
    if (row.kind === 'payment' || row.kind === 'bill_payment') return t('paymentEntry');
    return t('adjustmentEntry');
  };

  const resetEntryForm = () => {
    setEntryKind('payment');
    setEntryAmount('');
    setEntryDate(todayISO());
    setEntryNote('');
  };

  const openEntryModal = () => {
    resetEntryForm();
    setIsEntryOpen(true);
  };

  const openOpeningModal = () => {
    setOpeningAmount(String(activeCustomer.opening_balance || 0));
    setOpeningDate(activeCustomer.opening_balance_date || todayISO());
    setIsOpeningOpen(true);
  };

  const handleSaveEntry = async (e) => {
    e.preventDefault();
    const amount = round2(entryAmount);
    if (!(amount > 0)) {
      showNotice('error', lang === 'ml' ? 'തുക 0-ൽ കൂടുതലായിരിക്കണം.' : 'Amount must be greater than zero.');
      return;
    }

    setIsSavingEntry(true);
    try {
      const res = await fetch(`/api/customers/${customer.id}/ledger/entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry_type: entryKind === 'payment' ? 'payment' : 'adjustment',
          direction: entryKind === 'debit' ? 'debit' : 'credit',
          amount,
          entry_date: entryDate || todayISO(),
          note: entryNote.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to save');
      setIsEntryOpen(false);
      resetEntryForm();
      showNotice('success', t('paymentSaved'));
      await fetchLedger();
      onLedgerChanged?.();
    } catch (err) {
      console.error(err);
      showNotice('error', err.message);
    } finally {
      setIsSavingEntry(false);
    }
  };

  const handleSaveOpening = async (e) => {
    e.preventDefault();
    setIsSavingOpening(true);
    try {
      const res = await fetch(`/api/customers/${customer.id}/opening-balance`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opening_balance: round2(openingAmount),
          opening_balance_date: openingDate || todayISO(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to save');
      setIsOpeningOpen(false);
      showNotice('success', t('openingSaved'));
      await fetchLedger();
      onLedgerChanged?.();
    } catch (err) {
      console.error(err);
      showNotice('error', err.message);
    } finally {
      setIsSavingOpening(false);
    }
  };

  const handleDeleteEntry = async (entryId) => {
    if (!window.confirm(t('confirmDeleteLedgerEntry'))) return;
    try {
      const res = await fetch(`/api/customers/${customer.id}/ledger/entries/${entryId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to delete');
      await fetchLedger();
      onLedgerChanged?.();
    } catch (err) {
      console.error(err);
      showNotice('error', err.message);
    }
  };

  const handlePrint = async () => {
    setWaStatus({ type: 'info', message: t('sendingToPrinter') });
    try {
      if (window.electronAPI?.printSilent) {
        const result = await window.electronAPI.printSilent({
          paperSize: 'A4',
          elementId: 'printable-ledger',
        });
        if (result?.success) {
          setWaStatus({ type: 'success', message: t('sentToPrinter') });
        } else {
          setWaStatus({ type: 'error', message: result?.failureReason || t('printFailed') });
        }
      } else {
        setWaStatus(null);
        window.print();
      }
    } catch (err) {
      console.error('Ledger print error:', err);
      setWaStatus({ type: 'error', message: err.message || t('printFailed') });
    }
  };

  const buildWhatsAppCaption = () => {
    const period = fromDate || toDate
      ? `${fromDate || '…'} → ${toDate || '…'}`
      : t('allPeriods');
    const due = closing > 0 ? closing : 0;
    return [
      'KRS Plantain Merchant & Commission Agent',
      lang === 'ml' ? 'കസ്റ്റമർ ലെഡ്ജർ സ്റ്റേറ്റ്മെന്റ്' : 'Customer Ledger Statement',
      `${t('customer')}: ${displayName}`,
      `${t('ledgerPeriod')}: ${period}`,
      `${t('closingBalance')}: ${inr(closing)}`,
      `${t('amountDue')}: ${inr(due)}`,
      lang === 'ml' ? 'കൂടുതൽ വിവരങ്ങൾക്ക് ബന്ധപ്പെടുക.' : 'Please contact us for any clarification.',
    ].join('\n');
  };

  const handleSendWhatsApp = async () => {
    if (!whatsappEnabled) {
      showNotice('warning', t('waDisabled'));
      return;
    }
    setShowWaConfirm(false);
    const phone = (activeCustomer.phone || '').trim();
    if (!phone) {
      showNotice('warning', t('ledgerWaNoNumber'));
      return;
    }
    if (!window.electronAPI?.whatsapp || !window.electronAPI?.generateLedgerPdf) {
      showNotice('error', t('waDesktopOnly'));
      return;
    }

    setWaStatus({ type: 'info', message: t('ledgerWaSending') });
    try {
      const pdf = await window.electronAPI.generateLedgerPdf({
        fileName: `LEDGER-${activeCustomer.name || activeCustomer.id}-${todayISO()}`,
      });
      if (!pdf?.success) throw new Error(pdf?.error || t('printFailed'));

      const result = await window.electronAPI.whatsapp.sendBill({
        phone,
        filePath: pdf.filePath,
        caption: buildWhatsAppCaption(),
      });
      if (!result?.success) throw new Error(result?.error || t('waSettingsError'));

      setWaStatus({ type: 'success', message: t('ledgerWaSent') });
    } catch (err) {
      console.error('Ledger WhatsApp error:', err);
      setWaStatus({ type: 'error', message: err.message || t('waSettingsError') });
    }
  };

  if (!customer) return null;

  const periodLabel = fromDate || toDate
    ? `${fromDate || '…'} → ${toDate || '…'}`
    : t('allPeriods');
  const generatedAt = new Date().toLocaleString(lang === 'ml' ? 'ml-IN' : 'en-IN', {
    dateStyle: 'medium', timeStyle: 'short',
  });

  return (
    <div className="invoice-modal-container fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm p-2 sm:p-5">
      <div className="invoice-modal-dialog mx-auto my-2 sm:my-4 w-full max-w-6xl bg-white rounded-2xl shadow-2xl ring-1 ring-slate-900/10 overflow-hidden">

        {/* ---------------- SCREEN HEADER ---------------- */}
        <div className="no-print relative bg-gradient-to-r from-[#062f22] via-[#0e4f33] to-[#156b46] px-5 sm:px-6 py-5 text-white overflow-hidden">
          <div className="absolute -right-8 -top-12 w-44 h-44 rounded-full bg-white/5 pointer-events-none" />
          <div className="absolute -left-10 bottom-[-70px] w-40 h-40 rounded-full bg-amber-300/10 pointer-events-none" />
          <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-white/95 p-1.5 shrink-0 shadow-lg ring-1 ring-emerald-300/50">
                <img src={krsLogoPrint} alt="KRS" className="w-full h-full object-contain" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg sm:text-xl font-black tracking-tight leading-none">
                    {t('ledgerTitle')}
                  </h2>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold ring-1 ring-white/20">
                    <BookOpen className="w-3 h-3" />
                    {billCount} {billUnit}
                  </span>
                </div>
                <p className="text-sm font-semibold text-emerald-50 mt-1.5 truncate">{displayName}</p>
                <div className="flex items-center gap-3 mt-1 text-[11px] text-emerald-100/80 flex-wrap">
                  {activeCustomer.phone && (
                    <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" />{activeCustomer.phone}</span>
                  )}
                  {activeCustomer.address && (
                    <span className="inline-flex items-center gap-1 truncate max-w-[320px]"><MapPin className="w-3 h-3" />{activeCustomer.address}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 ring-1 ring-white/25 text-white text-xs font-bold transition-all"
              >
                <Printer className="w-4 h-4" />
                <span className="hidden sm:inline">{t('printLedger')}</span>
              </button>
              {whatsappEnabled && (
              <button
                type="button"
                onClick={() => setShowWaConfirm(true)}
                className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-emerald-950 text-xs font-black shadow-md shadow-amber-900/20 transition-all"
              >
                <MessageCircle className="w-4 h-4" />
                <span className="hidden sm:inline">{t('sendLedgerOnWhatsApp')}</span>
              </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-2.5 rounded-xl text-white/80 hover:text-white hover:bg-white/15 ring-1 ring-white/15 transition-all"
                aria-label={t('closePreview')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ---------------- SCREEN BODY ---------------- */}
        <div className="no-print p-4 sm:p-5 space-y-4 max-h-[calc(100vh-140px)] overflow-y-auto">

          {notice && (
            <div className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-xs font-bold ring-1 ${
              notice.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 ring-emerald-200'
                : notice.type === 'warning'
                  ? 'bg-amber-50 text-amber-900 ring-amber-200'
                  : 'bg-red-50 text-red-900 ring-red-200'
            }`}>
              <span className="flex items-center gap-2">
                {notice.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                {notice.message}
              </span>
              <button type="button" onClick={() => setNotice(null)} className="opacity-60 hover:opacity-100">✕</button>
            </div>
          )}

          {waStatus && (
            <div className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold ring-1 ${
              waStatus.type === 'info'
                ? 'bg-sky-50 text-sky-900 ring-sky-200'
                : waStatus.type === 'success'
                  ? 'bg-emerald-50 text-emerald-900 ring-emerald-200'
                  : 'bg-red-50 text-red-900 ring-red-200'
            }`}>
              {waStatus.type === 'info' && <Loader2 className="w-4 h-4 animate-spin" />}
              {waStatus.type === 'success' && <CheckCircle2 className="w-4 h-4" />}
              {waStatus.type === 'error' && <AlertCircle className="w-4 h-4" />}
              <span>{waStatus.message}</span>
            </div>
          )}

          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className={`rounded-2xl p-4 ring-1 shadow-sm ${
              closing > 0
                ? 'bg-gradient-to-br from-red-50 to-amber-50 ring-red-200/70'
                : 'bg-gradient-to-br from-emerald-50 to-teal-50 ring-emerald-200/70'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{t('outstanding')}</span>
                <Wallet className={`w-4 h-4 ${closing > 0 ? 'text-red-500' : 'text-emerald-600'}`} />
              </div>
              <p className={`mt-1.5 text-xl sm:text-2xl font-black tabular-nums ${closing > 0 ? 'text-red-700' : 'text-emerald-800'}`}>
                {inr(Math.abs(closing))}
              </p>
              <p className={`text-[11px] font-bold ${closing > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                {closing > 0 ? t('dueAmount') : isAdvance ? t('advanceAmount') : t('settled')}
              </p>
            </div>

            <div className="rounded-2xl p-4 bg-white ring-1 ring-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{t('totalBilled')}</span>
                <FileText className="w-4 h-4 text-amber-500" />
              </div>
              <p className="mt-1.5 text-xl sm:text-2xl font-black text-slate-900 tabular-nums">{inr(lifetime.total_billed)}</p>
              <p className="text-[11px] font-semibold text-slate-400">{billCount} {billUnit}</p>
            </div>

            <div className="rounded-2xl p-4 bg-white ring-1 ring-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{t('totalPaid')}</span>
                <ArrowDownRight className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="mt-1.5 text-xl sm:text-2xl font-black text-emerald-700 tabular-nums">{inr(lifetime.total_paid)}</p>
              <p className="text-[11px] font-semibold text-slate-400">{t('openingBalance')}: {inr(summary.opening_balance)}</p>
            </div>

            <div className="rounded-2xl p-4 bg-white ring-1 ring-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{t('closingBalance')}</span>
                <Scale className="w-4 h-4 text-[#156b46]" />
              </div>
              <p className="mt-1.5 text-xl sm:text-2xl font-black text-slate-900 tabular-nums">{inr(closing)}</p>
              <p className="text-[11px] font-semibold text-slate-400 truncate">{periodLabel}</p>
            </div>
          </div>

          {/* Actions + date filter */}
          <div className="rounded-2xl bg-slate-50/80 ring-1 ring-slate-200 p-3.5 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <button type="button" onClick={openEntryModal} className="ui-btn-primary shadow-md shadow-emerald-900/15">
                <Plus className="w-4 h-4" />
                {t('recordPayment')}
              </button>
              <button type="button" onClick={openOpeningModal} className="ui-btn-soft">
                <Pencil className="w-3.5 h-3.5" />
                {t('editOpeningBalance')}
              </button>
            </div>

            <div className="flex items-end gap-2 flex-wrap">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">{t('ledgerFrom')}</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="ui-input w-40 py-2"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">{t('ledgerTo')}</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="ui-input w-40 py-2"
                />
              </div>
              {(fromDate || toDate) && (
                <button
                  type="button"
                  onClick={() => { setFromDate(''); setToDate(''); }}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-900 hover:bg-white ring-1 ring-slate-200 transition-all"
                >
                  {t('clearFilter')}
                </button>
              )}
            </div>
          </div>

          {/* Ledger table */}
          <div className="rounded-2xl ring-1 ring-slate-200 overflow-hidden bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200 text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">
                    <th className="px-4 py-3 whitespace-nowrap">{t('ledgerDate')}</th>
                    <th className="px-4 py-3">{t('particulars')}</th>
                    <th className="px-4 py-3 text-right whitespace-nowrap">{t('debitShort')}</th>
                    <th className="px-4 py-3 text-right whitespace-nowrap">{t('creditShort')}</th>
                    <th className="px-4 py-3 text-right whitespace-nowrap">{t('balance')}</th>
                    <th className="px-3 py-3 text-center w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="py-14 text-center">
                        <Loader2 className="w-6 h-6 animate-spin text-emerald-600 mx-auto" />
                        <p className="mt-2 text-xs font-semibold text-slate-500">Loading…</p>
                      </td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center">
                        <AlertCircle className="w-7 h-7 text-red-500 mx-auto" />
                        <p className="mt-2 text-sm font-semibold text-red-700">{error}</p>
                      </td>
                    </tr>
                  ) : entries.length <= 1 && !fromDate && !toDate && closing === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 mb-3">
                          <BookOpen className="w-6 h-6" />
                        </div>
                        <p className="text-sm font-bold text-slate-700">{t('noLedgerEntries')}</p>
                        <p className="text-xs text-slate-400 mt-1">{t('ledgerEmptyNote')}</p>
                      </td>
                    </tr>
                  ) : (
                    entries.map((row, idx) => (
                      <tr
                        key={`${row.kind}-${row.ref_id ?? 'opening'}-${idx}`}
                        className={`transition-colors ${
                          row.kind === 'opening'
                            ? 'bg-amber-50/50'
                            : row.kind === 'bill'
                              ? 'hover:bg-emerald-50/40'
                              : 'hover:bg-sky-50/40'
                        }`}
                      >
                        <td className="px-4 py-3 text-xs font-semibold text-slate-600 whitespace-nowrap">
                          {row.kind === 'opening' && !row.date ? '—' : formatDate(row.date)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            {row.kind !== 'opening' && (
                              <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide ring-1 ${
                                row.kind === 'bill'
                                  ? 'bg-slate-100 text-slate-600 ring-slate-200'
                                  : row.direction === 'debit'
                                    ? 'bg-red-50 text-red-700 ring-red-200'
                                    : 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                              }`}>
                                {rowTypeLabel(row)}
                              </span>
                            )}
                            <span className="text-xs font-bold text-slate-800">{rowParticulars(row)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs font-bold text-slate-800 tabular-nums">
                          {row.debit ? inr(row.debit) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs font-bold text-emerald-700 tabular-nums">
                          {row.credit ? inr(row.credit) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs font-black text-slate-900 tabular-nums">
                          {inr(row.balance)}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {(row.kind === 'payment' || row.kind === 'adjustment') && (
                            <button
                              type="button"
                              onClick={() => handleDeleteEntry(row.ref_id)}
                              className="p-1.5 rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50 transition-all"
                              title={t('deleteLedgerEntry')}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {entries.length > 1 && (
                  <tfoot>
                    <tr className="bg-slate-50 border-t-2 border-slate-200">
                      <td colSpan={2} className="px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-600">
                        {t('closingBalance')}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-bold text-slate-700 tabular-nums">
                        {inr(entries.slice(1).reduce((s, r) => s + (r.debit || 0), 0))}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-bold text-emerald-700 tabular-nums">
                        {inr(entries.slice(1).reduce((s, r) => s + (r.credit || 0), 0))}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm font-black text-[#0e4f33] tabular-nums">
                        {inr(closing)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
            <ChevronRight className="w-3 h-3 text-emerald-500" />
            {t('addOpeningFirst')}
          </p>
        </div>

        {/* ---------------- PRINTABLE STATEMENT ---------------- */}
        <div
          id="printable-ledger"
          className="print-area size-a4 hidden bg-white text-slate-800 w-[196mm] p-6"
          style={{
            fontFamily: "'Noto Sans Malayalam', sans-serif",
            WebkitPrintColorAdjust: 'exact',
            printColorAdjust: 'exact',
          }}
        >
          <div
            className="rounded-xl px-3 pb-2.5 pt-2.5 mb-3 border-b-2"
            style={{
              background: 'linear-gradient(135deg, #dcfce7 0%, #fef9c3 55%, #ffedd5 100%)',
              borderBottomColor: '#d97706',
              borderTop: '4px solid #156b46',
            }}
          >
            <div className="flex items-center justify-center gap-3">
              <img
                src={krsLogoPrint}
                alt="KRS"
                className="w-10 h-11 object-contain rounded-md p-0.5 border bg-amber-100"
                style={{ borderColor: '#d97706' }}
              />
              <div className="text-center">
                <h1 className="text-base font-black uppercase tracking-tight leading-snug" style={{ color: '#0e4f33' }}>
                  {lang === 'ml' ? 'കെ.ആർ.എസ് പ്ലാന്റയിൻ മർച്ചന്റ് & കമ്മീഷൻ ഏജന്റ്' : 'KRS PLANTAIN MERCHANT & COMMISSION AGENT'}
                </h1>
                <p className="text-[9px] font-bold uppercase tracking-wide mt-0.5" style={{ color: '#b45309' }}>
                  {lang === 'ml' ? 'വാഴപ്പഴ മൊത്തവ്യാപാരം & കമ്മീഷൻ ഏജന്റ്' : 'Wholesale Plantain Merchant & Commission Agent'}
                </p>
                <p className="text-[8px] font-semibold mt-0.5" style={{ color: '#065f46' }}>
                  {lang === 'ml'
                    ? 'വാഴിച്ചേരി മാർക്കറ്റ്, ആലപ്പുഴ - 688001 | ഫോൺ: 9447304307'
                    : 'Vazhichery Market, Alappuzha - 688001 | Ph: +91 94473 04307'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 mb-2">
            <div>
              <span className="inline-block px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-[0.16em] text-white bg-[#156b46]">
                {t('ledgerStatement')}
              </span>
              <p className="text-[10px] font-bold mt-1 leading-relaxed" style={{ color: '#b45309' }}>
                {t('ledgerStatementMl')}
              </p>
            </div>
            <div className="text-right text-[9px] text-slate-600">
              <p><span className="font-bold">{t('generatedOn')}:</span> {generatedAt}</p>
              <p><span className="font-bold">{t('ledgerPeriod')}:</span> {periodLabel}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-2 rounded-xl border px-3 py-2 text-[9px]" style={{ borderColor: '#a7f3d0', background: '#f0fdf4' }}>
            <div>
              <p className="font-black uppercase tracking-wider text-[8px]" style={{ color: '#047857' }}>{t('customer')}</p>
              <p className="text-[11px] font-black text-slate-900">{displayName}</p>
              {activeCustomer.phone && <p className="font-semibold text-slate-700">📞 {activeCustomer.phone}</p>}
              {activeCustomer.address && <p className="text-slate-600">{activeCustomer.address}</p>}
            </div>
            <div className="text-right">
              <p className="font-black uppercase tracking-wider text-[8px]" style={{ color: '#047857' }}>{t('closingBalance')}</p>
              <p className="text-[16px] font-black leading-tight" style={{ color: closing > 0 ? '#b91c1c' : '#047857' }}>
                {inr(closing)}
              </p>
              <p className="font-bold text-slate-700">
                {closing > 0 ? t('amountDue') : isAdvance ? t('advanceAmount') : t('settled')}
              </p>
            </div>
          </div>

          <div className="rounded-xl overflow-hidden border mb-2" style={{ borderColor: '#a7f3d0' }}>
            <table className="print-table w-full border-collapse text-[9px] text-slate-800">
              <thead>
                <tr style={{ background: '#156b46', color: '#ffffff' }}>
                  <th className="px-2 py-1.5 text-left">{t('ledgerDate')}</th>
                  <th className="px-2 py-1.5 text-left">{t('particulars')}</th>
                  <th className="px-2 py-1.5 text-right">{t('debitShort')}</th>
                  <th className="px-2 py-1.5 text-right">{t('creditShort')}</th>
                  <th className="px-2 py-1.5 text-right">{t('balance')}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((row, idx) => (
                  <tr key={`print-${row.kind}-${row.ref_id ?? 'opening'}-${idx}`} style={{ background: row.kind === 'opening' ? '#fffbeb' : idx % 2 ? '#f8fafc' : '#ffffff' }}>
                    <td className="px-2 py-1 border-t font-semibold text-slate-600 whitespace-nowrap" style={{ borderColor: '#e2e8f0' }}>
                      {row.kind === 'opening' && !row.date ? '—' : formatDate(row.date)}
                    </td>
                    <td className="px-2 py-1 border-t font-bold text-slate-800" style={{ borderColor: '#e2e8f0' }}>
                      {rowParticulars(row)}
                      {row.kind === 'adjustment' && (
                        <span className="ml-1 text-[7px] font-black uppercase" style={{ color: row.direction === 'debit' ? '#b91c1c' : '#047857' }}>
                          ({row.direction === 'debit' ? '+' : '−'})
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1 border-t text-right font-mono" style={{ borderColor: '#e2e8f0' }}>
                      {row.debit ? inr(row.debit) : '—'}
                    </td>
                    <td className="px-2 py-1 border-t text-right font-mono" style={{ borderColor: '#e2e8f0', color: '#047857' }}>
                      {row.credit ? inr(row.credit) : '—'}
                    </td>
                    <td className="px-2 py-1 border-t text-right font-mono font-black" style={{ borderColor: '#e2e8f0' }}>
                      {inr(row.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: '#ecfdf5', color: '#064e3b' }}>
                  <td colSpan={2} className="px-2 py-1.5 font-black uppercase tracking-wide">{t('closingBalance')}</td>
                  <td className="px-2 py-1.5 text-right font-mono font-bold">
                    {inr(entries.slice(1).reduce((s, r) => s + (r.debit || 0), 0))}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono font-bold">
                    {inr(entries.slice(1).reduce((s, r) => s + (r.credit || 0), 0))}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono font-black">{inr(closing)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="flex items-center justify-between gap-3 mt-4 pt-2 border-t text-[9px]" style={{ borderColor: '#d97706' }}>
            <p className="font-semibold text-slate-500">
              {lang === 'ml'
                ? 'ഈ ലെഡ്ജർ സ്റ്റേറ്റ്മെന്റ് കെ.ആർ.എസ് ബില്ലിംഗ് സിസ്റ്റത്തിൽ നിന്ന് തയ്യാറാക്കിയതാണ്.'
                : 'This ledger statement was generated from the KRS Billing System.'}
            </p>
            <p className="font-black uppercase tracking-wider" style={{ color: '#047857' }}>
              {lang === 'ml' ? 'അംഗീകൃത ഒപ്പ്' : 'Authorized Signatory'}
            </p>
          </div>
        </div>
      </div>

      {/* ---------------- PAYMENT / ADJUSTMENT MODAL ---------------- */}
      {isEntryOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl ring-1 ring-slate-900/10 w-full max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-[#062f22] via-[#0e4f33] to-[#156b46] px-5 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-white/15 ring-1 ring-white/25">
                  <Wallet className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm">{t('recordPayment')}</h3>
              </div>
              <button type="button" onClick={() => setIsEntryOpen(false)} className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/15">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEntry} className="p-5 space-y-4">
              <div>
                <label className="ui-label">{t('ledgerEntryType')}</label>
                <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl ring-1 ring-slate-200">
                  {[
                    { id: 'payment', label: t('paymentReceived') },
                    { id: 'credit', label: t('discountCredit') },
                    { id: 'debit', label: t('debitCharge') },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setEntryKind(opt.id)}
                      className={`px-1 py-2 rounded-lg text-[10px] font-bold leading-tight transition-all ${
                        entryKind === opt.id
                          ? 'bg-white text-emerald-900 shadow-sm ring-1 ring-emerald-200'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5 font-medium">
                  {entryKind === 'payment'
                    ? t('ledgerPaymentTypePayment')
                    : entryKind === 'credit'
                      ? t('ledgerPaymentTypeCredit')
                      : t('ledgerPaymentTypeDebit')}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="ui-label">{t('ledgerAmount')}</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    autoFocus
                    required
                    value={entryAmount}
                    onChange={(e) => setEntryAmount(e.target.value)}
                    className="ui-input"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="ui-label">{t('ledgerDate')}</label>
                  <input
                    type="date"
                    required
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className="ui-input"
                  />
                </div>
              </div>

              <div>
                <label className="ui-label">{t('ledgerNote')}</label>
                <input
                  type="text"
                  value={entryNote}
                  onChange={(e) => setEntryNote(e.target.value)}
                  className="ui-input"
                  placeholder={lang === 'ml' ? 'ഉദാ: ക്യാഷ് / UPI റഫറൻസ്' : 'e.g. Cash / UPI reference'}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button type="button" onClick={() => setIsEntryOpen(false)} className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 ring-1 ring-slate-200">
                  {lang === 'ml' ? 'റദ്ദാക്കുക' : 'Cancel'}
                </button>
                <button type="submit" disabled={isSavingEntry} className="ui-btn-primary">
                  {isSavingEntry ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {t('saveLedgerEntry')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- OPENING BALANCE MODAL ---------------- */}
      {isOpeningOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl ring-1 ring-slate-900/10 w-full max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-[#062f22] via-[#0e4f33] to-[#156b46] px-5 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-white/15 ring-1 ring-white/25">
                  <Scale className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm">{t('editOpeningBalance')}</h3>
              </div>
              <button type="button" onClick={() => setIsOpeningOpen(false)} className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/15">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveOpening} className="p-5 space-y-4">
              <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{t('openingBalanceHint')}</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="ui-label">{t('openingAmount')}</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    autoFocus
                    value={openingAmount}
                    onChange={(e) => setOpeningAmount(e.target.value)}
                    className="ui-input"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="ui-label">{t('openingAsOf')}</label>
                  <input
                    type="date"
                    value={openingDate}
                    onChange={(e) => setOpeningDate(e.target.value)}
                    className="ui-input"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button type="button" onClick={() => setIsOpeningOpen(false)} className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 ring-1 ring-slate-200">
                  {lang === 'ml' ? 'റദ്ദാക്കുക' : 'Cancel'}
                </button>
                <button type="submit" disabled={isSavingOpening} className="ui-btn-primary">
                  {isSavingOpening ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {t('saveOpening')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- WHATSAPP CONFIRM ---------------- */}
      {showWaConfirm && whatsappEnabled && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl ring-1 ring-slate-900/10 w-full max-w-sm overflow-hidden">
            <div className="p-5 text-center">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-[#0e4f33] text-white flex items-center justify-center shadow-lg shadow-emerald-900/20">
                <MessageCircle className="w-6 h-6" />
              </div>
              <h3 className="mt-3 font-black text-sm text-slate-900">{t('ledgerWaConfirmTitle')}</h3>
              <p className="mt-1.5 text-[11px] text-slate-500 font-medium leading-relaxed">{t('ledgerWaConfirmBody')}</p>
              <div className="mt-2 rounded-xl bg-slate-50 ring-1 ring-slate-200 px-3 py-2 text-left">
                <p className="text-[11px] font-bold text-slate-800 truncate">{displayName}</p>
                <p className="text-[10px] text-slate-500 font-mono">{activeCustomer.phone || '—'}</p>
                <p className="text-[10px] font-semibold text-slate-600 mt-0.5">{t('closingBalance')}: {inr(closing)}</p>
              </div>
            </div>
            <div className="px-5 pb-5 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setShowWaConfirm(false)} className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 ring-1 ring-slate-200">
                {lang === 'ml' ? 'റദ്ദാക്കുക' : 'Cancel'}
              </button>
              <button type="button" onClick={handleSendWhatsApp} className="ui-btn-primary">
                <Send className="w-4 h-4" />
                {t('sendLedgerOnWhatsApp')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
