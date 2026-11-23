// StoreHub's REST API (api.storehubhq.com): Basic auth with the account's subdomain and its API
// token. StoreHub may rate-limit past about 3 calls a second, so callers pace themselves.
import type {StorehubTransaction} from './sale';

const API = 'https://api.storehubhq.com';

export function storehubClient({username, token}: {username: string; token: string}) {
  if (!token) throw new Error('StoreHub needs STOREHUB_API_TOKEN');
  const authorization = `Basic ${btoa(`${username}:${token}`)}`;

  async function post(path: string, body: unknown): Promise<void> {
    const response = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: {Authorization: authorization, 'Content-Type': 'application/json', Accept: 'application/json'},
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`StoreHub ${path} failed (${response.status}): ${(await response.text()).slice(0, 500)}`);
  }

  return {
    /** Records a sale; a repeat with the same refId is ignored by StoreHub. */
    recordSale: (transaction: StorehubTransaction) => post('/transactions', transaction),
    /** Cancels a recorded sale, for a refund. */
    cancelSale: (refId: string, at: Date) => post(`/transactions/${encodeURIComponent(refId)}/cancel`, {cancelledTime: at.toISOString()}),
  };
}
