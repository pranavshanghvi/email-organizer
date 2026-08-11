const express = require('express');
const path = require('path');
const fs = require('fs');
const gmailApi = require('../shared/gmail-api');
const obsidianApi = require('../shared/obsidian-api');

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

const PLANS_DIR = path.join(process.env.HOME, '.email-organizer', 'plans');
if (!fs.existsSync(PLANS_DIR)) {
  fs.mkdirSync(PLANS_DIR, { recursive: true });
}

function getPlanPath(id) {
  return path.join(PLANS_DIR, `${id}.json`);
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Live progress for the current Gmail scan, polled by the frontend.
let scanStatus = { status: 'idle', fetched: 0, total: 0, error: null };

// Run background plan executions one at a time. Firing them concurrently made
// several Gmail API calls at once and tripped Gmail's per-user rate limit
// ("Quota exceeded ... Units per minute per user"), silently failing batches.
let executionChain = Promise.resolve();
function enqueueExecution(fn) {
  executionChain = executionChain.then(fn).catch(() => {});
  return executionChain;
}

app.get('/api/senders', async (req, res) => {
  try {
    console.log('Loading senders...');
    scanStatus = { status: 'running', fetched: 0, total: 0, error: null };
    const { senders, truncated } = await gmailApi.listAllSenders((progress) => {
      scanStatus = { ...scanStatus, ...progress };
    });
    scanStatus = {
      status: 'done',
      fetched: scanStatus.fetched || 0,
      total: scanStatus.total || 0,
      error: null,
      truncated,
    };
    console.log('Loaded', (senders || []).length, 'unique senders' + (truncated ? ' (scan capped — inbox larger than scan window)' : ''));
    res.json({
      senders: senders || [],
      truncated: !!truncated,
      scannedCount: scanStatus.total || 0,
    });
  } catch (err) {
    scanStatus = {
      status: 'error',
      fetched: scanStatus.fetched || 0,
      total: scanStatus.total || 0,
      error: err.message,
    };
    console.error('Failed to load senders:', err.message, err.stack);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/senders/status', (req, res) => {
  res.json(scanStatus);
});

app.get('/api/labels', async (req, res) => {
  try {
    console.log('Loading Gmail labels...');
    const labels = await gmailApi.listLabels();
    console.log('Loaded', labels.length, 'labels');
    res.json(labels || []);
  } catch (err) {
    console.error('Failed to load labels:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/plans', (req, res) => {
  try {
    const files = fs.readdirSync(PLANS_DIR);
    const plans = files
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const content = fs.readFileSync(path.join(PLANS_DIR, f), 'utf8');
        return JSON.parse(content);
      })
      .sort((a, b) => new Date(b.created) - new Date(a.created));
    res.json(plans);
  } catch (err) {
    console.error('Failed to load plans:', err);
    res.json([]);
  }
});

app.post('/api/plans', (req, res) => {
  try {
    const { name, sender, action, folderName } = req.body;
    const id = generateId();
    const plan = {
      id,
      name,
      sender,
      action,
      folderName,
      created: new Date().toISOString(),
      executions: [],
    };
    fs.writeFileSync(getPlanPath(id), JSON.stringify(plan, null, 2));
    res.json(plan);
  } catch (err) {
    console.error('Failed to create plan:', err);
    res.status(500).json({ error: err.message });
  }
});

// The actual Gmail work for one plan. Reads the sender's inbox emails and
// applies the plan's action, then records the outcome in the plan file.
async function runPlanExecution(planPath, plan, execution) {
  try {
    console.log(`Executing plan ${plan.id} for sender ${plan.sender} (${plan.action})`);
    const emails = await gmailApi.listEmailsFromSender(plan.sender);
    const emailIds = emails.map(e => e.id);
    console.log(`Found ${emailIds.length} emails from ${plan.sender}`);

    if (plan.action === 'delete') {
      console.log(`Trashing ${emailIds.length} emails...`);
      await gmailApi.trashEmails(emailIds);
      execution.gmailCount = emailIds.length;

      // "Block" future emails from this sender by auto-trashing them.
      await gmailApi.createFilter(plan.sender, { addLabelIds: ['TRASH'] });

      // Obsidian cleanup is optional — a missing vault must not fail the run.
      try {
        const obsidianFiles = obsidianApi.listEmailFilesFromSender(plan.sender);
        const filePaths = obsidianFiles.map(f => f.path);
        execution.obsidianCount = obsidianApi.deleteObsidianFiles(filePaths);
      } catch (obsErr) {
        console.log(`Obsidian cleanup skipped for ${plan.sender}: ${obsErr.message}`);
      }
    } else if (plan.action === 'folder') {
      console.log(`Moving ${emailIds.length} emails to folder ${plan.folderName}...`);
      const labelId = await gmailApi.createLabel(plan.folderName);
      await gmailApi.moveEmailsToLabel(emailIds, labelId);
      await gmailApi.createFilter(plan.sender, { addLabelIds: [labelId] });
      execution.gmailCount = emailIds.length;
    } else if (plan.action === 'archive') {
      console.log(`Archiving ${emailIds.length} emails...`);
      await gmailApi.archiveEmails(emailIds);
      // Auto-archive future emails by removing them from the INBOX.
      await gmailApi.createFilter(plan.sender, { removeLabelIds: ['INBOX'] });
      execution.gmailCount = emailIds.length;
    }

    execution.status = 'success';
    console.log(`Plan ${plan.id} execution completed successfully`);
    plan.executions.push(execution);
    plan.lastExecuted = execution.timestamp;
    fs.writeFileSync(planPath, JSON.stringify(plan, null, 2));
  } catch (backgroundErr) {
    console.error(`Plan ${plan.id} execution failed:`, backgroundErr);
    execution.status = 'error';
    execution.error = backgroundErr.message;
    plan.executions.push(execution);
    fs.writeFileSync(planPath, JSON.stringify(plan, null, 2));
  }
}

app.post('/api/plans/:id/execute', async (req, res) => {
  try {
    const planPath = getPlanPath(req.params.id);
    if (!fs.existsSync(planPath)) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
    const execution = {
      timestamp: new Date().toISOString(),
      status: 'running',
      gmailCount: 0,
      obsidianCount: 0,
    };

    // Return immediately, process in background
    res.json({ status: 'executing', message: 'Plan execution started' });

    // Process in background without blocking response, one plan at a time so
    // concurrent batches don't exceed Gmail's per-user rate limit.
    enqueueExecution(() => runPlanExecution(planPath, plan, execution));
  } catch (err) {
    console.error('Failed to start plan execution:', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Email Organizer API running on http://localhost:${PORT}`);
});
