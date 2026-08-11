import React, { useState, useEffect } from 'react';
import './Dashboard.css';

// Detect API URL at runtime
const getApiUrl = () => {
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  // Production: use Railway backend
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return 'https://web-production-d755d.up.railway.app';
  }
  // Local development
  return 'http://localhost:3001';
};

const API_URL = getApiUrl();

// Key used to persist the current scan in sessionStorage. This is what makes
// the scan survive a page reload or tab navigation — you never lose your work.
const STORAGE_KEY = 'emailOrganizerState';

export default function Dashboard({ plans, onExecute, onStageChange, triggerReview, onReviewTriggered }) {
  const [stage, setStage] = useState('start'); // start → analyze → categorize → review → done
  const [senders, setSenders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scanProgress, setScanProgress] = useState(null);
  const [categorized, setCategorized] = useState({});
  const [labels, setLabels] = useState([]);
  const [newLabelModal, setNewLabelModal] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [scanNotice, setScanNotice] = useState(null);

  // On mount, restore a previous scan if one was saved (e.g. after the page
  // navigated away to Gmail and came back, or after a reload).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && Array.isArray(saved.senders) && saved.senders.length > 0) {
          setSenders(saved.senders);
          setCategorized(saved.categorized || {});
          setStage('categorize');
        }
      }
    } catch (err) {
      console.error('Failed to restore saved scan:', err);
    }
  }, []);

  // Persist the current scan whenever it changes, so it survives navigation.
  useEffect(() => {
    if (senders.length === 0) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ senders, categorized, stage }));
    } catch (err) {
      // Storage unavailable — ignore
    }
  }, [senders, categorized, stage]);

  const resetToStart = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setSenders([]);
    setCategorized({});
    setStage('start');
  };

  useEffect(() => {
    if (triggerReview) {
      proceedToReview();
      onReviewTriggered();
    }
    // proceedToReview/onReviewTriggered are recreated every render, so listing
    // them would make this effect fire on every render. Intentionally omitted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerReview]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    const loadLabels = async () => {
      try {
        const res = await fetch(`${API_URL}/api/labels`);
        if (res.ok) {
          const data = await res.json();
          setLabels(data);
        }
      } catch (err) {
        console.error('Failed to load labels:', err);
      }
    };
    loadLabels();
  }, []);

  const getSuggestedFolder = (senderEmail) => {
    const domain = senderEmail.split('@')[1]?.split('.')[0] || '';
    if (!domain) return '';
    const suggestedName = domain.charAt(0).toUpperCase() + domain.slice(1);
    return suggestedName;
  };

  // Build the same Gmail search URL Gmail itself produces, so the query
  // reliably opens a filtered view of this sender's emails.
  const getGmailSearchUrl = (senderEmail) => {
    return `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(`from:${senderEmail}`)}`;
  };

  const analyzeSenders = async () => {
    setLoading(true);
    setScanProgress({ fetched: 0, total: 0 });
    sessionStorage.removeItem(STORAGE_KEY);

    // Poll the backend for scan progress so the user sees it working.
    const statusInterval = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/api/senders/status`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'running') setScanProgress(data);
        }
      } catch (err) {
        // Ignore — the main scan request will surface real errors
      }
    }, 400);

    try {
      console.log('Fetching senders from API...');
      const res = await fetch(`${API_URL}/api/senders`);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      // Support both the current { senders, truncated } shape and the older
      // plain-array shape.
      const sendersList = Array.isArray(data) ? data : (data.senders || []);
      const truncated = !Array.isArray(data) && !!data.truncated;
      const scannedCount = !Array.isArray(data) ? (data.scannedCount || 0) : 0;
      console.log('Got senders:', sendersList.length, truncated ? '(scan window capped by Gmail rate limit)' : '');

      setSenders(sendersList);
      // Initialize categorized with empty decisions
      const init = {};
      sendersList.forEach(s => {
        init[s.email] = { action: null, folder: null, notes: '' };
      });
      setCategorized(init);
      // Be honest about the scan window: every count shown is exact (each is
      // verified against Gmail), but senders whose only emails are older than
      // the scanned window won't appear at all.
      setScanNotice(
        truncated
          ? `Counts are exact, but this scan covered only the most recent ${scannedCount.toLocaleString()} inbox emails. If your inbox has more than that, a few senders with only older emails may be missing — you can rescan later.`
          : null
      );
      setStage('categorize');
      onStageChange?.('categorize');
    } catch (err) {
      console.error('Failed to load senders:', err);
      alert('Error scanning Gmail: ' + err.message);
    } finally {
      clearInterval(statusInterval);
      setLoading(false);
      setScanProgress(null);
    }
  };

  const updateSenderDecision = (email, field, value) => {
    setCategorized(prev => ({
      ...prev,
      [email]: { ...prev[email], [field]: value }
    }));
  };

  const proceedToReview = () => {
    const hasAnyDecision = senders.some(s => categorized[s.email]?.action);
    if (!hasAnyDecision) {
      alert('Please select at least one action before proceeding.');
      return;
    }
    setStage('review');
    onStageChange?.('review');
  };

  const commitPlan = async () => {
    console.log('commitPlan called');
    setLoading(true);

    try {
      // Only process senders with selected actions (batch processing)
      const decidedSenders = senders.filter(s => categorized[s.email]?.action);
      console.log('Decided senders:', decidedSenders.length);

      const keep = decidedSenders.filter(s => categorized[s.email]?.action === 'keep');
      const route = decidedSenders.filter(s => categorized[s.email]?.action === 'route');
      const deleteBlock = decidedSenders.filter(s => categorized[s.email]?.action === 'deleteBlock');
      const deleteNoBlock = decidedSenders.filter(s => categorized[s.email]?.action === 'deleteNoBlock');

      console.log('Creating plans...', { keep: keep.length, route: route.length, deleteBlock: deleteBlock.length, deleteNoBlock: deleteNoBlock.length });

      // Track the plans created in THIS batch so we only execute those —
      // never re-run older plans for the same sender. Each entry carries its
      // action so the success feedback can report real email counts per type.
      const createdPlans = [];

      // Helper function with timeout
      const fetchWithTimeout = (url, options = {}, timeout = 30000) => {
        return Promise.race([
          fetch(url, options),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Request timeout')), timeout))
        ]);
      };

      // Create plans for each action type
      for (const sender of route) {
        console.log('Creating route plan for', sender.email);
        const res = await fetchWithTimeout(`${API_URL}/api/plans`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `Route ${sender.email}`,
            sender: sender.email,
            action: 'folder',
            folderName: categorized[sender.email].folder,
          }),
        });
        if (!res.ok) throw new Error(`Failed to create route plan: ${res.status}`);
        const createdPlan = await res.json();
        if (createdPlan?.id) createdPlans.push({ id: createdPlan.id, action: 'folder' });
      }

      for (const sender of deleteBlock) {
        console.log('Creating delete+block plan for', sender.email);
        const res = await fetchWithTimeout(`${API_URL}/api/plans`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `Delete + Block ${sender.email}`,
            sender: sender.email,
            action: 'delete',
          }),
        });
        if (!res.ok) throw new Error(`Failed to create delete plan: ${res.status}`);
        const createdPlan = await res.json();
        if (createdPlan?.id) createdPlans.push({ id: createdPlan.id, action: 'delete' });
      }

      for (const sender of deleteNoBlock) {
        console.log('Creating archive plan for', sender.email);
        const res = await fetchWithTimeout(`${API_URL}/api/plans`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `Archive ${sender.email}`,
            sender: sender.email,
            action: 'archive',
          }),
        });
        if (!res.ok) throw new Error(`Failed to create archive plan: ${res.status}`);
        const createdPlan = await res.json();
        if (createdPlan?.id) createdPlans.push({ id: createdPlan.id, action: 'archive' });
      }

      console.log('Executing plans...');
      console.log('Total plans to execute:', createdPlans.length);

      // Fire the execute requests (the backend runs them in the background,
      // one at a time).
      for (const p of createdPlans) {
        console.log('Executing plan', p.id);
        const execRes = await fetchWithTimeout(`${API_URL}/api/plans/${p.id}/execute`, { method: 'POST' }, 60000);
        if (!execRes.ok) throw new Error(`Failed to execute plan ${p.id}: ${execRes.status}`);
        console.log('Plan execution started', p.id);
      }

      // Wait for the background jobs to actually finish so the feedback
      // reflects what really happened instead of guessing.
      const finished = [];
      const pending = [...createdPlans];
      const deadline = Date.now() + 180000; // up to 3 minutes for large batches
      while (pending.length > 0 && Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 1500));
        try {
          const res = await fetch(`${API_URL}/api/plans`);
          const allPlans = await res.json();
          for (const p of [...pending]) {
            const plan = allPlans.find(x => x.id === p.id);
            const lastExec = plan?.executions?.[plan.executions.length - 1];
            if (lastExec && lastExec.status !== 'running') {
              finished.push({
                planId: p.id,
                action: p.action,
                status: lastExec.status,
                error: lastExec.error,
                gmailCount: lastExec.gmailCount || 0,
              });
              pending.splice(pending.indexOf(p), 1);
            }
          }
        } catch (err) {
          // transient network error — retry on the next poll
        }
      }

      // Anything still pending when the deadline hit counts as a failure so
      // we never claim success for work that didn't finish.
      pending.forEach(p => finished.push({
        planId: p.id,
        action: p.action,
        status: 'error',
        error: 'Timed out while waiting — check the History screen.',
        gmailCount: 0,
      }));

      const failedRuns = finished.filter(r => r.status !== 'success');
      const succeededRuns = finished.filter(r => r.status === 'success');

      if (failedRuns.length > 0) {
        // Honest feedback: something failed, so this is NOT a success.
        const actionLabel = { folder: 'Routed', delete: 'Delete + Block', archive: 'Archived' };
        const details = failedRuns.slice(0, 5).map(r =>
          `${actionLabel[r.action] || r.action} failed: ${r.error || 'unknown error'}`
        );
        setSuccessMessage({
          type: 'error',
          failedCount: failedRuns.length,
          totalCount: createdPlans.length,
          details,
        });
        setShowSuccessModal(true);
      } else {
        // Sum the actual emails Gmail reported as processed, per action type.
        const emailCounts = { folder: 0, delete: 0, archive: 0 };
        succeededRuns.forEach(r => { emailCounts[r.action] += r.gmailCount; });
        setSuccessMessage({
          type: 'success',
          kept: keep.length,
          routed: route.length,
          routedEmails: emailCounts.folder,
          deletedBlocked: deleteBlock.length,
          deletedBlockedEmails: emailCounts.delete,
          deletedNoBlock: deleteNoBlock.length,
          deletedNoBlockEmails: emailCounts.archive,
        });
        setShowSuccessModal(true);
      }

      // Clear only the processed senders' decisions
      const newCategorized = { ...categorized };
      decidedSenders.forEach(s => {
        delete newCategorized[s.email];
      });
      setCategorized(newCategorized);

      setStage('categorize');
      onStageChange?.('categorize');
    } catch (err) {
      console.error('Error executing plan:', err);
      alert('Error executing plan: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Compute review section data
  const keep = senders.filter(s => categorized[s.email]?.action === 'keep');
  const route = senders.filter(s => categorized[s.email]?.action === 'route');
  const deleteBlock = senders.filter(s => categorized[s.email]?.action === 'deleteBlock');
  const deleteNoBlock = senders.filter(s => categorized[s.email]?.action === 'deleteNoBlock');
  const review = senders.filter(s => categorized[s.email]?.action === 'review');

  return (
    <div className="dashboard">
      {/* Success Banner */}
      {successMessage?.type === 'success' && (
        <div className="success-banner">
          <div className="success-banner-content">
            <span className="success-icon">✓</span>
            <div>
              <strong>Batch executed successfully!</strong>
              <p>Kept: {successMessage.kept} | Routed: {successMessage.routedEmails} | Deleted + Blocked: {successMessage.deletedBlockedEmails} | Archived: {successMessage.deletedNoBlockEmails}</p>
            </div>
          </div>
          <button className="close-banner" onClick={() => setSuccessMessage(null)}>×</button>
        </div>
      )}

      {/* Error Banner */}
      {successMessage?.type === 'error' && (
        <div className="error-banner">
          <div className="success-banner-content">
            <span className="success-icon error-icon">⚠</span>
            <div>
              <strong>{successMessage.failedCount} of {successMessage.totalCount} action(s) failed</strong>
              {successMessage.details.map((d, i) => <p key={i}>{d}</p>)}
            </div>
          </div>
          <button className="close-banner" onClick={() => setSuccessMessage(null)}>×</button>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && successMessage?.type === 'success' && (
        <div className="modal-overlay">
          <div className="modal success-modal">
            <h3>✓ Batch Executed Successfully!</h3>
            <div className="success-details">
              <div className="success-item">
                <span className="success-label">Kept:</span>
                <span className="success-count">{successMessage.kept} sender(s)</span>
              </div>
              <div className="success-item">
                <span className="success-label">Routed to Folder:</span>
                <span className="success-count">{successMessage.routedEmails} emails</span>
              </div>
              <div className="success-item">
                <span className="success-label">Deleted + Blocked:</span>
                <span className="success-count">{successMessage.deletedBlockedEmails} emails</span>
              </div>
              <div className="success-item">
                <span className="success-label">Archived:</span>
                <span className="success-count">{successMessage.deletedNoBlockEmails} emails</span>
              </div>
            </div>
            <p className="success-note">Continue with more senders or review your actions.</p>
            <div className="modal-buttons">
              <button
                className="primary-btn"
                onClick={() => setShowSuccessModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Modal */}
      {showSuccessModal && successMessage?.type === 'error' && (
        <div className="modal-overlay">
          <div className="modal success-modal">
            <h3 className="error-heading">⚠ Some actions failed</h3>
            <div className="success-details error-details">
              <p className="error-summary">
                {successMessage.failedCount} of {successMessage.totalCount} action(s) did not
                complete successfully. Those senders were not fully processed.
              </p>
              <ul className="error-list">
                {successMessage.details.map((d, i) => <li key={i}>{d}</li>)}
              </ul>
              <p className="error-note">Full details are in the History screen.</p>
            </div>
            <div className="modal-buttons">
              <button
                className="primary-btn"
                onClick={() => setShowSuccessModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Start Stage */}
      {stage === 'start' && (
        <div className="stage-container">
          <h2>Email Cleanup Organizer</h2>
          <p>Analyze your Gmail inbox and create a customized cleanup plan.</p>
          {loading ? (
            <div className="scan-progress">
              {scanProgress && scanProgress.total > 0 ? (
                <>
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${Math.min(100, (scanProgress.fetched / scanProgress.total) * 100)}%` }}
                    />
                  </div>
                  <p>Scanning {scanProgress.fetched.toLocaleString()} of {scanProgress.total.toLocaleString()} emails…</p>
                </>
              ) : (
                <p>Connecting to Gmail…</p>
              )}
            </div>
          ) : (
            <button className="primary-btn" onClick={analyzeSenders}>
              🔍 Scan & Analyze
            </button>
          )}
        </div>
      )}

      {/* Categorize Stage */}
      {stage === 'categorize' && (
        <>
          <h2>Step 1: Categorize Senders</h2>
          <p>For each sender, decide what to do:</p>
          {scanNotice && (
            <div className="scan-notice" role="status">
              ⓘ {scanNotice}
            </div>
          )}
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
                    <td className="sender-email">
                      <a
                        href={getGmailSearchUrl(sender.email)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open all emails from this sender in Gmail"
                      >
                        {sender.email}
                      </a>
                    </td>
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
                      {categorized[sender.email]?.action === 'route' ? (
                        <div className="folder-selector">
                          <select
                            value={categorized[sender.email]?.folder || ''}
                            onChange={(e) => {
                              if (e.target.value === '__create_new__') {
                                const suggested = getSuggestedFolder(sender.email);
                                setNewLabelModal({ sender: sender.email, suggested });
                              } else {
                                updateSenderDecision(sender.email, 'folder', e.target.value);
                              }
                            }}
                          >
                            <option value="">Select folder...</option>
                            {labels.map(label => (
                              <option key={label.id} value={label.name}>
                                {label.name}
                              </option>
                            ))}
                            <option value="__create_new__">+ Create new folder</option>
                          </select>
                        </div>
                      ) : (
                        <span className="disabled-text">—</span>
                      )}
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

          {newLabelModal && (
            <div className="modal-overlay">
              <div className="modal">
                <h3>Create New Folder</h3>
                <p>For: {newLabelModal.sender}</p>
                <input
                  type="text"
                  id="new-label-input"
                  placeholder="Folder name"
                  defaultValue={newLabelModal.suggested}
                  autoFocus
                />
                <div className="modal-buttons">
                  <button
                    className="secondary-btn"
                    onClick={() => setNewLabelModal(null)}
                  >
                    Cancel
                  </button>
                  <button
                    className="primary-btn"
                    onClick={() => {
                      const input = document.getElementById('new-label-input');
                      const folderName = input.value.trim();
                      if (folderName) {
                        updateSenderDecision(newLabelModal.sender, 'folder', folderName);
                        setLabels([...labels, { id: folderName, name: folderName }]);
                        setNewLabelModal(null);
                      }
                    }}
                  >
                    Create
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="button-group">
            <button className="secondary-btn" onClick={resetToStart}>← Back</button>
            <button className="primary-btn" onClick={proceedToReview}>Review Plan →</button>
          </div>
        </>
      )}

      {/* Review Stage */}
      {stage === 'review' && (
        <>
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
            <button className="secondary-btn" onClick={() => { setStage('categorize'); onStageChange?.('categorize'); }}>← Edit</button>
            <button className="commit-btn" onClick={commitPlan} disabled={loading}>
              {loading ? '⏳ Executing...' : '✓ Commit Plan'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
// Updated Sun Aug  9 18:50:42 EDT 2026
