import { createBackend } from '../server/backend.mjs';
import { readConfig } from '../server/config.mjs';

let backend;
export default async function handler(request, response) {
  try { backend ||= createBackend(readConfig()); }
  catch (error) {
    console.error('Backend configuration failed:', error.message);
    response.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify({ error: 'Backend setup is incomplete. Configure the Vercel environment variables and redeploy. See Function logs for the missing setting.' }));
    return;
  }
  // Restore the API path supplied by vercel.json while retaining its query.
  const url = new URL(request.url, 'http://localhost');
  const path = url.searchParams.get('__api_path');
  if (path !== null) {
    url.pathname = `/api/${path}`;
    url.searchParams.delete('__api_path');
    request.url = url.pathname + url.search;
  }
  return backend(request, response);
}
