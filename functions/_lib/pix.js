// Pix estático (BR Code / EMV do Banco Central). O dinheiro vai direto para a conta do titular.
const tlv = (id, value) => `${id}${String(value.length).padStart(2, '0')}${value}`;

// CRC16-CCITT (polinômio 0x1021, início 0xFFFF), exigido no final do código.
export function crc16(str) {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

// Nome e cidade: maiúsculas, sem acento e sem símbolos; titular até 25 e cidade até 15 caracteres.
export const clean = (s, max) =>
  String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);

// Aceita chave aleatória, e-mail, CPF/CNPJ (só números) ou celular com +55. Devolve a chave pronta ou null.
export function normalizeKey(raw) {
  const k = String(raw || '').trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(k)) return k.toLowerCase();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(k) && k.length <= 77 && /^[\x21-\x7e]+$/.test(k)) return k;
  if (/^\+55\d{10,11}$/.test(k)) return k;
  const digits = k.replace(/[.\-/\s]/g, '');
  if (/^(\d{11}|\d{14})$/.test(digits)) return digits;
  return null;
}

export function pixPayload({ key, name, city, amountCents }) {
  const body =
    tlv('00', '01') + tlv('01', '11') +
    tlv('26', tlv('00', 'br.gov.bcb.pix') + tlv('01', key)) +
    tlv('52', '0000') + tlv('53', '986') +
    (amountCents ? tlv('54', (amountCents / 100).toFixed(2)) : '') +
    tlv('58', 'BR') + tlv('59', clean(name, 25) || 'DOACAO') + tlv('60', clean(city, 15) || 'BRASIL') +
    tlv('62', tlv('05', '***')) + '6304';
  return body + crc16(body);
}
