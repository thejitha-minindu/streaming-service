import { createHandler } from './app.mjs';
import { createStore } from './store.mjs';
import { createAgent } from './agent.mjs';
import { createGeminiAgent } from './gemini.mjs';
import { createAuth } from './auth.mjs';

// Shared initialization for the local HTTP server and hosted function.
export function createBackend(config) {
  const store = createStore(config);
  const agentFor = (memberConfig, memberStore) => memberConfig.chatProvider === 'gemini'
    ? createGeminiAgent(memberConfig, memberStore) : createAgent(memberConfig);
  return createHandler({ config, store, agent: agentFor(config, store), auth: createAuth(config, store), scope: async user => {
    const memberStore = await store.registeredAccount(user.id);
    return { store: memberStore, agent: agentFor({ ...config, userId: user.id }, memberStore) };
  } });
}
