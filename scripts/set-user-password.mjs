import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { readConfig } from '../server/config.mjs';
import { createStore } from '../server/store.mjs';
import { hashPassword } from '../server/passwords.mjs';

// Operator-only password setup/reset. Do not pass passwords in command arguments.
if (!process.stdin.isTTY || !process.stdout.isTTY) {
  console.error('Run npm run user:password in an interactive terminal.');
  process.exit(1);
}
let muted = false;
const output = new Writable({ write(chunk, encoding, callback) {
  if (!muted) process.stdout.write(chunk, encoding);
  callback();
} });
output.isTTY = true;
output.columns = process.stdout.columns;
const input = createInterface({ input: process.stdin, output, terminal: true });
async function passwordPrompt(label) {
  process.stdout.write(label);
  muted = true;
  try { return await input.question(''); }
  finally { muted = false; process.stdout.write('\n'); }
}
try {
  const store = createStore(readConfig());
  const enteredEmail = (await input.question('Account email (Enter to keep the current demo user): ')).trim().toLowerCase();
  const email = enteredEmail || (await store.account()).email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
  const user = await store.userByEmail(email);
  if (!user) throw new Error('This account has no login yet. Run supabase/005_normal_authentication.sql, then try again.');
  console.log(`Setting the login password for ${user.name} (${email}). Membership and wallet will be preserved.`);
  const password = await passwordPrompt('New password (hidden): ');
  const confirmation = await passwordPrompt('Confirm password (hidden): ');
  if (password.length < 8 || password.length > 128) throw new Error('Password must contain 8–128 characters.');
  if (password !== confirmation) throw new Error('Passwords do not match.');
  await store.setUserPassword(email, await hashPassword(password));
  console.log('Password saved. Previous sessions have been revoked. You can now sign in.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally { muted = false; input.close(); }
