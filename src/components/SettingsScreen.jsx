import React, { useEffect, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import {
  Settings as SettingsIcon,
  MessageCircle,
  Save,
  RefreshCw,
  Link2,
  Unlink,
  AlertCircle,
  CheckCircle2,
  Loader2,
  QrCode,
  Wallet
} from 'lucide-react';

const DEFAULT_UPI_ID = 'Vyapar.178760240373@hdfcbank';

function Toggle({ checked, onChange, disabled, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={`relative w-12 h-7 shrink-0 rounded-full transition-colors ${
        checked ? 'bg-[#156b46]' : 'bg-slate-300'
      } disabled:opacity-50`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

const DEFAULT_MESSAGE =
  'KRS Plantain Merchant & Commission Agent\nBill {bill_number}\nAmount: {amount}\nPlease find the attached PDF bill.\nThank you!';

const phoneKey = (value) => String(value || '').replace(/\D/g, '');

const STATUS_COLORS = {
  idle: 'bg-slate-100 text-slate-700 border-slate-300',
  initializing: 'bg-blue-50 text-blue-700 border-blue-200',
  qr: 'bg-amber-50 text-amber-800 border-amber-300',
  authenticated: 'bg-blue-50 text-blue-700 border-blue-200',
  ready: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  auth_failure: 'bg-red-50 text-red-700 border-red-200',
  disconnected: 'bg-slate-100 text-slate-700 border-slate-300',
  error: 'bg-red-50 text-red-700 border-red-200'
};

const STATUS_LABEL_KEYS = {
  idle: 'waStatusIdle',
  initializing: 'waStatusInitializing',
  qr: 'waStatusQr',
  authenticated: 'waStatusAuthenticated',
  ready: 'waStatusReady',
  auth_failure: 'waStatusAuthFailure',
  disconnected: 'waStatusDisconnected',
  error: 'waStatusError'
};

export default function SettingsScreen({ settings, onSettingsSaved }) {
  const { t } = useLanguage();
  const isElectron = typeof window !== 'undefined' && !!window.electronAPI?.whatsapp;

  const [ownerNumber, setOwnerNumber] = useState(settings?.whatsapp_owner_number || '');
  const [savedOwnerNumber, setSavedOwnerNumber] = useState(settings?.whatsapp_owner_number || '');
  const [messageTemplate, setMessageTemplate] = useState(
    settings?.whatsapp_message_template || DEFAULT_MESSAGE
  );
  const [upiId, setUpiId] = useState(settings?.upi_id || DEFAULT_UPI_ID);
  const [whatsappEnabled, setWhatsappEnabled] = useState(settings?.whatsapp_enabled !== 'false');
  const [qrEnabled, setQrEnabled] = useState(settings?.qr_enabled !== 'false');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setOwnerNumber(settings?.whatsapp_owner_number || '');
    setSavedOwnerNumber(settings?.whatsapp_owner_number || '');
    setMessageTemplate(settings?.whatsapp_message_template || DEFAULT_MESSAGE);
    setUpiId(settings?.upi_id || DEFAULT_UPI_ID);
    setWhatsappEnabled(settings?.whatsapp_enabled !== 'false');
    setQrEnabled(settings?.qr_enabled !== 'false');
  }, [settings]);

  useEffect(() => {
    if (!isElectron) return undefined;

    let mounted = true;
    const unsubscribe = window.electronAPI.whatsapp.onStatus((next) => {
      if (mounted) setStatus(next);
    });
    window.electronAPI.whatsapp
      .getStatus()
      .then((next) => {
        if (mounted) setStatus(next);
      })
      .catch((err) => {
        if (mounted) setStatus({ status: 'error', error: err.message });
      });

    return () => {
      mounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [isElectron]);

  const refreshStatus = async () => {
    if (!isElectron) return;
    try {
      setStatus(await window.electronAPI.whatsapp.getStatus());
    } catch (err) {
      setStatus({ status: 'error', error: err.message });
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          whatsapp_owner_number: ownerNumber.trim(),
          whatsapp_message_template: messageTemplate,
          upi_id: upiId.trim(),
          whatsapp_enabled: whatsappEnabled,
          qr_enabled: qrEnabled
        })
      });
      if (!res.ok) throw new Error('Failed to save settings');
      const updated = await res.json();
      if (onSettingsSaved) onSettingsSaved(updated);

      const ownerChanged = phoneKey(savedOwnerNumber) !== phoneKey(updated.whatsapp_owner_number);
      setSavedOwnerNumber(updated.whatsapp_owner_number || '');
      setNotice({ type: 'success', message: t('waSettingsSaved') });

      if (ownerChanged && isElectron) {
        const wa = window.electronAPI.whatsapp;
        if (wa.resetSession) {
          const next = await wa.resetSession();
          if (next) setStatus(next);
        } else {
          await wa.disconnect();
          if (phoneKey(updated.whatsapp_owner_number)) await wa.connect();
        }
        setNotice({
          type: 'success',
          message: phoneKey(updated.whatsapp_owner_number)
            ? t('waOwnerChangedScanQr')
            : t('waOwnerCleared')
        });
      }

      await refreshStatus();
    } catch (err) {
      setNotice({ type: 'error', message: err.message || t('waSettingsError') });
    } finally {
      setSaving(false);
    }
  };

  const handleConnect = async () => {
    setBusy(true);
    try {
      setStatus(await window.electronAPI.whatsapp.connect());
    } catch (err) {
      setStatus({ status: 'error', error: err.message });
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    try {
      setStatus(await window.electronAPI.whatsapp.disconnect());
    } catch (err) {
      setStatus({ status: 'error', error: err.message });
    } finally {
      setBusy(false);
    }
  };

  const statusLabel = t(STATUS_LABEL_KEYS[status?.status] || 'waStatusIdle');
  const badgeClass = status ? STATUS_COLORS[status.status] || STATUS_COLORS.idle : STATUS_COLORS.idle;

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-white via-white to-emerald-50/50 rounded-2xl p-5 shadow-sm shadow-emerald-900/5 border border-slate-200/80 flex items-center space-x-4">
        <div className="p-3 bg-gradient-to-br from-[#156b46] to-[#0e4f33] rounded-2xl text-white shadow-lg shadow-emerald-900/20">
          <SettingsIcon className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900">{t('settingsTitle')}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{t('settingsSubtitle')}</p>
        </div>
      </div>

      {/* Billing Options */}
      <div className="bg-white rounded-2xl shadow-md shadow-emerald-900/5 border border-slate-200/80 p-6">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
            <Wallet className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">{t('billingOptionsTitle')}</h3>
            <p className="text-[11px] text-slate-500">{t('billingOptionsSubtitle')}</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">
              {t('upiIdLabel')}
            </label>
            <input
              type="text"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder={DEFAULT_UPI_ID}
              className="w-full px-4 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 outline-none focus:bg-white focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 transition-all placeholder:text-slate-400"
            />
            <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">{t('upiIdHint')}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3.5 py-3">
              <div className="flex items-center gap-2.5">
                <QrCode className="w-4 h-4 text-emerald-700 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-slate-800">{t('qrEnabledLabel')}</p>
                  <p className="text-[10px] text-slate-500 leading-snug">{t('qrEnabledHint')}</p>
                </div>
              </div>
              <Toggle checked={qrEnabled} onChange={setQrEnabled} disabled={saving} label={t('qrEnabledLabel')} />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3.5 py-3">
              <div className="flex items-center gap-2.5">
                <MessageCircle className="w-4 h-4 text-emerald-700 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-slate-800">{t('whatsappEnabledLabel')}</p>
                  <p className="text-[10px] text-slate-500 leading-snug">{t('whatsappEnabledHint')}</p>
                </div>
              </div>
              <Toggle checked={whatsappEnabled} onChange={setWhatsappEnabled} disabled={saving} label={t('whatsappEnabledLabel')} />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-gradient-to-r from-[#156b46] to-[#0e4f33] hover:from-[#0e4f33] hover:to-[#0a3d28] disabled:opacity-60 text-white text-sm font-bold rounded-xl shadow-lg shadow-emerald-900/20 transition-all flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {t('waSaveSettings')}
            </button>
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Sender Configuration */}
        <div className="bg-white rounded-2xl shadow-md shadow-emerald-900/5 border border-slate-200/80 p-6">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
              <MessageCircle className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">{t('waOwnerNumber')}</h3>
          </div>

          {notice && (
            <div
              className={`mb-4 flex items-center gap-2.5 text-sm p-3 rounded-xl border shadow-sm ${
                notice.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}
            >
              {notice.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{notice.message}</span>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">
                {t('waOwnerNumber')}
              </label>
              <input
                type="tel"
                value={ownerNumber}
                onChange={(e) => setOwnerNumber(e.target.value)}
                placeholder="+91 94473 04307"
                className="w-full px-4 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 outline-none focus:bg-white focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 transition-all placeholder:text-slate-400"
              />
              <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">{t('waOwnerHint')}</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-600">
                  {t('waMessageTemplate')}
                </label>
                <button
                  type="button"
                  onClick={() => setMessageTemplate(DEFAULT_MESSAGE)}
                  className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 hover:underline"
                >
                  {t('waMessageReset')}
                </button>
              </div>
              <textarea
                rows={5}
                value={messageTemplate}
                onChange={(e) => setMessageTemplate(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 outline-none focus:bg-white focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 transition-all resize-y leading-relaxed"
              />
              <p className="text-[11px] text-slate-500 mt-1.5">{t('waMessageHint')}</p>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-gradient-to-r from-[#156b46] to-[#0e4f33] hover:from-[#0e4f33] hover:to-[#0a3d28] disabled:opacity-60 text-white text-sm font-bold rounded-xl shadow-lg shadow-emerald-900/20 transition-all flex items-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {t('waSaveSettings')}
              </button>
            </div>
          </form>
        </div>

        {/* Connection Card */}
        <div className="bg-white rounded-2xl shadow-md shadow-emerald-900/5 border border-slate-200/80 p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                <Link2 className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">{t('waConnection')}</h3>
            </div>
            <button
              type="button"
              onClick={refreshStatus}
              disabled={!isElectron}
              className="p-2 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg disabled:opacity-40 transition-all"
              title={t('waRefreshStatus')}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {!isElectron ? (
            <div className="flex items-start gap-2.5 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-4">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{t('waDesktopOnly')}</span>
            </div>
          ) : (
            <>
              <div className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-full border shadow-sm text-sm font-bold ${badgeClass}`}>
                {status?.status === 'ready' ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : status?.status === 'initializing' || status?.status === 'authenticated' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <MessageCircle className="w-4 h-4" />
                )}
                {statusLabel}
              </div>

              {status?.number && (
                <p className="text-sm text-slate-600 mt-4">
                  <span className="font-bold">{t('waConnectedAs')}: </span>
                  <span className="font-mono">+{status.number}</span>
                </p>
              )}

              {status?.error && (
                <div className="mt-4 flex items-start gap-2.5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="break-words">{status.error}</span>
                </div>
              )}

              {status?.configured && status?.connected && !status.match && (
                <div className="mt-4 flex items-start gap-2.5 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{t('waOwnerMismatch')}</span>
                </div>
              )}

              {status?.status === 'ready' && status.match && (
                <div className="mt-4 flex items-start gap-2.5 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{t('waOwnerMatch')}</span>
                </div>
              )}

              {status?.qr && (
                <div className="mt-5 flex flex-col items-center">
                  <div className="p-3 bg-white border border-slate-200 rounded-2xl shadow-lg ring-4 ring-emerald-50">
                    <img src={status.qr} alt="WhatsApp login QR code" className="w-44 h-44 rounded-lg" />
                  </div>
                  <p className="text-xs text-slate-600 mt-3 text-center leading-relaxed max-w-xs">
                    {t('waScanInstructions')}
                  </p>
                </div>
              )}

              <div className="mt-6 flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={handleConnect}
                  disabled={busy || status?.status === 'ready' || status?.status === 'initializing'}
                  className="px-5 py-2.5 bg-gradient-to-r from-[#156b46] to-[#0e4f33] hover:from-[#0e4f33] hover:to-[#0a3d28] disabled:opacity-50 text-white text-sm font-bold rounded-xl shadow-lg shadow-emerald-900/20 flex items-center gap-2 transition-all"
                >
                  <Link2 className="w-4 h-4" />
                  {t('waConnect')}
                </button>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={busy || !status || status.status === 'idle'}
                  className="px-5 py-2.5 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 text-sm font-bold rounded-xl border border-slate-200 shadow-sm flex items-center gap-2 transition-all"
                >
                  <Unlink className="w-4 h-4" />
                  {t('waDisconnect')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
