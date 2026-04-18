import { useState, useEffect } from 'react';
import { PlanGate } from '../components/PlanGate';
import { useCategoryStore, useDevoteeStore, useSettingsStore } from '../store';
import { getDB, generateId } from '../db';

export function Broadcast() {
  const { categories } = useCategoryStore();
  const { devotees } = useDevoteeStore();
  const { whatsappTemplate } = useSettingsStore();

  const [selectedCategory, setSelectedCategory] = useState('');
  const [template, setTemplate] = useState(whatsappTemplate);
  
  const [queue, setQueue] = useState<typeof devotees>([]);
  const [sentCount, setSentCount] = useState(0);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [historyLog, setHistoryLog] = useState<any[]>([]);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    const db = await getDB();
    const logs = await db.getAll('broadcast_log');
    setHistoryLog(logs.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
  };

  const startBroadcast = () => {
    if (!selectedCategory) return;
    const targetDevotees = devotees.filter(d => d.category === selectedCategory && d.phone);
    setQueue(targetDevotees);
    setSentCount(0);
    setIsBroadcasting(true);
  };

  const sendNext = () => {
    if (queue.length === 0) {
      finishBroadcast();
      return;
    }
    const devotee = queue[0];
    
    // Parse template
    let msg = template
      .replace(/{name}/g, devotee.name)
      .replace(/{city}/g, devotee.city)
      .replace(/{nakshathiram}/g, categories.find(c => c.id === devotee.category)?.name || '')
      .replace(/{expiry_date}/g, devotee.subscription_end.slice(0,10))
      .replace(/{balance}/g, Math.max(0, devotee.annual_amount - devotee.amount_paid).toString());

    window.open(`whatsapp://send?phone=91${devotee.phone}&text=${encodeURIComponent(msg)}`, '_blank');
    
    setQueue(q => q.slice(1));
    setSentCount(s => s + 1);
  };

  const finishBroadcast = async () => {
    setIsBroadcasting(false);
    if (sentCount > 0) {
      const db = await getDB();
      const d = new Date();
      await db.put('broadcast_log', {
        id: generateId('BCST'),
        category_id: selectedCategory,
        month: String(d.getMonth() + 1).padStart(2,'0'),
        year: String(d.getFullYear()),
        contact_count: sentCount,
        timestamp: d.toISOString(),
      });
      loadHistory();
    }
  };

  return (
    <PlanGate requiredPlan="plus" featureName="WhatsApp Broadcasting">
      <div className="section mb-16">
        <h2 className="mb-16">Broadcast</h2>

        {!isBroadcasting ? (
          <>
            <div className="card mb-24" style={{ border: '2px solid var(--gold)' }}>
              <div className="form-group">
                <label className="form-label">1. Select Target Category</label>
                <select className="form-input" value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
                  <option value="">-- Choose Category --</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {selectedCategory && (
                  <div className="text-sm mt-8 text-gold fw-600">
                    {devotees.filter(d => d.category === selectedCategory && d.phone).length} Devotees found with phone numbers
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">2. Message Template</label>
                <textarea 
                  className="form-input" 
                  rows={4} 
                  value={template} 
                  onChange={e => setTemplate(e.target.value)}
                />
                <div className="text-xs text-muted mt-4">
                  Placeholders: <code style={{color:'var(--gold)'}}>{'{name}'}</code>, <code style={{color:'var(--gold)'}}>{'{city}'}</code>, <code style={{color:'var(--gold)'}}>{'{nakshathiram}'}</code>, <code style={{color:'var(--gold)'}}>{'{expiry_date}'}</code>, <code style={{color:'var(--gold)'}}>{'{balance}'}</code>
                </div>
              </div>

              <button 
                className="btn btn-primary w-full" 
                onClick={startBroadcast} 
                disabled={!selectedCategory || devotees.filter(d => d.category === selectedCategory && d.phone).length === 0}
              >
                🚀 Prepare Broadcast Queue
              </button>
            </div>

            <h4 className="text-gold mb-12">Broadcast History</h4>
            {historyLog.length === 0 ? (
              <div className="text-sm text-2">No past broadcasts.</div>
            ) : (
              <div className="flex-col gap-8">
                {historyLog.map(log => (
                  <div key={log.id} className="card-flat flex-between">
                    <div>
                      <div className="fw-600">Sent to {categories.find(c => c.id === log.category_id)?.name}</div>
                      <div className="text-xs text-muted">{new Date(log.timestamp).toLocaleString()}</div>
                    </div>
                    <div className="badge badge-green">{log.contact_count} Sent</div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="card text-center p-32">
            <h3 className="mb-8">Broadcast in Progress</h3>
            <div className="text-gold" style={{ fontSize: '3rem', margin: '16px 0' }}>{sentCount}</div>
            <div className="text-sm text-2 mb-24">Messages sent so far</div>

            {queue.length > 0 ? (
              <div>
                <p className="mb-16">Up next: <strong>{queue[0].name}</strong></p>
                <button className="btn btn-primary btn-lg w-full mb-16" onClick={sendNext}>
                  <span style={{ fontSize: '1.5rem' }}>💬</span> Send Next Message
                </button>
                <div className="text-xs text-muted mb-16">
                  {queue.length} remaining in queue
                </div>
              </div>
            ) : (
              <div className="text-green fw-600 mb-16">Queue Empty! All messages done.</div>
            )}

            <button className="btn btn-ghost w-full" onClick={finishBroadcast}>
              Stop / Finish Broadcast
            </button>
          </div>
        )}
      </div>
    </PlanGate>
  );
}
