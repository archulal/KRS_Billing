import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { ShoppingCart, History, Users, Layers, Settings as SettingsIcon } from 'lucide-react';

export default function Navigation({ activeTab, setActiveTab, frequentCount = 0 }) {
  const { t } = useLanguage();

  const navItems = [
    { id: 'billing', label: t('navBilling'), icon: ShoppingCart, shortcut: 'F1' },
    { id: 'history', label: t('navHistory'), icon: History, shortcut: 'F2' },
    { id: 'customers', label: t('navCustomers'), icon: Users, badge: frequentCount > 0 ? frequentCount : null, shortcut: 'F3' },
    { id: 'varieties', label: t('navVarieties'), icon: Layers, shortcut: 'F4' },
    { id: 'settings', label: t('navSettings'), icon: SettingsIcon, shortcut: 'F5' },
  ];

  return (
    <nav className="no-print sticky top-[68px] z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-1.5 overflow-x-auto py-2 scrollbar-none">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`group relative flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-gradient-to-r from-emerald-50 to-amber-50 text-[#0e4f33] ring-1 ring-emerald-200 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <span
                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                    isActive
                      ? 'bg-[#156b46] text-white shadow-sm'
                      : 'bg-slate-100 text-slate-400 group-hover:bg-white group-hover:text-emerald-700'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </span>
                <span>{item.label}</span>
                {item.badge != null && (
                  <span className="ui-badge bg-amber-500 text-white shadow-sm">
                    {item.badge}
                  </span>
                )}
                <span
                  className={`hidden md:inline-block px-1.5 py-0.5 text-[10px] font-mono rounded-md border ${
                    isActive
                      ? 'border-emerald-200 bg-white/70 text-emerald-700'
                      : 'border-slate-200 bg-slate-50 text-slate-400'
                  }`}
                >
                  {item.shortcut}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
