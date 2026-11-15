import {
  Banknote, CreditCard, Fuel, GraduationCap, HeartPulse, Home, Package, PawPrint,
  Shirt, ShoppingCart, Star, Tag, Ticket, Tv,
} from 'lucide-react';

const PALETTE = ['#2f7ae5', '#ec7fa5', '#f0a30a', '#19b27b', '#6c5ce7', '#e5484d', '#12a150', '#f2711c', '#0ea5e9', '#a855f7'];
const RULES = [
  [/moradia|casa|aluguel|condom/i, Home, '#2f7ae5'],
  [/aliment|mercado|restaur/i, ShoppingCart, '#19b27b'],
  [/combust|transporte|carro|uber/i, Fuel, '#f0a30a'],
  [/sa[úu]de|farm|m[ée]dic/i, HeartPulse, '#e5484d'],
  [/lazer|divers/i, Ticket, '#ec7fa5'],
  [/educa|curso|escola/i, GraduationCap, '#6c5ce7'],
  [/assinat|stream/i, Tv, '#12a150'],
  [/roupa|vestu/i, Shirt, '#6c5ce7'],
  [/e-?commerce|compras online/i, Package, '#e5484d'],
  [/gato|pet/i, PawPrint, '#f2711c'],
  [/uso pr[oó]prio/i, Star, '#ec7fa5'],
  [/sal[aá]rio|receita/i, Banknote, '#12a150'],
  [/fatura|cart[aã]o/i, CreditCard, '#6c5ce7'],
  [/outros|sem categoria/i, Tag, '#9aa3b2'],
];

// Ícone e cor por categoria (por palavra-chave; senão, cor estável pelo nome).
export function catStyle(name = '') {
  for (const [re, Icon, color] of RULES) if (re.test(name)) return { Icon, color };
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return { Icon: Tag, color: PALETTE[h % PALETTE.length] };
}
