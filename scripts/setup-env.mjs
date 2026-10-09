import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';

const envPath = new URL('../.env', import.meta.url);
let contents;
try { contents = await readFile(envPath, 'utf8'); }
catch (error) {
  if (error.code !== 'ENOENT') throw error;
  contents = await readFile(new URL('../.env.example', import.meta.url), 'utf8');
}
let values = parseEnv(contents);
if (!values.TOOL_API_KEY?.trim()) {
  const line = `TOOL_API_KEY=${randomBytes(32).toString('hex')}`;
  const pattern = /^[\t ]*TOOL_API_KEY[\t ]*=[^\r\n]*/m;
  contents = pattern.test(contents) ? contents.replace(pattern, () => line) : `${contents.trimEnd()}\n${line}\n`;
  await writeFile(envPath, contents, { mode: 0o600 });
  console.log('Generated TOOL_API_KEY in .env. Existing configuration was preserved.');
} else {
  console.log('TOOL_API_KEY is already configured; no settings were changed.');
}
values = parseEnv(contents);
const agentKeys = ['AGENT_CHAT_URL', 'AGENT_CONSENT_URL', 'AGENT_API_KEY', 'AGENT_TENANT_ID'];
const missing = agentKeys.filter(key => !values[key]?.trim());
const provider = values.CHAT_PROVIDER || (values.GEMINI_API_KEY ? 'gemini' : 'agent-platform');
if (provider === 'gemini') {
  console.log(values.GEMINI_API_KEY?.trim() ? 'Gemini chat key is configured.' : 'Chat still needs GEMINI_API_KEY.');
} else {
  if (missing.length) console.log(`Chat still needs these real Agent Platform settings: ${missing.join(', ')}`);
  console.log('Configure the same TOOL_API_KEY as the bearer credential in your Agent Platform business tools.');
}
