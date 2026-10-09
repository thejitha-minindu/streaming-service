export interface Account {
  id: string;
  name: string;
  email: string;
  subscription_status: 'active' | 'cancelled';
  plan: 'premium';
  price_cents: number;
  wallet_cents: number;
  charged_at: string;
  billing_timezone: string;
  cancelled_at: string | null;
}
export interface Consent {
  id: string;
  action: 'cancel_and_refund' | 'cancel_subscription';
  refund_amount_cents: number;
  status: 'pending' | 'approved' | 'declined' | 'executed';
  expires_at: string;
}
export interface ChatMessage {
  id: number | string;
  role: 'user' | 'assistant';
  content: string;
  consent?: Consent | null;
}
export interface ChatResult { account: Account; message?: ChatMessage; messages?: ChatMessage[] }
export interface AuthUser { id: string; email: string; name: string }
export interface AuthResult { user: AuthUser | null }
export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json', 'X-StreamSphere-Client': 'web' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(130000),
  });
  const data = await response.json().catch(() => ({ error: 'The backend is not reachable. Start the API server and check the Vite proxy.' }));
  if (!response.ok || data.error) {
    if (response.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new Event('streamsphere-session-expired'));
    throw new ApiError(data.error || 'Request failed. Please try again.', response.status);
  }
  return data as T;
}

export const api = {
  session: () => request<AuthResult>('/auth/session'),
  signup: (name: string, email: string, password: string) => request<AuthResult>('/auth/signup', { name, email, password }),
  signin: (email: string, password: string) => request<AuthResult>('/auth/signin', { email, password }),
  signout: () => request<AuthResult>('/auth/signout', {}),
  account: () => request<{ account: Account }>('/account'),
  history: (sessionId: string) => request<{ messages: ChatMessage[] }>(`/chat?session_id=${encodeURIComponent(sessionId)}`),
  chat: (sessionId: string, message: string) => request<ChatResult>('/chat', { session_id: sessionId, message }),
  consent: (sessionId: string, consentId: string, approved: boolean) => request<ChatResult>('/chat/consent', { session_id: sessionId, consent_id: consentId, approved }),
  purchase: () => request<{ account: Account }>('/subscription/purchase', {}),
};

export function chatSession() {
  try {
    const existing = sessionStorage.getItem('streamsphere-chat-session');
    if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
    const id = crypto.randomUUID();
    sessionStorage.setItem('streamsphere-chat-session', id);
    return id;
  } catch { return crypto.randomUUID(); }
}
