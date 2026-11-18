import React, { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { 
  Users, UserCheck, UserPlus, Search, Phone, Store, MapPin, 
  Sparkles, Award, ArrowUpRight, CheckCircle2, AlertCircle, Trash2, Edit 
} from 'lucide-react';

export default function CustomersScreen({ 
  permanentCustomers, 
  onRefreshCustomers,
  activeSubTab = 'permanent',
  setActiveSubTab 
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

  return (
    <div className="space-y-4">
      
      {/* Toast Notification */}
      {notification && (
        <div className={`p-4 rounded-xl text-xs font-bold flex items-center justify-between shadow-lg ${
          notification.type === 'success' 
            ? 'bg-leaf-600 text-white' 
            : 'bg-red-600 text-white'
        }`}>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{notification.msg}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-white/80 hover:text-white">✕</button>
        </div>
      )}

      {/* Header & Tabs */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          
          {/* Sub Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setSubTab('permanent')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
                subTab === 'permanent'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-4 h-4 text-amber-600" />
              <span>{t('tabPermanent')} ({permanentCustomers.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab('walkin')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
                subTab === 'walkin'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Award className="w-4 h-4 text-amber-600" />
              <span>{t('tabFrequentWalkin')}</span>
              {frequentWalkinsCount > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-black bg-amber-500 text-white rounded-full">
                  {frequentWalkinsCount}
                </span>
              )}
            </button>
          </div>

          {/* Right Action: Search & Add Customer */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder={t('searchCustomerPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium w-48 sm:w-64 focus:bg-white"
              />
            </div>

            {subTab === 'permanent' && (
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
              >
                <UserPlus className="w-4 h-4" />
                <span>{t('addCustomer')}</span>
              </button>
            )}
          </div>

        </div>
      </div>

      {/* Tab 1: Permanent Customers */}
      {subTab === 'permanent' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">{t('customerName')}</th>
                  <th className="py-3 px-4">{t('shopName')}</th>
                  <th className="py-3 px-4">{t('phone')}</th>
                  <th className="py-3 px-4">{t('address')}</th>
                  <th className="py-3 px-4 text-right">Registered</th>
                  <th className="py-3 px-4 text-center w-28">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPermanent.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-xs text-slate-500">
                      {t('noCustomersFound')}
                    </td>
                  </tr>
                ) : (
                  filteredPermanent.map((cust, idx) => (
                    <tr key={cust.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 text-center font-bold text-xs text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-xs text-slate-900 flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-900 flex items-center justify-center text-[10px]">
                            👤
                          </span>
                          <span>{cust.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-semibold text-xs text-slate-700">
                        {cust.shop_name ? (
                          <span className="flex items-center gap-1.5">
                            <Store className="w-3.5 h-3.5 text-slate-400" />
                            {cust.shop_name}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-800">
                        {cust.phone ? (
                          <span className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            {cust.phone}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">
                        {cust.address ? (
                          <span className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            {cust.address}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-[11px] text-slate-500">
                        {cust.created_at ? new Date(cust.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(cust)}
                            className="p-1.5 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 rounded-lg transition-all"
                            title={t('editCustomer')}
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomer(cust.id, cust.name)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
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
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          
          {/* Informational Callout */}
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-4 border-b border-amber-200/80 flex items-start gap-3">
            <div className="p-2 bg-amber-500 text-white rounded-xl shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-xs text-amber-950 uppercase tracking-wider">
                Frequent Walk-Ins Staging Area (Auto-Tracked via Mobile Number)
              </h4>
              <p className="text-xs text-amber-900/90 mt-0.5">
                Every time a walk-in bill is saved with a mobile number, visits and total purchase spend are staged here without polluting the permanent list. 
                Buyers with <strong>3 or more visits</strong> are highlighted for 1-Click promotion to Permanent Customer status.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">{t('phone')}</th>
                  <th className="py-3 px-4">{t('customerName')}</th>
                  <th className="py-3 px-4">{t('shopName')}</th>
                  <th className="py-3 px-4 text-center">{t('visitCount')}</th>
                  <th className="py-3 px-4 text-right">{t('totalSpent')}</th>
                  <th className="py-3 px-4 text-right">{t('lastVisit')}</th>
                  <th className="py-3 px-4 text-center">Auto-Promotion Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredWalkins.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-xs text-slate-500">
                      {t('noWalkinsFound')}
                    </td>
                  </tr>
                ) : (
                  filteredWalkins.map((w, idx) => {
                    const isFrequent = w.visit_count >= 3;

                    return (
                      <tr 
                        key={w.id} 
                        className={`transition-colors ${
                          isFrequent ? 'bg-amber-50/50 hover:bg-amber-100/50' : 'hover:bg-slate-50/70'
                        }`}
                      >
                        <td className="py-3 px-4 text-center font-bold text-xs text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-xs text-slate-900">
                          <span className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-amber-600" />
                            {w.phone}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-xs text-slate-800">
                          {w.name || <span className="text-slate-400 italic">Not recorded</span>}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-700">
                          {w.shop_name || <span className="text-slate-400 italic">—</span>}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="inline-flex items-center gap-1.5">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                              isFrequent 
                                ? 'bg-amber-500 text-slate-950 border border-amber-600 shadow-sm'
                                : 'bg-slate-100 text-slate-800'
                            }`}>
                              {w.visit_count} {w.visit_count === 1 ? 'visit' : 'visits'}
                            </span>
                            {isFrequent && (
                              <span className="text-amber-600 font-bold text-xs" title="3+ visits frequent buyer">
                                ★
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-xs text-slate-900">
                          ₹{Number(w.total_spent || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-[11px] text-slate-500">
                          {w.last_visit_date ? new Date(w.last_visit_date).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handlePromote(w.id)}
                            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 mx-auto ${
                              isFrequent
                                ? 'bg-leaf-600 hover:bg-leaf-700 active:bg-leaf-800 text-white shadow-md shadow-leaf-600/20'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                            }`}
                          >
                            <UserCheck className="w-3.5 h-3.5" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden">
            <div className="bg-amber-600 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-white" />
                <h3 className="font-bold text-base">{t('addCustomer')}</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setIsAddModalOpen(false)}
                className="text-white/80 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddPermanent} className="p-6 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('customerName')} *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ananthu K."
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('shopName')}
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ananthu Supermarket"
                  value={formShop}
                  onChange={(e) => setFormShop(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('phone')}
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 9847123456"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('address')}
                </label>
                <textarea
                  rows={2}
                  placeholder="Shop location / Market road address"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:bg-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow transition-all"
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Permanent Customer Modal */}
      {isEditModalOpen && editingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-[#156b46] px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit className="w-5 h-5 text-white" />
                <h3 className="font-bold text-base">{t('editCustomer')}</h3>
              </div>
              <button 
                type="button" 
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingCustomer(null);
                }}
                className="text-white/80 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('customerName')} *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ananthu K."
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('shopName')}
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ananthu Supermarket"
                  value={editShop}
                  onChange={(e) => setEditShop(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('phone')}
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 9847123456"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('address')}
                </label>
                <textarea
                  rows={2}
                  placeholder="Shop location / Market road address"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:bg-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingCustomer(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-5 py-2 bg-[#156b46] hover:bg-[#125839] text-white text-xs font-bold rounded-xl shadow transition-all flex items-center gap-1.5"
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
