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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/65 backdrop-blur-sm modal-backdrop">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-emerald-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col"
        onKeyDown={handleKeyDown}
      >
        {/* Header - KRS Emerald Theme */}
        <div className="bg-gradient-to-r from-emerald-950 via-[#156b46] to-emerald-900 px-5 sm:px-6 py-3.5 text-white">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white/15 rounded-xl border border-white/25 shrink-0">
                <UserCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-base sm:text-lg text-white leading-tight">
                  {t('quickCaptureTitle')}
                </h3>
                <p className="text-xs text-emerald-100/90 mt-0.5">
                  {t('quickCaptureSubtitle')}
                </p>
              </div>
            </div>
            
            <div className="text-right shrink-0 bg-emerald-950/60 px-3 py-1.5 rounded-xl border border-emerald-400/30">
              <span className="text-[10px] text-emerald-200 block uppercase font-bold tracking-wider">{t('grandTotal')}</span>
              <span className="text-base sm:text-lg font-black text-white">₹{grandTotal.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-5 sm:p-6 space-y-4">
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-[#156b46]" />
                <span>{t('phone')} (10 digits)</span>
              </label>
              <span className="text-[11px] text-[#156b46] font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
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
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold text-base sm:text-lg focus:bg-white focus:ring-2 focus:ring-emerald-600 transition-all placeholder:text-slate-400 placeholder:font-normal placeholder:text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('customerName')} ({lang === 'ml' ? 'നിർബന്ധമില്ല' : 'Optional'})
              </label>
              <input
                type="text"
                placeholder={lang === 'ml' ? 'കസ്റ്റമറുടെ പേര്' : 'Buyer Name'}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Store className="w-3 h-3 text-slate-400" />
                <span>{t('shopName')} ({lang === 'ml' ? 'നിർബന്ധമില്ല' : 'Optional'})</span>
              </label>
              <input
                type="text"
                placeholder={lang === 'ml' ? 'കട / സ്റ്റാൾ പേര്' : 'Shop / Stall'}
                value={shop}
                onChange={(e) => setShop(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          <div className="bg-emerald-50 rounded-xl p-3 text-xs text-emerald-950 border border-emerald-200/90 flex items-start gap-2">
            <span className="font-bold text-[#156b46] text-sm leading-none mt-0.5">ℹ️</span>
            <span className="leading-relaxed">
              {lang === 'ml' 
                ? 'ഫോൺ നമ്പർ നൽകിയാൽ ഇടപാടുകൾ ഓട്ടോമാറ്റിക്കായി ട്രാക്ക് ചെയ്യപ്പെടും. സ്ഥിരം ലിസ്റ്റിൽ കൂട്ടിച്ചേർക്കപ്പെടില്ല.'
                : 'Repeat purchases with phone number are auto-tracked in Frequent Walk-Ins staging without polluting permanent customers.'}
            </span>
          </div>
        </div>

        {/* Footer Actions - Aligned and Responsive */}
        <div className="bg-slate-50 px-5 sm:px-6 py-3.5 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Quick Skip button */}
          <button
            type="button"
            onClick={() => onConfirm({ phone: '', name: '', shop: '' })}
            className="px-3.5 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200/80 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-slate-300/80 bg-white"
          >
            <SkipForward className="w-3.5 h-3.5 text-slate-500" />
            <span>{t('skipButton')}</span>
            <span className="text-[10px] font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-300">Enter</span>
          </button>

          {/* Cancel & Save/Print buttons */}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-slate-500 hover:text-slate-800 text-xs font-semibold transition-all rounded-lg hover:bg-slate-200/60"
            >
              {t('closePreview')}
            </button>
            <button
              type="button"
              onClick={handleProceed}
              className="px-5 py-2.5 bg-[#156b46] hover:bg-[#125839] active:bg-[#0e482e] text-white font-black text-xs sm:text-sm rounded-xl shadow-md shadow-emerald-900/25 transition-all flex items-center justify-center gap-2"
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
