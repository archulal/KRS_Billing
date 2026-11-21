import React, { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { 
  Plus, Trash2, Printer, RotateCcw, User, Search, Store, 
  HelpCircle, AlertCircle, CheckCircle2, ChevronDown, Sparkles, Edit, Wallet, BookOpen
} from 'lucide-react';
import WalkInCaptureModal from './WalkInCaptureModal';

export default function BillingScreen({ 
  bananaTypes, 
  permanentCustomers, 
  onBillCreated, 
  refreshStats,
  onOpenCustomerDirectory,
  onRefreshCustomers,
  onOpenLedger
}) {
  const { lang, t, getVarietyName } = useLanguage();

  // Customer state: default to 'walkin'
  const [customerType, setCustomerType] = useState('walkin'); // 'walkin' | 'permanent'
  const [selectedPermanentCustomer, setSelectedPermanentCustomer] = useState(null);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);

  // Edit Selected Customer modal state
  const [isEditCustomerOpen, setIsEditCustomerOpen] = useState(false);
  const [editCustName, setEditCustName] = useState('');
  const [editCustShop, setEditCustShop] = useState('');
  const [editCustPhone, setEditCustPhone] = useState('');
  const [editCustAddress, setEditCustAddress] = useState('');
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);

  const handleOpenEditCustomer = () => {
    if (!selectedPermanentCustomer) return;
    setEditCustName(selectedPermanentCustomer.name || '');
    setEditCustShop(selectedPermanentCustomer.shop_name || '');
    setEditCustPhone(selectedPermanentCustomer.phone || '');
    setEditCustAddress(selectedPermanentCustomer.address || '');
    setIsEditCustomerOpen(true);
  };

  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    if (!selectedPermanentCustomer || !editCustName.trim()) return;
    setIsSavingCustomer(true);
    try {
      const res = await fetch(`/api/customers/${selectedPermanentCustomer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editCustName.trim(),
          shop_name: editCustShop.trim(),
          phone: editCustPhone.trim(),
          address: editCustAddress.trim(),
        }),
      });
      if (!res.ok) throw new Error('Failed to update customer');
      const updated = await res.json();
      setSelectedPermanentCustomer(updated);
      setIsEditCustomerOpen(false);
      if (onRefreshCustomers) onRefreshCustomers();
    } catch (err) {
      console.error(err);
      setErrorMessage(err.message);
    } finally {
      setIsSavingCustomer(false);
    }
  };

  // Billing line items
  const createEmptyRow = (defaultVariety = null) => {
    const variety = defaultVariety || (bananaTypes.length > 0 ? bananaTypes[0] : null);
    const waste = variety ? variety.default_stem_waste_per_bunch_kg : 0.5;
    const rate = variety ? variety.default_rate_per_kg : 40;
    return {
      rowId: Date.now() + Math.random(),
      banana_type_id: variety ? variety.id : '',
      bunch_quantity: 1,
      gross_weight_kg: '',
      waste_per_bunch_kg: waste,
      total_waste_kg: waste,
      net_weight_kg: 0,
      rate_per_kg: rate,
      subtotal: 0,
    };
  };

  // The very first row is only a placeholder: the first quick-add click
  // fills it, while every later click always appends a fresh line item.
  const createInitialRow = () => ({
    ...createEmptyRow(bananaTypes.length > 0 ? bananaTypes[0] : null),
    isInitialPlaceholder: true
  });

  const [items, setItems] = useState([]);
  const [isWalkInModalOpen, setIsWalkInModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [amountPaidTouched, setAmountPaidTouched] = useState(false);

  // Initialize with 1 empty row once varieties load
  useEffect(() => {
    if (bananaTypes.length > 0 && items.length === 0) {
      setItems([createInitialRow()]);
    }
  }, [bananaTypes]);

  // Recalculate row totals
  const recalculateRow = (row) => {
    const qty = parseInt(row.bunch_quantity, 10) || 0;
    const gross = parseFloat(row.gross_weight_kg) || 0;
    const wastePerBunch = parseFloat(row.waste_per_bunch_kg) || 0;
    const rate = parseFloat(row.rate_per_kg) || 0;

    // Stem & Bunch Waste Calculation Formula:
    // Total Waste Weight = Quantity (Bunches) × Waste per Bunch (kg)
    // Net Weight (Billable Weight) = Gross Weight - Total Waste Weight
    // Line Total = Net Weight × Editable Rate per Kg
    const totalWaste = Math.round(qty * wastePerBunch * 100) / 100;
    const netWeight = Math.round(Math.max(0, gross - totalWaste) * 100) / 100;
    const subtotal = Math.round(netWeight * rate * 100) / 100;

    return {
      ...row,
      total_waste_kg: totalWaste,
      net_weight_kg: netWeight,
      subtotal: subtotal,
    };
  };

  const handleRowChange = (index, field, value) => {
    setItems((prevItems) => {
      const next = [...prevItems];
      let row = { ...next[index], [field]: value, isInitialPlaceholder: false };

      // If variety changed, auto-fill default rate and stem waste
      if (field === 'banana_type_id') {
        const found = bananaTypes.find((b) => b.id === parseInt(value, 10));
        if (found) {
          row.waste_per_bunch_kg = found.default_stem_waste_per_bunch_kg;
          row.rate_per_kg = found.default_rate_per_kg;
        }
      }

      next[index] = recalculateRow(row);
      return next;
    });
  };

  const handleAddRow = () => {
    const nextVariety = bananaTypes.length > 0 ? bananaTypes[0] : null;
    setItems((prev) => [...prev, createEmptyRow(nextVariety)]);
  };

  const handleQuickSelectVariety = (variety) => {
    setItems((prevItems) => {
      // Replace the untouched placeholder row, but never overwrite a row the
      // user has already started — every click adds a fresh line item.
      const rows = prevItems.filter((row) => !row.isInitialPlaceholder);
      return [...rows, createEmptyRow(variety)];
    });
  };

  const handleRemoveRow = (index) => {
    if (items.length <= 1) {
      setItems([createInitialRow()]);
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClearBill = () => {
    if (window.confirm(lang === 'ml' ? 'ബിൽ വിവരങ്ങൾ മായ്ക്കണമെന്നുണ്ടോ?' : 'Clear all items in this bill?')) {
      setItems([createInitialRow()]);
      setCustomerType('walkin');
      setSelectedPermanentCustomer(null);
      setCustomerSearchQuery('');
      setErrorMessage('');
      setAmountPaidTouched(false);
      setAmountPaid('0');
    }
  };

  // Bill Totals
  const billSummary = items.reduce(
    (acc, row) => {
      acc.bunches += parseInt(row.bunch_quantity, 10) || 0;
      acc.gross += parseFloat(row.gross_weight_kg) || 0;
      acc.waste += parseFloat(row.total_waste_kg) || 0;
      acc.net += parseFloat(row.net_weight_kg) || 0;
      acc.rawTotal += parseFloat(row.subtotal) || 0;
      return acc;
    },
    { bunches: 0, gross: 0, waste: 0, net: 0, rawTotal: 0, grandTotal: 0 }
  );

  billSummary.gross = Math.round(billSummary.gross * 100) / 100;
  billSummary.waste = Math.round(billSummary.waste * 100) / 100;
  billSummary.net = Math.round(billSummary.net * 100) / 100;
  // Wholesale mandi rounding rule: round down to whole integer rupee (e.g. 200.40 -> 200, 200.80 -> 200)
  billSummary.grandTotal = Math.floor(billSummary.rawTotal);

  // Amount collected now: follows the bill total until the operator edits it.
  useEffect(() => {
    if (!amountPaidTouched) {
      setAmountPaid(String(billSummary.grandTotal || 0));
    }
  }, [billSummary.grandTotal, amountPaidTouched]);

  // Saved-customer ledger balance: positive = dues, negative = advance/credit.
  const hasLedgerCustomer = customerType === 'permanent' && !!selectedPermanentCustomer;
  const selectedOutstanding = hasLedgerCustomer
    ? Number(selectedPermanentCustomer.outstanding) || 0
    : 0;
  const previousDue = Math.max(0, selectedOutstanding);
  const previousAdvance = Math.max(0, -selectedOutstanding);
  const maxPayable = billSummary.grandTotal + previousDue;

  const paidAmount = Math.min(
    Math.max(parseFloat(amountPaid) || 0, 0),
    maxPayable
  );
  const balanceDue = Math.max(
    0,
    Math.round((billSummary.grandTotal - paidAmount) * 100) / 100
  );

  // Money over this bill's total adjusts the customer's old dues.
  const oldDuesPaid = Math.min(previousDue, Math.max(0, paidAmount - billSummary.grandTotal));
  const advanceApplied = Math.min(previousAdvance, Math.max(0, billSummary.grandTotal - paidAmount));
  const projectedBalance = Math.round((selectedOutstanding + billSummary.grandTotal - paidAmount) * 100) / 100;

  // Filtered permanent customers for autocomplete
  const filteredCustomers = permanentCustomers.filter((c) => {
    if (!customerSearchQuery.trim()) return true;
    const query = customerSearchQuery.toLowerCase();
    return (
      (c.name && c.name.toLowerCase().includes(query)) ||
      (c.shop_name && c.shop_name.toLowerCase().includes(query)) ||
      (c.phone && c.phone.includes(query))
    );
  });

  // Handle Save & Print Trigger
  const handleSaveAndPrintClick = () => {
    setErrorMessage('');
    const validItems = items.filter((row) => row.banana_type_id && (parseFloat(row.gross_weight_kg) || 0) > 0);
    if (validItems.length === 0) {
      setErrorMessage(
        lang === 'ml'
          ? 'ദയവായി കുറഞ്ഞത് ഒരു ഇനത്തിന്റെ എണ്ണവും മൊത്തം തൂക്കവും നൽകുക.'
          : 'Please enter gross weight and quantity for at least one banana variety.'
      );
      return;
    }

    if (customerType === 'walkin') {
      setIsWalkInModalOpen(true);
    } else {
      submitBill({
        customer_type: 'permanent',
        customer_id: selectedPermanentCustomer ? selectedPermanentCustomer.id : null,
      });
    }
  };

  // Submit bill to backend API
  const submitBill = async (customerData) => {
    setIsSaving(true);
    setErrorMessage('');
    try {
      const payload = {
        customer_type: customerData.customer_type || customerType,
        customer_id: customerData.customer_id || (selectedPermanentCustomer ? selectedPermanentCustomer.id : null),
        walkin_phone: customerData.phone || '',
        walkin_name: customerData.name || '',
        walkin_shop: customerData.shop || '',
        amount_paid: paidAmount,
        advance_adjusted: advanceApplied,
        advance_balance: previousAdvance,
        items: items
          .filter((row) => row.banana_type_id && (parseFloat(row.gross_weight_kg) || 0) > 0)
          .map((row) => ({
            banana_type_id: parseInt(row.banana_type_id, 10),
            bunch_quantity: parseInt(row.bunch_quantity, 10) || 1,
            gross_weight_kg: parseFloat(row.gross_weight_kg) || 0,
            waste_per_bunch_kg: parseFloat(row.waste_per_bunch_kg) || 0,
            rate_per_kg: parseFloat(row.rate_per_kg) || 0,
          })),
      };

      const res = await fetch('/api/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save bill');
      }

      const createdBill = await res.json();
      
      setItems([createInitialRow()]);
      setCustomerType('walkin');
      setSelectedPermanentCustomer(null);
      setIsWalkInModalOpen(false);
      setAmountPaidTouched(false);
      setAmountPaid('0');

      if (refreshStats) refreshStats();
      if (onRefreshCustomers) onRefreshCustomers();
      if (onBillCreated) onBillCreated(createdBill);

    } catch (err) {
      console.error('Error saving bill:', err);
      setErrorMessage(err.message || 'Error saving bill');
    } finally {
      setIsSaving(false);
    }
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.key === 'F9' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's')) {
        e.preventDefault();
        handleSaveAndPrintClick();
      }
      if (e.altKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        handleAddRow();
      }
      if (e.altKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleClearBill();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [items, customerType, selectedPermanentCustomer]);

  return (
    <div className="space-y-4">
      
      {/* Top Customer Selection Bar */}
      <div className="ui-card p-5 border-emerald-100/80">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Toggle: Walk-In vs Permanent Customer */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {t('customerType')}:
            </span>
            <div className="flex bg-slate-100/80 p-1 rounded-xl border border-slate-200/80">
              <button
                type="button"
                onClick={() => {
                  setCustomerType('walkin');
                  setSelectedPermanentCustomer(null);
                }}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                  customerType === 'walkin'
                    ? 'bg-gradient-to-r from-[#156b46] to-[#0e4f33] text-white shadow-md shadow-emerald-900/20'
                    : 'text-slate-500 hover:text-emerald-800 hover:bg-white'
                }`}
              >
                <span>🚶 {t('walkInCustomer')}</span>
              </button>
              <button
                type="button"
                onClick={() => setCustomerType('permanent')}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                  customerType === 'permanent'
                    ? 'bg-gradient-to-r from-[#156b46] to-[#0e4f33] text-white shadow-md shadow-emerald-900/20'
                    : 'text-slate-500 hover:text-emerald-800 hover:bg-white'
                }`}
              >
                <span>🏢 {t('permanentCustomer')}</span>
              </button>
            </div>
          </div>

          {/* Customer Details / Autocomplete Selector */}
          <div className="flex-1 max-w-2xl relative">
            {customerType === 'walkin' ? (
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl px-3.5 py-2 text-xs text-emerald-950 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#156b46]">
                    ⚡ {t('walkInCustomer')}:
                  </span>
                  <span>{t('walkInNotice')}</span>
                </div>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] bg-emerald-100 rounded font-bold text-emerald-900 border border-emerald-300">
                  Instant Checkout
                </span>
              </div>
            ) : selectedPermanentCustomer ? (
              <>
              <div className="bg-emerald-50 border border-emerald-300 rounded-xl px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#156b46] text-white flex items-center justify-center font-bold text-sm">
                    {selectedPermanentCustomer.shop_name ? '🏬' : '👤'}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <span>{selectedPermanentCustomer.shop_name || selectedPermanentCustomer.name}</span>
                      {selectedPermanentCustomer.shop_name && (
                        <span className="text-xs font-normal text-slate-600">({selectedPermanentCustomer.name})</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-600 flex items-center gap-2">
                      {selectedPermanentCustomer.phone && <span>📞 {selectedPermanentCustomer.phone}</span>}
                      {selectedPermanentCustomer.address && <span>📍 {selectedPermanentCustomer.address}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {onOpenLedger && (
                    <button
                      type="button"
                      onClick={() => onOpenLedger(selectedPermanentCustomer)}
                      className="px-2.5 py-1 text-xs font-bold text-[#156b46] hover:bg-emerald-100 rounded-lg transition-all flex items-center gap-1"
                      title={t('viewLedger')}
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>{t('ledgerAction')}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleOpenEditCustomer}
                    className="px-2.5 py-1 text-xs font-bold text-amber-800 hover:bg-amber-100 rounded-lg transition-all flex items-center gap-1"
                    title={t('editCustomer')}
                  >
                    <Edit className="w-3.5 h-3.5 text-amber-700" />
                    <span>{t('editCustomer')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPermanentCustomer(null);
                      setCustomerSearchQuery('');
                    }}
                    className="px-2.5 py-1 text-xs font-bold text-[#156b46] hover:bg-emerald-100 rounded-lg transition-all"
                  >
                    {t('changeCustomer')}
                  </button>
                </div>
              </div>

              {/* Live ledger snapshot for the selected saved customer */}
              <div className="mt-2 grid grid-cols-3 gap-2">
                <div className={`rounded-xl border px-3 py-1.5 ${
                  previousDue > 0
                    ? 'bg-red-50 border-red-200'
                    : previousAdvance > 0
                      ? 'bg-emerald-50 border-emerald-200'
                      : 'bg-slate-50 border-slate-200'
                }`}>
                  <span className="block text-[9px] font-black uppercase tracking-wide text-slate-500">
                    {previousDue > 0
                      ? t('previousDue')
                      : previousAdvance > 0
                        ? t('previousAdvance')
                        : t('settled')}
                  </span>
                  <span className={`block text-sm font-black tabular-nums ${
                    previousDue > 0 ? 'text-red-700' : 'text-emerald-700'
                  }`}>
                    ₹{(previousDue > 0 ? previousDue : previousAdvance).toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5">
                  <span className="block text-[9px] font-black uppercase tracking-wide text-slate-500">
                    {t('thisBill')}
                  </span>
                  <span className="block text-sm font-black tabular-nums text-slate-900">
                    ₹{billSummary.grandTotal.toLocaleString('en-IN')}
                  </span>
                </div>

                <div className={`rounded-xl border px-3 py-1.5 ${
                  projectedBalance > 0
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-emerald-50 border-emerald-200'
                }`}>
                  <span className="block text-[9px] font-black uppercase tracking-wide text-slate-500">
                    {t('afterPayment')}
                  </span>
                  <span className={`block text-sm font-black tabular-nums ${
                    projectedBalance > 0 ? 'text-amber-700' : 'text-emerald-700'
                  }`}>
                    {projectedBalance < 0 ? `${t('advanceAmount')} ` : ''}
                    ₹{Math.abs(projectedBalance).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
              </>
            ) : (
              <div className="relative">
                <div className="flex items-center relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                  <input
                    type="text"
                    value={customerSearchQuery}
                    onChange={(e) => {
                      setCustomerSearchQuery(e.target.value);
                      setIsCustomerDropdownOpen(true);
                    }}
                    onFocus={() => setIsCustomerDropdownOpen(true)}
                    placeholder={t('selectCustomerPlaceholder')}
                    className="ui-input pl-9 pr-8"
                  />
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 pointer-events-none" />
                </div>

                {isCustomerDropdownOpen && (
                  <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 max-h-60 overflow-y-auto">
                    {filteredCustomers.length === 0 ? (
                      <div className="p-3 text-center text-xs text-slate-500">
                        {t('noCustomersFound')}
                      </div>
                    ) : (
                      filteredCustomers.map((cust) => (
                        <div
                          key={cust.id}
                          onClick={() => {
                            setSelectedPermanentCustomer(cust);
                            setIsCustomerDropdownOpen(false);
                            setCustomerSearchQuery('');
                          }}
                          className="px-4 py-2.5 hover:bg-emerald-50 cursor-pointer border-b border-slate-100 last:border-b-0 flex items-center justify-between"
                        >
                          <div>
                            <div className="font-bold text-xs text-slate-900">
                              {cust.shop_name ? `${cust.shop_name} — ${cust.name}` : cust.name}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {cust.phone} {cust.address ? `• ${cust.address}` : ''}
                            </div>
                          </div>
                          <span className="text-xs text-[#156b46] font-bold bg-emerald-100 px-2 py-0.5 rounded">
                            Select
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-300 text-red-800 px-4 py-2.5 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Billing Table */}
      <div className="ui-card overflow-hidden">
        
        {/* Helper Note for Stem Waste Formula */}
        <div className="bg-slate-50 px-5 py-2 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-600 gap-2">
          <div className="flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-[#156b46]" />
            <span className="font-semibold text-slate-800">{t('stemWasteFormulaHelp')}</span>
          </div>
          <div className="text-[11px] text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-semibold">
            💡 {t('editableRateTip')}
          </div>
        </div>

        {/* Quick Variety Selection Chips with Malayalam name in first place */}
        {bananaTypes.length > 0 && (
          <div className="px-5 py-3 bg-gradient-to-r from-emerald-50/80 to-amber-50/60 border-b border-emerald-100 flex items-center gap-2 overflow-x-auto">
            <span className="text-[11px] font-bold text-emerald-900 whitespace-nowrap flex items-center gap-1 shrink-0">
              <span>🍌</span>
              <span>{lang === 'ml' ? 'പെട്ടെന്ന് ചേർക്കുക:' : 'Quick Add Variety:'}</span>
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {bananaTypes.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => handleQuickSelectVariety(v)}
                  className="px-2.5 py-1.5 bg-white hover:bg-emerald-50 hover:-translate-y-0.5 active:translate-y-0 border border-emerald-200 hover:border-emerald-400 rounded-xl text-xs font-bold text-slate-700 transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                  title={lang === 'ml' ? `${v.name_ml} ചേർക്കുക` : `Add ${v.name_en}`}
                >
                  <span className="text-emerald-900 font-extrabold">
                    {lang === 'ml' ? v.name_ml : v.name_en}
                  </span>
                  <span className="text-[10px] text-slate-500 font-normal">
                    ({lang === 'ml' ? v.name_en : v.name_ml})
                  </span>
                  <span className="bg-emerald-100/80 text-emerald-800 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold">
                    ₹{v.default_rate_per_kg}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 border-b border-slate-200">
                <th className="py-3 px-3 text-center w-12">{t('slNo')}</th>
                <th className="py-3 px-3 min-w-[200px]">{t('variety')}</th>
                <th className="py-3 px-3 w-28 text-center">{t('bunches')}</th>
                <th className="py-3 px-3 w-36 text-right">{t('grossWeight')}</th>
                <th className="py-3 px-3 w-32 text-right">{t('wastePerBunch')}</th>
                <th className="py-3 px-3 w-32 text-right">{t('totalWaste')}</th>
                <th className="py-3 px-3 w-36 text-right font-black text-slate-900">{t('netWeight')}</th>
                <th className="py-3 px-3 w-32 text-right font-bold text-[#156b46]">{t('ratePerKg')}</th>
                <th className="py-3 px-3 w-36 text-right font-black text-slate-900">{t('subtotal')}</th>
                <th className="py-3 px-2 text-center w-12">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((row, index) => {
                const currentVariety = bananaTypes.find((b) => b.id === parseInt(row.banana_type_id, 10));

                return (
                  <tr key={row.rowId} className="hover:bg-emerald-50/40 transition-colors">
                    {/* Sl No */}
                    <td className="py-2.5 px-3 text-center font-bold text-xs text-slate-400">
                      {index + 1}
                    </td>

                    {/* Banana Variety Selection */}
                    <td className="py-2.5 px-3">
                      <select
                        value={row.banana_type_id}
                        onChange={(e) => handleRowChange(index, 'banana_type_id', e.target.value)}
                        className="ui-input py-1.5 font-bold"
                      >
                        {bananaTypes.map((v) => (
                          <option key={v.id} value={v.id}>
                            {lang === 'ml' 
                              ? `${v.name_ml} (${v.name_en}) — ₹${v.default_rate_per_kg}/kg`
                              : `${v.name_en} (${v.name_ml}) — ₹${v.default_rate_per_kg}/kg`
                            }
                          </option>
                        ))}
                      </select>
                      {currentVariety && (
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {lang === 'ml' 
                            ? `${currentVariety.name_ml} (${currentVariety.name_en}) • സാധാരണ തണ്ട് കിഴിവ്: ${currentVariety.default_stem_waste_per_bunch_kg} kg/കുല`
                            : `${currentVariety.name_en} (${currentVariety.name_ml}) • Std Waste: ${currentVariety.default_stem_waste_per_bunch_kg} kg/bunch`
                          }
                        </div>
                      )}
                    </td>

                    {/* Bunches (Quantity) - Integer only, no up/down arrows */}
                    <td className="py-2.5 px-3">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={row.bunch_quantity}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, '');
                          handleRowChange(index, 'bunch_quantity', val);
                        }}
                        className="ui-input py-1.5 text-center font-bold"
                      />
                    </td>

                    {/* Gross Weight (kg) - Decimal text box, no spinner arrows */}
                    <td className="py-2.5 px-3">
                      <div className="relative">
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="0.00"
                          value={row.gross_weight_kg}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '' || /^\d*\.?\d*$/.test(val)) {
                              handleRowChange(index, 'gross_weight_kg', val);
                            }
                          }}
                          className="ui-input py-1.5 pr-6 pl-2 text-right font-bold bg-emerald-50/40 border-emerald-200"
                        />
                        <span className="absolute right-2 top-2 text-[10px] text-slate-400 pointer-events-none">
                          kg
                        </span>
                      </div>
                    </td>

                    {/* Waste per Bunch (kg) - Decimal text box, editable per row */}
                    <td className="py-2.5 px-3">
                      <div className="relative">
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="0.00"
                          value={row.waste_per_bunch_kg}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '' || /^\d*\.?\d*$/.test(val)) {
                              handleRowChange(index, 'waste_per_bunch_kg', val);
                            }
                          }}
                          className="ui-input py-1.5 pr-6 pl-2 text-right"
                        />
                        <span className="absolute right-2 top-2 text-[10px] text-slate-400 pointer-events-none">
                          kg
                        </span>
                      </div>
                    </td>

                    {/* Total Waste (kg) - Read only auto-calculated */}
                    <td className="py-2.5 px-3 text-right">
                      <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                        {row.total_waste_kg.toFixed(2)} kg
                      </span>
                    </td>

                    {/* Net Weight (kg) - Read only auto-calculated */}
                    <td className="py-2.5 px-3 text-right">
                      <span className="font-mono text-xs font-black text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg shadow-sm">
                        {row.net_weight_kg.toFixed(2)} kg
                      </span>
                    </td>

                    {/* Rate per kg (₹) - Decimal text box, immediately editable */}
                    <td className="py-2.5 px-3">
                      <div className="relative">
                        <span className="absolute left-2 top-2 text-xs font-bold text-[#156b46] pointer-events-none">
                          ₹
                        </span>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="0.00"
                          value={row.rate_per_kg}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '' || /^\d*\.?\d*$/.test(val)) {
                              handleRowChange(index, 'rate_per_kg', val);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && index === items.length - 1) {
                              handleAddRow();
                            }
                          }}
                          className="ui-input py-1.5 pl-5 pr-2 text-right font-bold bg-emerald-50/60 border-emerald-300 text-emerald-900"
                        />
                      </div>
                    </td>

                    {/* Subtotal (₹) */}
                    <td className="py-2.5 px-3 text-right">
                      <span className="font-mono text-xs font-black text-slate-900 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                        ₹{row.subtotal.toFixed(2)}
                      </span>
                    </td>

                    {/* Delete Row Action */}
                    <td className="py-2.5 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(index)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        title="Delete line item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Add Row Button & Shortcuts */}
        <div className="p-3 bg-slate-50/80 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={handleAddRow}
            className="ui-btn-soft shadow-sm"
          >
            <Plus className="w-4 h-4 text-[#156b46]" />
            <span>{t('addItem')}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClearBill}
              className="px-3 py-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-lg text-xs font-semibold transition-all flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t('clearBill')} (Alt+C)</span>
            </button>
          </div>
        </div>

      </div>

      {/* Bill Summary Banner - KRS Signboard Green Theme */}
      <div className="bg-gradient-to-br from-emerald-950 via-[#156b46] to-emerald-900 text-white rounded-2xl p-5 shadow-xl border border-emerald-600/40">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 items-center">
          
          {/* Total Bunches */}
          <div className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl p-3 shadow-inner">
            <span className="text-[11px] uppercase font-bold text-emerald-200 block">{t('totalBunches')}</span>
            <span className="text-xl font-black text-white">{billSummary.bunches}</span>
          </div>

          {/* Gross Weight */}
          <div className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl p-3 shadow-inner">
            <span className="text-[11px] uppercase font-bold text-emerald-200 block">{t('totalGrossWeight')}</span>
            <span className="text-xl font-black text-white">{billSummary.gross.toFixed(2)} kg</span>
          </div>

          {/* Total Stem Waste */}
          <div className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl p-3 shadow-inner">
            <span className="text-[11px] uppercase font-bold text-red-200 block">{t('totalStemWaste')}</span>
            <span className="text-xl font-black text-red-300">-{billSummary.waste.toFixed(2)} kg</span>
          </div>

          {/* Net Billable Weight */}
          <div className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl p-3 shadow-inner">
            <span className="text-[11px] uppercase font-bold text-emerald-200 block">{t('totalNetWeight')}</span>
            <span className="text-xl font-black text-emerald-300">{billSummary.net.toFixed(2)} kg</span>
          </div>

          {/* Grand Total - Clean White/Gold Contrast Box */}
          <div className="col-span-2 sm:col-span-3 lg:col-span-1 bg-white/95 text-emerald-950 rounded-2xl p-3 shadow-xl flex flex-col justify-center border border-amber-300 ring-4 ring-amber-400/10">
            <span className="text-[11px] uppercase font-black tracking-wider text-[#156b46] block">
              {t('grandTotal')}
            </span>
            <span className="text-2xl font-black tracking-tight text-slate-900">
              ₹{billSummary.grandTotal.toLocaleString('en-IN')}
            </span>
          </div>

        </div>

        {/* Checkout Action Bar */}
        <div className="mt-4 pt-4 border-t border-emerald-700/50 flex flex-col lg:flex-row lg:items-end justify-between gap-4">

          {/* Payment status */}
          <div className="flex flex-col gap-2">
            <div className={`self-start inline-flex items-center gap-3 rounded-2xl px-4 h-12 ring-1 ${
              balanceDue > 0
                ? 'bg-amber-400/15 ring-amber-300/40'
                : 'bg-emerald-400/15 ring-emerald-300/40'
            }`}>
              <span className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-200">
                {hasLedgerCustomer ? t('billBalance') : t('balanceDue')}
              </span>
              <span className={`text-xl font-black tabular-nums ${balanceDue > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>
                ₹{balanceDue.toLocaleString('en-IN')}
              </span>
            </div>
            <span className="text-[11px] text-emerald-200/80 font-medium">
              {t('posPaymentHint')}
            </span>
          </div>

          {/* Amount paid + Save & Print */}
          <div className="flex flex-col sm:flex-row sm:items-end gap-3 w-full lg:w-auto rounded-2xl bg-emerald-950/25 ring-1 ring-white/10 p-3">

            <div className="flex-1 sm:flex-none">
              <label htmlFor="pos-amount-paid" className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-200 mb-1.5">
                <Wallet className="w-3.5 h-3.5 text-amber-300" />
                {t('amountPaid')}
              </label>
              <div className="flex items-stretch gap-2">
                <div className="relative flex-1 sm:flex-none">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-900/70 font-black text-sm pointer-events-none">₹</span>
                  <input
                    id="pos-amount-paid"
                    type="number"
                    min="0"
                    max={maxPayable}
                    step="1"
                    inputMode="decimal"
                    value={amountPaid}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      setAmountPaidTouched(true);
                      setAmountPaid(e.target.value);
                    }}
                    className="w-full sm:w-40 h-12 pl-8 pr-3 bg-white border-2 border-amber-300 rounded-xl text-lg font-black text-emerald-950 tabular-nums focus:ring-4 focus:ring-amber-300/30 focus:border-amber-400 outline-none transition-all"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAmountPaidTouched(false);
                    setAmountPaid(String(billSummary.grandTotal));
                  }}
                  className="h-12 px-3.5 rounded-xl bg-white/10 hover:bg-white/20 ring-1 ring-white/25 text-white text-xs font-black whitespace-nowrap transition-all"
                >
                  {t('payFull')}
                </button>
                {previousDue > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setAmountPaidTouched(true);
                      setAmountPaid(String(maxPayable));
                    }}
                    className="h-12 px-3.5 rounded-xl bg-amber-300/20 hover:bg-amber-300/30 ring-1 ring-amber-300/50 text-amber-200 text-xs font-black whitespace-nowrap transition-all"
                  >
                    {t('payAllDues')}
                  </button>
                )}
                {previousAdvance > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setAmountPaidTouched(true);
                      setAmountPaid(String(Math.max(0, billSummary.grandTotal - previousAdvance)));
                    }}
                    className="h-12 px-3.5 rounded-xl bg-emerald-300/20 hover:bg-emerald-300/30 ring-1 ring-emerald-300/50 text-emerald-200 text-xs font-black whitespace-nowrap transition-all"
                  >
                    {t('useAdvance')}
                  </button>
                )}
              </div>
              {oldDuesPaid > 0 && (
                <p className="mt-1.5 text-[10px] font-bold text-amber-300">
                  ₹{oldDuesPaid.toLocaleString('en-IN')} {t('adjustsOldDues')}
                </p>
              )}
              {oldDuesPaid === 0 && advanceApplied > 0 && (
                <p className="mt-1.5 text-[10px] font-bold text-emerald-300">
                  ₹{advanceApplied.toLocaleString('en-IN')} {t('advanceAdjusted')}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={handleSaveAndPrintClick}
                disabled={isSaving}
                className="w-full sm:w-auto h-12 px-8 bg-gradient-to-r from-amber-300 to-amber-400 hover:from-amber-400 hover:to-amber-500 active:from-amber-500 text-emerald-950 font-black text-sm rounded-xl shadow-lg shadow-amber-900/20 transition-all flex items-center justify-center gap-2 transform active:scale-95 disabled:opacity-60 whitespace-nowrap"
              >
                <Printer className="w-5 h-5 text-emerald-950" />
                <span>{isSaving ? t('saving') : t('saveAndPrint')}</span>
              </button>
              <span className="text-[10px] text-emerald-200/70 font-semibold text-center">
                {lang === 'ml' ? 'F9 അല്ലെങ്കിൽ Ctrl+S' : 'F9 or Ctrl+S'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Walk-In Quick-Capture Modal */}
      <WalkInCaptureModal
        isOpen={isWalkInModalOpen}
        onClose={() => setIsWalkInModalOpen(false)}
        onConfirm={(walkinData) => {
          submitBill({
            customer_type: 'walkin',
            phone: walkinData.phone,
            name: walkinData.name,
            shop: walkinData.shop,
          });
        }}
        grandTotal={billSummary.grandTotal}
      />

      {/* Edit Selected Permanent Customer Modal */}
      {isEditCustomerOpen && selectedPermanentCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="ui-card shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-[#156b46] px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit className="w-5 h-5 text-white" />
                <h3 className="font-bold text-base">{t('editCustomer')}</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setIsEditCustomerOpen(false)}
                className="text-white/80 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="p-6 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('customerName')} *
                </label>
                <input
                  type="text"
                  required
                  value={editCustName}
                  onChange={(e) => setEditCustName(e.target.value)}
                  className="ui-input"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('shopName')}
                </label>
                <input
                  type="text"
                  value={editCustShop}
                  onChange={(e) => setEditCustShop(e.target.value)}
                  className="ui-input"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('phone')}
                </label>
                <input
                  type="tel"
                  value={editCustPhone}
                  onChange={(e) => setEditCustPhone(e.target.value)}
                  className="ui-input"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('address')}
                </label>
                <textarea
                  rows={2}
                  value={editCustAddress}
                  onChange={(e) => setEditCustAddress(e.target.value)}
                  className="ui-input"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditCustomerOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingCustomer}
                  className="px-5 py-2 bg-[#156b46] hover:bg-[#125839] text-white text-xs font-bold rounded-xl shadow transition-all flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSavingCustomer ? t('saving') : t('updateCustomer')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
