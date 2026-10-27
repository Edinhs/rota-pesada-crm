import Fastify, { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import { z } from 'zod';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { acquireLock, backupDatabase, DB_FILENAME, openDatabase } from './storage.ts';
import { seedDemo } from './seed.ts';
import {
  STAGES,
  AVAILABILITIES,
  type Activity,
  type AppState,
  type AuditEvent,
  type Client,
  type Dashboard,
  type Opportunity,
  type Order,
  type Product,
  type Quote,
  type QuoteItem,
  type Settings,
} from '../shared/types.ts';

const text = z.string().trim().max(10000),
  short = z.string().trim().max(300);
const cents = z.number().int().min(0).max(1_000_000_000);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
    'Data inválida',
  );
const instant = z.string().datetime({ offset: true });
const baseContact = z.object({
  name: short.default(''),
  phone: short.default(''),
  email: z.union([z.email(), z.literal('')]).default(''),
});
const clientSchema = z.object({
  name: short.min(1, 'Informe o nome'),
  type: z.enum(['PF', 'PJ']).default('PJ'),
  segment: short.default(''),
  document: short.default(''),
  phone: short.default(''),
  email: z.union([z.email(), z.literal('')]).default(''),
  city: short.default(''),
  state: z.string().trim().max(2).default(''),
  notes: text.default(''),
  contacts: z.array(baseContact).max(100).default([]),
  archived: z.boolean().default(false),
});
const productSchema = z.object({
  sku: short.min(1),
  description: short.min(1),
  manufacturer: short.default(''),
  category: short.default(''),
  unit: short.default('UN'),
  priceCents: cents.default(0),
  references: z.array(short).max(100).default([]),
  application: text.default(''),
  location: short.default(''),
  availability: z.enum(AVAILABILITIES).default('unknown'),
  archived: z.boolean().default(false),
});
const opportunitySchema = z.object({
  clientId: short.min(1),
  title: short.min(1),
  need: text.default(''),
  vehicle: short.default(''),
  estimatedValueCents: cents.default(0),
});
const activitySchema = z.object({
  clientId: short.min(1),
  opportunityId: short.nullable().default(null),
  kind: z.enum(['task', 'call', 'whatsapp', 'visit', 'note']).default('task'),
  title: short.min(1),
  notes: text.default(''),
  dueAt: instant.nullable().default(null),
  completedAt: instant.nullable().default(null),
});
const quoteSchema = z.object({
  opportunityId: short.min(1),
  validUntil: date,
  paymentTerms: text.default(''),
  notes: text.default(''),
  items: z
    .array(
      z.object({
        productId: short.min(1),
        quantity: z.number().int().positive().max(1_000_000),
        unitPriceCents: cents,
      }),
    )
    .min(1)
    .max(500),
  discountCents: cents.default(0),
  freightCents: cents.default(0),
});
const settingsSchema = z.object({
  companyName: short.min(1),
  phone: short.default(''),
  address: text.default(''),
});
const now = () => new Date().toISOString();
function day(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  return `${parts.find((p) => p.type === 'year')!.value}-${parts.find((p) => p.type === 'month')!.value}-${parts.find((p) => p.type === 'day')!.value}`;
}
function fail(message: string, statusCode = 400): never {
  throw Object.assign(new Error(message), { statusCode });
}
const meta = () => ({ id: randomUUID(), createdAt: now(), updatedAt: now() });
const normalized = (value: string) => value.replace(/[^\p{L}\p{N}]/gu, '').toUpperCase();
type Table =
  'clients' | 'products' | 'opportunities' | 'activities' | 'quotes' | 'orders' | 'events';

