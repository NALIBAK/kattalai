import { useDevoteeStore, useCategoryStore } from '../store';
import { getSubscriptionStatus } from '../db';
import { PlanGate } from '../components/PlanGate';

export function Reports() {
  const { devotees } = useDevoteeStore();
  const { categories } = useCategoryStore();

  const getCatName = (id: string) => categories.find(c => c.id === id)?.name || 'Unknown';

  const downloadCSV = (filename: string, data: any[]) => {
    if (data.length === 0) return alert('No data to export');
    
    // Extract headers based on keys of first object
    const headers = Object.keys(data[0]);
    
    const csvRows = [
      headers.join(','), // Header row
      ...data.map(row => 
        headers.map(fieldName => {
          const val = (row as any)[fieldName];
          // Escape quotes and commas
          return `"${String(val || '').replace(/"/g, '""')}"`;
        }).join(',')
      )
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportFullList = () => {
    const data = devotees.map(d => ({
      ID: d.id,
      Name: d.name,
      Phone: d.phone,
      City: d.city,
      Address: d.address,
      Gothram: d.gothram,
      Category: getCatName(d.category),
      Annual_Amount: d.annual_amount,
      Amount_Paid: d.amount_paid,
      Status: getSubscriptionStatus(d),
      Expiry_Date: d.subscription_end.slice(0, 10),
    }));
    downloadCSV('Kattalai_Full_List', data);
  };

  const exportPendingDues = () => {
    const data = devotees
      .filter(d => d.annual_amount > d.amount_paid)
      .map(d => ({
        Name: d.name,
        Phone: d.phone,
        City: d.city,
        Amount_Due: d.annual_amount - d.amount_paid,
        Expiry_Date: d.subscription_end.slice(0, 10),
      }));
    downloadCSV('Kattalai_Pending_Dues', data);
  };

  const exportCityDistribution = () => {
    // Count devotees per city
    const summary: Record<string, number> = {};
    devotees.forEach(d => {
      summary[d.city] = (summary[d.city] || 0) + 1;
    });
    const data = Object.keys(summary).map(city => ({
      City: city,
      Total_Devotees: summary[city]
    }));
    downloadCSV('Kattalai_City_Distribution', data);
  };

  return (
    <div>
      <div className="section mb-16">
        <h2 className="mb-16">Reports & Export</h2>

        <div className="card mb-16">
          <div className="flex-between mb-8">
            <h4 className="m-0 text-gold">Full Database Export</h4>
            <button className="btn btn-primary btn-sm" onClick={exportFullList}>📄 Download CSV</button>
          </div>
          <div className="text-sm text-2">Exports all devotees with their contact info, address, category, and subscription dates.</div>
        </div>

        <div className="card mb-16">
          <div className="flex-between mb-8">
            <h4 className="m-0 text-gold">Pending Dues Report</h4>
            <button className="btn btn-primary btn-sm" onClick={exportPendingDues}>📄 Download CSV</button>
          </div>
          <div className="text-sm text-2">Exports a filtered list of only devotees who have unpaid balances.</div>
        </div>

        <div className="card mb-16">
          <div className="flex-between mb-8">
            <h4 className="m-0 text-gold">City-wise Summary</h4>
            <button className="btn btn-primary btn-sm" onClick={exportCityDistribution}>📄 Download CSV</button>
          </div>
          <div className="text-sm text-2">Shows total devotee counts grouped by City.</div>
        </div>
        
        {/* Pro features placeholder */}
        <PlanGate requiredPlan="pro" featureName="Custom PDF Generation">
          <div className="card mt-24 text-center">
            <div className="mb-8" style={{ fontSize: '2rem' }}>📈</div>
            <h4>Advanced Analytics</h4>
            <div className="text-sm text-2">Coming soon: Automated Chart PDF Generation.</div>
          </div>
        </PlanGate>

      </div>
    </div>
  );
}
