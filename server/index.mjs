import { readConfig, chatConfigured } from './config.mjs';
import { createStore } from './store.mjs';
import { createAgent } from './agent.mjs';
import { createApp } from './app.mjs';
import { createGeminiAgent } from './gemini.mjs';
import { createAuth } from './auth.mjs';

try {
  const config = readConfig();
  const store = createStore(config);
  const agent = config.chatProvider === 'gemini' ? createGeminiAgent(config, store) : createAgent(config);
  const server = createApp({ config, store, agent, auth: createAuth(config, store), scope: async user => {
    const memberStore = await store.registeredAccount(user.id);
    const memberConfig = { ...config, userId: user.id };
    return { store: memberStore, agent: config.chatProvider === 'gemini' ? createGeminiAgent(memberConfig, memberStore) : createAgent(memberConfig) };
  } });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.listen(config.port, config.host, () => {
    console.log(`StreamSphere API listening at http://${config.host}:${config.port}`);
    if (!chatConfigured(config)) console.warn(`Support chat configuration is incomplete for ${config.chatProvider}. Account APIs work; chat will show a setup error.`);
    else console.log(`Support chat provider: ${config.chatProvider}${config.chatProvider === 'gemini' ? ` (${config.geminiModel})` : ''}`);
  });
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