export async function createApp(options: {
  dataDir: string;
  serveStatic?: boolean;
  mode?: 'operational' | 'demo';
}): Promise<FastifyInstance> {
  const { dataDir, serveStatic = false, mode = 'operational' } = options;
  const release = acquireLock(dataDir),
    dbPath = join(dataDir, DB_FILENAME);
  let db: DatabaseSync;
  try {
    db = openDatabase(dbPath);
  } catch (error) {
    release();
    throw error;
  }
  const app = Fastify({ logger: false, bodyLimit: 1_048_576 });
  const token = randomBytes(32).toString('hex');
  const list = <T>(table: Table): T[] =>
    db
      .prepare(`SELECT payload FROM ${table} ORDER BY rowid`)
      .all()
      .map((r) => JSON.parse(r.payload as string) as T);
  const get = <T>(table: Table, id: string): T => {
    const row = db.prepare(`SELECT payload FROM ${table} WHERE id=?`).get(id);
    if (!row) fail('Registro não encontrado.', 404);
    return JSON.parse(row!.payload as string) as T;
  };
  const save = (
    table: Table,
    entity:
      | { id: string; [key: string]: unknown }
      | Client
      | Product
      | Opportunity
      | Activity
      | Quote
      | Order
      | AuditEvent,
  ) => {
    const payload = JSON.stringify(entity),
      e = entity as unknown as Record<string, unknown>;
    const columns: Record<string, unknown> = { id: entity.id };
    if (table === 'products') columns.sku = e.sku;
    if (['opportunities', 'activities', 'quotes', 'orders'].includes(table))
      columns.client_id = e.clientId;
    if (['activities', 'quotes', 'orders'].includes(table))
      columns.opportunity_id = e.opportunityId;
    if (table === 'orders') columns.quote_id = e.quoteId;
    columns.payload = payload;
    const keys = Object.keys(columns);
    db.prepare(
      `INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')}) ON CONFLICT(id) DO UPDATE SET ${keys
        .filter((k) => k !== 'id')
        .map((k) => `${k}=excluded.${k}`)
        .join(',')}`,
    ).run(...(Object.values(columns) as (string | number | null)[]));
  };
  const audit = (entityType: string, entityId: string, action: string, detail = '') =>
    save('events', { id: randomUUID(), entityType, entityId, action, detail, createdAt: now() });
  const transaction = <T>(run: () => T): T => {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = run();
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  };
  const settings = (): Settings => {
    const row = db.prepare('SELECT payload FROM settings WHERE id=1').get();
    return row
      ? JSON.parse(row.payload as string)
      : { companyName: 'Minha distribuidora', phone: '', address: '' };
  };
  const activeQuotes = (opportunityId: string) =>
    list<Quote>('quotes').filter(
      (q) => q.opportunityId === opportunityId && q.status !== 'superseded',
    );
  const latestQuote = (opportunityId: string) => activeQuotes(opportunityId).at(-1);
  const requireOpen = (opportunity: Opportunity) => {
    if (opportunity.stage === 'won' || opportunity.stage === 'lost')
      fail('Oportunidade encerrada.');
  };
  const requireClient = (clientId: string) => {
    const c = get<Client>('clients', clientId);
    if (c.archived) fail('Cliente arquivado. Reative-o antes de criar novos registros.');
    return c;
  };
  const quoteData = (input: z.infer<typeof quoteSchema>) => {
    const opportunity = get<Opportunity>('opportunities', input.opportunityId);
    requireOpen(opportunity);
    requireClient(opportunity.clientId);
    const items: QuoteItem[] = input.items.map((i) => {
      const p = get<Product>('products', i.productId);
      if (p.archived) fail(`A peça ${p.sku} está arquivada.`);
      return { ...i, sku: p.sku, description: p.description, unit: p.unit };
    });
    const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPriceCents, 0);
    if (!Number.isSafeInteger(subtotal) || subtotal > 1_000_000_000)
      fail('Valor total acima do limite suportado.');
    if (input.discountCents > subtotal) fail('O desconto não pode superar o subtotal das peças.');
    const totalCents = subtotal - input.discountCents + input.freightCents;
    if (totalCents > 1_000_000_000) fail('Valor total acima do limite suportado.');
    return { ...input, items, totalCents, clientId: opportunity.clientId };
  };
  const dashboard = (from = day().slice(0, 7) + '-01', to = day()): Dashboard => {
    date.parse(from);
    date.parse(to);
    if (from > to) fail('A data inicial deve preceder a final.');
    const opportunities = list<Opportunity>('opportunities'),
      orders = list<Order>('orders'),
      activities = list<Activity>('activities');
    const period = (value: string) => {
      const d = day(new Date(value));
      return d >= from && d <= to;
    };
    const open = opportunities.filter((o) => !['won', 'lost'].includes(o.stage));
    const won = orders.filter((o) => o.status !== 'cancelled' && period(o.createdAt));
    const lost = opportunities.filter(
      (o) => o.stage === 'lost' && o.closedAt && period(o.closedAt),
    );
    const reasons = new Map<string, number>();
    for (const o of lost) reasons.set(o.lossReason, (reasons.get(o.lossReason) || 0) + 1);
    return {
      openCount: open.length,
      pipelineCents: open.reduce(
        (sum, o) => sum + (latestQuote(o.id)?.totalCents ?? o.estimatedValueCents),
        0,
      ),
      overdueCount: activities.filter((a) => !a.completedAt && a.dueAt && a.dueAt < now()).length,
      wonCount: won.length,
      lostCount: lost.length,
      wonCents: won.reduce((sum, o) => sum + o.totalCents, 0),
      winRate: won.length + lost.length ? won.length / (won.length + lost.length) : null,
      lossReasons: [...reasons].map(([reason, count]) => ({ reason, count })),
      from,
      to,
    };
  };
  const state = (): AppState => ({
    clients: list<Client>('clients'),
    products: list<Product>('products'),
    opportunities: list<Opportunity>('opportunities'),
    activities: list<Activity>('activities'),
    quotes: list<Quote>('quotes'),
    orders: list<Order>('orders'),
    events: list<AuditEvent>('events').reverse(),
    settings: settings(),
    dashboard: dashboard(),
    mode,
  });
  app.addHook('onClose', async () => {
    try {
      db.close();
    } finally {
      release();
    }
  });
  app.addHook('onRequest', async (request, reply) => {
    const host = request.headers.host || '';
    if (!/^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/i.test(host))
      fail('Acesso permitido somente por endereço local.', 403);
    let url: URL;
    try {
      url = new URL(`http://${host}`);
    } catch {
      fail('Host inválido.', 403);
    }
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
      fail('Acesso permitido somente por endereço local.', 403);
    const origin = request.headers.origin;
    if (origin) {
      let originUrl: URL;
      try {
        originUrl = new URL(origin);
      } catch {
        fail('Origem inválida.', 403);
      }
      if (originUrl!.host !== url.host || !['http:', 'https:'].includes(originUrl!.protocol))
        fail('Origem não autorizada.', 403);
    }
    reply
      .header('X-Content-Type-Options', 'nosniff')
      .header('Referrer-Policy', 'no-referrer')
      .header('X-Frame-Options', 'DENY')
      .header(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
      );
    if (request.url.startsWith('/api/')) reply.header('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      const supplied = request.headers['x-csrf-token'];
      if (
        typeof supplied !== 'string' ||
        !/^[a-f0-9]{64}$/.test(supplied) ||
        !timingSafeEqual(Buffer.from(supplied), Buffer.from(token))
      )
        fail('Sessão inválida. Recarregue a página.', 403);
    }
  });
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof z.ZodError) {
      const fields: Record<string, string> = {};
      for (const issue of error.issues) fields[issue.path.join('.')] = issue.message;
      reply.code(400).send({ message: 'Revise os campos informados.', fields });
      return;
    }
    const err = error as Error & { code?: string; statusCode?: number; errcode?: number };
    if (
      err.code?.startsWith('SQLITE_CONSTRAINT') ||
      (err.errcode !== undefined && (err.errcode & 255) === 19)
    ) {
      reply.code(409).send({ message: 'Registro duplicado ou referência inválida.' });
      return;
    }
    const status =
      err.statusCode && err.statusCode >= 400 && err.statusCode < 500 ? err.statusCode : 500;
    if (status === 500) console.error('Falha na API:', err.code ?? err.name);
    reply.code(status).send({
      message:
        status === 500 ? 'Não foi possível concluir a operação. Tente novamente.' : err.message,
    });
  });
  app.get('/api/health', async () => ({ ok: true, mode }));
  app.get('/api/session', async () => ({ token }));
  app.get('/api/state', async () => state());
  app.get('/api/dashboard', async (request) => {
    const q = request.query as { from?: string; to?: string };
    return dashboard(q.from, q.to);
  });
  const idOf = (request: { params: unknown }) => (request.params as { id: string }).id;
  app.post('/api/clients', async (request, reply) =>
    transaction(() => {
      const input = clientSchema.parse(request.body);
      if (
        input.document &&
        list<Client>('clients').some((c) => normalized(c.document) === normalized(input.document))
      )
        fail('Já existe cliente com este documento.', 409);
      const entity: Client = { ...meta(), ...input };
      save('clients', entity);
      audit('client', entity.id, 'created');
      reply.code(201);
      return entity;
    }),
  );
  app.put('/api/clients/:id', async (request) =>
    transaction(() => {
      const old = get<Client>('clients', idOf(request)),
        input = clientSchema.parse({ ...old, ...(request.body as object) });
      if (
        input.document &&
        list<Client>('clients').some(
          (c) => c.id !== old.id && normalized(c.document) === normalized(input.document),
        )
      )
        fail('Já existe cliente com este documento.', 409);
      const entity = { ...old, ...input, updatedAt: now() };
      save('clients', entity);
      audit('client', entity.id, input.archived ? 'archived' : 'updated');
      return entity;
    }),
  );
  app.post('/api/products', async (request, reply) =>
    transaction(() => {
      const input = productSchema.parse(request.body),
        entity: Product = { ...meta(), ...input, availabilityUpdatedAt: now() };
      save('products', entity);
      audit('product', entity.id, 'created');
      reply.code(201);
      return entity;
    }),
  );
  app.put('/api/products/:id', async (request) =>
    transaction(() => {
      const old = get<Product>('products', idOf(request)),
        input = productSchema.parse({ ...old, ...(request.body as object) });
      const entity = {
        ...old,
        ...input,
        updatedAt: now(),
        availabilityUpdatedAt:
          input.availability !== old.availability ? now() : old.availabilityUpdatedAt,
      };
      save('products', entity);
      audit('product', entity.id, input.archived ? 'archived' : 'updated');
      return entity;
    }),
  );
  app.post('/api/opportunities', async (request, reply) =>
    transaction(() => {
      const input = opportunitySchema.parse(request.body);
      requireClient(input.clientId);
      const entity: Opportunity = {
        ...meta(),
        ...input,
        stage: 'new',
        lossReason: '',
        closedAt: null,
      };
      save('opportunities', entity);
      audit('opportunity', entity.id, 'created');
      reply.code(201);
      return entity;
    }),
  );
  app.put('/api/opportunities/:id', async (request) =>
    transaction(() => {
      const old = get<Opportunity>('opportunities', idOf(request));
      requireOpen(old);
      const body = request.body as Record<string, unknown>;
      if (body?.stage && body.stage !== old.stage) fail('Use a ação de etapa para mudar o funil.');
      const input = opportunitySchema.parse({ ...old, ...body });
      requireClient(input.clientId);
      if (
        input.clientId !== old.clientId &&
        (list<Quote>('quotes').some((q) => q.opportunityId === old.id) ||
          list<Activity>('activities').some((a) => a.opportunityId === old.id))
      )
        fail('O cliente não pode mudar depois da criação de um orçamento ou atividade.');
      const entity = { ...old, ...input, updatedAt: now() };
      save('opportunities', entity);
      audit('opportunity', entity.id, 'updated');
      return entity;
    }),
  );
  app.post('/api/opportunities/:id/stage', async (request) =>
    transaction(() => {
      const input = z
          .object({ stage: z.enum(STAGES), lossReason: text.optional() })
          .parse(request.body),
        old = get<Opportunity>('opportunities', idOf(request));
      if (old.stage === input.stage) return old;
      requireOpen(old);
      if (input.stage === 'won')
        fail('Para marcar como ganho, converta um orçamento enviado em pedido.');
      if (input.stage === 'lost' && !input.lossReason?.trim()) fail('Informe o motivo da perda.');
      if (
        ['quoted', 'negotiation'].includes(input.stage) &&
        !activeQuotes(old.id).some((q) => q.status === 'sent')
      )
        fail('Envie um orçamento antes de avançar para esta etapa.');
      const entity = {
        ...old,
        stage: input.stage,
        lossReason: input.stage === 'lost' ? input.lossReason! : '',
        closedAt: input.stage === 'lost' ? now() : null,
        updatedAt: now(),
      };
      save('opportunities', entity);
      audit(
        'opportunity',
        entity.id,
        'stage',
        `${old.stage} → ${entity.stage}${entity.lossReason ? `: ${entity.lossReason}` : ''}`,
      );
      return entity;
    }),
  );
  app.post('/api/activities', async (request, reply) =>
    transaction(() => {
      const input = activitySchema.parse(request.body);
      requireClient(input.clientId);
      if (
        input.opportunityId &&
        get<Opportunity>('opportunities', input.opportunityId).clientId !== input.clientId
      )
        fail('A oportunidade pertence a outro cliente.');
      const entity: Activity = { ...meta(), ...input };
      save('activities', entity);
      audit('activity', entity.id, 'created');
      reply.code(201);
      return entity;
    }),
  );
  app.put('/api/activities/:id', async (request) =>
    transaction(() => {
      const old = get<Activity>('activities', idOf(request)),
        input = activitySchema.parse({ ...old, ...(request.body as object) });
      get<Client>('clients', input.clientId);
      if (
        input.opportunityId &&
        get<Opportunity>('opportunities', input.opportunityId).clientId !== input.clientId
      )
        fail('A oportunidade pertence a outro cliente.');
      const entity = { ...old, ...input, updatedAt: now() };
      save('activities', entity);
      audit('activity', entity.id, input.completedAt ? 'completed' : 'updated');
      return entity;
    }),
  );
  app.post('/api/quotes', async (request, reply) =>
    transaction(() => {
      const input = quoteSchema.parse(request.body),
        data = quoteData(input);
      if (activeQuotes(data.opportunityId).length)
        fail('Já existe um orçamento ativo. Use Revisar orçamento.', 409);
      const entity: Quote = {
        ...meta(),
        ...data,
        number: Math.max(0, ...list<Quote>('quotes').map((q) => q.number)) + 1,
        revision: 1,
        familyId: randomUUID(),
        status: 'draft',
        clientSnapshot: null,
        sentAt: null,
      };
      save('quotes', entity);
      audit('quote', entity.id, 'created');
      reply.code(201);
      return entity;
    }),
  );
  app.put('/api/quotes/:id', async (request) =>
    transaction(() => {
      const old = get<Quote>('quotes', idOf(request));
      if (old.status !== 'draft') fail('Orçamento enviado não pode ser editado. Crie uma revisão.');
      const input = quoteSchema.parse({ ...old, ...(request.body as object) });
      if (input.opportunityId !== old.opportunityId)
        fail('A oportunidade de um orçamento não pode mudar.');
      const data = quoteData(input),
        entity = { ...old, ...data, updatedAt: now() };
      save('quotes', entity);
      audit('quote', entity.id, 'updated');
      return entity;
    }),
  );
  app.post('/api/quotes/:id/send', async (request) =>
    transaction(() => {
      const old = get<Quote>('quotes', idOf(request)),
        opportunity = get<Opportunity>('opportunities', old.opportunityId);
      requireOpen(opportunity);
      if (old.status !== 'draft') fail('Somente um rascunho pode ser enviado.');
      if (old.validUntil < day()) fail('Atualize a validade do orçamento antes de enviar.');
      const client = requireClient(old.clientId),
        items = old.items.map((i) => {
          const p = get<Product>('products', i.productId);
          return { ...i, sku: p.sku, description: p.description, unit: p.unit };
        }),
        entity: Quote = {
          ...old,
          items,
          status: 'sent',
          clientSnapshot: client,
          sentAt: now(),
          updatedAt: now(),
        };
      save('quotes', entity);
      if (opportunity.stage !== 'negotiation')
        save('opportunities', { ...opportunity, stage: 'quoted', updatedAt: now() });
      audit('quote', entity.id, 'sent', 'Envio registrado manualmente; não dispara mensagem.');
      return entity;
    }),
  );
  app.post('/api/quotes/:id/revise', async (request, reply) =>
    transaction(() => {
      const old = get<Quote>('quotes', idOf(request));
      requireOpen(get<Opportunity>('opportunities', old.opportunityId));
      if (old.status === 'superseded' || old.status === 'accepted')
        fail('Esta versão não pode ser revisada.');
      save('quotes', { ...old, status: 'superseded', updatedAt: now() });
      const entity: Quote = {
        ...old,
        ...meta(),
        revision: old.revision + 1,
        status: 'draft',
        clientSnapshot: null,
        sentAt: null,
      };
      save('quotes', entity);
      audit('quote', old.id, 'superseded');
      audit('quote', entity.id, 'revised');
      reply.code(201);
      return entity;
    }),
  );
  app.post('/api/quotes/:id/convert', async (request, reply) =>
    transaction(() => {
      const quote = get<Quote>('quotes', idOf(request)),
        opportunity = get<Opportunity>('opportunities', quote.opportunityId);
      const existing = list<Order>('orders').find((o) => o.opportunityId === opportunity.id);
      if (existing) {
        if (existing.quoteId !== quote.id)
          fail('Esta oportunidade já possui pedido de outro orçamento.', 409);
        return existing;
      }
      requireOpen(opportunity);
      if (quote.status !== 'sent' || latestQuote(opportunity.id)?.id !== quote.id)
        fail('Converta apenas a versão atual de um orçamento enviado.');
      if (quote.validUntil < day()) fail('O orçamento venceu. Crie uma revisão.');
      if (!quote.clientSnapshot)
        fail('O orçamento precisa ter os dados do cliente registrados no envio.');
      const entity: Order = {
        ...meta(),
        opportunityId: opportunity.id,
        quoteId: quote.id,
        clientId: quote.clientId,
        number: Math.max(0, ...list<Order>('orders').map((o) => o.number)) + 1,
        status: 'confirmed',
        cancellationReason: '',
        items: quote.items,
        clientSnapshot: quote.clientSnapshot!,
        discountCents: quote.discountCents,
        freightCents: quote.freightCents,
        totalCents: quote.totalCents,
        paymentTerms: quote.paymentTerms,
        notes: quote.notes,
      };
      save('orders', entity);
      save('quotes', { ...quote, status: 'accepted', updatedAt: now() });
      save('opportunities', {
        ...opportunity,
        stage: 'won',
        lossReason: '',
        closedAt: now(),
        updatedAt: now(),
      });
      audit('order', entity.id, 'created', `Orçamento ${quote.number} revisão ${quote.revision}`);
      audit('opportunity', opportunity.id, 'won');
      reply.code(201);
      return entity;
    }),
  );
  app.post('/api/orders/:id/status', async (request) =>
    transaction(() => {
      const input = z
          .object({
            status: z.enum(['confirmed', 'processing', 'completed', 'cancelled']),
            cancellationReason: text.optional(),
          })
          .parse(request.body),
        old = get<Order>('orders', idOf(request));
      if (old.status === input.status) return old;
      if (old.status === 'cancelled' || old.status === 'completed')
        fail('Pedido encerrado não pode mudar de situação.');
      const transitions: Record<string, string[]> = {
        confirmed: ['processing', 'cancelled'],
        processing: ['completed', 'cancelled'],
      };
      if (!transitions[old.status]?.includes(input.status)) fail('Transição de pedido inválida.');
      if (input.status === 'cancelled' && !input.cancellationReason?.trim())
        fail('Informe o motivo do cancelamento.');
      const entity = {
        ...old,
        status: input.status,
        cancellationReason: input.status === 'cancelled' ? input.cancellationReason! : '',
        updatedAt: now(),
      };
      save('orders', entity);
      audit('order', entity.id, input.status, entity.cancellationReason);
      return entity;
    }),
  );
  app.put('/api/settings', async (request) =>
    transaction(() => {
      const input = settingsSchema.parse({ ...settings(), ...(request.body as object) });
      db.prepare(
        'INSERT INTO settings(id,payload) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload',
      ).run(JSON.stringify(input));
      audit('settings', '1', 'updated');
      return input;
    }),
  );
  const csv = (rows: unknown[][]) =>
    '\uFEFF' +
    rows
      .map((row) =>
        row
          .map((value) => {
            let s = String(value ?? '');
            if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
            return '"' + s.replaceAll('"', '""') + '"';
          })
          .join(';'),
      )
      .join('\r\n');
  app.get('/api/export/clients', async (_request, reply) =>
    reply
      .type('text/csv; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="clientes.csv"')
      .send(
        csv([
          [
            'Nome',
            'Tipo',
            'Segmento',
            'Documento',
            'Telefone',
            'Email',
            'Cidade',
            'UF',
            'Arquivado',
          ],
          ...list<Client>('clients').map((c) => [
            c.name,
            c.type,
            c.segment,
            c.document,
            c.phone,
            c.email,
            c.city,
            c.state,
            c.archived ? 'Sim' : 'Não',
          ]),
        ]),
      ),
  );
  app.get('/api/export/products', async (_request, reply) =>
    reply
      .type('text/csv; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="pecas.csv"')
      .send(
        csv([
          [
            'SKU',
            'Descrição',
            'Fabricante',
            'Categoria',
            'Unidade',
            'Preço (R$)',
            'Referências',
            'Aplicação',
            'Localização',
            'Disponibilidade',
            'Atualizado',
            'Arquivado',
          ],
          ...list<Product>('products').map((p) => [
            p.sku,
            p.description,
            p.manufacturer,
            p.category,
            p.unit,
            (p.priceCents / 100).toFixed(2),
            p.references.join(' | '),
            p.application,
            p.location,
            p.availability,
            p.availabilityUpdatedAt,
            p.archived ? 'Sim' : 'Não',
          ]),
        ]),
      ),
  );
  app.get('/api/backup', async (_request, reply) => {
    const temp = join(dataDir, `backup-${randomUUID()}.sqlite`);
    try {
      await backupDatabase(dbPath, temp);
      return reply
        .type('application/vnd.sqlite3')
        .header('Content-Disposition', `attachment; filename="crm-backup-${day()}.sqlite"`)
        .send(readFileSync(temp));
    } finally {
      if (existsSync(temp)) unlinkSync(temp);
    }
  });
  if (mode === 'demo' && !list<Client>('clients').length)
    transaction(() => seedDemo({ save, audit, db }));
  if (serveStatic) {
    const root = resolve('dist');
    if (!existsSync(join(root, 'index.html'))) {
      await app.close();
      throw new Error('Frontend não compilado. Execute npm run build primeiro.');
    }
    await app.register(fastifyStatic, { root });
    app.setNotFoundHandler((request, reply) =>
      request.url.startsWith('/api/')
        ? reply.code(404).send({ message: 'Rota não encontrada.' })
        : reply.sendFile('index.html'),
    );
  }
  return app;
}
