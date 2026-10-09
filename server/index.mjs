import { readConfig, chatConfigured } from './config.mjs';
import { createServer } from 'node:http';
import { createBackend } from './backend.mjs';

try {
  const config = readConfig();
  const server = createServer(createBackend(config));
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
