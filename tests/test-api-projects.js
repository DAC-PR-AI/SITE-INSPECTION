const fs = require('fs');

// Load environment variables from .env.local
const envContent = fs.readFileSync('.env.local', 'utf-8');
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  const rawVal = trimmed.slice(eqIdx + 1).trim();
  process.env[key] = rawVal.startsWith('"') && rawVal.endsWith('"') ? rawVal.slice(1, -1) : rawVal;
}

async function test() {
  console.log('Testing getProjects from lib/store...');
  const store = require('../lib/store.js');
  try {
    const projects = await store.getProjects();
    console.log('Returned projects:', JSON.stringify(projects, null, 2));
  } catch (err) {
    console.error('ERROR in getProjects:', err);
  }
}

test();
