const COLORS = [
  '#F6465D', '#0ECB81', '#F0A500', '#1890FF', 
  '#9B59B6', '#E67E22', '#1ABC9C', '#34495E'
];

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCategoryStore, useToastStore, useDevoteeStore } from '../store';
import { upsertCategory, deleteCategory, Category, generateId } from '../db';
import { useTranslation } from '../utils/i18n';

export function ManageCategories() {
  const navigate = useNavigate();
  const { categories, loadCategories } = useCategoryStore();
  const { refresh, devotees } = useDevoteeStore();
  const { showToast } = useToastStore();
  const { t } = useTranslation();

  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);

  const handleSave = async () => {
    if (!name.trim()) return showToast(t('cat_name_req'), 'error');
    const newCat: Category = {
      id: generateId('CAT'),
      name,
      color,
      is_builtin: false,
      sort_order: categories.length + 1
    };
    await upsertCategory(newCat);
    await loadCategories();
    setIsAdding(false);
    setName('');
    setColor(COLORS[0]);
    showToast(t('cat_added_success'), 'success');
  };

  const handleDelete = async (id: string) => {
    // Check how many devotees use this
    const count = devotees.filter(d => d.category === id).length;
    if (count > 0) {
      showToast(t('cat_delete_in_use').replace('{count}', String(count)), 'error');
      return;
    }
    
    if (window.confirm(t('cat_delete_confirm'))) {
      await deleteCategory(id);
      await loadCategories();
      await refresh();
      showToast(t('cat_deleted_success'), 'info');
    }
  };

  return (
    <div>
      <div className="section flex-between mb-16" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div className="flex-center gap-12">
          <button className="btn-icon" onClick={() => navigate('/settings')}>🔙</button>
          <h2 className="mb-0">{t('cat_title')}</h2>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setIsAdding(!isAdding)}>
          {isAdding ? t('cancel') : t('cat_add_custom')}
        </button>
      </div>

      {isAdding && (
        <div className="card mb-16" style={{ border: '2px solid var(--gold)' }}>
          <h4 className="mb-16">{t('cat_new_custom')}</h4>
          <div className="form-group">
            <label className="form-label">{t('cat_name_label')}</label>
            <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. VIP Donors" />
          </div>
          <div className="form-group">
            <label className="form-label">{t('cat_badge_color')}</label>
            <div className="flex gap-8 mt-8" style={{ flexWrap: 'wrap' }}>
              {COLORS.map(c => (
                <div 
                  key={c} 
                  onClick={() => setColor(c)}
                  style={{
                    width: 32, height: 32, borderRadius: 16, background: c, cursor: 'pointer',
                    border: color === c ? '3px solid var(--text)' : '2px solid transparent'
                  }}
                />
              ))}
            </div>
          </div>
          <button className="btn btn-primary w-full" onClick={handleSave}>{t('cat_save_btn')}</button>
        </div>
      )}

      <div className="section">
        <h4 className="mb-8 text-gold">{t('cat_custom_title')}</h4>
        <div className="flex-col gap-8 mb-24">
          {categories.filter(c => !c.is_builtin).length === 0 ? (
            <div className="text-sm text-2">{t('cat_no_custom')}</div>
          ) : (
            categories.filter(c => !c.is_builtin).map(c => (
              <div key={c.id} className="card-flat flex-between" style={{ borderLeft: `4px solid ${c.color}`, flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div className="fw-600">{c.name}</div>
                  <div className="text-xs text-muted">{devotees.filter(d => d.category === c.id).length} {t('cat_devotees_count')}</div>
                </div>
                <button className="btn-icon text-red" onClick={() => handleDelete(c.id)}>🗑️</button>
              </div>
            ))
          )}
        </div>

        <h4 className="mb-8 text-2">{t('cat_builtin_title')}</h4>
        <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
          {categories.filter(c => c.is_builtin).map(c => (
            <span key={c.id} className="badge badge-muted p-8" style={{ fontSize: '0.85rem' }}>
              {c.name} {c.name_ta ? `(${c.name_ta})` : ''}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
