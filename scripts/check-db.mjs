import { readConfig } from '../server/config.mjs';
import { createStore } from '../server/store.mjs';

try {
  const account = await createStore(readConfig()).account();
  console.log('Supabase connection OK. Demo account found.');
  console.log(`Membership: ${account.subscription_status === 'active' ? 'Paid Premium' : 'Non-paid'}`);
  console.log(`Wallet: $${(account.wallet_cents / 100).toFixed(2)}`);
} catch (error) {
  console.error(error.status ? error.message : 'Database check failed. Check configuration and network connectivity.');
  process.exitCode = 1;
}
