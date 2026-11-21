import React, { useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { Layers, Plus, Edit2, Trash2, Check, X, AlertCircle } from 'lucide-react';

export default function VarietiesScreen({ bananaTypes, onRefreshVarieties }) {
  const { lang, t } = useLanguage();
  const [editingId, setEditingId] = useState(null);
  const [editRate, setEditRate] = useState('');
  const [editWaste, setEditWaste] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newNameEn, setNewNameEn] = useState('');
  const [newNameMl, setNewNameMl] = useState('');
  const [newRate, setNewRate] = useState('');
  const [newWaste, setNewWaste] = useState('0.50');
  const [error, setError] = useState('');

  const startEdit = (v) => {
    setEditingId(v.id);
    setEditRate(v.default_rate_per_kg);
    setEditWaste(v.default_stem_waste_per_bunch_kg);
    setError('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditRate('');
    setEditWaste('');
  };

  const saveEdit = async (v) => {
    try {
      const res = await fetch(`/api/banana-types/${v.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name_en: v.name_en,
          name_ml: v.name_ml,
          default_rate_per_kg: parseFloat(editRate) || 0,
          default_stem_waste_per_bunch_kg: parseFloat(editWaste) || 0,
        }),
      });

      if (!res.ok) throw new Error('Failed to update variety');
      setEditingId(null);
      if (onRefreshVarieties) onRefreshVarieties();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddVariety = async (e) => {
    e.preventDefault();
    if (!newNameEn.trim() || !newNameMl.trim()) {
      setError('Please provide both English and Malayalam names.');
      return;
    }

    try {
      const res = await fetch('/api/banana-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name_en: newNameEn.trim(),
          name_ml: newNameMl.trim(),
          default_rate_per_kg: parseFloat(newRate) || 0,
          default_stem_waste_per_bunch_kg: parseFloat(newWaste) || 0.5,
        }),
      });

      if (!res.ok) throw new Error('Failed to create variety');

      setNewNameEn('');
      setNewNameMl('');
      setNewRate('');
      setNewWaste('0.50');
      setIsAddOpen(false);
      setError('');
      if (onRefreshVarieties) onRefreshVarieties();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('deleteConfirm'))) return;

    try {
      const res = await fetch(`/api/banana-types/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete variety');
      }
      if (onRefreshVarieties) onRefreshVarieties();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-5">

      {/* Top Bar */}
      <div className="bg-white rounded-2xl p-5 shadow-sm shadow-slate-200/60 ring-1 ring-slate-900/5 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-gradient-to-br from-emerald-50 to-emerald-100 ring-1 ring-emerald-200/70 rounded-2xl text-emerald-800 shadow-sm shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">{t('varietiesTitle')}</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Configure standard default market prices and stem/stalk deductions per bunch.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsAddOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#156b46] to-emerald-800 hover:from-[#0e4f33] hover:to-emerald-900 text-white font-semibold text-sm rounded-xl shadow-md shadow-emerald-900/20 transition-all duration-200 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{t('addVariety')}</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-3.5 rounded-xl text-sm flex items-center gap-2.5 shadow-sm animate-in fade-in duration-150">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* Varieties Table */}
      <div className="bg-white rounded-2xl shadow-sm shadow-slate-200/60 ring-1 ring-slate-900/5 border border-slate-200/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 border-b border-slate-200">
                <th className="py-3.5 px-4 w-12 text-center">#</th>
                <th className="py-3.5 px-4">{lang === 'ml' ? t('varietyNameMl') : t('varietyNameEn')}</th>
                <th className="py-3.5 px-4">{lang === 'ml' ? t('varietyNameEn') : t('varietyNameMl')}</th>
                <th className="py-3.5 px-4 text-right">{t('defaultRate')}</th>
                <th className="py-3.5 px-4 text-right">{t('defaultStemWaste')}</th>
                <th className="py-3.5 px-4 text-center w-28">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bananaTypes.map((v, idx) => {
                const isEditing = editingId === v.id;

                return (
                  <tr key={v.id} className="hover:bg-emerald-50/40 transition-colors">
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 text-slate-500 text-xs font-bold tabular-nums">
                        {idx + 1}
                      </span>
                    </td>

                    {/* Primary Name */}
                    <td className="py-3.5 px-4 font-bold text-sm text-slate-900 font-malayalam">
                      {lang === 'ml' ? v.name_ml : v.name_en}
                    </td>

                    {/* Secondary Name */}
                    <td className="py-3.5 px-4 font-medium text-sm text-slate-500 font-malayalam">
                      {lang === 'ml' ? v.name_en : v.name_ml}
                    </td>

                    {/* Default Rate */}
                    <td className="py-3.5 px-4 text-right">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.5"
                          value={editRate}
                          onChange={(e) => setEditRate(e.target.value)}
                          className="w-24 px-2.5 py-1.5 text-right bg-white border border-emerald-400 rounded-lg text-sm font-bold text-slate-900 shadow-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
                        />
                      ) : (
                        <span className="inline-block font-mono font-bold text-sm text-amber-900 bg-amber-50 border border-amber-200 px-3 py-1 rounded-lg shadow-sm">
                          ₹{Number(v.default_rate_per_kg).toFixed(2)}
                        </span>
                      )}
                    </td>

                    {/* Default Stem Waste */}
                    <td className="py-3.5 px-4 text-right">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.05"
                          value={editWaste}
                          onChange={(e) => setEditWaste(e.target.value)}
                          className="w-24 px-2.5 py-1.5 text-right bg-white border border-emerald-400 rounded-lg text-sm font-bold text-slate-900 shadow-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
                        />
                      ) : (
                        <span className="inline-block font-mono text-sm text-slate-600 bg-slate-100 border border-slate-200 px-3 py-1 rounded-lg">
                          {Number(v.default_stem_waste_per_bunch_kg).toFixed(2)} kg
                        </span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4 text-center">
                      {isEditing ? (
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            type="button"
                            onClick={() => saveEdit(v)}
                            className="p-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 shadow-sm transition-all"
                            title="Save"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="p-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-all"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            type="button"
                            onClick={() => startEdit(v)}
                            className="p-2 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-all"
                            title="Edit Rate & Waste"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(v.id)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Variety Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl shadow-slate-900/25 ring-1 ring-slate-900/5 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="relative bg-gradient-to-r from-emerald-950 via-[#156b46] to-emerald-900 px-6 py-5 text-white overflow-hidden">
              <div className="absolute -right-6 -top-8 w-28 h-28 rounded-full bg-white/5 pointer-events-none" />
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/15 rounded-xl ring-1 ring-white/25 shrink-0">
                    <Plus className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-bold text-lg tracking-tight text-white">{t('addVariety')}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/15 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500" />
            </div>

            <form onSubmit={handleAddVariety} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {t('varietyNameEn')} *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Grand Naine / Kappa"
                  value={newNameEn}
                  onChange={(e) => setNewNameEn(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {t('varietyNameMl')} *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. കപ്പപ്പഴം / റോബസ്റ്റ"
                  value={newNameMl}
                  onChange={(e) => setNewNameMl(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all font-malayalam"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {t('defaultRate')} *
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    placeholder="45.00"
                    value={newRate}
                    onChange={(e) => setNewRate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {t('defaultStemWaste')} *
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    required
                    placeholder="0.50"
                    value={newWaste}
                    onChange={(e) => setNewWaste(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#156b46] to-emerald-800 hover:from-[#0e4f33] hover:to-emerald-900 text-white text-sm font-semibold rounded-xl shadow-md shadow-emerald-900/20 transition-all duration-200"
                >
                  <Check className="w-4 h-4" />
                  {t('saveVariety')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
