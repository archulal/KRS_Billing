import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { 
  Plus, Trash2, Printer, RotateCcw, User, Search, Store, 
  HelpCircle, AlertCircle, CheckCircle2, ChevronDown, Sparkles
} from 'lucide-react';
import WalkInCaptureModal from './WalkInCaptureModal';

export default function BillingScreen({ 
  bananaTypes, 
  permanentCustomers, 
  onBillCreated, 
  refreshStats,
  onOpenCustomerDirectory
}) {
  const { lang, t, getVarietyName } = useLanguage();

  // Customer state: default to 'walkin'
  const [customerType, setCustomerType] = useState('walkin'); // 'walkin' | 'permanent'
  const [selectedPermanentCustomer, setSelectedPermanentCustomer] = useState(null);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);

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

  const [items, setItems] = useState([]);
  const [isWalkInModalOpen, setIsWalkInModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Initialize with 1 empty row once varieties load
  useEffect(() => {
    if (bananaTypes.length > 0 && items.length === 0) {
      setItems([createEmptyRow(bananaTypes[0])]);
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
      let row = { ...next[index], [field]: value };

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
      if (prevItems.length === 0) {
        return [createEmptyRow(variety)];
      }
      const lastIndex = prevItems.length - 1;
      const lastRow = prevItems[lastIndex];
      // If last row has no gross weight entered yet, just update its variety
      if (!lastRow.gross_weight_kg || parseFloat(lastRow.gross_weight_kg) === 0) {
        const next = [...prevItems];
        next[lastIndex] = recalculateRow({
          ...lastRow,
          banana_type_id: variety.id,
          waste_per_bunch_kg: variety.default_stem_waste_per_bunch_kg,
          rate_per_kg: variety.default_rate_per_kg,
        });
        return next;
      }
      // Otherwise append a new row with this variety
      return [...prevItems, createEmptyRow(variety)];
    });
  };

  const handleRemoveRow = (index) => {
    if (items.length <= 1) {
      setItems([createEmptyRow(bananaTypes[0])]);
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClearBill = () => {
    if (window.confirm(lang === 'ml' ? 'ബിൽ വിവരങ്ങൾ മായ്ക്കണമെന്നുണ്ടോ?' : 'Clear all items in this bill?')) {
      setItems([createEmptyRow(bananaTypes[0])]);
      setCustomerType('walkin');
      setSelectedPermanentCustomer(null);
      setCustomerSearchQuery('');
      setErrorMessage('');
    }
  };

  // Bill Totals
  const billSummary = items.reduce(
    (acc, row) => {
      acc.bunches += parseInt(row.bunch_quantity, 10) || 0;
      acc.gross += parseFloat(row.gross_weight_kg) || 0;
      acc.waste += parseFloat(row.total_waste_kg) || 0;
      acc.net += parseFloat(row.net_weight_kg) || 0;
      acc.grandTotal += parseFloat(row.subtotal) || 0;
      return acc;
    },
    { bunches: 0, gross: 0, waste: 0, net: 0, grandTotal: 0 }
  );

  billSummary.gross = Math.round(billSummary.gross * 100) / 100;
  billSummary.waste = Math.round(billSummary.waste * 100) / 100;
  billSummary.net = Math.round(billSummary.net * 100) / 100;
  billSummary.grandTotal = Math.round(billSummary.grandTotal * 100) / 100;

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
      
      setItems([createEmptyRow(bananaTypes[0])]);
      setCustomerType('walkin');
      setSelectedPermanentCustomer(null);
      setIsWalkInModalOpen(false);

      if (refreshStats) refreshStats();
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
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-emerald-100">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Toggle: Walk-In vs Permanent Customer */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {t('customerType')}:
            </span>
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setCustomerType('walkin');
                  setSelectedPermanentCustomer(null);
                }}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                  customerType === 'walkin'
                    ? 'bg-[#156b46] text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>🚶 {t('walkInCustomer')}</span>
              </button>
              <button
                type="button"
                onClick={() => setCustomerType('permanent')}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                  customerType === 'permanent'
                    ? 'bg-[#156b46] text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
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
                    className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:bg-white"
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
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        
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
          <div className="px-5 py-2.5 bg-emerald-50/60 border-b border-emerald-100 flex items-center gap-2 overflow-x-auto">
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
                  className="px-2.5 py-1 bg-white hover:bg-emerald-100 active:bg-emerald-200 border border-emerald-300 hover:border-emerald-500 rounded-lg text-xs font-bold text-slate-800 transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
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
              <tr className="bg-slate-100/90 text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
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
                  <tr key={row.rowId} className="hover:bg-slate-50/70 transition-colors">
                    {/* Sl No */}
                    <td className="py-2.5 px-3 text-center font-bold text-xs text-slate-400">
                      {index + 1}
                    </td>

                    {/* Banana Variety Selection */}
                    <td className="py-2.5 px-3">
                      <select
                        value={row.banana_type_id}
                        onChange={(e) => handleRowChange(index, 'banana_type_id', e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:bg-white"
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

                    {/* Bunches (Quantity) */}
                    <td className="py-2.5 px-3">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={row.bunch_quantity}
                        onChange={(e) => handleRowChange(index, 'bunch_quantity', e.target.value)}
                        className="w-full text-center px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900"
                      />
                    </td>

                    {/* Gross Weight (kg) */}
                    <td className="py-2.5 px-3">
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={row.gross_weight_kg}
                          onChange={(e) => handleRowChange(index, 'gross_weight_kg', e.target.value)}
                          className="w-full text-right pr-6 pl-2 py-1.5 bg-emerald-50/30 border border-emerald-300 rounded-lg text-xs font-bold text-slate-900 focus:bg-white"
                        />
                        <span className="absolute right-2 top-2 text-[10px] text-slate-400 pointer-events-none">
                          kg
                        </span>
                      </div>
                    </td>

                    {/* Waste per Bunch (kg) - Editable per row */}
                    <td className="py-2.5 px-3">
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          value={row.waste_per_bunch_kg}
                          onChange={(e) => handleRowChange(index, 'waste_per_bunch_kg', e.target.value)}
                          className="w-full text-right pr-6 pl-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-700"
                        />
                        <span className="absolute right-2 top-2 text-[10px] text-slate-400 pointer-events-none">
                          kg
                        </span>
                      </div>
                    </td>

                    {/* Total Waste (kg) - Read only auto-calculated */}
                    <td className="py-2.5 px-3 text-right">
                      <span className="font-mono text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">
                        {row.total_waste_kg.toFixed(2)} kg
                      </span>
                    </td>

                    {/* Net Weight (kg) - Read only auto-calculated */}
                    <td className="py-2.5 px-3 text-right">
                      <span className="font-mono text-xs font-black text-emerald-900 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">
                        {row.net_weight_kg.toFixed(2)} kg
                      </span>
                    </td>

                    {/* Rate per kg (₹) - Immediately editable */}
                    <td className="py-2.5 px-3">
                      <div className="relative">
                        <span className="absolute left-2 top-2 text-xs font-bold text-[#156b46] pointer-events-none">
                          ₹
                        </span>
                        <input
                          type="number"
                          step="0.5"
                          value={row.rate_per_kg}
                          onChange={(e) => handleRowChange(index, 'rate_per_kg', e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && index === items.length - 1) {
                              handleAddRow();
                            }
                          }}
                          className="w-full text-right pl-5 pr-2 py-1.5 bg-emerald-50/70 border border-emerald-400 rounded-lg text-xs font-bold text-emerald-950 focus:bg-white focus:ring-emerald-600"
                        />
                      </div>
                    </td>

                    {/* Subtotal (₹) */}
                    <td className="py-2.5 px-3 text-right">
                      <span className="font-mono text-xs font-black text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md">
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
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={handleAddRow}
            className="px-4 py-2 bg-white hover:bg-emerald-50 text-[#156b46] border border-emerald-300 font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
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
          <div className="bg-emerald-950/60 border border-emerald-400/30 rounded-xl p-3">
            <span className="text-[11px] uppercase font-bold text-emerald-200 block">{t('totalBunches')}</span>
            <span className="text-xl font-black text-white">{billSummary.bunches}</span>
          </div>

          {/* Gross Weight */}
          <div className="bg-emerald-950/60 border border-emerald-400/30 rounded-xl p-3">
            <span className="text-[11px] uppercase font-bold text-emerald-200 block">{t('totalGrossWeight')}</span>
            <span className="text-xl font-black text-white">{billSummary.gross.toFixed(2)} kg</span>
          </div>

          {/* Total Stem Waste */}
          <div className="bg-emerald-950/60 border border-emerald-400/30 rounded-xl p-3">
            <span className="text-[11px] uppercase font-bold text-red-200 block">{t('totalStemWaste')}</span>
            <span className="text-xl font-black text-red-300">-{billSummary.waste.toFixed(2)} kg</span>
          </div>

          {/* Net Billable Weight */}
          <div className="bg-emerald-950/60 border border-emerald-400/30 rounded-xl p-3">
            <span className="text-[11px] uppercase font-bold text-emerald-200 block">{t('totalNetWeight')}</span>
            <span className="text-xl font-black text-emerald-300">{billSummary.net.toFixed(2)} kg</span>
          </div>

          {/* Grand Total - Clean White/Gold Contrast Box */}
          <div className="col-span-2 sm:col-span-3 lg:col-span-1 bg-white text-emerald-950 rounded-xl p-3 shadow-lg flex flex-col justify-center border-2 border-emerald-300">
            <span className="text-[11px] uppercase font-black tracking-wider text-[#156b46] block">
              {t('grandTotal')}
            </span>
            <span className="text-2xl font-black tracking-tight text-slate-900">
              ₹{billSummary.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

        </div>

        {/* Large Action Bar */}
        <div className="mt-4 pt-4 border-t border-emerald-700/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-emerald-200/90 font-medium">
            {lang === 'ml' 
              ? 'F9 അല്ലെങ്കിൽ Ctrl+S അമർത്തി സേവ് ചെയ്ത് പ്രിന്റ് ചെയ്യാം.'
              : 'Press F9 or Ctrl+S to instantly Save & Print invoice.'}
          </div>

          <button
            type="button"
            onClick={handleSaveAndPrintClick}
            disabled={isSaving}
            className="w-full sm:w-auto px-8 py-3.5 bg-emerald-400 hover:bg-emerald-300 active:bg-emerald-500 text-emerald-950 font-black text-sm rounded-xl shadow-lg shadow-emerald-950/40 transition-all flex items-center justify-center gap-2 transform active:scale-95"
          >
            <Printer className="w-5 h-5 text-emerald-950" />
            <span>{isSaving ? t('saving') : t('saveAndPrint')}</span>
          </button>
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

    </div>
  );
}
