import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToastStore } from '../store';
import { getDeletedDevotees, restoreDevotee, permanentlyDeleteDevotee, emptyRecycleBin } from '../db';
import type { DeletedDevotee } from '../db';
import { allowPush } from '../utils/syncLock';
import { useTranslation } from '../utils/i18n';

export function RecycleBin() {
  const navigate = useNavigate();
  const { showToast } = useToastStore();
  const { t } = useTranslation();

  const [records, setRecords] = useState<DeletedDevotee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const loadRecords = useCallback(async (showLoading = false) => {
    if (showLoading) {
      setLoading(true);
    }
    try {
      const data = await getDeletedDevotees();
      setRecords(data);
    } catch {
      showToast(t('bin_restore_failed'), 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, t]);

  useEffect(() => {
    Promise.resolve().then(() => {
      loadRecords();
    });
  }, [loadRecords]);

  const handleRestore = async (id: string, name: string) => {
    if (window.confirm(t('bin_confirm_restore').replace('{name}', name))) {
      try {
        await restoreDevotee(id);
        allowPush(); // Unlock auto-push since user made a genuine edit
        showToast(t('bin_restore_success').replace('{name}', name), 'success');
        loadRecords(true);
      } catch {
        showToast(t('bin_restore_failed'), 'error');
      }
    }
  };

  const handlePermanentDelete = async (id: string, name: string) => {
    if (window.confirm(t('bin_confirm_perm_delete').replace('{name}', name))) {
      try {
        await permanentlyDeleteDevotee(id);
        allowPush(); // Unlock auto-push since user made a genuine edit
        showToast(t('bin_perm_deleted_success').replace('{name}', name), 'info');
        loadRecords(true);
      } catch {
        showToast(t('bin_delete_failed'), 'error');
      }
    }
  };

  const handleEmptyBin = async () => {
    if (records.length === 0) return;
    if (window.confirm(t('bin_confirm_empty'))) {
      try {
        await emptyRecycleBin();
        allowPush(); // Unlock auto-push since user made a genuine edit
        showToast(t('bin_empty_success'), 'success');
        loadRecords(true);
      } catch {
        showToast(t('bin_empty_failed'), 'error');
      }
    }
  };

  const filtered = records.filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const d = r.devotee;
    return d.name.toLowerCase().includes(q) || d.phone.includes(q) || d.city.toLowerCase().includes(q);
  });

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString.slice(0, 16).replace('T', ' ');
    }
  };

  return (
    <div>
      {/* Header section with back and empty bin button */}
      <div className="section flex-between mb-24" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div className="flex-center gap-12">
          <button className="btn-icon" onClick={() => navigate('/settings')} title="Back to Settings">
            🔙
          </button>
          <h2 className="mb-0">{t('bin_title')}</h2>
        </div>
        {records.length > 0 && (
          <button className="btn btn-sm btn-danger flex-center gap-4" onClick={handleEmptyBin}>
            {t('bin_empty_btn')}
          </button>
        )}
      </div>

      {/* Description / Summary card */}
      <div className="card mb-16" style={{ background: 'rgba(212,175,55,0.04)', borderColor: 'rgba(212,175,55,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: '1.5rem' }}>♻️</span>
          <div className="text-sm text-2" style={{ lineHeight: 1.4 }}>
            {t('bin_desc')}
          </div>
        </div>
      </div>

      {/* Search Bar */}
      {records.length > 0 && (
        <div className="search-bar mb-16">
          <span>🔍</span>
          <input
            type="text"
            placeholder={t('bin_search_placeholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && <button onClick={() => setSearchQuery('')}>✖️</button>}
        </div>
      )}

      {/* Deleted Devotees List */}
      {loading ? (
        <div className="flex-col gap-12">
          <div className="skeleton" style={{ height: 110 }} />
          <div className="skeleton" style={{ height: 110 }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-icon" style={{ filter: 'grayscale(0.2)' }}>♻️</div>
          <div className="empty-title">
            {searchQuery ? t('bin_no_matches') : t('bin_empty_state')}
          </div>
          <p>
            {searchQuery
              ? t('bin_try_modify')
              : t('bin_empty_details')}
          </p>
        </div>
      ) : (
        <div className="flex-col gap-12">
          {filtered.map((record) => {
            const d = record.devotee;
            return (
              <div
                key={record.id}
                className="card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  position: 'relative',
                  borderLeft: '4px solid var(--border)',
                  transition: 'border-color 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderLeftColor = 'var(--gold)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderLeftColor = 'var(--border)')}
              >
                {/* Devotee Info row */}
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div
                    className="devotee-avatar"
                    style={{
                      margin: 0,
                      background: 'linear-gradient(135deg, var(--text-3), var(--surface-2))',
                      color: 'var(--text)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {d.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div className="fw-700" style={{ fontSize: '0.95rem', marginBottom: 2 }}>
                      {d.name}
                    </div>
                    <div className="text-xs text-muted mb-4">
                      📱 {d.phone} {d.city && `| 📍 ${d.city}`}
                    </div>
                    <div className="text-xs text-red fw-600">
                      🕒 {t('bin_deleted_label')} {formatDate(record.deleted_at)}
                    </div>
                  </div>

                  {/* Actions buttons */}
                  <div className="flex gap-8" style={{ alignSelf: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <button
                      className="btn btn-sm btn-ghost flex-center"
                      onClick={() => handleRestore(record.id, d.name)}
                      title="Restore Devotee"
                      style={{ minWidth: 36, padding: '4px 8px' }}
                    >
                      {t('bin_restore_btn')}
                    </button>
                    <button
                      className="btn btn-sm btn-danger flex-center"
                      onClick={() => handlePermanentDelete(record.id, d.name)}
                      title="Permanently Delete"
                      style={{ minWidth: 36, padding: '4px 8px' }}
                    >
                      {t('bin_permanent_btn')}
                    </button>
                  </div>
                </div>

                <div className="divider" style={{ margin: '0' }} />

                {/* Sub-records summary badges */}
                <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
                  <span className="badge badge-muted">
                    👪 {record.family_members.length} {t('bin_family_badge')}
                  </span>
                  <span className="badge badge-muted">
                    💳 {record.payment_history.length} {t('bin_payments_badge')}
                  </span>
                  <span className="badge badge-gold">
                    💰 ₹{d.annual_amount} {t('bin_annual_badge')}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
