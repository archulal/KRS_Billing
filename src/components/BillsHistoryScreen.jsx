import React, { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { History, Search, Calendar, Printer, FileText, TrendingUp, ShoppingBag, Weight, MessageCircle, CheckCircle2, AlertCircle, X } from 'lucide-react';

export default function BillsHistoryScreen({ onSelectBillForPrint, settings }) {
  const { lang, t } = useLanguage();
  const whatsappEnabled = settings?.whatsapp_enabled !== 'false';
  const [bills, setBills] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [cancelNotice, setCancelNotice] = useState(null);

  const fetchBills = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (selectedDate) params.append('date', selectedDate);

      const res = await fetch(`/api/bills?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setBills(data);
      }
    } catch (err) {
      console.error('Error fetching bills:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBills();
  }, [searchQuery, selectedDate]);

  const handlePrintClick = async (billId) => {
    try {
      const res = await fetch(`/api/bills/${billId}`);
      if (res.ok) {
        const fullBill = await res.json();
        if (onSelectBillForPrint) onSelectBillForPrint(fullBill);
      }
    } catch (err) {
      console.error('Error fetching bill details:', err);
    }
  };
  const buildCancelMessage = (bill) => {
    const date = bill.date
      ? new Date(bill.date).toLocaleDateString(lang === 'ml' ? 'ml-IN' : 'en-IN', { dateStyle: 'medium' })
      : '';
    return [
      'KRS Plantain Merchant & Commission Agent',
      `Bill ${bill.bill_number} dated ${date} for ₹${Number(bill.grand_total || 0).toFixed(2)} has been CANCELLED.`,
      'Please ignore this invoice.',
      'ഈ ബിൽ റദ്ദാക്കപ്പെട്ടു. ദയവായി ഇത് പരിഗണിക്കരുത്.'
    ].join('\n');
  };

  // Cancel a bill (soft delete) and notify the customer on WhatsApp.
  const handleCancelBill = async (billId) => {
    if (!window.confirm(t('confirmCancelBill'))) return;

    const bill = bills.find((b) => b.id === billId);
    setCancelNotice(null);

    try {
      const res = await fetch(`/api/bills/${billId}/cancel`, { method: 'PATCH' });
      if (!res.ok) throw new Error('Cancel failed');
      const updated = await res.json();
      setBills((prev) =>
        prev.map((b) => (b.id === updated.id ? { ...b, ...updated } : b))
      );

      if (!whatsappEnabled) {
        setCancelNotice({ type: 'warning', message: t('waDisabled') });
        return;
      }

      const phone = (bill?.customer_phone || '').trim();
      if (!phone) {
        setCancelNotice({ type: 'warning', message: t('waCancelNoNumberSkipped') });
        return;
      }
      if (!window.electronAPI?.whatsapp?.sendText) {
        setCancelNotice({ type: 'warning', message: t('waDesktopOnly') });
        return;
      }

      try {
        await window.electronAPI.whatsapp.sendText({
          phone,
          message: buildCancelMessage(bill)
        });
        setCancelNotice({ type: 'success', message: t('waCancelMessageSent') });
      } catch (err) {
        console.error('Cancellation WhatsApp error:', err);
        setCancelNotice({ type: 'error', message: t('waCancelSendFailed') });
      }
    } catch (e) {
      console.error(e);
      setCancelNotice({ type: 'error', message: e.message || t('errorSaving') });
    }
  };

  return (
    <div className="space-y-5">

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-2xl p-5 shadow-sm shadow-emerald-900/5 border border-slate-200/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">

          <div className="flex items-center space-x-3.5">
            <div className="p-3 bg-gradient-to-br from-[#156b46] to-[#0e4f33] rounded-2xl text-white shadow-lg shadow-emerald-900/20">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-slate-900">{t('historyTitle')}</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {t('historySubtitle')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder={t('searchBillsPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 w-56 sm:w-72 outline-none focus:bg-white focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 transition-all placeholder:text-slate-400"
              />
            </div>

            {/* Date Filter */}
            <div className="relative flex items-center gap-2">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-4 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:bg-white focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 transition-all"
              />
              {selectedDate && (
                <button
                  type="button"
                  onClick={() => setSelectedDate('')}
                  className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 hover:underline"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

        </div>
      </div>

      {cancelNotice && (
        <div
          className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border shadow-sm text-sm font-semibold ${
            cancelNotice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : cancelNotice.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}
        >
          <span className="flex items-center gap-2.5">
            {cancelNotice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            {cancelNotice.message}
          </span>
          <button
            type="button"
            onClick={() => setCancelNotice(null)}
            className="shrink-0 p-1 rounded-lg opacity-60 hover:opacity-100 hover:bg-black/5 transition-all"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Bills Table */}
      <div className="bg-white rounded-2xl shadow-md shadow-emerald-900/5 border border-slate-200/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/90 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <th className="py-3.5 px-4 w-28">{t('billNo')}</th>
                <th className="py-3.5 px-4">{t('customer')}</th>
                <th className="py-3.5 px-4 w-40">{t('date')}</th>
                <th className="py-3.5 px-4 text-center w-20">{t('bunches')}</th>
                <th className="py-3.5 px-4 text-right w-28">{t('grossWeight')}</th>
                <th className="py-3.5 px-4 text-right w-28">{t('totalWaste')}</th>
                <th className="py-3.5 px-4 text-right w-28">{t('netWeight')}</th>
                <th className="py-3.5 px-4 text-right w-32 font-black">{t('grandTotal')}</th>
                <th className="py-3.5 px-4 text-center w-52">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bills.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2.5">
                      <div className="p-3 rounded-2xl bg-slate-100 text-slate-400">
                        <FileText className="w-6 h-6" />
                      </div>
                      <span className="text-sm font-semibold text-slate-600">
                        {isLoading ? 'Loading bills...' : 'No billing records found.'}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                bills.map((b) => (
                  <tr key={b.id} className="hover:bg-emerald-50/40 transition-colors">
                    {/* Bill No */}
                    <td className="py-3.5 px-4">
                      <span className="inline-block px-2 py-1 rounded-lg bg-amber-50 text-amber-800 font-mono font-bold text-xs ring-1 ring-inset ring-amber-200/70">
                        {b.bill_number}
                      </span>
                    </td>

                    {/* Customer Info */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-sm text-slate-900">
                        {b.customer_display_name || 'Walk-In Customer'}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-1">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ring-1 ring-inset ${b.customer_type === 'permanent'
                          ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                          : 'bg-amber-50 text-amber-700 ring-amber-200'
                          }`}>
                          {b.customer_type === 'permanent' ? 'Permanent' : 'Walk-In'}
                        </span>
                        {b.customer_phone && <span className="font-mono">📞 {b.customer_phone}</span>}
                      </div>
                    </td>

                    {/* Date */}
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-600">
                      {new Date(b.date).toLocaleString(lang === 'ml' ? 'ml-IN' : 'en-IN', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </td>

                    {/* Bunches */}
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-xs text-slate-800">
                      {b.total_bunches || '—'}
                    </td>

                    {/* Gross */}
                    <td className="py-3.5 px-4 text-right font-mono text-xs text-slate-600">
                      {Number(b.total_gross_weight).toFixed(2)} kg
                    </td>

                    {/* Waste */}
                    <td className="py-3.5 px-4 text-right font-mono text-xs text-red-600">
                      -{Number(b.total_waste_weight).toFixed(2)} kg
                    </td>

                    {/* Net */}
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-xs text-emerald-700">
                      {Number(b.total_net_weight).toFixed(2)} kg
                    </td>

                    {/* Grand Total */}
                    <td className="py-3.5 px-4 text-right font-mono">
                      <div className="font-black text-sm text-slate-900">
                        ₹{Number(b.grand_total).toFixed(2)}
                      </div>
                      {b.status !== 'cancelled' && Number(b.balance_due) > 0 && (
                        <div className="mt-0.5 text-[10px] font-bold text-red-600">
                          {t('balanceDue')}: ₹{Number(b.balance_due).toFixed(2)}
                        </div>
                      )}
                      {b.status !== 'cancelled' && Number(b.balance_due) <= 0 && (
                        <div className="mt-0.5 text-[10px] font-bold text-emerald-600">
                          {t('paidInFull')}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex gap-2 justify-center">
                        <button
                          type="button"
                          onClick={() => handlePrintClick(b.id)}
                          className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-sm hover:shadow"
                        >
                          <Printer className="w-3.5 h-3.5 text-amber-700" />
                          <span>{t('printInvoice')}</span>
                        </button>
                        {whatsappEnabled && (
                        <button
                          type="button"
                          onClick={() => handlePrintClick(b.id)}
                          className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-sm hover:shadow"
                          title={t('waSend')}
                        >
                          <MessageCircle className="w-3.5 h-3.5 text-emerald-700" />
                          <span>{t('waSend')}</span>
                        </button>
                        )}
                        {b.status !== 'cancelled' && (
                          <button
                            type="button"
                            onClick={() => handleCancelBill(b.id)}
                            className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-sm hover:shadow"
                          >
                            <span>{t('cancelBill')}</span>
                          </button>
                        )}
                      </div>
                      {b.status === 'cancelled' && (
                        <span className="mt-2 inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold ring-1 ring-inset ring-slate-200">
                          {t('cancelled')}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
