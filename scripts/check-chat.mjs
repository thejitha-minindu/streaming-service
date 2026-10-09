import { randomUUID } from 'node:crypto';
import { readConfig, chatConfigured } from '../server/config.mjs';
import { createStore } from '../server/store.mjs';
import { createAgent } from '../server/agent.mjs';
import { createGeminiAgent } from '../server/gemini.mjs';

try {
  const config = readConfig();
  if (!chatConfigured(config)) throw new Error(`Support chat is not configured for ${config.chatProvider}.`);
  const store = createStore(config);
  const account = await store.account();
  const agent = config.chatProvider === 'gemini' ? createGeminiAgent(config, store) : createAgent(config);
  const result = await agent.chat({ sessionId: randomUUID(), message: 'Hello. What is my current membership and wallet balance? Do not request any changes.', account });
  if (!result.reply) throw new Error('No chat reply received.');
  // No messages, confirmations, membership changes or refunds are written by this check.
  console.log(`Support chat connected successfully (${config.chatProvider}). Membership and wallet were not changed.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
