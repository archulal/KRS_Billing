import React, { useState, useEffect } from 'react';
import { useLanguage } from './i18n/LanguageContext';
import Header from './components/Header';
import Navigation from './components/Navigation';
import BillingScreen from './components/BillingScreen';
import BillsHistoryScreen from './components/BillsHistoryScreen';
import CustomersScreen from './components/CustomersScreen';
import VarietiesScreen from './components/VarietiesScreen';
import SettingsScreen from './components/SettingsScreen';
import PrintableInvoice from './components/PrintableInvoice';

export default function App() {
  const { lang, t } = useLanguage();
  const [activeTab, setActiveTab] = useState('billing'); // 'billing', 'history', 'customers', 'varieties'
  const [bananaTypes, setBananaTypes] = useState([]);
  const [permanentCustomers, setPermanentCustomers] = useState([]);
  const [stats, setStats] = useState(null);
  const [activeInvoice, setActiveInvoice] = useState(null);
  const [invoiceMode, setInvoiceMode] = useState('print'); // 'print' (POS direct print) | 'preview'
  const [invoiceFromPos, setInvoiceFromPos] = useState(false);
  const [frequentCount, setFrequentCount] = useState(0);
  const [settings, setSettings] = useState(null);

  // Fetch initial data
  const fetchBananaTypes = async () => {
    try {
      const res = await fetch('/api/banana-types');
      if (res.ok) {
        const data = await res.json();
        setBananaTypes(data);
      }
    } catch (err) {
      console.error('Failed to fetch banana types:', err);
    }
  };

  const fetchPermanentCustomers = async () => {
    try {
      const res = await fetch('/api/customers');
      if (res.ok) {
        const data = await res.json();
        setPermanentCustomers(data);
      }
    } catch (err) {
      console.error('Failed to fetch customers:', err);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/bills/stats/summary');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        setSettings(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    }
  };

  const fetchWalkinCount = async () => {
    try {
      const res = await fetch('/api/customers/walkin');
      if (res.ok) {
        const data = await res.json();
        const count = data.filter((w) => w.visit_count >= 3).length;
        setFrequentCount(count);
      }
    } catch (err) {
      console.error('Failed to fetch walk-ins count:', err);
    }
  };

  useEffect(() => {
    fetchBananaTypes();
    fetchPermanentCustomers();
    fetchStats();
    fetchWalkinCount();
    fetchSettings();
  }, []);

  // Global Function key shortcuts (F1, F2, F3, F4, F5)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F1') {
        e.preventDefault();
        setActiveTab('billing');
      } else if (e.key === 'F2') {
        e.preventDefault();
        setActiveTab('history');
      } else if (e.key === 'F3') {
        e.preventDefault();
        setActiveTab('customers');
      } else if (e.key === 'F4') {
        e.preventDefault();
        setActiveTab('varieties');
      } else if (e.key === 'F5') {
        e.preventDefault();
        setActiveTab('settings');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleBillCreated = (newBill) => {
    setInvoiceFromPos(true);
    // POS always opens the invoice preview: Send on WhatsApp or Print.
    setInvoiceMode('preview');
    setActiveInvoice(newBill);
    fetchStats();
    fetchWalkinCount();
  };

  const handleOpenInvoicePreview = (bill) => {
    setInvoiceFromPos(false);
    setInvoiceMode('preview');
    setActiveInvoice(bill);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 font-sans selection:bg-amber-200">
      
      {/* Top Header with Language Toggle & Live Clock */}
      <Header stats={stats} />

      {/* Main Tab Navigation */}
      <Navigation 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        frequentCount={frequentCount} 
      />

      {/* Main Content Area */}
      <main className="no-print flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5">
        {activeTab === 'billing' && (
          <BillingScreen
            bananaTypes={bananaTypes}
            permanentCustomers={permanentCustomers}
            onBillCreated={handleBillCreated}
            refreshStats={fetchStats}
            onOpenCustomerDirectory={() => setActiveTab('customers')}
            onRefreshCustomers={() => {
              fetchPermanentCustomers();
              fetchWalkinCount();
            }}
          />
        )}

        {activeTab === 'history' && (
          <BillsHistoryScreen
            onSelectBillForPrint={handleOpenInvoicePreview}
          />
        )}

        {activeTab === 'customers' && (
          <CustomersScreen
            permanentCustomers={permanentCustomers}
            onRefreshCustomers={() => {
              fetchPermanentCustomers();
              fetchWalkinCount();
            }}
          />
        )}

        {activeTab === 'varieties' && (
          <VarietiesScreen
            bananaTypes={bananaTypes}
            onRefreshVarieties={fetchBananaTypes}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsScreen
            settings={settings}
            onSettingsSaved={setSettings}
          />
        )}
      </main>

      {/* Offline Desktop Footer Note */}
      <footer className="no-print bg-slate-200/80 border-t border-slate-300 py-3 text-center text-xs text-slate-500">
        <p>
          KRS Banana Wholesale Billing System • Canon PIXMA G3000 Series Ready (A5 / A4) • Standalone Offline POS
        </p>
      </footer>

      {/* Printable Invoice Modal / Overlay */}
      {activeInvoice && (
        <PrintableInvoice
          key={activeInvoice.id || activeInvoice.bill_number}
          bill={activeInvoice}
          mode={invoiceMode}
          settings={settings}
          closeAfterPrint={invoiceFromPos}
          onClose={() => setActiveInvoice(null)}
        />
      )}

    </div>
  );
}
