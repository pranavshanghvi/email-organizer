import React, { useState, useEffect } from 'react';
import './Dashboard.css';

export default function Dashboard({ plans, onExecute }) {
  const [stage, setStage] = useState('start'); // start → analyze → categorize → review → done
  const [senders, setSenders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [categorized, setCategorized] = useState({});

  const analyzeSenders = async () => {
    setLoading(true);
    try {
      console.log('Fetching senders from API...');
      const res = await fetch('http://localhost:3001/api/senders');
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      console.log('Got senders:', data.length);

      setSenders(data);
      // Initialize categorized with empty decisions
      const init = {};
      data.forEach(s => {
        init[s.email] = { action: null, folder: null, notes: '' };
      });
      setCategorized(init);
      setTimeout(() => setStage('categorize'), 100);
    } catch (err) {
      console.error('Failed to load senders:', err);
      alert('Error scanning Gmail: ' + err.message);
      setLoading(false);
    }
  };

  const updateSenderDecision = (email, field, value) => {
    setCategorized(prev => ({
      ...prev,
      [email]: { ...prev[email], [field]: value }
    }));
  };

  const proceedToReview = () => {
    const allDecided = senders.every(s => categorized[s.email]?.action);
    if (!allDecided) {
      alert('Please make a decision for each sender before proceeding.');
      return;
    }
    setStage('review');
  };

  const commitPlan = async () => {
    setLoading(true);

    try {
      // Group by action type
      const keep = senders.filter(s => categorized[s.email]?.action === 'keep');
      const route = senders.filter(s => categorized[s.email]?.action === 'route');
      const deleteBlock = senders.filter(s => categorized[s.email]?.action === 'deleteBlock');
      const deleteNoBlock = senders.filter(s => categorized[s.email]?.action === 'deleteNoBlock');

      // Execute each action
      for (const sender of route) {
        await fetch('http://localhost:3001/api/plans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `Route ${sender.email}`,
            sender: sender.email,
            action: 'folder',
            folderName: categorized[sender.email].folder,
          }),
        });
      }

      for (const sender of deleteBlock) {
        await fetch('http://localhost:3001/api/plans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `Delete + Block ${sender.email}`,
            sender: sender.email,
            action: 'delete',
          }),
        });
      }

      for (const sender of deleteNoBlock) {
        await fetch('http://localhost:3001/api/plans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `Delete (no block) ${sender.email}`,
            sender: sender.email,
            action: 'delete',
          }),
        });
      }

      // Execute all plans immediately
      const plansRes = await fetch('http://localhost:3001/api/plans');
      const allPlans = await plansRes.json();
      for (const plan of allPlans) {
        await fetch(`http://localhost:3001/api/plans/${plan.id}/execute`, { method: 'POST' });
      }

      alert(`✓ Plan executed!\n\nKept: ${keep.length}\nRouted: ${route.length}\nDeleted + Blocked: ${deleteBlock.length}\nDeleted (no block): ${deleteNoBlock.length}`);
      setStage('done');

      // Reset
      setTimeout(() => {
        setStage('start');
        setSenders([]);
        setCategorized({});
      }, 2000);
    } catch (err) {
      console.error('Error executing plan:', err);
      alert('Error executing plan: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (stage === 'start') {
    return (
      <div className="dashboard">
        <div className="stage-container">
          <h2>Email Cleanup Organizer</h2>
          <p>Analyze your Gmail inbox and create a customized cleanup plan.</p>
          <button className="primary-btn" onClick={analyzeSenders} disabled={loading}>
            {loading ? 'Scanning Gmail...' : '🔍 Scan & Analyze'}
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'categorize') {
    return (
      <div className="dashboard">
        <h2>Step 1: Categorize Senders</h2>
        <p>For each sender, decide what to do:</p>
        <div className="categorize-container">
          <table className="categorize-table">
            <thead>
              <tr>
                <th>Sender Email</th>
                <th>Count</th>
                <th>Action</th>
                <th>Folder (if routing)</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {senders.map(sender => (
                <tr key={sender.email}>
                  <td className="sender-email">{sender.email}</td>
                  <td className="count">{sender.count.toLocaleString()}</td>
                  <td>
                    <select
                      value={categorized[sender.email]?.action || ''}
                      onChange={(e) => updateSenderDecision(sender.email, 'action', e.target.value)}
                    >
                      <option value="">Choose...</option>
                      <option value="keep">Keep</option>
                      <option value="route">Route to folder</option>
                      <option value="deleteBlock">Delete + Block</option>
                      <option value="deleteNoBlock">Delete (no block)</option>
                      <option value="review">Manual review</option>
                    </select>
                  </td>
                  <td>
                    <input
                      type="text"
                      placeholder="Folder name"
                      value={categorized[sender.email]?.folder || ''}
                      onChange={(e) => updateSenderDecision(sender.email, 'folder', e.target.value)}
                      disabled={categorized[sender.email]?.action !== 'route'}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      placeholder="Notes..."
                      value={categorized[sender.email]?.notes || ''}
                      onChange={(e) => updateSenderDecision(sender.email, 'notes', e.target.value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="button-group">
          <button className="secondary-btn" onClick={() => setStage('start')}>← Back</button>
          <button className="primary-btn" onClick={proceedToReview}>Review Plan →</button>
        </div>
      </div>
    );
  }

  if (stage === 'review') {
    const keep = senders.filter(s => categorized[s.email]?.action === 'keep');
    const route = senders.filter(s => categorized[s.email]?.action === 'route');
    const deleteBlock = senders.filter(s => categorized[s.email]?.action === 'deleteBlock');
    const deleteNoBlock = senders.filter(s => categorized[s.email]?.action === 'deleteNoBlock');
    const review = senders.filter(s => categorized[s.email]?.action === 'review');

    return (
      <div className="dashboard">
        <h2>Step 2: Review Plan</h2>

        <div className="review-grid">
          <div className="review-section keep">
            <h3>✓ Keep ({keep.length})</h3>
            <ul>
              {keep.map(s => <li key={s.email}>{s.email} ({s.count})</li>)}
            </ul>
          </div>

          <div className="review-section route">
            <h3>→ Route to Folder ({route.length})</h3>
            <ul>
              {route.map(s => (
                <li key={s.email}>{s.email} → {categorized[s.email]?.folder} ({s.count})</li>
              ))}
            </ul>
          </div>

          <div className="review-section delete">
            <h3>🗑️ Delete + Block ({deleteBlock.length})</h3>
            <ul>
              {deleteBlock.map(s => <li key={s.email}>{s.email} ({s.count})</li>)}
            </ul>
          </div>

          <div className="review-section delete-noblock">
            <h3>🗑️ Delete (No Block) ({deleteNoBlock.length})</h3>
            <p style={{ fontSize: '0.875rem', color: '#666' }}>For auth/transactional emails</p>
            <ul>
              {deleteNoBlock.map(s => <li key={s.email}>{s.email} ({s.count})</li>)}
            </ul>
          </div>

          <div className="review-section review">
            <h3>⚠️ Manual Review ({review.length})</h3>
            <ul>
              {review.map(s => (
                <li key={s.email}>{s.email} — {categorized[s.email]?.notes} ({s.count})</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="button-group">
          <button className="secondary-btn" onClick={() => setStage('categorize')}>← Edit</button>
          <button className="commit-btn" onClick={commitPlan}>✓ Commit Plan</button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="stage-container">
        <h2>✓ Plan Committed!</h2>
        <p>Your cleanup plan has been saved and will be executed.</p>
        <p style={{ color: '#666', fontSize: '0.875rem' }}>Redirecting...</p>
      </div>
    </div>
  );
}
