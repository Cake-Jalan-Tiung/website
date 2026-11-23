// StoreHub's REST API (api.storehubhq.com): Basic auth with the account's subdomain and its API
// token. StoreHub may rate-limit past about 3 calls a second, so callers pace themselves.
import type {StorehubTransaction} from './sale';

const API = 'https://api.storehubhq.com';
/** A cron run must not hang on one call; StoreHub answers in well under a second when it is up. */
const TIMEOUT_MS = 15_000;

/** A call StoreHub refused or did not answer. `status` is null when no answer came at all. */
export class StorehubError extends Error {
  constructor(readonly status: number | null, message: string) {
    super(message);
    this.name = 'StorehubError';
  }

  /**
   * StoreHub understood the call and said no to this one sale, so other sales can still go through.
   * A wrong token (401, 403), a rate limit (429) or a timeout (408) would fail every call alike.
   */
  get refusedThisSale() {
    return this.status !== null && this.status >= 400 && this.status < 500 && ![401, 403, 408, 429].includes(this.status);
  }
}

// Seen live on 23 Nov 2026 with a labelled test sale: a repeat of a recorded refId answers 200
// and adds nothing, a repeat cancel answers 200, and a cancel of a refId StoreHub never had
// answers 404 with code ResourceNotFound.
export type StorehubClient = {
  /** Records a sale; a repeat with the same refId changes nothing. */
  recordSale(transaction: StorehubTransaction): Promise<void>;
  /** Cancels a sale, for a refund. A sale StoreHub never had counts as cancelled: there is nothing in its totals to take back. */
  cancelSale(refId: string, at: Date): Promise<void>;
};

/** StoreHub's own "no such thing" answer, as opposed to a 404 from a wrong path or a proxy. */
function notFound(text: string) {
  try {
    const body: unknown = JSON.parse(text);
    return typeof body === 'object' && body !== null && 'code' in body && body.code === 'ResourceNotFound';
  } catch {
    return false;
  }
}

export function storehubClient({username, token}: {username: string; token: string}): StorehubClient {
  const authorization = `Basic ${btoa(`${username}:${token}`)}`;

  /** Answers whether StoreHub said the resource does not exist; any other failure throws. */
  async function post(path: string, body: unknown): Promise<'done' | 'not-found'> {
    if (!token) throw new StorehubError(401, 'STOREHUB_API_TOKEN is not set on the Worker');
    let response: Response;
    try {
      response = await fetch(`${API}${path}`, {
        method: 'POST',
        headers: {Authorization: authorization, 'Content-Type': 'application/json', Accept: 'application/json'},
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      throw new StorehubError(null, `StoreHub ${path} did not answer: ${String(error)}`);
    }
    if (response.ok) return 'done';
    const text = await response.text();
    if (response.status === 404 && notFound(text)) return 'not-found';
    throw new StorehubError(response.status, `StoreHub ${path} failed (${response.status}): ${text.slice(0, 500)}`);
  }

  return {
    async recordSale(transaction) {
      if ((await post('/transactions', transaction)) === 'not-found') throw new StorehubError(404, 'StoreHub /transactions was not found');
    },
    async cancelSale(refId, at) {
      await post(`/transactions/${encodeURIComponent(refId)}/cancel`, {cancelledTime: at.toISOString()});
    },
  };
}
