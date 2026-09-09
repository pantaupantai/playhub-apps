const fs = require('fs');
const path = require('path');
const pool = require('./db');

async function importBackup() {
  const backupPath = path.join(__dirname, 'backend/storage/app/private/backups/pos-billing-backup-20260609-172224.sql');
  if (!fs.existsSync(backupPath)) {
    console.log('No backup file found at', backupPath);
    return;
  }
  const content = fs.readFileSync(backupPath, 'utf8');
  const lines = content.split('\n');
  
  await pool.query('SET FOREIGN_KEY_CHECKS=0');
  
  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith('--')) continue;
    if (line.endsWith(';')) {
      try {
        await pool.query(line);
      } catch (e) {
        console.error('Error on line:', line, e.message);
      }
    }
  }
  
  await pool.query('SET FOREIGN_KEY_CHECKS=1');
  console.log('Backup imported successfully into MySQL.');
}

importBackup()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
