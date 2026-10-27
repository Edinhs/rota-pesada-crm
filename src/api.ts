import type { AppState, ApiError, Opportunity } from '../shared/types';
let token = '';
export class RequestError extends Error {
  fields?: Record<string, string>;
  constructor(error: ApiError) {
    super(error.message);
    this.fields = error.fields;
  }
}
export async function request<T>(
  path: string,
  method = 'GET',
  body?: unknown,
  retrySession = true,
): Promise<T> {
  if (method !== 'GET' && !token) token = (await request<{ token: string }>('/api/session')).token;
  const response = await fetch(path, {
    method,
    headers: method === 'GET' ? {} : { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    let error: ApiError = { message: 'Não foi possível concluir. Tente novamente.' };
    try {
      error = await response.json();
    } catch {}
    if (
      response.status === 403 &&
      method !== 'GET' &&
      retrySession &&
      error.message === 'Sessão inválida. Recarregue a página.'
    ) {
      token = (await request<{ token: string }>('/api/session')).token;
      return request<T>(path, method, body, false);
    }
    throw new RequestError(error);
  }
  return response.json();
}
export const loadState = () => request<AppState>('/api/state');
export const money = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
export const moneyInput = (cents: number) =>
  `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, '0')}`;
export function valorComercial(state: AppState, opportunity: Opportunity): number {
  const order = state.orders.find((order) => order.opportunityId === opportunity.id);
  if (order) return order.totalCents;
  const quote = state.quotes
    .filter((quote) => quote.opportunityId === opportunity.id && quote.status !== 'superseded')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.revision - a.revision)[0];
  return quote?.totalCents ?? opportunity.estimatedValueCents;
}
export function parseMoney(value: string) {
  const raw = value.trim().replace(/^R\$\s?/, '');
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{0,2})?$/.test(raw))
    throw new Error('Informe valores em reais, por exemplo 1.250,90.');
  const clean = raw.replace(/\./g, '');
  const [whole, decimal = ''] = clean.split(',');
  const cents = Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents)) throw new Error('Valor muito alto.');
  return cents;
}
export const date = (value: string | null, withTime = false) =>
  value
    ? new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        dateStyle: 'short',
        ...(withTime ? { timeStyle: 'short' as const } : {}),
      }).format(new Date(value.length === 10 ? `${value}T12:00:00-03:00` : value))
    : '—';
export function saoPauloDay(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const part = (name: string) => parts.find((p) => p.type === name)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function localDateInput(value: string | null) {
  if (!value) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(value));
  const part = (name: string) => parts.find((p) => p.type === name)?.value;
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
}
export async function download(path: string, name: string) {
  const response = await fetch(path);
  if (!response.ok) throw new Error('Não foi possível baixar o arquivo.');
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
