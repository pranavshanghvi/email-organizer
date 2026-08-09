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

app.get('/api/senders', async (req, res) => {
  try {
    console.log('Loading senders...');
    const senders = await gmailApi.listAllSenders();
    console.log('Loaded', senders.length, 'unique senders');
    res.json(senders || []);
  } catch (err) {
    console.error('Failed to load senders:', err.message, err.stack);
    res.status(500).json({ error: err.message });
  }
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

    const emails = await gmailApi.listEmailsFromSender(plan.sender);
    const emailIds = emails.map(e => e.id);

    if (plan.action === 'delete') {
      await gmailApi.trashEmails(emailIds);
      execution.gmailCount = emailIds.length;

      const obsidianFiles = obsidianApi.listEmailFilesFromSender(plan.sender);
      const filePaths = obsidianFiles.map(f => f.path);
      execution.obsidianCount = obsidianApi.deleteObsidianFiles(filePaths);
    } else if (plan.action === 'folder') {
      const labelId = await gmailApi.createLabel(plan.folderName);
      await gmailApi.moveEmailsToLabel(emailIds, labelId);
      await gmailApi.createFilter(plan.sender, labelId);
      execution.gmailCount = emailIds.length;
    } else if (plan.action === 'archive') {
      await gmailApi.createFilter(plan.sender, 'ARCHIVE');
      execution.gmailCount = emailIds.length;
    }

    execution.status = 'success';
    plan.executions.push(execution);
    plan.lastExecuted = execution.timestamp;
    fs.writeFileSync(planPath, JSON.stringify(plan, null, 2));

    res.json(execution);
  } catch (err) {
    console.error('Failed to execute plan:', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Email Organizer API running on http://localhost:${PORT}`);
});
