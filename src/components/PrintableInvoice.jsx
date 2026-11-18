import React, { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { Printer, X, FileText } from 'lucide-react';
import QRCode from 'qrcode';
import krsLogoPrint from '../assets/krs_banana_tree_print.png';

// Number to Words converter (Indian numbering system)
function numberToWords(amount) {
  const num = Math.round(amount);
  if (num === 0) return 'Zero Rupees Only';

  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
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

export default function PrintableInvoice({ bill, onClose }) {
  const { lang, t } = useLanguage();
  const [paperSize, setPaperSize] = useState('a5'); // 'a5' (A4 Half Size - 148x210mm) default, or 'a4'
  const [qrDataUrl, setQrDataUrl] = useState('');

  // Generate Dynamic UPI QR Code with exact bill amount
  useEffect(() => {
    if (bill && bill.grand_total != null) {
      const formattedAmount = Number(bill.grand_total).toFixed(2);
      // Construct official NPCI UPI Intent URI using the shop's HDFC Vyapar details
      const upiUri = `upi://pay?pa=Vyapar.178760240373@hdfcbank&pn=KRS%20Plantain%20Merchant&mc=8999&am=${formattedAmount}&cu=INR&tn=Invoice%20${encodeURIComponent(bill.bill_number)}`;

      QRCode.toDataURL(upiUri, {
        width: 140,
        margin: 1,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('Failed to generate UPI QR Code:', err));
    }
  }, [bill]);

  if (!bill) return null;

  const handlePrint = () => {
    window.print();
  };

  const formattedDateTime = bill.date
    ? new Date(bill.date).toLocaleString(lang === 'ml' ? 'ml-IN' : 'en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : new Date().toLocaleString();

  return (
    <div className="invoice-modal-container fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      
      {/* Container with Print Preview Controls on Screen */}
      <div className="invoice-modal-dialog bg-white rounded-2xl shadow-2xl border border-slate-300 w-full max-w-4xl max-h-[96vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* On-Screen Action Header (Hidden during actual print) */}
        <div className="no-print bg-slate-800 text-white px-4 sm:px-6 py-3 flex items-center justify-between border-b border-slate-700 flex-wrap gap-2.5">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-emerald-500/20 rounded-lg border border-emerald-400/30">
              <FileText className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <span className="font-bold text-sm tracking-wide block">
                {t('printInvoice')} — <span className="font-mono text-emerald-300">{bill.bill_number}</span>
              </span>
              <span className="text-[11px] text-slate-400">
                Canon PIXMA G3000 Series (Draft Ink-Saver B&W)
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2.5 flex-wrap">
            {/* Paper Size Selector (A4 Half Size default vs Full A4) */}
            <div className="flex items-center bg-slate-900 rounded-xl p-1 border border-slate-700 text-xs">
              <span className="text-slate-400 px-2 font-medium hidden sm:inline">{t('paperSize')}:</span>
              <button
                type="button"
                onClick={() => setPaperSize('a5')}
                className={`px-3 py-1 rounded-lg font-bold transition-all ${
                  paperSize === 'a5'
                    ? 'bg-[#156b46] text-white shadow'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {lang === 'ml' ? 'A4 ഹാഫ് സൈസ് (A5)' : 'A4 Half Size (A5)'}
              </button>
              <button
                type="button"
                onClick={() => setPaperSize('a4')}
                className={`px-3 py-1 rounded-lg font-bold transition-all ${
                  paperSize === 'a4'
                    ? 'bg-[#156b46] text-white shadow'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {lang === 'ml' ? 'ഫുൾ A4' : 'Full A4'}
              </button>
            </div>

            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-[#156b46] hover:bg-[#125839] active:bg-[#0e482e] text-white text-xs font-black rounded-xl shadow-md flex items-center gap-1.5 transition-all"
            >
              <Printer className="w-4 h-4" />
              <span>{t('printNow')}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-xl transition-all"
              title="Close Preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Invoice Body */}
        <div className="invoice-scroll-area overflow-y-auto p-4 sm:p-6 bg-slate-200/60 flex justify-center items-start">
          
          <div 
            id="printable-receipt"
            className={`print-area size-${paperSize} bg-white text-black border border-slate-400 shadow-xl ${
              paperSize === 'a5' 
                ? 'w-[138mm] min-h-[195mm] max-h-[200mm] p-3.5 text-[9.5px]' 
                : 'w-[196mm] min-h-[280mm] p-6 text-[11px]'
            } leading-tight rounded-sm`}
            style={{ fontFamily: "'Noto Sans Malayalam', sans-serif" }}
          >
            
            {/* Header: Shop Name, Banana Tree Stamp Logo & Contact Details */}
            <div className="pb-2 border-b-2 border-black">
              <div className="flex items-center justify-center space-x-3">
                <img 
                  src={krsLogoPrint} 
                  alt="KRS Banana Tree Logo" 
                  className="w-8 h-10 object-contain shrink-0" 
                />
                <div className="text-center">
                  <h1 className="text-sm sm:text-base font-black tracking-tight uppercase leading-tight">
                    {lang === 'ml' 
                      ? 'കെ.ആർ.എസ് പ്ലാന്റയിൻ മർച്ചന്റ് & കമ്മീഷൻ ഏജന്റ്' 
                      : 'KRS PLANTAIN MERCHANT & COMMISSION AGENT'}
                  </h1>
                  <p className="text-[10px] font-bold tracking-wide uppercase mt-0.5">
                    {lang === 'ml' ? 'വാഴപ്പഴ മൊത്തവ്യാപാരം & കമ്മീഷൻ ഏജന്റ്' : 'Wholesale Plantain Merchant & Commission Agent'}
                  </p>
                  <p className="text-[9px] font-semibold mt-0.5 text-slate-900">
                    {lang === 'ml' 
                      ? 'വാഴിച്ചേരി മാർക്കറ്റ്, ആലപ്പുഴ - 688001 | ഫോൺ: 9447304307' 
                      : 'Vazhichery Market, Alappuzha - 688001 | Ph: +91 94473 04307'}
                  </p>
                </div>
              </div>

              <div className="text-center mt-1">
                <span className="border border-black px-2.5 py-0.5 text-[8.5px] font-bold uppercase tracking-wider">
                  {lang === 'ml' ? 'വാഴപ്പഴ വിൽപന ഇൻവോയ്സ്' : 'WHOLESALE BILL / INVOICE'}
                </span>
              </div>
            </div>

            {/* Bill Metadata & Customer Info */}
            <div className="grid grid-cols-2 gap-2 my-2 text-[9px] border-b border-black pb-1.5">
              <div>
                <p>
                  <span className="font-bold">{t('billNo')}: </span>
                  <span className="font-mono font-bold text-xs">{bill.bill_number}</span>
                </p>
                <p>
                  <span className="font-bold">{t('invoiceDate')}: </span>
                  <span>{formattedDateTime}</span>
                </p>
              </div>

              <div className="text-right">
                <p>
                  <span className="font-bold">{t('customer')}: </span>
                  <span className="font-bold text-[10.5px]">{bill.customer_display_name || t('walkInCustomer')}</span>
                </p>
                {bill.customer_phone && (
                  <p>
                    <span className="font-bold">{t('phone')}: </span>
                    <span className="font-mono">{bill.customer_phone}</span>
                  </p>
                )}
                {bill.permanent_shop_name && (
                  <p>
                    <span className="font-bold">{t('shopName')}: </span>
                    <span>{bill.permanent_shop_name}</span>
                  </p>
                )}
                {bill.permanent_address && (
                  <p className="text-[8px] text-slate-700">
                    {bill.permanent_address}
                  </p>
                )}
              </div>
            </div>

            {/* Line Items Table (A4 half-size with sharp thin borders) */}
            <table className="print-table w-full border-collapse border border-black my-1.5 text-[9px]">
              <thead>
                <tr className="border-b-2 border-black bg-slate-100 font-bold">
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
                  <tr key={item.id || index} className="border-b border-black/70">
                    <td className="border border-black px-1 py-0.5 text-center font-mono">{index + 1}</td>
                    <td className="border border-black px-1.5 py-0.5 font-bold">
                      {lang === 'ml' 
                        ? `${item.name_ml || item.name_en}${item.name_en && item.name_ml ? ` (${item.name_en})` : ''}`
                        : `${item.name_en || item.name_ml}${item.name_ml && item.name_en ? ` (${item.name_ml})` : ''}`
                      }
                      {item.waste_per_bunch_kg > 0 && (
                        <span className="block text-[7.5px] font-normal text-slate-600">
                          ({item.waste_per_bunch_kg} {lang === 'ml' ? 'kg/കുല കിഴിവ്' : 'kg/bunch waste'})
                        </span>
                      )}
                    </td>
                    <td className="border border-black px-1 py-0.5 text-center font-mono font-bold">
                      {item.bunch_quantity}
                    </td>
                    <td className="border border-black px-1 py-0.5 text-right font-mono">
                      {Number(item.gross_weight_kg).toFixed(2)}
                    </td>
                    <td className="border border-black px-1 py-0.5 text-right font-mono text-slate-700">
                      {Number(item.total_waste_kg).toFixed(2)}
                    </td>
                    <td className="border border-black px-1 py-0.5 text-right font-mono font-bold">
                      {Number(item.net_weight_kg).toFixed(2)}
                    </td>
                    <td className="border border-black px-1 py-0.5 text-right font-mono">
                      ₹{Number(item.rate_per_kg).toFixed(2)}
                    </td>
                    <td className="border border-black px-1.5 py-0.5 text-right font-mono font-bold">
                      ₹{Number(item.subtotal).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {/* Total Summary Row */}
                <tr className="border-t-2 border-black font-bold bg-slate-50">
                  <td colSpan={2} className="border border-black px-1.5 py-1 text-right font-black uppercase text-[9px]">
                    {lang === 'ml' ? 'ആകെ തുക / Totals:' : 'Totals:'}
                  </td>
                  <td className="border border-black px-1 py-1 text-center font-mono font-bold">
                    {bill.items?.reduce((sum, it) => sum + (it.bunch_quantity || 0), 0) || 0}
                  </td>
                  <td className="border border-black px-1 py-1 text-right font-mono">
                    {Number(bill.total_gross_weight).toFixed(2)}
                  </td>
                  <td className="border border-black px-1 py-1 text-right font-mono">
                    {Number(bill.total_waste_weight).toFixed(2)}
                  </td>
                  <td className="border border-black px-1 py-1 text-right font-mono font-bold">
                    {Number(bill.total_net_weight).toFixed(2)}
                  </td>
                  <td className="border border-black px-1 py-1 text-center text-[7.5px] text-slate-500">
                    —
                  </td>
                  <td className="border border-black px-1.5 py-1 text-right font-mono font-black text-[11px]">
                    ₹{Number(bill.grand_total).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>

            {/* Split Section: QR Code (Left) & Grand Total / Words (Right) */}
            <div className="grid grid-cols-12 gap-2 my-1.5 border border-black p-1.5 items-center">
              
              {/* Dynamic Payment QR Code Box */}
              <div className="col-span-5 flex items-center space-x-2 border-r border-black pr-1.5">
                {qrDataUrl ? (
                  <div className="border border-black p-0.5 bg-white shrink-0">
                    <img 
                      src={qrDataUrl} 
                      alt="UPI Payment QR Code" 
                      className="w-18 h-18 sm:w-20 sm:h-20 object-contain block" 
                    />
                  </div>
                ) : (
                  <div className="w-18 h-18 border border-black flex items-center justify-center text-[7.5px] text-slate-400">
                    Loading QR...
                  </div>
                )}
                
                <div className="text-[7.5px] leading-tight">
                  <p className="font-bold uppercase tracking-wider text-[8px] text-black">
                    {t('scanAndPay')}
                  </p>
                  <p className="font-bold text-slate-900 mt-0.5">
                    Amount: <span className="font-mono font-black text-[9px]">₹{Number(bill.grand_total).toFixed(2)}</span>
                  </p>
                  <p className="font-mono text-[7px] text-slate-700 mt-0.5 break-all">
                    Vyapar.178760240373@hdfcbank
                  </p>
                  <p className="text-[6.5px] text-slate-600 mt-0.5">
                    {t('scanSupportedApps')}
                  </p>
                </div>
              </div>

              {/* Amount In Words & Summary */}
              <div className="col-span-7 pl-1 flex flex-col justify-between h-full">
                <div>
                  <div className="text-[9px] leading-snug">
                    <span className="font-bold">{t('amountInWords')}: </span>
                    <span className="italic font-medium">{numberToWords(bill.grand_total)}</span>
                  </div>
                  <div className="text-[7.5px] text-slate-600 italic mt-0.5">
                    * {lang === 'ml' 
                      ? 'തണ്ട് കിഴിവ് കഴിച്ചുള്ള ശുദ്ധ തൂക്കത്തിനാണ് വില കണക്കാക്കിയിട്ടുള്ളത്.' 
                      : 'Billed only on net weight after deducting stem/stalk waste.'}
                  </div>
                </div>

                <div className="mt-1 pt-1 border-t border-dotted border-black flex items-center justify-between">
                  <span className="font-black uppercase text-[9.5px]">
                    {lang === 'ml' ? 'അടയ്ക്കേണ്ട തുക:' : 'Net Payable:'}
                  </span>
                  <span className="font-mono font-black text-sm">
                    ₹{Number(bill.grand_total).toFixed(2)}
                  </span>
                </div>
              </div>

            </div>

            {/* Notice & Signatures */}
            <div className="border-t border-black pt-1 mt-1 text-[8px]">
              <div className="grid grid-cols-2 gap-2 mb-3 items-center">
                
                {/* Banana Leaves Sold Based on Order Notice */}
                <div className="border border-black border-dashed p-1 rounded bg-slate-50">
                  <p className="font-black text-[9px] text-black tracking-wide">
                    🍃 {lang === 'ml' ? 'വാഴയിലകൾ ഓർഡർ അനുസരിച്ച് നൽകുന്നതാണ്' : 'Banana Leaves are sold based on order'}
                  </p>
                  <p className="text-[7.5px] text-slate-700 font-semibold mt-0.5">
                    {lang === 'ml' ? 'Banana Leaves are sold based on order' : 'വാഴയിലകൾ ഓർഡർ അനുസരിച്ച് നൽകുന്നതാണ്'}
                  </p>
                </div>

                <div className="text-right flex flex-col justify-between">
                  <p className="font-bold text-[8px]">
                    {lang === 'ml' 
                      ? 'കെ.ആർ.എസ് പ്ലാന്റയിൻ മർച്ചന്റിന് വേണ്ടി' 
                      : 'For KRS PLANTAIN MERCHANT & COMMISSION AGENT'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-1.5 border-t border-dotted border-black/70">
                <div className="text-left">
                  <p className="font-semibold text-slate-800">{t('customerSignature')}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-800">{t('authorizedSignatory')}</p>
                </div>
              </div>

              <div className="text-center mt-1 text-[7.5px] text-slate-600 italic">
                {t('thankYou')}
              </div>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
