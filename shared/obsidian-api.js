const fs = require('fs');
const path = require('path');

const VAULT_PATH = path.join(process.env.HOME, 'Brain', 'conversations');

function listEmailFilesFromSender(senderEmail) {
  if (!fs.existsSync(VAULT_PATH)) {
    throw new Error(`Obsidian vault not found at ${VAULT_PATH}`);
  }

  const files = fs.readdirSync(VAULT_PATH);
  const matching = [];

  for (const file of files) {
    if (!file.startsWith('E_')) continue;

    const filePath = path.join(VAULT_PATH, file);
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      if (content.includes(senderEmail) || content.includes(`<${senderEmail}>`)) {
        matching.push({ file, path: filePath });
      }
    } catch (err) {
      // Skip unreadable files
    }
  }

  return matching;
}

function deleteObsidianFiles(filePaths) {
  let deleted = 0;

  for (const filePath of filePaths) {
    try {
      fs.unlinkSync(filePath);
      deleted++;
    } catch (err) {
      console.error(`Failed to delete ${filePath}: ${err.message}`);
    }
  }

  return deleted;
}

function getVaultStats() {
  if (!fs.existsSync(VAULT_PATH)) {
    return { exists: false, emailCount: 0 };
  }

  const files = fs.readdirSync(VAULT_PATH);
  const emailCount = files.filter(f => f.startsWith('E_')).length;

  return {
    exists: true,
    emailCount,
    totalFiles: files.length,
  };
}

module.exports = {
  listEmailFilesFromSender,
  deleteObsidianFiles,
  getVaultStats,
};
