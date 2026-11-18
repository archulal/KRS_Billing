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
    <div className="space-y-4">
      
      {/* Top Bar */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-amber-100 rounded-xl text-amber-800">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">{t('varietiesTitle')}</h2>
            <p className="text-xs text-slate-500">
              Configure standard default market prices and stem/stalk deductions per bunch.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsAddOpen(true)}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{t('addVariety')}</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Varieties Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                <th className="py-3 px-4 w-12 text-center">#</th>
                <th className="py-3 px-4">{lang === 'ml' ? t('varietyNameMl') : t('varietyNameEn')}</th>
                <th className="py-3 px-4">{lang === 'ml' ? t('varietyNameEn') : t('varietyNameMl')}</th>
                <th className="py-3 px-4 text-right">{t('defaultRate')}</th>
                <th className="py-3 px-4 text-right">{t('defaultStemWaste')}</th>
                <th className="py-3 px-4 text-center w-28">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bananaTypes.map((v, idx) => {
                const isEditing = editingId === v.id;

                return (
                  <tr key={v.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 text-center font-bold text-xs text-slate-400">
                      {idx + 1}
                    </td>

                    {/* Primary Name */}
                    <td className="py-3 px-4 font-bold text-xs text-slate-900 font-malayalam">
                      {lang === 'ml' ? v.name_ml : v.name_en}
                    </td>

                    {/* Secondary Name */}
                    <td className="py-3 px-4 font-medium text-xs text-slate-600 font-malayalam">
                      {lang === 'ml' ? v.name_en : v.name_ml}
                    </td>

                    {/* Default Rate */}
                    <td className="py-3 px-4 text-right">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.5"
                          value={editRate}
                          onChange={(e) => setEditRate(e.target.value)}
                          className="w-24 px-2 py-1 text-right bg-white border border-amber-400 rounded-lg text-xs font-bold text-slate-900"
                        />
                      ) : (
                        <span className="font-mono font-bold text-xs text-slate-900 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md">
                          ₹{Number(v.default_rate_per_kg).toFixed(2)}
                        </span>
                      )}
                    </td>

                    {/* Default Stem Waste */}
                    <td className="py-3 px-4 text-right">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.05"
                          value={editWaste}
                          onChange={(e) => setEditWaste(e.target.value)}
                          className="w-24 px-2 py-1 text-right bg-white border border-amber-400 rounded-lg text-xs font-bold text-slate-900"
                        />
                      ) : (
                        <span className="font-mono text-xs text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md">
                          {Number(v.default_stem_waste_per_bunch_kg).toFixed(2)} kg
                        </span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-3 px-4 text-center">
                      {isEditing ? (
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            type="button"
                            onClick={() => saveEdit(v)}
                            className="p-1 bg-leaf-600 text-white rounded hover:bg-leaf-700"
                            title="Save"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="p-1 bg-slate-300 text-slate-700 rounded hover:bg-slate-400"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            type="button"
                            onClick={() => startEdit(v)}
                            className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg"
                            title="Edit Rate & Waste"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(v.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden">
            <div className="bg-amber-600 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-white" />
                <h3 className="font-bold text-base">{t('addVariety')}</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setIsAddOpen(false)}
                className="text-white/80 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddVariety} className="p-6 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('varietyNameEn')} *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Grand Naine / Kappa"
                  value={newNameEn}
                  onChange={(e) => setNewNameEn(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('varietyNameMl')} *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. കപ്പപ്പഴം / റോബസ്റ്റ"
                  value={newNameMl}
                  onChange={(e) => setNewNameMl(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:bg-white font-malayalam"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t('defaultRate')} *
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    placeholder="45.00"
                    value={newRate}
                    onChange={(e) => setNewRate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t('defaultStemWaste')} *
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    required
                    placeholder="0.50"
                    value={newWaste}
                    onChange={(e) => setNewWaste(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:bg-white"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow transition-all"
                >
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
