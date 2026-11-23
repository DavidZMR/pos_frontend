import { normalizeText } from '../../shared/utils/text';
import type { PosProduct } from './pos-models';

export interface IndexedProduct {
  product: PosProduct;
  code: string;
  barcode: string;
  name: string;
  words: string[];
}

export function indexProducts(products: readonly PosProduct[]): IndexedProduct[] {
  return products.map((product) => {
    const name = normalizeText(product.name);
    return {
      product,
      code: product.code.toUpperCase(),
      barcode: product.barcode ?? '',
      name,
      words: name.split(' '),
    };
  });
}

/**
 * Busca en el catálogo en memoria con este orden:
 * 0 código o código de barras exacto · 1 código que empieza · 2 nombre que empieza ·
 * 3 todas las palabras empiezan alguna palabra del nombre · 4 todas las palabras contenidas.
 */
export function searchCatalog(
  index: readonly IndexedProduct[],
  rawTerm: string,
  limit = 40,
): PosProduct[] {
  const term = rawTerm.trim();
  if (!term) return [];
  const upper = term.toUpperCase();
  const normalized = normalizeText(term);
  const tokens = normalized.split(' ').filter(Boolean);

  const scored: { product: PosProduct; score: number }[] = [];
  for (const item of index) {
    let score = -1;
    if (item.code === upper || (item.barcode && item.barcode === term)) score = 0;
    else if (item.code.startsWith(upper)) score = 1;
    else if (item.name.startsWith(normalized)) score = 2;
    else if (tokens.every((t) => item.words.some((w) => w.startsWith(t)))) score = 3;
    else if (tokens.every((t) => item.name.includes(t))) score = 4;
    if (score >= 0) scored.push({ product: item.product, score });
  }
  scored.sort((a, b) => a.score - b.score || a.product.name.localeCompare(b.product.name, 'es-MX'));
  return scored.slice(0, limit).map((s) => s.product);
}

/** "3*402" / "1.5 x camaron" → cantidad tecleada + término. Sin multiplicador → qty null. */
export function parseMultiplier(raw: string): { qty: string | null; term: string } {
  const match = /^\s*(\d+(?:[.,]\d+)?)\s*[*xX×]\s*(.+)$/.exec(raw);
  if (!match?.[1] || !match[2]) return { qty: null, term: raw };
  return { qty: match[1].replace(',', '.'), term: match[2] };
}
