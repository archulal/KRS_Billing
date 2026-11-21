import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { UserCheck, Phone, Store, ArrowRight, CornerDownLeft, X, SkipForward } from 'lucide-react';

export default function WalkInCaptureModal({ isOpen, onClose, onConfirm, grandTotal }) {
  const { lang, t } = useLanguage();
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [shop, setShop] = useState('');
  const phoneInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setPhone('');
      setName('');
      setShop('');
      setTimeout(() => {
        if (phoneInputRef.current) {
          phoneInputRef.current.focus();
        }
      }, 60);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleProceed();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const handleProceed = () => {
    onConfirm({
      phone: phone.trim(),
      name: name.trim(),
      shop: shop.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/65 backdrop-blur-sm modal-backdrop">
      <div 
        className="bg-white rounded-2xl shadow-2xl shadow-slate-900/25 ring-1 ring-emerald-200/70 border border-emerald-200/80 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col"
        onKeyDown={handleKeyDown}
      >
        {/* Header - KRS Emerald Theme */}
        <div className="relative bg-gradient-to-r from-emerald-950 via-[#156b46] to-emerald-900 px-5 sm:px-6 py-4 text-white overflow-hidden">
          <div className="absolute -right-8 -top-10 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-white/15 rounded-xl ring-1 ring-white/25 shrink-0">
                <UserCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-lg sm:text-xl tracking-tight text-white leading-tight">
                  {t('quickCaptureTitle')}
                </h3>
                <p className="text-xs text-emerald-100/90 mt-1">
                  {t('quickCaptureSubtitle')}
                </p>
              </div>
            </div>
            
            <div className="text-right shrink-0 bg-emerald-950/50 px-3.5 py-2 rounded-xl ring-1 ring-emerald-400/30 shadow-inner">
              <span className="text-[10px] text-emerald-200 block uppercase font-bold tracking-wider">{t('grandTotal')}</span>
              <span className="text-base sm:text-xl font-black text-white tabular-nums">₹{grandTotal.toLocaleString('en-IN')}</span>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500" />
        </div>

        {/* Form Body */}
        <div className="p-5 sm:p-6 space-y-5">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-700" />
                <span>{t('phone')} (10 digits)</span>
              </label>
              <span className="text-[11px] text-emerald-800 font-semibold bg-emerald-50 px-2.5 py-1 rounded-lg ring-1 ring-emerald-200">
                {t('skipNotice')}
              </span>
            </div>
            <input
              ref={phoneInputRef}
              type="tel"
              placeholder="e.g. 9847123456"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
              maxLength={10}
              className="w-full px-4 py-3 bg-slate-50/80 border border-slate-200 rounded-xl text-slate-900 font-bold text-base sm:text-lg shadow-sm focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all placeholder:text-slate-400 placeholder:font-normal placeholder:text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t('customerName')} ({lang === 'ml' ? 'നിർബന്ധമില്ല' : 'Optional'})
              </label>
              <input
                type="text"
                placeholder={lang === 'ml' ? 'കസ്റ്റമറുടെ പേര്' : 'Buyer Name'}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 shadow-sm focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all placeholder:text-slate-400 placeholder:font-normal"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
                <Store className="w-3.5 h-3.5 text-emerald-600" />
                <span>{t('shopName')} ({lang === 'ml' ? 'നിർബന്ധമില്ല' : 'Optional'})</span>
              </label>
              <input
                type="text"
                placeholder={lang === 'ml' ? 'കട / സ്റ്റാൾ പേര്' : 'Shop / Stall'}
                value={shop}
                onChange={(e) => setShop(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 shadow-sm focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all placeholder:text-slate-400 placeholder:font-normal"
              />
            </div>
          </div>

          <div className="bg-emerald-50 rounded-xl p-3.5 text-sm text-emerald-950 ring-1 ring-emerald-200/80 flex items-start gap-2.5">
            <span className="font-bold text-emerald-700 text-base leading-none mt-0.5 shrink-0">ℹ️</span>
            <span className="leading-relaxed">
              {lang === 'ml' 
                ? 'ഫോൺ നമ്പർ നൽകിയാൽ ഇടപാടുകൾ ഓട്ടോമാറ്റിക്കായി ട്രാക്ക് ചെയ്യപ്പെടും. സ്ഥിരം ലിസ്റ്റിൽ കൂട്ടിച്ചേർക്കപ്പെടില്ല.'
                : 'Repeat purchases with phone number are auto-tracked in Frequent Walk-Ins staging without polluting permanent customers.'}
            </span>
          </div>
        </div>

        {/* Footer Actions - Aligned and Responsive */}
        <div className="bg-slate-50/80 px-5 sm:px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Quick Skip button */}
          <button
            type="button"
            onClick={() => onConfirm({ phone: '', name: '', shop: '' })}
            className="px-3.5 py-2.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 border border-slate-200 bg-white shadow-sm"
          >
            <SkipForward className="w-4 h-4 text-emerald-600" />
            <span>{t('skipButton')}</span>
            <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md ring-1 ring-slate-200">Enter</span>
          </button>

          {/* Cancel & Save/Print buttons */}
          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2.5 text-slate-500 hover:text-slate-800 text-sm font-semibold transition-all rounded-xl hover:bg-slate-200/70"
            >
              {t('closePreview')}
            </button>
            <button
              type="button"
              onClick={handleProceed}
              className="px-5 py-2.5 bg-gradient-to-r from-[#156b46] to-emerald-800 hover:from-[#0e4f33] hover:to-emerald-900 active:from-[#0e482e] text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-900/25 transition-all flex items-center justify-center gap-2"
            >
              <span>{t('saveAndPrintButton')}</span>
              <CornerDownLeft className="w-4 h-4 shrink-0" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
