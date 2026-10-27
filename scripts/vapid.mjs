// Gera o par de chaves VAPID das notificações push. Rode uma vez: node scripts/vapid.mjs
// Guarde as duas chaves como variáveis no Cloudflare Pages (VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY).
import { generateKeyPairSync } from 'node:crypto';

const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const jwk = privateKey.export({ format: 'jwk' });
const pub = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, 'base64url'), Buffer.from(jwk.y, 'base64url')]).toString('base64url');
console.log(`VAPID_PUBLIC_KEY=${pub}`);
console.log(`VAPID_PRIVATE_KEY=${jwk.d}`);
