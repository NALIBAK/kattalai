import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useToastStore, useDevoteeStore } from '../store';
import { getDevotee, getPaymentHistory, addPayment, deletePayment, upsertDevotee, Devotee, PaymentEntry, generateId } from '../db';
import { allowPush } from '../utils/syncLock';

export function DevoteePayments() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToastStore();
  const { refresh } = useDevoteeStore();
  
  const [devotee, setDevotee] = useState<Devotee | null>(null);
  const [history, setHistory] = useState<PaymentEntry[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  
  // New Payment Form
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadData = async () => {
    if (id) {
      const d = await getDevotee(id);
      if (d) {
        setDevotee(d);
        const h = await getPaymentHistory(id);
        setHistory(h);
      } else {
        showToast('Devotee not found', 'error');
        navigate('/devotees');
      }
    }
  };

  const handleAddPayment = async () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      showToast('Enter a valid amount', 'error');
      return;
    }
    await addPayment({
      id: generateId('PAY'),
      devotee_id: id!,
      date,
      amount: Number(amount),
      note
    });
    
    showToast('Payment recorded successfully', 'success');
    allowPush(); // Unlock auto-push
    setIsAdding(false);
    setAmount('');
    setNote('');
    setDate(new Date().toISOString().split('T')[0]);
    await loadData();
    await refresh(); // Sync global store
  };

  const handleDelete = async (payId: string) => {
    if (window.confirm('Delete this payment record?')) {
      await deletePayment(payId, id!);
      allowPush(); // Unlock auto-push
      showToast('Payment deleted', 'info');
      await loadData();
      await refresh();
    }
  };

  const handleRenew = async () => {
    if (!devotee) return;
    if (window.confirm(`Renew subscription for another year? The expiry date will be extended by 1 year.`)) {
      const currentEnd = new Date(devotee.subscription_end);
      const newEnd = new Date(currentEnd.setFullYear(currentEnd.getFullYear() + 1));
      
      const updated: Devotee = { 
        ...devotee, 
        subscription_end: newEnd.toISOString().split('T')[0],
        annual_amount: devotee.annual_amount, // Keeps the same fee amount
        updated_at: new Date().toISOString()
      };
      
      await upsertDevotee(updated);
      allowPush(); // Unlock auto-push
      showToast('Subscription renewed successfully! 🎉', 'success');
      await loadData();
      await refresh();
    }
  };

  if (!devotee) return <div className="p-16">Loading...</div>;

  const pending = Math.max(0, devotee.annual_amount - devotee.amount_paid);

  return (
    <div>
      <div className="section flex-between mb-16">
        <div className="flex-center gap-12">
          <button className="btn-icon" onClick={() => navigate(`/devotees/${id}`)}>🔙</button>
          <h2 className="mb-0">Payments</h2>
        </div>
        <button className="btn btn-sm" style={{ border: '1px solid var(--gold)', color: 'var(--gold)' }} onClick={handleRenew}>
          🔄 Renew 1 Year
        </button>
      </div>

      <div className="card mb-24 text-center">
        <h4 className="mb-4">{devotee.name}</h4>
        <div className="text-2 text-sm mb-16">Sub valid until: {devotee.subscription_end.slice(0,10)}</div>

        <div className="grid-2">
          <div className="card-flat" style={{ background: pending === 0 ? 'rgba(14,203,129,0.05)' : 'rgba(240,165,0,0.05)' }}>
            <div className="text-xs text-muted">Total Paid</div>
            <div className={`text-xl fw-700 ${pending === 0 ? 'text-green' : 'text-amber'}`}>₹{devotee.amount_paid}</div>
          </div>
          <div className="card-flat" style={{ background: pending > 0 ? 'rgba(246,70,93,0.05)' : 'var(--surface-2)' }}>
            <div className="text-xs text-muted">Pending Balance</div>
            <div className={`text-xl fw-700 ${pending > 0 ? 'text-red' : 'text-green'}`}>₹{pending}</div>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="flex-between mb-16">
          <h3 className="mb-0">History</h3>
          {!isAdding && <button className="btn btn-primary btn-sm" onClick={() => setIsAdding(true)}>➕ Add</button>}
        </div>

        {isAdding && (
          <div className="card mb-16" style={{ border: '2px solid var(--gold)' }}>
            <h4 className="mb-16">Record Payment</h4>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Date</label>
                <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Amount (₹) *</label>
                <input className="form-input" type="number" placeholder="0" value={amount} onChange={e => setAmount(e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Note (Optional)</label>
              <input className="form-input" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Cash handed to admin" />
            </div>
            <div className="flex gap-8">
              <button className="btn btn-ghost flex-1" onClick={() => setIsAdding(false)}>Cancel</button>
              <button className="btn btn-primary flex-1" onClick={handleAddPayment}>Save</button>
            </div>
          </div>
        )}

        {history.length === 0 ? (
          <div className="empty-state p-32">
            <div style={{ fontSize: '2rem' }}>🧾</div>
            <div className="text-sm mt-8">No payments recorded yet.</div>
          </div>
        ) : (
          <div className="flex-col gap-8">
            {history.map(pay => (
              <div key={pay.id} className="card-flat flex-between">
                <div>
                  <div className="fw-600">₹{pay.amount}</div>
                  <div className="text-xs text-muted">{pay.date}</div>
                  {pay.note && <div className="text-xs mt-4 text-2 flex gap-4"><span className="text-gold">★</span> {pay.note}</div>}
                </div>
                <button className="btn-icon" style={{ borderColor: 'transparent', color: 'var(--red)' }} onClick={() => handleDelete(pay.id)}>🗑️</button>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
