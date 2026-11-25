// Checks a Lalamove key before delivery goes live: which Malaysian cities and services the key
// can book, and, given the shop's pin, a sample price for a ride 3 km north of it. Read-only:
// it places no order. The key's prefix picks the host (pk_test: sandbox, pk_prod: production).
//
//   LALAMOVE_API_KEY=pk_test_… LALAMOVE_API_SECRET=sk_test_… node scripts/lalamove-check.mjs [lat,lng]
import {createHmac, randomUUID} from 'node:crypto';

const key = process.env.LALAMOVE_API_KEY ?? '';
const secret = process.env.LALAMOVE_API_SECRET ?? '';
if (!key || !secret) {
  console.error('Set LALAMOVE_API_KEY and LALAMOVE_API_SECRET.');
  process.exit(2);
}
const host = key.startsWith('pk_prod') ? 'https://rest.lalamove.com' : 'https://rest.sandbox.lalamove.com';

async function call(method, path, body) {
  const text = body === undefined ? '' : JSON.stringify(body);
  const timestamp = String(Date.now());
  const signature = createHmac('sha256', secret).update(`${timestamp}\r\n${method}\r\n${path}\r\n\r\n${text}`).digest('hex');
  const requestId = randomUUID();
  const response = await fetch(host + path, {
    method,
    headers: {Authorization: `hmac ${key}:${timestamp}:${signature}`, Market: 'MY', 'Request-ID': requestId, 'Content-Type': 'application/json'},
    body: text || undefined,
  });
  const reply = await response.text();
  // What Lalamove's support asks for when a call fails: our Request-ID and their gateway's ray id.
  const trace = `Request-ID ${requestId}, waf-ray-id ${response.headers.get('waf-ray-id') ?? 'none'}, ${new Date().toISOString()}`;
  return {status: response.status, body: reply ? JSON.parse(reply) : null, trace};
}

console.log(`Host: ${host}`);
const cities = await call('GET', '/v3/cities');
if (cities.status !== 200) {
  console.error(`GET /v3/cities answered ${cities.status}:`, JSON.stringify(cities.body));
  console.error(cities.trace);
  process.exit(1);
}
for (const city of cities.body.data ?? []) {
  console.log(`\n${city.name} (${city.locode})`);
  for (const service of city.services ?? []) console.log(`  ${service.key.padEnd(20)} ${service.description ?? ''} load ${service.load?.value ?? '?'} ${service.load?.unit ?? ''}`);
}

const pin = process.argv[2];
if (pin) {
  const [lat, lng] = pin.split(',').map(Number);
  const stops = [
    {coordinates: {lat: String(lat), lng: String(lng)}, address: 'Shop'},
    {coordinates: {lat: String(lat + 3 / 111.32), lng: String(lng)}, address: '3 km north of the shop'},
  ];
  const quote = await call('POST', '/v3/quotations', {data: {serviceType: 'MOTORCYCLE', language: 'en_MY', stops}});
  console.log(`\nMOTORCYCLE, 3 km north: ${quote.status}`, JSON.stringify(quote.body?.data?.priceBreakdown ?? quote.body));
  if (quote.status !== 201 && quote.status !== 200) console.error(quote.trace);
}
