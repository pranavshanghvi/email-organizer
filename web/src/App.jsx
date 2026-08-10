import React, { useState, useEffect } from 'react';
import './App.css';
import Dashboard from './components/Dashboard';
import PlanBuilder from './components/PlanBuilder';
import ExecutionLog from './components/ExecutionLog';

const getApiUrl = () => {
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return 'https://web-production-d755d.up.railway.app';
  }
  return 'http://localhost:3001';
};

const API_URL = getApiUrl();

export default function App() {
  const [view, setView] = useState('dashboard'); // dashboard, builder, history
  const [plans, setPlans] = useState([]);
  const [dashboardStage, setDashboardStage] = useState('start');
  const [triggerReview, setTriggerReview] = useState(false);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = () => {
    fetch(`${API_URL}/api/plans`)
      .then(r => r.json())
      .then(data => setPlans(data))
      .catch(err => console.error('Failed to load plans:', err));
  };

  const createPlan = (plan) => {
    fetch(`${API_URL}/api/plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(plan),
    })
      .then(r => r.json())
      .then(() => {
        loadPlans();
        setView('dashboard');
      })
      .catch(err => console.error('Failed to create plan:', err));
  };

  const executePlan = (planId) => {
    fetch(`${API_URL}/api/plans/${planId}/execute`, { method: 'POST' })
      .then(r => r.json())
      .then(result => {
        alert('Plan executed! Check the history for details.');
        loadPlans();
      })
      .catch(err => console.error('Failed to execute plan:', err));
  };

  return (
    <div className="app">
      <nav className="navbar">
        <h1>📧 Email Organizer</h1>
        <div className="nav-buttons">
          <button
            className={view === 'dashboard' ? 'active' : ''}
            onClick={() => setView('dashboard')}
          >
            Dashboard
          </button>
          {dashboardStage === 'categorize' ? (
            <button
              className="review-nav-btn"
              onClick={() => setTriggerReview(true)}
              title="Go to review"
            >
              ✓ Review
            </button>
          ) : null}
          <button
            className={view === 'builder' ? 'active' : ''}
            onClick={() => setView('builder')}
          >
            New Plan
          </button>
          <button
            className={view === 'history' ? 'active' : ''}
            onClick={() => setView('history')}
          >
            History
          </button>
        </div>
      </nav>

      <main className="main-content">
        {view === 'dashboard' && (
          <Dashboard
            plans={plans}
            onExecute={executePlan}
            onStageChange={setDashboardStage}
            triggerReview={triggerReview}
            onReviewTriggered={() => setTriggerReview(false)}
          />
        )}
        {view === 'builder' && (
          <PlanBuilder onCreate={createPlan} />
        )}
        {view === 'history' && (
          <ExecutionLog plans={plans} />
        )}
      </main>
    </div>
  );
}
