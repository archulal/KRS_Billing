import React, { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { 
  Users, UserCheck, UserPlus, Search, Phone, Store, MapPin, 
  Sparkles, Award, ArrowUpRight, CheckCircle2, AlertCircle, Trash2, Edit,
  BookOpen, Wallet, TrendingUp, CircleDollarSign
} from 'lucide-react';

export default function CustomersScreen({ 
  permanentCustomers, 
  onRefreshCustomers,
  activeSubTab = 'permanent',
  setActiveSubTab,
  onOpenLedger
}) {
  const { lang, t } = useLanguage();
  const [subTab, setSubTab] = useState(activeSubTab || 'permanent'); // 'permanent' | 'walkin'
  const [walkinCustomers, setWalkinCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingWalkins, setIsLoadingWalkins] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [notification, setNotification] = useState(null);

  // Form state for adding permanent customer
  const [formName, setFormName] = useState('');
  const [formShop, setFormShop] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAddress, setFormAddress] = useState('');

  // Form state for editing permanent customer
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editShop, setEditShop] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Fetch walk-in staging list
  const fetchWalkins = async () => {
    setIsLoadingWalkins(true);
    try {
      const res = await fetch('/api/customers/walkin');
      if (res.ok) {
        const data = await res.json();
        setWalkinCustomers(data);
      }
    } catch (err) {
      console.error('Error fetching walk-ins:', err);
    } finally {
      setIsLoadingWalkins(false);
    }
  };

  useEffect(() => {
    fetchWalkins();
  }, []);

  const showNotification = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // 1-Click Promote walk-in customer to permanent
  const handlePromote = async (walkinId) => {
    try {
      const res = await fetch(`/api/customers/walkin/promote/${walkinId}`, {
        method: 'POST',
      });
      if (!res.ok) {
        throw new Error('Failed to promote customer');
      }
      showNotification(t('promoteSuccess'), 'success');
      await fetchWalkins();
      if (onRefreshCustomers) onRefreshCustomers();
    } catch (err) {
      console.error(err);
      showNotification(err.message, 'error');
    }
  };

  // Add permanent customer
  const handleAddPermanent = async (e) => {
    e.preventDefault();
    if (!formName.trim()) return;

    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          shop_name: formShop.trim(),
          phone: formPhone.trim(),
          address: formAddress.trim(),
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to create customer');
      }

      showNotification(t('successSaved'), 'success');
      setFormName('');
      setFormShop('');
      setFormPhone('');
      setFormAddress('');
      setIsAddModalOpen(false);
      if (onRefreshCustomers) onRefreshCustomers();
    } catch (err) {
      console.error(err);
      showNotification(err.message, 'error');
    }
  };

  // Open edit modal pre-filled with customer details
  const handleOpenEdit = (customer) => {
    setEditingCustomer(customer);
    setEditName(customer.name || '');
    setEditShop(customer.shop_name || '');
    setEditPhone(customer.phone || '');
    setEditAddress(customer.address || '');
    setIsEditModalOpen(true);
  };

  // Save updated customer details
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingCustomer || !editName.trim()) return;

    setIsSavingEdit(true);
    try {
      const res = await fetch(`/api/customers/${editingCustomer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          shop_name: editShop.trim(),
          phone: editPhone.trim(),
          address: editAddress.trim(),
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to update customer');
      }

      showNotification(t('customerUpdated'), 'success');
      setIsEditModalOpen(false);
      setEditingCustomer(null);
      if (onRefreshCustomers) onRefreshCustomers();
    } catch (err) {
      console.error(err);
      showNotification(err.message, 'error');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Delete customer with confirmation
  const handleDeleteCustomer = async (id, name) => {
    if (!window.confirm(lang === 'ml' ? `${name} എന്ന കസ്റ്റമറെ നീക്കം ചെയ്യണമെന്നുണ്ടോ?` : `Are you sure you want to delete ${name}?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete customer');
      showNotification(lang === 'ml' ? 'കസ്റ്റമറെ നീക്കം ചെയ്തു' : 'Customer deleted successfully', 'success');
      if (onRefreshCustomers) onRefreshCustomers();
    } catch (err) {
      console.error(err);
      showNotification(err.message, 'error');
    }
  };

  // Filter permanent customers
  const filteredPermanent = permanentCustomers.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.shop_name && c.shop_name.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(q)) ||
      (c.address && c.address.toLowerCase().includes(q))
    );
  });

  // Filter walk-ins
  const filteredWalkins = walkinCustomers.filter((w) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (w.name && w.name.toLowerCase().includes(q)) ||
      (w.shop_name && w.shop_name.toLowerCase().includes(q)) ||
      (w.phone && w.phone.includes(q))
    );
  });

  const frequentWalkinsCount = walkinCustomers.filter((w) => w.visit_count >= 3).length;

  const totalOutstanding = permanentCustomers.reduce(
    (sum, c) => sum + Math.max(0, Number(c.outstanding) || 0),
    0
  );
  const customersWithDues = permanentCustomers.filter((c) => Number(c.outstanding) > 0).length;
  const customersWithAdvance = permanentCustomers.filter((c) => Number(c.outstanding) < 0).length;

  return (
    <div className="space-y-5">

      {/* Toast Notification */}
      {notification && (
        <div className={`p-4 rounded-2xl text-sm font-semibold flex items-center justify-between shadow-lg animate-in fade-in slide-in-from-top-2 duration-200 ${
          notification.type === 'success'
            ? 'bg-gradient-to-r from-[#156b46] to-emerald-800 text-white ring-1 ring-emerald-700/50'
            : 'bg-gradient-to-r from-red-600 to-red-700 text-white ring-1 ring-red-700/50'
        }`}>
          <div className="flex items-center gap-2.5">
            {notification.type === 'success'
              ? <CheckCircle2 className="w-5 h-5 shrink-0" />
              : <AlertCircle className="w-5 h-5 shrink-0" />}
            <span>{notification.msg}</span>
          </div>
          <button onClick={() => setNotification(null)} className="ml-3 p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/15 transition-all" aria-label="Dismiss">✕</button>
        </div>
      )}

      {/* Header & Tabs */}
      <div className="bg-white rounded-2xl p-5 shadow-sm shadow-slate-200/60 ring-1 ring-slate-900/5 border border-slate-200/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">

          {/* Sub Tabs */}
          <div className="flex bg-slate-100/80 p-1 rounded-xl ring-1 ring-slate-200/70">
            <button
              type="button"
              onClick={() => setSubTab('permanent')}
              className={`px-4 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${
                subTab === 'permanent'
                  ? 'bg-white text-emerald-900 shadow-sm ring-1 ring-emerald-200/80'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Users className={`w-4 h-4 ${subTab === 'permanent' ? 'text-emerald-700' : 'text-amber-500'}`} />
              <span>{t('tabPermanent')} ({permanentCustomers.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab('walkin')}
              className={`px-4 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${
                subTab === 'walkin'
                  ? 'bg-white text-emerald-900 shadow-sm ring-1 ring-emerald-200/80'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Award className="w-4 h-4 text-amber-500" />
              <span>{t('tabFrequentWalkin')}</span>
              {frequentWalkinsCount > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-black bg-gradient-to-r from-amber-400 to-amber-500 text-white rounded-full shadow-sm shadow-amber-500/30 tabular-nums">
                  {frequentWalkinsCount}
                </span>
              )}
            </button>
          </div>

          {/* Right Action: Search & Add Customer */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder={t('searchCustomerPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 placeholder:font-normal w-52 sm:w-72 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
              />
            </div>

            {subTab === 'permanent' && (
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#156b46] to-emerald-800 hover:from-[#0e4f33] hover:to-emerald-900 text-white font-semibold text-sm rounded-xl shadow-md shadow-emerald-900/20 transition-all duration-200 whitespace-nowrap"
              >
                <UserPlus className="w-4 h-4" />
                <span>{t('addCustomer')}</span>
              </button>
            )}
          </div>

        </div>
      </div>

      {/* Ledger summary strip (permanent customers only) */}
      {subTab === 'permanent' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-2xl bg-gradient-to-br from-red-50 via-amber-50 to-white p-4 ring-1 ring-red-200/70 shadow-sm flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-red-500">{t('outstandingTotal')}</p>
              <p className="mt-1 text-xl font-black text-red-700 tabular-nums">
                ₹{totalOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/80 ring-1 ring-red-200 text-red-500 flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 shadow-sm flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{t('dueAmount')}</p>
              <p className="mt-1 text-xl font-black text-slate-900 tabular-nums">{customersWithDues}</p>
              <p className="text-[10px] font-semibold text-slate-400">{t('tabPermanent')}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 ring-1 ring-amber-200 text-amber-600 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 shadow-sm flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{t('advanceAmount')}</p>
              <p className="mt-1 text-xl font-black text-emerald-700 tabular-nums">{customersWithAdvance}</p>
              <p className="text-[10px] font-semibold text-slate-400">{t('settled')}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 ring-1 ring-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
              <CircleDollarSign className="w-5 h-5" />
            </div>
          </div>
        </div>
      )}

      {/* Tab 1: Permanent Customers */}
      {subTab === 'permanent' && (
        <div className="bg-white rounded-2xl shadow-sm shadow-slate-200/60 ring-1 ring-slate-900/5 border border-slate-200/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 border-b border-slate-200">
                  <th className="py-3.5 px-4 w-12 text-center">#</th>
                  <th className="py-3.5 px-4">{t('customerName')}</th>
                  <th className="py-3.5 px-4">{t('shopName')}</th>
                  <th className="py-3.5 px-4">{t('phone')}</th>
                  <th className="py-3.5 px-4">{t('address')}</th>
                  <th className="py-3.5 px-4 text-right">Registered</th>
                  <th className="py-3.5 px-4 text-right">{t('outstanding')}</th>
                  <th className="py-3.5 px-4 text-center w-36">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPermanent.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-14 text-center">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mb-3">
                        <Users className="w-6 h-6" />
                      </div>
                      <p className="text-sm text-slate-500 font-medium">{t('noCustomersFound')}</p>
                    </td>
                  </tr>
                ) : (
                  filteredPermanent.map((cust, idx) => (
                    <tr key={cust.id} className="hover:bg-emerald-50/40 transition-colors">
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 text-slate-500 text-xs font-bold tabular-nums">
                          {idx + 1}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-sm text-slate-900 flex items-center gap-2.5">
                          <span className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-100 to-emerald-200 text-emerald-800 ring-1 ring-emerald-300/60 flex items-center justify-center text-sm shrink-0">
                            👤
                          </span>
                          <span>{cust.name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-sm text-slate-700">
                        {cust.shop_name ? (
                          <span className="flex items-center gap-1.5">
                            <Store className="w-4 h-4 text-slate-400 shrink-0" />
                            {cust.shop_name}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-sm text-slate-800">
                        {cust.phone ? (
                          <span className="flex items-center gap-1.5">
                            <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                            {cust.phone}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-sm text-slate-600">
                        {cust.address ? (
                          <span className="flex items-center gap-1.5">
                            <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                            {cust.address}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-xs text-slate-500">
                        {cust.created_at ? new Date(cust.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {(() => {
                          const due = Number(cust.outstanding) || 0;
                          if (due > 0) {
                            return (
                              <span className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1 text-xs font-black text-red-700 ring-1 ring-red-200 tabular-nums">
                                ₹{due.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            );
                          }
                          if (due < 0) {
                            return (
                              <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200 tabular-nums">
                                {t('advanceAmount')} ₹{Math.abs(due).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            );
                          }
                          return (
                            <span className="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">
                              {t('settled')}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onOpenLedger && onOpenLedger(cust)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-2 text-[11px] font-bold text-white bg-gradient-to-r from-[#156b46] to-emerald-800 hover:from-[#0e4f33] hover:to-emerald-900 rounded-lg shadow-sm shadow-emerald-900/15 transition-all"
                            title={t('viewLedger')}
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>{t('ledgerAction')}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(cust)}
                            className="p-2 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 rounded-lg transition-all"
                            title={t('editCustomer')}
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomer(cust.id, cust.name)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title={t('deleteCustomer')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Frequent Walk-Ins (Staging Table with 1-Click Promote) */}
      {subTab === 'walkin' && (
        <div className="bg-white rounded-2xl shadow-sm shadow-slate-200/60 ring-1 ring-slate-900/5 border border-slate-200/80 overflow-hidden">

          {/* Informational Callout */}
          <div className="bg-gradient-to-r from-amber-50 via-amber-50 to-orange-50 p-5 border-b border-amber-200/70 flex items-start gap-3.5">
            <div className="p-2.5 bg-gradient-to-br from-amber-400 to-amber-500 text-white rounded-xl shadow-md shadow-amber-500/25 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-xs text-amber-900 uppercase tracking-[0.08em]">
                Frequent Walk-Ins Staging Area (Auto-Tracked via Mobile Number)
              </h4>
              <p className="text-sm text-amber-900/80 mt-1 leading-relaxed">
                Every time a walk-in bill is saved with a mobile number, visits and total purchase spend are staged here without polluting the permanent list. 
                Buyers with <strong className="font-bold text-amber-950">3 or more visits</strong> are highlighted for 1-Click promotion to Permanent Customer status.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 border-b border-slate-200">
                  <th className="py-3.5 px-4 w-12 text-center">#</th>
                  <th className="py-3.5 px-4">{t('phone')}</th>
                  <th className="py-3.5 px-4">{t('customerName')}</th>
                  <th className="py-3.5 px-4">{t('shopName')}</th>
                  <th className="py-3.5 px-4 text-center">{t('visitCount')}</th>
                  <th className="py-3.5 px-4 text-right">{t('totalSpent')}</th>
                  <th className="py-3.5 px-4 text-right">{t('lastVisit')}</th>
                  <th className="py-3.5 px-4 text-center">Auto-Promotion Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredWalkins.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-14 text-center">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mb-3">
                        <Award className="w-6 h-6" />
                      </div>
                      <p className="text-sm text-slate-500 font-medium">{t('noWalkinsFound')}</p>
                    </td>
                  </tr>
                ) : (
                  filteredWalkins.map((w, idx) => {
                    const isFrequent = w.visit_count >= 3;

                    return (
                      <tr 
                        key={w.id} 
                        className={`transition-colors ${
                          isFrequent ? 'bg-amber-50/60 hover:bg-amber-100/60' : 'hover:bg-emerald-50/40'
                        }`}
                      >
                        <td className="py-3.5 px-4 text-center">
                          <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold tabular-nums ${
                            isFrequent ? 'bg-amber-200/70 text-amber-900' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {idx + 1}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-sm text-slate-900">
                          <span className="flex items-center gap-1.5">
                            <Phone className="w-4 h-4 text-amber-500 shrink-0" />
                            {w.phone}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-sm text-slate-800">
                          {w.name || <span className="text-slate-400 italic">Not recorded</span>}
                        </td>
                        <td className="py-3.5 px-4 text-sm text-slate-600">
                          {w.shop_name || <span className="text-slate-400 italic">—</span>}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="inline-flex items-center gap-1.5">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-black tabular-nums ${
                              isFrequent 
                                ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-white shadow-sm shadow-amber-500/30'
                                : 'bg-slate-100 text-slate-700'
                            }`}>
                              {w.visit_count} {w.visit_count === 1 ? 'visit' : 'visits'}
                            </span>
                            {isFrequent && (
                              <span className="text-amber-500 font-bold text-sm drop-shadow-sm" title="3+ visits frequent buyer">
                                ★
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-sm text-slate-900">
                          ₹{Number(w.total_spent || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-xs text-slate-500">
                          {w.last_visit_date ? new Date(w.last_visit_date).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handlePromote(w.id)}
                            className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-sm transition-all mx-auto ${
                              isFrequent
                                ? 'bg-gradient-to-r from-[#156b46] to-emerald-800 hover:from-[#0e4f33] hover:to-emerald-900 text-white shadow-md shadow-emerald-900/20'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 ring-1 ring-slate-200'
                            }`}
                          >
                            <UserCheck className="w-4 h-4" />
                            <span>{t('promoteBtn')}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Permanent Customer Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl shadow-slate-900/25 ring-1 ring-slate-900/5 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="relative bg-gradient-to-r from-emerald-950 via-[#156b46] to-emerald-900 px-6 py-5 text-white overflow-hidden">
              <div className="absolute -right-6 -top-8 w-28 h-28 rounded-full bg-white/5 pointer-events-none" />
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/15 rounded-xl ring-1 ring-white/25 shrink-0">
                    <UserPlus className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-bold text-lg tracking-tight text-white">{t('addCustomer')}</h3>
                </div>
                <button 
                  type="button" 
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/15 transition-all"
                >
                  <span className="text-lg leading-none">✕</span>
                </button>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500" />
            </div>

            <form onSubmit={handleAddPermanent} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {t('customerName')} *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ananthu K."
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {t('shopName')}
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ananthu Supermarket"
                  value={formShop}
                  onChange={(e) => setFormShop(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {t('phone')}
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 9847123456"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {t('address')}
                </label>
                <textarea
                  rows={2}
                  placeholder="Shop location / Market road address"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all resize-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#156b46] to-emerald-800 hover:from-[#0e4f33] hover:to-emerald-900 text-white text-sm font-semibold rounded-xl shadow-md shadow-emerald-900/20 transition-all duration-200"
                >
                  <UserPlus className="w-4 h-4" />
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Permanent Customer Modal */}
      {isEditModalOpen && editingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl shadow-slate-900/25 ring-1 ring-slate-900/5 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="relative bg-gradient-to-r from-emerald-950 via-[#156b46] to-emerald-900 px-6 py-5 text-white overflow-hidden">
              <div className="absolute -right-6 -top-8 w-28 h-28 rounded-full bg-white/5 pointer-events-none" />
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/15 rounded-xl ring-1 ring-white/25 shrink-0">
                    <Edit className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-bold text-lg tracking-tight text-white">{t('editCustomer')}</h3>
                </div>
                <button 
                  type="button" 
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingCustomer(null);
                  }}
                  className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/15 transition-all"
                >
                  <span className="text-lg leading-none">✕</span>
                </button>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500" />
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {t('customerName')} *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ananthu K."
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {t('shopName')}
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ananthu Supermarket"
                  value={editShop}
                  onChange={(e) => setEditShop(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {t('phone')}
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 9847123456"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {t('address')}
                </label>
                <textarea
                  rows={2}
                  placeholder="Shop location / Market road address"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all resize-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingCustomer(null);
                  }}
                  className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#156b46] to-emerald-800 hover:from-[#0e4f33] hover:to-emerald-900 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl shadow-md shadow-emerald-900/20 transition-all duration-200"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSavingEdit ? t('saving') : t('updateCustomer')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
