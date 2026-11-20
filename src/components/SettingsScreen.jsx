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
  Loader2
} from 'lucide-react';

const DEFAULT_MESSAGE =
  'KRS Plantain Merchant & Commission Agent\nBill {bill_number}\nAmount: {amount}\nPlease find the attached PDF bill.\nThank you!';

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
  const [messageTemplate, setMessageTemplate] = useState(
    settings?.whatsapp_message_template || DEFAULT_MESSAGE
  );
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setOwnerNumber(settings?.whatsapp_owner_number || '');
    setMessageTemplate(settings?.whatsapp_message_template || DEFAULT_MESSAGE);
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
          whatsapp_message_template: messageTemplate
        })
      });
      if (!res.ok) throw new Error('Failed to save settings');
      const updated = await res.json();
      if (onSettingsSaved) onSettingsSaved(updated);
      setNotice({ type: 'success', message: t('waSettingsSaved') });
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
    <div className="space-y-4">
      {/* Page Header */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex items-center space-x-3">
        <div className="p-2.5 bg-emerald-100 rounded-xl text-emerald-800">
          <SettingsIcon className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-900">{t('settingsTitle')}</h2>
          <p className="text-xs text-slate-500">{t('settingsSubtitle')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Sender Configuration */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <MessageCircle className="w-4 h-4 text-emerald-700" />
            <h3 className="text-sm font-bold text-slate-900">{t('waOwnerNumber')}</h3>
          </div>

          {notice && (
            <div
              className={`mb-3 flex items-center gap-2 text-xs p-2.5 rounded-lg border ${
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

          <form onSubmit={handleSave} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {t('waOwnerNumber')}
              </label>
              <input
                type="tel"
                value={ownerNumber}
                onChange={(e) => setOwnerNumber(e.target.value)}
                placeholder="+91 94473 04307"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:bg-white"
              />
              <p className="text-[10px] text-slate-500 mt-1 leading-snug">{t('waOwnerHint')}</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">
                  {t('waMessageTemplate')}
                </label>
                <button
                  type="button"
                  onClick={() => setMessageTemplate(DEFAULT_MESSAGE)}
                  className="text-[10px] text-emerald-700 hover:underline"
                >
                  {t('waMessageReset')}
                </button>
              </div>
              <textarea
                rows={5}
                value={messageTemplate}
                onChange={(e) => setMessageTemplate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:bg-white resize-y"
              />
              <p className="text-[10px] text-slate-500 mt-1">{t('waMessageHint')}</p>
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-[#156b46] hover:bg-[#125839] disabled:opacity-60 text-white text-xs font-bold rounded-xl shadow transition-all flex items-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {t('waSaveSettings')}
              </button>
            </div>
          </form>
        </div>

        {/* Connection Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-emerald-700" />
              <h3 className="text-sm font-bold text-slate-900">{t('waConnection')}</h3>
            </div>
            <button
              type="button"
              onClick={refreshStatus}
              disabled={!isElectron}
              className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg disabled:opacity-40"
              title={t('waRefreshStatus')}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {!isElectron ? (
            <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{t('waDesktopOnly')}</span>
            </div>
          ) : (
            <>
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold ${badgeClass}`}>
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
                <p className="text-xs text-slate-600 mt-3">
                  <span className="font-bold">{t('waConnectedAs')}: </span>
                  <span className="font-mono">+{status.number}</span>
                </p>
              )}

              {status?.error && (
                <div className="mt-3 flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="break-words">{status.error}</span>
                </div>
              )}

              {status?.configured && status?.connected && !status.match && (
                <div className="mt-3 flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{t('waOwnerMismatch')}</span>
                </div>
              )}

              {status?.status === 'ready' && status.match && (
                <div className="mt-3 flex items-start gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{t('waOwnerMatch')}</span>
                </div>
              )}

              {status?.qr && (
                <div className="mt-4 flex flex-col items-center">
                  <div className="p-2 bg-white border border-slate-300 rounded-xl shadow-sm">
                    <img src={status.qr} alt="WhatsApp login QR code" className="w-44 h-44" />
                  </div>
                  <p className="text-[11px] text-slate-600 mt-2 text-center leading-snug">
                    {t('waScanInstructions')}
                  </p>
                </div>
              )}

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleConnect}
                  disabled={busy || status?.status === 'ready' || status?.status === 'initializing'}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all"
                >
                  <Link2 className="w-4 h-4" />
                  {t('waConnect')}
                </button>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={busy || !status || status.status === 'idle'}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-2 transition-all"
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
