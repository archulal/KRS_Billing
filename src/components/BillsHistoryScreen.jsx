import React, { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { History, Search, Calendar, Printer, FileText, TrendingUp, ShoppingBag, Weight } from 'lucide-react';

export default function BillsHistoryScreen({ onSelectBillForPrint }) {
  const { lang, t } = useLanguage();
  const [bills, setBills] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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
  const handlePrintClice = async (billId) => {
    console.error('Error fetching bill details:', billId);
     try {
      const res = await fetch(`/api/bills/${billId}/cancel`, { method: 'PATCH' });
      if (!res.ok) throw new Error('Cancel failed');
      const updated = await res.json();
      // Update local state
      setBills((prev) =>
        prev.map((b) => (b.id === updated.id ? { ...b, ...updated } : b))
      );
    } catch (e) {
      console.error(e);
    }
  };

  // Cancel a bill (soft delete)
  const handleCancelBill = async (billId) => {
    alert(t('cancelNotice')); // or whatever message key you use
    if (!window.confirm(t('confirmCancel'))) return;

    try {
      const res = await fetch(`/api/bills/${billId}/cancel`, { method: 'PATCH' });
      if (!res.ok) throw new Error('Cancel failed');
      const updated = await res.json();
      // Update local state
      setBills((prev) =>
        prev.map((b) => (b.id === updated.id ? { ...b, ...updated } : b))
      );
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-4">

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">

          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-amber-100 rounded-xl text-amber-800">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">{t('historyTitle')}</h2>
              <p className="text-xs text-slate-500">
                View, search, and reprint past invoices in either English or Malayalam.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder={t('searchBillsPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium w-48 sm:w-64 focus:bg-white"
              />
            </div>

            {/* Date Filter */}
            <div className="relative">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-700 focus:bg-white"
              />
              {selectedDate && (
                <button
                  type="button"
                  onClick={() => setSelectedDate('')}
                  className="ml-1 text-[11px] text-slate-400 hover:text-slate-700 underline"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Bills Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                <th className="py-3 px-4 w-28">{t('billNo')}</th>
                <th className="py-3 px-4">{t('customer')}</th>
                <th className="py-3 px-4 w-40">{t('date')}</th>
                <th className="py-3 px-4 text-center w-20">{t('bunches')}</th>
                <th className="py-3 px-4 text-right w-28">{t('grossWeight')}</th>
                <th className="py-3 px-4 text-right w-28">{t('totalWaste')}</th>
                <th className="py-3 px-4 text-right w-28">{t('netWeight')}</th>
                <th className="py-3 px-4 text-right w-32 font-black">{t('grandTotal')}</th>
                <th className="py-3 px-4 text-center w-28">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bills.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-xs text-slate-500">
                    {isLoading ? 'Loading bills...' : 'No billing records found.'}
                  </td>
                </tr>
              ) : (
                bills.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Bill No */}
                    <td className="py-3 px-4 font-mono font-bold text-xs text-amber-800">
                      {b.bill_number}
                    </td>

                    {/* Customer Info */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-xs text-slate-900">
                        {b.customer_display_name || 'Walk-In Customer'}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${b.customer_type === 'permanent'
                          ? 'bg-leaf-100 text-leaf-800'
                          : 'bg-amber-100 text-amber-800'
                          }`}>
                          {b.customer_type === 'permanent' ? 'Permanent' : 'Walk-In'}
                        </span>
                        {b.customer_phone && <span>📞 {b.customer_phone}</span>}
                      </div>
                    </td>

                    {/* Date */}
                    <td className="py-3 px-4 font-mono text-xs text-slate-600">
                      {new Date(b.date).toLocaleString(lang === 'ml' ? 'ml-IN' : 'en-IN', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </td>

                    {/* Bunches */}
                    <td className="py-3 px-4 text-center font-mono font-bold text-xs text-slate-800">
                      {b.total_bunches || '—'}
                    </td>

                    {/* Gross */}
                    <td className="py-3 px-4 text-right font-mono text-xs text-slate-700">
                      {Number(b.total_gross_weight).toFixed(2)} kg
                    </td>

                    {/* Waste */}
                    <td className="py-3 px-4 text-right font-mono text-xs text-red-600">
                      -{Number(b.total_waste_weight).toFixed(2)} kg
                    </td>

                    {/* Net */}
                    <td className="py-3 px-4 text-right font-mono font-bold text-xs text-leaf-700">
                      {Number(b.total_net_weight).toFixed(2)} kg
                    </td>

                    {/* Grand Total */}
                    <td className="py-3 px-4 text-right font-mono font-black text-xs text-slate-900">
                      ₹{Number(b.grand_total).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex gap-2 justify-center">
                        <button
                          type="button"
                          onClick={() => handlePrintClick(b.id)}
                          className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5"
                        >
                          <Printer className="w-3.5 h-3.5 text-amber-700" />
                          <span>{t('printInvoice')}</span>
                        </button>
                        {b.status !== 'cancelled' && (
                          <button
                            type="button"
                            onClick={() => handlePrintClice(b.id)}
                            className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-900 border border-red-300 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5"
                          >
                            <span>{t('cancelBill')}</span>
                          </button>
                        )}
                      </div>
                      {b.status === 'cancelled' && (
                        <span className="mt-1 inline-block px-2 py-0.5 bg-gray-200 text-gray-600 text-xs rounded">
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
