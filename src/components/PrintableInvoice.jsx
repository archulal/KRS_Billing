// src/components/PrintableInvoice.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Printer, X, FileText, CheckCircle2, AlertCircle, MessageCircle, Loader2 } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import QRCode from 'qrcode';
import krsLogoPrint from '../assets/krs_banana_tree.png';

// Number to Words converter (Indian numbering system)
function numberToWords(amount) {
  const num = Math.round(amount);
  if (num === 0) return 'Zero Rupees Only';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  function inWords(n) {
    if (n === 0) return '';
    if (n < 20) return a[n] + ' ';
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '') + ' ';
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred ' + inWords(n % 100);
    if (n < 100000) return inWords(Math.floor(n / 1000)) + 'Thousand ' + inWords(n % 1000);
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + 'Lakh ' + inWords(n % 100000);
    return inWords(Math.floor(n / 10000000)) + 'Crore ' + inWords(n % 10000000);
  }
  return `Rupees ${inWords(num).trim()} Only`;
}

export default function PrintableInvoice({ bill, onClose, mode = 'print', settings }) {
  const { lang, t } = useLanguage();
  const [paperSize] = useState('a5'); // fixed to A5 as per requirement
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [printerName, setPrinterName] = useState(null);
  const [customerName, setCustomerName] = useState(null);
  const [printStatus, setPrintStatus] = useState(null);
  const [waStatus, setWaStatus] = useState(null);
  const receiptRef = useRef(null);

  const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

  // 1️⃣ Get default printer (fallback to first available)
  useEffect(() => {
    (async () => {
      try {
        if (!window.electronAPI?.listPrinters) {
          setPrinterName('');
          return;
        }
        const printers = await window.electronAPI.listPrinters();
        const def = printers.find(p => p.isDefault) || printers[0];
        setPrinterName(def?.name || '');
      } catch (e) {
        console.error('Printer enumeration error →', e);
        setPrinterName('');
      }
    })();
  }, []);

  // 2️⃣ Resolve customer name (prompt only for POS direct print)
  useEffect(() => {
    if (customerName !== null) return; // already set
    const existing = bill?.customer_display_name || bill?.customer_name;
    if (existing) {
      setCustomerName(existing);
      return;
    }
    if (mode !== 'print') {
      setCustomerName('Walk-In');
      return;
    }
    const input = window.prompt('Enter walk‑in customer name:');
    const name = input && input.trim() ? input.trim() : 'Walk‑In';
    setCustomerName(name);
  }, [bill, customerName, mode]);

  // 3️⃣ Generate QR code (black/white)
  useEffect(() => {
    if (bill?.grand_total != null) {
      const amt = Number(bill.grand_total).toFixed(2);
      const upi = `upi://pay?pa=Vyapar.178760240373@hdfcbank&pn=KRS%20Plantain%20Merchant&mc=8999&am=${amt}&cu=INR&tn=Invoice%20${encodeURIComponent(bill.bill_number)}`;
      QRCode.toDataURL(upi, { width: 140, margin: 1, errorCorrectionLevel: 'M' })
        .then(setQrDataUrl)
        .catch(err => console.error('QR generation error', err));
    }
  }, [bill]);

  // 4️⃣ POS flow only: print automatically as soon as the invoice is ready.
  // History preview mode never auto-prints — the user decides.
  useEffect(() => {
    if (mode !== 'print' || customerName === null || printerName === null) return;
    const timer = setTimeout(() => {
      if (window.electronAPI?.printSilent) {
        window.electronAPI.printSilent({ printer: printerName, pageSize: paperSize.toUpperCase() })
          .then(res => console.log('Silent print result →', res))
          .catch(err => console.error('Silent print error →', err))
          .finally(() => onClose && onClose());
      } else {
        // Web POS fallback: use the browser print dialog.
        window.print();
        onClose && onClose();
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [mode, printerName, customerName, onClose, paperSize]);

  // 5️⃣ Preview flow: print on demand from the preview toolbar.
  const handleManualPrint = async () => {
    setPrintStatus({ type: 'info', message: t('sendingToPrinter') });
    try {
      if (window.electronAPI?.printSilent) {
        const result = await window.electronAPI.printSilent({
          printer: printerName || undefined,
          pageSize: paperSize.toUpperCase(),
        });
        if (result?.success) {
          setPrintStatus({ type: 'success', message: t('sentToPrinter') });
        } else {
          setPrintStatus({ type: 'error', message: result?.failureReason || t('printFailed') });
        }
      } else {
        setPrintStatus(null);
        window.print();
      }
    } catch (err) {
      console.error('Manual print error →', err);
      setPrintStatus({ type: 'error', message: err.message || t('printFailed') });
    }
  };

  // 6️⃣ Generate the exact printed invoice as a PDF and send it on WhatsApp.
  const buildWhatsAppCaption = () => {
    const template =
      settings?.whatsapp_message_template ||
      'KRS Plantain Merchant & Commission Agent\nBill {bill_number}\nAmount: {amount}\nPlease find the attached PDF bill.\nThank you!';

    return template
      .replace(/\{bill_number\}/g, bill.bill_number || '')
      .replace(/\{amount\}/g, `₹${Number(bill.grand_total || 0).toFixed(2)}`)
      .replace(/\{customer\}/g, customerName || t('customer'));
  };

  const handleSendWhatsApp = async () => {
    if (!window.electronAPI?.whatsapp || !window.electronAPI?.generateBillPdf) {
      setWaStatus({ type: 'error', message: t('waDesktopOnly') });
      return;
    }

    let phone = (bill.customer_phone || '').trim();
    if (!phone) {
      const entered = window.prompt(t('waNoPhone'), '');
      if (!entered || !entered.trim()) return;
      phone = entered.trim();
    }

    setWaStatus({ type: 'info', message: t('waSending') });
    try {
      const pdf = await window.electronAPI.generateBillPdf({ billNumber: bill.bill_number });
      if (!pdf?.success) {
        throw new Error(pdf?.error || t('printFailed'));
      }

      const result = await window.electronAPI.whatsapp.sendBill({
        phone,
        filePath: pdf.filePath,
        caption: buildWhatsAppCaption()
      });

      if (!result?.success) throw new Error(result?.error || t('waSettingsError'));
      setWaStatus({ type: 'success', message: t('waSent') });
    } catch (err) {
      console.error('WhatsApp send error →', err);
      setWaStatus({ type: 'error', message: err.message || t('waSettingsError') });
    }
  };

  if (!bill) return null;

  const formattedDateTime = bill.date
    ? new Date(bill.date).toLocaleString(lang === 'ml' ? 'ml-IN' : 'en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : new Date().toLocaleString();

  const renderReceipt = () => (
      <div
        id="printable-receipt"
        className={`print-area size-${paperSize} bg-white text-black border border-black shadow-xl ${paperSize === 'a5'
          ? 'w-[138mm] min-h-[195mm] max-h-[200mm] p-3.5 text-[9.5px]'
          : 'w-[196mm] min-h-[280mm] p-6 text-[11px]'} leading-tight rounded-sm`}
        style={{ fontFamily: "'Noto Sans Malayalam', sans-serif" }}
      >
        {/* Colourful Shop Header + Black Invoice Tag */}
        <div
          className="pt-2.5 pb-2.5 mb-2 border-b-2 border-black rounded-t-md px-2.5"
          style={{
            background: 'linear-gradient(135deg, #ecfdf5 0%, #fef9c3 100%)',
            borderTop: '3px solid #156b46',
            WebkitPrintColorAdjust: 'exact',
            printColorAdjust: 'exact',
          }}
        >
          <div className="flex items-center justify-center space-x-3">
            <img
              src={krsLogoPrint}
              alt="KRS Banana Tree Logo"
              className="w-9 h-10 object-contain shrink-0 rounded-md p-0.5 border border-amber-500 bg-amber-100"
              style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
            />
            <div className="text-center">
              <div className="h-1.5" aria-hidden="true" />
              <h1 className="text-sm sm:text-base font-black tracking-tight uppercase leading-snug pt-0.5" style={{ color: '#0e4f33' }}>
                {lang === 'ml' ? 'കെ.ആർ.എസ് പ്ലാന്റയിൻ മർച്ചന്റ് & കമ്മീഷൻ ഏജന്റ്' : 'KRS PLANTAIN MERCHANT & COMMISSION AGENT'}
              </h1>
              <p className="text-[10px] font-bold tracking-wide uppercase mt-1 leading-snug" style={{ color: '#b45309' }}>
                {lang === 'ml' ? 'വാഴപ്പഴ മൊത്തവ്യാപാരം & കമ്മീഷൻ ഏജന്റ്' : 'Wholesale Plantain Merchant & Commission Agent'}
              </p>
              <p className="text-[9px] font-semibold mt-1 leading-snug" style={{ color: '#065f46' }}>
                {lang === 'ml' ? (
                  <>വാഴിച്ചേരി മാർക്കറ്റ്, ആലപ്പുഴ - 688001 | <span className="font-bold" style={{ color: '#9a3412' }}>ഫോൺ: 9447304307</span></>
                ) : (
                  <>Vazhichery Market, Alappuzha - 688001 | <span className="font-bold" style={{ color: '#9a3412' }}>Ph: +91 94473 04307</span></>
                )}
              </p>
            </div>
          </div>
          <div className="text-center mt-2">
            <span className="border border-black bg-white text-black px-2.5 py-0.5 text-[8.5px] font-bold uppercase tracking-wider inline-block">
              {lang === 'ml' ? 'വാഴപ്പഴ വിൽപന ഇൻവോയ്സ്' : 'WHOLESALE BILL / INVOICE'}
            </span>
          </div>
        </div>
        {/* Bill Metadata & Customer Info */}
        <div className="grid grid-cols-2 gap-2 my-2 text-[9px] text-black border-b border-black pb-1.5">
          <div>
            <p><span className="font-bold">{t('billNo')}: </span><span className="font-mono font-bold text-xs text-black">{bill.bill_number}</span></p>
            <p><span className="font-bold">{t('invoiceDate')}: </span><span className="text-black">{formattedDateTime}</span></p>
          </div>
          <div className="text-right">
            <p><span className="font-bold">{t('customer')}: </span><span className="font-bold text-[10.5px] text-black">{customerName}</span></p>
            {bill.customer_phone && (
              <p><span className="font-bold">{t('phone')}: </span><span className="font-mono text-black">{bill.customer_phone}</span></p>
            )}
            {bill.permanent_shop_name && (
              <p><span className="font-bold">{t('shopName')}: </span><span className="text-black">{bill.permanent_shop_name}</span></p>
            )}
            {bill.permanent_address && (
              <p className="text-[8px] text-black">{bill.permanent_address}</p>
            )}
          </div>
        </div>
        {/* Line Items Table */}
        <table className="print-table w-full border-collapse border border-black my-1.5 text-[9px] text-black">
          <thead>
            <tr className="border-b-2 border-black bg-white text-black font-bold">
              <th className="border border-black px-1 py-1 text-center w-5">#</th>
              <th className="border border-black px-1.5 py-1 text-left">{t('variety')}</th>
              <th className="border border-black px-1 py-1 text-center w-9">{t('bunches')}</th>
              <th className="border border-black px-1 py-1 text-right w-13">{t('grossWeight')}</th>
              <th className="border border-black px-1 py-1 text-right w-13">{t('totalWaste')}</th>
              <th className="border border-black px-1 py-1 text-right w-13">{t('netWeight')}</th>
              <th className="border border-black px-1 py-1 text-right w-11">{t('ratePerKg')}</th>
              <th className="border border-black px-1.5 py-1 text-right w-15">{t('subtotal')}</th>
            </tr>
          </thead>
          <tbody>
            {bill.items && bill.items.map((item, index) => (
              <tr key={item.id || index} className="border-b border-black text-black">
                <td className="border border-black px-1 py-0.5 text-center font-mono">{index + 1}</td>
                <td className="border border-black px-1.5 py-0.5 font-bold">
                  {lang === 'ml'
                    ? `${item.name_ml || item.name_en}${item.name_en && item.name_ml ? ` (${item.name_en})` : ''}`
                    : `${item.name_en || item.name_ml}${item.name_ml && item.name_en ? ` (${item.name_ml})` : ''}`}
                  {item.waste_per_bunch_kg > 0 && (
                    <span className="block text-[7.5px] font-normal text-black">
                      ({item.waste_per_bunch_kg} {lang === 'ml' ? 'kg/കുല കിഴിവ്' : 'kg/bunch waste'})
                    </span>
                  )}
                </td>
                <td className="border border-black px-1 py-0.5 text-center font-mono font-bold">{item.bunch_quantity}</td>
                <td className="border border-black px-1 py-0.5 text-right font-mono">{Number(item.gross_weight_kg).toFixed(2)}</td>
                <td className="border border-black px-1 py-0.5 text-right font-mono">{Number(item.total_waste_kg).toFixed(2)}</td>
                <td className="border border-black px-1 py-0.5 text-right font-mono font-bold">{Number(item.net_weight_kg).toFixed(2)}</td>
                <td className="border border-black px-1 py-0.5 text-right font-mono">₹{Number(item.rate_per_kg).toFixed(2)}</td>
                <td className="border border-black px-1.5 py-0.5 text-right font-mono font-bold">₹{Number(item.subtotal).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-black font-bold bg-white text-black">
              <td colSpan={2} className="border border-black px-1.5 py-1 text-right font-black uppercase text-[9px]">
                {lang === 'ml' ? 'ആകെ തുക / Totals:' : 'Totals:'}
              </td>
              <td className="border border-black px-1 py-1 text-center font-mono font-bold">{bill.items?.reduce((s, it) => s + (it.bunch_quantity || 0), 0) || 0}</td>
              <td className="border border-black px-1 py-1 text-right font-mono">{Number(bill.total_gross_weight).toFixed(2)}</td>
              <td className="border border-black px-1 py-1 text-right font-mono">{Number(bill.total_waste_weight).toFixed(2)}</td>
              <td className="border border-black px-1 py-1 text-right font-mono font-bold">{Number(bill.total_net_weight).toFixed(2)}</td>
              <td className="border border-black px-1 py-1 text-center text-[7.5px] text-black">—</td>
              <td className="border border-black px-1.5 py-1 text-right font-mono font-black text-[11px]">₹{Number(bill.grand_total).toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
        {/* QR & Amount in Words */}
        <div className="grid grid-cols-12 gap-2 my-1.5 border border-black p-1.5 items-center text-black">
          <div className="col-span-5 flex items-center space-x-2 border-r border-black pr-1.5">
            {qrDataUrl ? (
              <div className="border border-black p-0.5 bg-white shrink-0">
                <img src={qrDataUrl} alt="UPI QR" className="w-18 h-18 sm:w-20 sm:h-20 object-contain block" />
              </div>
            ) : (
              <div className="w-18 h-18 border border-black flex items-center justify-center text-[7.5px]">Loading QR...</div>
            )}
            <div className="text-[7.5px] leading-tight">
              <p className="font-bold uppercase tracking-wider text-[8px]">{t('scanAndPay')}</p>
              <p className="font-bold mt-0.5">Amount: <span className="font-mono font-black text-[9px]">₹{Number(bill.grand_total).toFixed(2)}</span></p>
              <p className="font-mono text-[7px] mt-0.5 break-all">Vyapar.178760240373@hdfcbank</p>
              <p className="text-[6.5px] mt-0.5">{t('scanSupportedApps')}</p>
            </div>
          </div>
          <div className="col-span-7 pl-1 flex flex-col justify-between h-full">
            <div>
              <div className="text-[9px] leading-snug"><span className="font-bold">{t('amountInWords')}: </span><span className="italic font-medium">{numberToWords(bill.grand_total)}</span></div>
              <div className="text-[7.5px] italic mt-0.5">
                - {lang === 'ml' ? 'തണ്ട് കിഴിവ് കഴിച്ചുള്ള ശുദ്ധ തൂക്കത്തിനാണ് വില കണക്കാക്കിയിട്ടുള്ളത്.' : 'Billed only on net weight after deducting stem/stalk waste.'}
              </div>
            </div>
            <div className="mt-1 pt-1 border-t flex items-center justify-between">
              <span className="font-black uppercase text-[9.5px]">{lang === 'ml' ? 'അടയ്ക്കേണ്ട തുക:' : 'Net Payable:'}</span>
              <span className="font-mono font-black text-sm">₹{Number(bill.grand_total).toFixed(2)}</span>
            </div>
          </div>
        </div>
        {/* Footer */}
        <div className="border-t text-[8px] pt-1 mt-1">
          <div className="grid grid-cols-2 gap-2 mb-3 items-center">
            <div className="border border-black border-dashed p-1 rounded bg-white">
              <p className="font-black text-[9px] tracking-wide">{lang === 'ml' ? 'വാഴയിലകൾ ഓർഡർ അനുസരിച്ച് നൽകുന്നതാണ്' : 'Banana Leaves are sold based on order'}</p>
              <p className="text-[7.5px] font-semibold mt-0.5">{lang === 'ml' ? 'Banana Leaves are sold based on order' : 'വാഴയിലകൾ ഓർഡർ അനുസരിച്ച് നൽകുന്നതാണ്'}</p>
            </div>
            <div className="text-right flex flex-col justify-between">
              <p className="font-bold text-[8px]">{lang === 'ml' ? 'കെ.ആർ.എസ് പ്ലാന്റയിൻ മർച്ചന്റിന് വേണ്ടി' : 'For KRS PLANTAIN MERCHANT & COMMISSION AGENT'}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 pt-1.5 border-t-dotted text-center">
            <p className="font-semibold">{t('customerSignature')}</p>
            <p className="font-semibold text-right">{t('authorizedSignatory')}</p>
          </div>
          <div className="text-center mt-1 text-[7.5px] italic">{t('thankYou')}</div>
        </div>
      </div>
  );

  // History flow: show the invoice first, print only when asked.
  const activeStatus = waStatus || printStatus;

  if (mode === 'preview') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/70 backdrop-blur-sm invoice-modal-container">
        <div className="bg-white rounded-2xl shadow-2xl border border-emerald-200 w-full max-w-3xl max-h-[94vh] flex flex-col overflow-hidden invoice-modal-dialog">

          {/* Preview Toolbar */}
          <div className="no-print bg-gradient-to-r from-emerald-950 via-[#156b46] to-emerald-900 px-5 py-3.5 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <FileText className="w-5 h-5 text-emerald-200" />
              <div>
                <h3 className="font-bold text-base leading-tight">{t('invoicePreviewTitle')}</h3>
                <p className="text-[11px] text-emerald-100/90 font-mono mt-0.5">{bill.bill_number}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-all"
              title={t('closePreview')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Invoice Preview */}
          <div className="invoice-scroll-area flex-1 overflow-auto bg-slate-300/70 p-3 sm:p-5 flex justify-center">
            <div className="shrink-0 shadow-2xl">
              {renderReceipt()}
            </div>
          </div>

          {/* Preview Actions */}
          <div className="no-print bg-slate-50 border-t border-slate-200 px-4 sm:px-5 py-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
            <div className="text-[11px] font-medium min-h-[16px] max-w-md">
              {activeStatus ? (
                <span className={`inline-flex items-start gap-1.5 ${
                  activeStatus.type === 'success'
                    ? 'text-emerald-700'
                    : activeStatus.type === 'error'
                    ? 'text-red-600'
                    : 'text-slate-600'
                }`}>
                  {activeStatus.type === 'success' && <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
                  {activeStatus.type === 'error' && <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
                  {activeStatus.type === 'info' && <Loader2 className="w-3.5 h-3.5 shrink-0 mt-0.5 animate-spin" />}
                  <span>{activeStatus.message}</span>
                </span>
              ) : (
                <span className="text-slate-500">
                  {isElectron ? '' : t('browserPrintHint')}
                </span>
              )}
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-all"
              >
                {t('closePreview')}
              </button>
              <button
                type="button"
                onClick={handleSendWhatsApp}
                disabled={waStatus?.type === 'info'}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-60 text-white font-black text-xs rounded-xl shadow-md shadow-emerald-900/25 transition-all flex items-center justify-center gap-2"
              >
                {waStatus?.type === 'info' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <MessageCircle className="w-4 h-4" />
                )}
                <span>{t('waSend')}</span>
              </button>
              <button
                type="button"
                onClick={handleManualPrint}
                className="px-5 py-2.5 bg-[#156b46] hover:bg-[#125839] active:bg-[#0e482e] text-white font-black text-xs rounded-xl shadow-md shadow-emerald-900/25 transition-all flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" />
                <span>{t('printInvoiceNow')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // POS flow: keep the receipt off-screen and auto-print.
  return (
    <div
      ref={receiptRef}
      className="invoice-modal-container"
      style={{ position: 'absolute', left: '-9999px', top: 0 }}
    >
      {renderReceipt()}
    </div>
  );
}
