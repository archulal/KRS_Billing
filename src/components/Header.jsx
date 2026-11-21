import React, { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { Languages, WifiOff, Clock, TrendingUp, ShoppingBag, Weight, Sparkles } from 'lucide-react';
import krsLogo from '../assets/krs_banana_tree.png';

export default function Header({ stats }) {
  const { lang, toggleLanguage, t } = useLanguage();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedDate = time.toLocaleDateString(lang === 'ml' ? 'ml-IN' : 'en-IN', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const formattedTime = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <header className="no-print sticky top-0 z-40 border-b border-emerald-900/40 bg-gradient-to-r from-[#062f22] via-[#0e4f33] to-[#156b46] text-white shadow-[0_12px_34px_-24px_rgba(6,47,34,0.95)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">

          {/* Brand & Market Information */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative w-11 h-11 rounded-2xl bg-white/95 p-1.5 shadow-lg ring-1 ring-emerald-300/50 shrink-0">
              <img
                src={krsLogo}
                alt="KRS Banana Tree Logo"
                className="w-full h-full object-contain"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-amber-400 border-2 border-[#0e4f33]" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-[22px] font-black tracking-tight leading-none text-white drop-shadow-sm">
                  {lang === 'ml' ? 'കെ.ആർ.എസ്' : 'KRS'}
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-white/95 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-[#0e4f33] shadow-sm">
                  <Sparkles className="w-3 h-3 text-amber-600" />
                  {lang === 'ml' ? 'പ്ലാന്റയിൻ മർച്ചന്റ്' : 'PLANTAIN MERCHANTS'}
                </span>
              </div>

              <div className="flex items-center gap-2 mt-1 text-[11px] text-emerald-100/80 flex-wrap">
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-950/40 px-2 py-0.5 border border-emerald-400/20">
                  <WifiOff className="w-3 h-3 text-emerald-300" />
                  {t('offlineReady')}
                </span>
                <span className="w-1 h-1 rounded-full bg-emerald-300/50" />
                <span className="truncate">{t('headerMarketLocation')}</span>
              </div>
            </div>
          </div>

          {/* Quick Metrics & Controls */}
          <div className="flex items-center flex-wrap gap-2 justify-between lg:justify-end">

            {stats && stats.today && (
              <div className="hidden xl:flex items-center gap-2.5 rounded-xl bg-emerald-950/35 border border-emerald-400/20 px-3 py-1.5 text-[11px] text-emerald-100 shadow-inner backdrop-blur-sm">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-300" />
                  <span className="text-emerald-200/80">{lang === 'ml' ? 'ഇന്ന്:' : 'Today:'}</span>
                  <strong className="font-black text-white">₹{Number(stats.today.today_sales || 0).toLocaleString('en-IN')}</strong>
                </div>
                <span className="w-px h-3.5 bg-emerald-400/25" />
                <div className="flex items-center gap-1.5">
                  <ShoppingBag className="w-3.5 h-3.5 text-amber-300" />
                  <strong className="font-black text-white">{stats.today.today_bills_count || 0}</strong>
                  <span className="text-emerald-200/80">{lang === 'ml' ? 'ബിൽ' : 'Bills'}</span>
                </div>
                <span className="w-px h-3.5 bg-emerald-400/25" />
                <div className="flex items-center gap-1.5">
                  <Weight className="w-3.5 h-3.5 text-emerald-300" />
                  <strong className="font-black text-white">{Number(stats.today.today_net_weight || 0).toFixed(1)} kg</strong>
                </div>
              </div>
            )}

            <div className="hidden md:flex items-center gap-1.5 rounded-xl bg-emerald-950/35 border border-emerald-400/20 px-2.5 py-1.5 text-[11px] text-emerald-100 backdrop-blur-sm">
              <Clock className="w-3.5 h-3.5 text-emerald-300" />
              <span className="font-medium">{formattedDate} • {formattedTime}</span>
            </div>

            <div className="flex items-center gap-1 rounded-xl bg-emerald-950/50 p-1 border border-emerald-400/25 shadow-inner">
              <Languages className="w-3.5 h-3.5 text-emerald-300 ml-1.5" />
              <button
                type="button"
                onClick={() => lang !== 'en' && toggleLanguage()}
                className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all ${
                  lang === 'en'
                    ? 'bg-white text-[#0e4f33] shadow-sm'
                    : 'text-emerald-100/80 hover:text-white hover:bg-white/10'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => lang !== 'ml' && toggleLanguage()}
                className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all font-malayalam ${
                  lang === 'ml'
                    ? 'bg-white text-[#0e4f33] shadow-sm'
                    : 'text-emerald-100/80 hover:text-white hover:bg-white/10'
                }`}
              >
                മലയാളം
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
