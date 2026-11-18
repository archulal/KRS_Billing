import React, { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { Languages, WifiOff, Clock, TrendingUp, ShoppingBag, Weight } from 'lucide-react';
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
    <header className="no-print bg-gradient-to-r from-emerald-950 via-[#156b46] to-emerald-900 text-white shadow-xl sticky top-0 z-40 border-b border-emerald-700/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          
          {/* Brand & Market Information matching the Physical KRS Signboard */}
          <div className="flex items-center space-x-3.5">
            {/* Banana Tree Logo Emblem */}
            <div className="w-12 h-12 rounded-xl bg-white p-1 shadow-md border-2 border-emerald-300/60 flex items-center justify-center shrink-0">
              <img 
                src={krsLogo} 
                alt="KRS Banana Tree Logo" 
                className="w-full h-full object-contain filter drop-shadow-sm" 
              />
            </div>

            <div>
              <div className="flex items-center gap-2.5">
                {/* 3D KRS Signboard Title */}
                <h1 className="text-xl sm:text-2xl font-black tracking-tight leading-none text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                  {lang === 'ml' ? 'കെ.ആർ.എസ്' : 'KRS'}
                </h1>
                <span className="bg-white/95 text-[#156b46] text-[11px] font-black uppercase px-2 py-0.5 rounded shadow-sm border border-emerald-200">
                  {lang === 'ml' ? 'പ്ലാന്റയിൻ മർച്ചന്റ്' : 'PLANTAIN MERCHANTS'}
                </span>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-800/80 text-emerald-100 border border-emerald-600/40">
                  <WifiOff className="w-3 h-3 mr-1 inline" />
                  {t('offlineReady')}
                </span>
              </div>
              
              <div className="flex items-center gap-2 text-xs text-emerald-100 mt-1 font-medium flex-wrap">
                <span className="bg-emerald-900/60 px-2 py-0.5 rounded text-emerald-200 border border-emerald-700/40">
                  {t('headerMarketLocation')}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Metrics & Controls */}
          <div className="flex items-center flex-wrap gap-2 md:gap-4 justify-between md:justify-end">
            
            {/* Today's Sales Badge */}
            {stats && stats.today && (
              <div className="hidden xl:flex items-center gap-3 bg-emerald-950/70 border border-emerald-500/40 rounded-xl px-3 py-1.5 text-xs text-emerald-100 shadow-inner">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{lang === 'ml' ? 'ഇന്ന്:' : 'Today:'}</span>
                  <strong className="text-emerald-300 font-bold">₹{Number(stats.today.today_sales || 0).toLocaleString('en-IN')}</strong>
                </div>
                <div className="w-px h-3.5 bg-emerald-700/50" />
                <div className="flex items-center gap-1.5">
                  <ShoppingBag className="w-3.5 h-3.5 text-emerald-300" />
                  <span>{stats.today.today_bills_count || 0} {lang === 'ml' ? 'ബിൽ' : 'Bills'}</span>
                </div>
                <div className="w-px h-3.5 bg-emerald-700/50" />
                <div className="flex items-center gap-1.5">
                  <Weight className="w-3.5 h-3.5 text-emerald-300" />
                  <span>{Number(stats.today.today_net_weight || 0).toFixed(1)} kg</span>
                </div>
              </div>
            )}

            {/* Date Time Indicator */}
            <div className="hidden sm:flex items-center text-xs text-emerald-100/90 bg-emerald-950/50 px-2.5 py-1.5 rounded-xl border border-emerald-700/30">
              <Clock className="w-3.5 h-3.5 mr-1.5 text-emerald-300" />
              <span>{formattedDate} • {formattedTime}</span>
            </div>

            {/* Language Toggle Switch */}
            <div className="flex items-center bg-emerald-950/80 p-1 rounded-xl border border-emerald-500/50 shadow-inner">
              <button
                type="button"
                onClick={() => lang !== 'en' && toggleLanguage()}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1 ${
                  lang === 'en'
                    ? 'bg-white text-[#156b46] shadow-sm font-black'
                    : 'text-emerald-200 hover:text-white'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => lang !== 'ml' && toggleLanguage()}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1 font-malayalam ${
                  lang === 'ml'
                    ? 'bg-white text-[#156b46] shadow-sm font-black'
                    : 'text-emerald-200 hover:text-white'
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
