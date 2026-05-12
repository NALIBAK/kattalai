const COLORS = [
  '#F6465D', '#0ECB81', '#F0A500', '#1890FF', 
  '#9B59B6', '#E67E22', '#1ABC9C', '#34495E'
];

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCategoryStore, useToastStore, useDevoteeStore } from '../store';
import { upsertCategory, deleteCategory, Category, generateId } from '../db';

export function ManageCategories() {
  const navigate = useNavigate();
  const { categories, loadCategories } = useCategoryStore();
  const { refresh, devotees } = useDevoteeStore();
  const { showToast } = useToastStore();

  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);

  const handleSave = async () => {
    if (!name.trim()) return showToast('Name is required', 'error');
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
    showToast('Category added', 'success');
  };

  const handleDelete = async (id: string) => {
    // Check how many devotees use this
    const count = devotees.filter(d => d.category === id).length;
    if (count > 0) {
      showToast(`Cannot delete category! ${count} devotees are still using it.`, 'error');
      return;
    }
    
    if (window.confirm('Delete this empty category?')) {
      await deleteCategory(id);
      await loadCategories();
      await refresh();
      showToast('Category deleted', 'info');
    }
  };

  return (
    <div>
      <div className="section flex-between mb-16">
        <div className="flex-center gap-12">
          <button className="btn-icon" onClick={() => navigate('/settings')}>🔙</button>
          <h2 className="mb-0">Categories</h2>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setIsAdding(!isAdding)}>
          {isAdding ? 'Cancel' : '➕ Add Custom'}
        </button>
      </div>

      {isAdding && (
        <div className="card mb-16" style={{ border: '2px solid var(--gold)' }}>
          <h4 className="mb-16">New Custom Category</h4>
          <div className="form-group">
            <label className="form-label">Category Name</label>
            <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. VIP Donors" />
          </div>
          <div className="form-group">
            <label className="form-label">Badge Color</label>
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
          <button className="btn btn-primary w-full" onClick={handleSave}>Save Category</button>
        </div>
      )}

      <div className="section">
        <h4 className="mb-8 text-gold">Custom Categories</h4>
        <div className="flex-col gap-8 mb-24">
          {categories.filter(c => !c.is_builtin).length === 0 ? (
            <div className="text-sm text-2">No custom categories created yet.</div>
          ) : (
            categories.filter(c => !c.is_builtin).map(c => (
              <div key={c.id} className="card-flat flex-between" style={{ borderLeft: `4px solid ${c.color}` }}>
                <div>
                  <div className="fw-600">{c.name}</div>
                  <div className="text-xs text-muted">{devotees.filter(d => d.category === c.id).length} Devotees</div>
                </div>
                <button className="btn-icon text-red" onClick={() => handleDelete(c.id)}>🗑️</button>
              </div>
            ))
          )}
        </div>

        <h4 className="mb-8 text-2">Built-in (Nakshathiram)</h4>
        <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
          {categories.filter(c => c.is_builtin).map(c => (
            <span key={c.id} className="badge badge-muted p-8">
              {c.name} {c.name_ta ? `(${c.name_ta})` : ''}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
