import React from 'react';
import './ExecutionLog.css';

export default function ExecutionLog({ plans }) {
  const executedPlans = plans.filter(p => p.executions && p.executions.length > 0);

  return (
    <div className="execution-log">
      <h2>Execution History</h2>
      {executedPlans.length === 0 ? (
        <div className="empty-state">
          <p>No executions yet.</p>
        </div>
      ) : (
        <div className="history-list">
          {executedPlans.map((plan) =>
            plan.executions.map((exec, idx) => (
              <div key={`${plan.id}-${idx}`} className="history-item">
                <div className="history-header">
                  <h3>{plan.name}</h3>
                  <span className={`status ${exec.status}`}>
                    {exec.status}
                  </span>
                </div>
                <p className="history-details">
                  {new Date(exec.timestamp).toLocaleString()}
                </p>
                <p className="history-summary">
                  {exec.gmailCount} emails deleted from Gmail
                  {exec.obsidianCount > 0 && `, ${exec.obsidianCount} from Obsidian`}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
