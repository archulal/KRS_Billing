import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { ShoppingCart, History, Users, Layers, Settings as SettingsIcon } from 'lucide-react';

export default function Navigation({ activeTab, setActiveTab, frequentCount = 0 }) {
  const { t } = useLanguage();

  const navItems = [
    {
      id: 'billing',
      label: t('navBilling'),
      icon: ShoppingCart,
      shortcut: 'F1',
    },
    {
      id: 'history',
      label: t('navHistory'),
      icon: History,
      shortcut: 'F2',
    },
    {
      id: 'customers',
      label: t('navCustomers'),
      icon: Users,
      badge: frequentCount > 0 ? frequentCount : null,
      shortcut: 'F3',
    },
    {
      id: 'varieties',
      label: t('navVarieties'),
      icon: Layers,
      shortcut: 'F4',
    },
    {
      id: 'settings',
      label: t('navSettings'),
      icon: SettingsIcon,
      shortcut: 'F5',
    },
  ];

  return (
    <nav className="no-print bg-white border-b border-emerald-100 sticky top-[68px] z-30 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex space-x-1 sm:space-x-4 overflow-x-auto py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-emerald-50 text-[#156b46] font-bold shadow-sm border border-emerald-300'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#156b46]' : 'text-slate-400'}`} />
                <span>{item.label}</span>
                {item.badge != null && (
                  <span className="ml-1.5 px-2 py-0.5 text-xs font-bold bg-emerald-600 text-white rounded-full">
                    {item.badge}
                  </span>
                )}
                <span className="hidden md:inline-block ml-1 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-100 border border-slate-200 rounded">
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
