import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createApp } from '../server/app.ts';
import { backupDatabase, DB_FILENAME, restoreDatabase } from '../server/storage.ts';
import type { AppState, Client, Opportunity, Order, Product, Quote } from '../shared/types.ts';

type App = Awaited<ReturnType<typeof createApp>>;

async function setup() {
  const dir = await mkdtemp(path.join(tmpdir(), 'crm-faculdade-test-'));
  const app = await createApp({ dataDir: path.join(dir, 'data'), serveStatic: false });
  const session = await app.inject({ method: 'GET', url: '/api/session' });
  assert.equal(session.statusCode, 200);
  const token = session.json<{ token: string }>().token;
  assert.ok(token);
  const request = async <T>(
    method: 'POST' | 'PUT',
    url: string,
    payload?: Record<string, unknown>,
    expected?: number,
  ): Promise<T> => {
    const res = await app.inject({
      method,
      url: `/api${url}`,
      headers: { 'x-csrf-token': token },
      payload,
    });
    if (expected !== undefined) assert.equal(res.statusCode, expected, res.body);
    else
      assert.ok(
        res.statusCode >= 200 && res.statusCode < 300,
        `${method} ${url}: ${res.statusCode} ${res.body}`,
      );
    return res.json<T>();
  };
  const state = async () => {
    const res = await app.inject({ method: 'GET', url: '/api/state' });
    assert.equal(res.statusCode, 200, res.body);
    return res.json<AppState>();
  };
  return {
    dir,
    app,
    request,
    state,
    cleanup: async () => {
      await app.close();
      await rm(dir, { recursive: true, force: true });
    },
  };
}

async function seed(request: Awaited<ReturnType<typeof setup>>['request']) {
  const client = await request<Client>('POST', '/clients', {
    name: 'Transportadora Exemplo',
    type: 'PJ',
    phone: '31999999999',
  });
  const product = await request<Product>('POST', '/products', {
    sku: 'P-001',
    description: 'Peça de teste',
    manufacturer: 'Exemplo',
    unit: 'UN',
    priceCents: 12500,
    references: ['OEM-EXEMPLO'],
    application: 'Aplicação informada pelo vendedor',
    availability: 'available',
  });
  const opportunity = await request<Opportunity>('POST', '/opportunities', {
    clientId: client.id,
    title: 'Reposição da frota',
    need: 'Identificar peça',
    vehicle: 'Caminhão de teste',
  });
  return { client, product, opportunity };
}

function quoteInput(client: Client, product: Product, opportunity: Opportunity) {
  return {
    clientId: client.id,
    opportunityId: opportunity.id,
    validUntil: '2099-12-31',
    paymentTerms: 'À vista',
    notes: 'Dados de teste',
    items: [
      {
        productId: product.id,
        sku: product.sku,
        description: product.description,
        unit: product.unit,
        quantity: 2,
        unitPriceCents: 12500,
      },
    ],
    discountCents: 1000,
    freightCents: 500,
  };
}

test('cadastros, tarefas e configurações persistem após reinício', async () => {
  const ctx = await setup();
  let reopened: App | undefined;
  try {
    const { client, product, opportunity } = await seed(ctx.request);
    await ctx.request('POST', '/activities', {
      clientId: client.id,
      opportunityId: opportunity.id,
      kind: 'task',
      title: 'Retornar orçamento',
      dueAt: '2000-01-01T12:00:00.000Z',
    });
    await ctx.request('PUT', '/settings', {
      companyName: 'Distribuidora Exemplo',
      phone: '3133334444',
      address: 'Endereço de teste',
    });
    await ctx.app.close();
    reopened = await createApp({ dataDir: path.join(ctx.dir, 'data'), serveStatic: false });
    const res = await reopened.inject({ method: 'GET', url: '/api/state' });
    const state = res.json<AppState>();
    assert.equal(state.clients.find((x) => x.id === client.id)?.name, client.name);
    assert.equal(state.products.find((x) => x.id === product.id)?.sku, 'P-001');
    assert.equal(state.opportunities.length, 1);
    assert.equal(state.activities.length, 1);
    assert.equal(state.settings.companyName, 'Distribuidora Exemplo');
    assert.equal(state.dashboard.overdueCount, 1);
  } finally {
    await reopened?.close();
    await ctx.cleanup();
  }
});

test('escritas exigem sessão CSRF e entradas inválidas não criam documentos', async () => {
  const ctx = await setup();
  try {
    const denied = await ctx.app.inject({
      method: 'POST',
      url: '/api/clients',
      payload: { name: 'Sem token' },
    });
    assert.ok(denied.statusCode >= 400);
    const { client, product, opportunity } = await seed(ctx.request);
    for (const patch of [
      { items: [{ ...quoteInput(client, product, opportunity).items[0], quantity: 0 }] },
      { items: [{ ...quoteInput(client, product, opportunity).items[0], quantity: 1.5 }] },
      { items: [{ ...quoteInput(client, product, opportunity).items[0], unitPriceCents: -1 }] },
      { discountCents: 25001 },
      { freightCents: -1 },
      { validUntil: '2026-02-30' },
    ]) {
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/quotes',
        headers: {
          'x-csrf-token': (await ctx.app.inject({ method: 'GET', url: '/api/session' })).json<{
            token: string;
          }>().token,
        },
        payload: { ...quoteInput(client, product, opportunity), ...patch },
      });
      assert.ok(res.statusCode >= 400 && res.statusCode < 500, res.body);
    }
    assert.equal((await ctx.state()).quotes.length, 0);
    await assert.rejects(
      ctx.request('POST', '/products', { sku: 'P-001', description: 'Duplicada', priceCents: 1 }),
    );
  } finally {
    await ctx.cleanup();
  }
});

test('envio preserva snapshot e impede alteração; revisão mantém histórico', async () => {
  const ctx = await setup();
  try {
    const { client, product, opportunity } = await seed(ctx.request);
    const input = quoteInput(client, product, opportunity);
    const draft = await ctx.request<Quote>('POST', '/quotes', input);
    assert.equal(draft.totalCents, 24500);
    await ctx.request('POST', `/quotes/${draft.id}/send`);
    await ctx.request('PUT', `/clients/${client.id}`, { ...client, name: 'Nome alterado' });
    await ctx.request('PUT', `/products/${product.id}`, {
      ...product,
      description: 'Descrição alterada',
      priceCents: 99000,
    });
    const sent = (await ctx.state()).quotes.find((x) => x.id === draft.id)!;
    assert.equal(sent.status, 'sent');
    assert.equal(sent.clientSnapshot?.name, 'Transportadora Exemplo');
    assert.equal(sent.items[0].description, 'Peça de teste');
    assert.equal(sent.items[0].unitPriceCents, 12500);
    await assert.rejects(ctx.request('PUT', `/quotes/${sent.id}`, { ...input, freightCents: 100 }));
    const revision = await ctx.request<Quote>('POST', `/quotes/${sent.id}/revise`);
    assert.notEqual(revision.id, sent.id);
    assert.equal(revision.status, 'draft');
    assert.equal(revision.familyId, sent.familyId);
    assert.equal(revision.revision, sent.revision + 1);
    assert.equal((await ctx.state()).quotes.find((x) => x.id === sent.id)?.status, 'superseded');
    await assert.rejects(ctx.request('POST', `/quotes/${sent.id}/convert`));
  } finally {
    await ctx.cleanup();
  }
});

test('proposta vencida bloqueia envio e requer revisão antes de converter', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-01-01T12:00:00.000Z') });
  const ctx = await setup();
  try {
    const { client, product, opportunity } = await seed(ctx.request);
    const draft = await ctx.request<Quote>('POST', '/quotes', {
      ...quoteInput(client, product, opportunity),
      validUntil: '2000-01-01',
    });
    await assert.rejects(ctx.request('POST', `/quotes/${draft.id}/send`));
    await ctx.request('PUT', `/quotes/${draft.id}`, {
      ...quoteInput(client, product, opportunity),
      validUntil: '2026-01-02',
    });
    await ctx.request('POST', `/quotes/${draft.id}/send`);
    t.mock.timers.setTime(new Date('2026-01-03T12:00:00.000Z').getTime());
    await assert.rejects(ctx.request('POST', `/quotes/${draft.id}/convert`));
    const revision = await ctx.request<Quote>('POST', `/quotes/${draft.id}/revise`);
    await ctx.request('PUT', `/quotes/${revision.id}`, {
      ...quoteInput(client, product, opportunity),
      validUntil: '2099-12-31',
    });
    await ctx.request('POST', `/quotes/${revision.id}/send`);
    const order = await ctx.request<Order>('POST', `/quotes/${revision.id}/convert`);
    assert.equal(order.quoteId, revision.id);
  } finally {
    await ctx.cleanup();
  }
});

test('conversões concorrentes produzem um pedido e painel comercial consistente', async () => {
  const ctx = await setup();
  try {
    const { client, product, opportunity } = await seed(ctx.request);
    const draft = await ctx.request<Quote>(
      'POST',
      '/quotes',
      quoteInput(client, product, opportunity),
    );
    await ctx.request('POST', `/quotes/${draft.id}/send`);
    const results = await Promise.all(
      Array.from({ length: 4 }, () => ctx.request<Order>('POST', `/quotes/${draft.id}/convert`)),
    );
    assert.equal(new Set(results.map((x) => x.id)).size, 1);
    const state = await ctx.state();
    assert.equal(state.orders.length, 1);
    assert.equal(state.opportunities.find((x) => x.id === opportunity.id)?.stage, 'won');
    assert.equal(state.dashboard.wonCount, 1);
    assert.equal(state.dashboard.wonCents, 24500);
    await assert.rejects(
      ctx.request('POST', `/orders/${results[0].id}/status`, {
        status: 'cancelled',
        cancellationReason: '',
      }),
    );
    await ctx.request('POST', `/orders/${results[0].id}/status`, {
      status: 'cancelled',
      cancellationReason: 'Cliente desistiu',
    });
    const cancelled = await ctx.state();
    assert.equal(cancelled.orders[0].status, 'cancelled');
    assert.equal(cancelled.dashboard.wonCents, 0);
    assert.equal(cancelled.dashboard.wonCount, 0);
    const another = await ctx.request<Opportunity>('POST', '/opportunities', {
      clientId: client.id,
      title: 'Outro atendimento',
    });
    await assert.rejects(
      ctx.request('POST', `/opportunities/${another.id}/stage`, { stage: 'lost', lossReason: '' }),
    );
    await ctx.request('POST', `/opportunities/${another.id}/stage`, {
      stage: 'lost',
      lossReason: 'Sem disponibilidade',
    });
    const dashboardRes = await ctx.app.inject({
      method: 'GET',
      url: '/api/dashboard?from=2000-01-01&to=2099-12-31',
    });
    assert.equal(dashboardRes.statusCode, 200);
    assert.ok(dashboardRes.json<AppState['dashboard']>().lostCount >= 1);
    assert.ok((await ctx.state()).events.length > 0);
  } finally {
    await ctx.cleanup();
  }
});

test('exportação e backup permitem restauração validada sem sobrescrever base ativa', async () => {
  const ctx = await setup();
  let restoredApp: App | undefined;
  try {
    await seed(ctx.request);
    for (const resource of ['clients', 'products']) {
      const csv = await ctx.app.inject({ method: 'GET', url: `/api/export/${resource}` });
      assert.equal(csv.statusCode, 200);
      assert.match(csv.headers['content-type'] ?? '', /csv/);
      assert.ok(csv.body.length > 20);
    }
    const download = await ctx.app.inject({ method: 'GET', url: '/api/backup' });
    assert.equal(download.statusCode, 200);
    assert.equal(download.rawPayload.subarray(0, 15).toString(), 'SQLite format 3');
    const backupPath = path.join(ctx.dir, 'copia.sqlite');
    await backupDatabase(path.join(ctx.dir, 'data', DB_FILENAME), backupPath);
    await assert.rejects(restoreDatabase(path.join(ctx.dir, 'data'), backupPath));
    const target = path.join(ctx.dir, 'restored');
    await restoreDatabase(target, backupPath);
    restoredApp = await createApp({ dataDir: target, serveStatic: false });
    const restored = (
      await restoredApp.inject({ method: 'GET', url: '/api/state' })
    ).json<AppState>();
    assert.equal(restored.clients[0].name, 'Transportadora Exemplo');
    assert.equal(restored.products[0].sku, 'P-001');
    assert.equal(restored.opportunities.length, 1);
    const restoredToken = (await restoredApp.inject({ method: 'GET', url: '/api/session' })).json<{
      token: string;
    }>().token;
    const addition = await restoredApp.inject({
      method: 'POST',
      url: '/api/clients',
      headers: { 'x-csrf-token': restoredToken },
      payload: { name: 'Cadastro anterior à restauração' },
    });
    assert.equal(addition.statusCode, 201, addition.body);
    await restoredApp.close();
    restoredApp = undefined;
    await assert.rejects(restoreDatabase(target, path.join(ctx.dir, 'inexistente.sqlite')));
    const corrupt = path.join(ctx.dir, 'corrompido.sqlite');
    await writeFile(corrupt, 'Este arquivo não é um banco SQLite.');
    await assert.rejects(restoreDatabase(target, corrupt));
    restoredApp = await createApp({ dataDir: target, serveStatic: false });
    assert.equal(
      (await restoredApp.inject({ method: 'GET', url: '/api/state' })).json<AppState>().clients
        .length,
      2,
    );
    await restoredApp.close();
    restoredApp = undefined;
    await restoreDatabase(target, backupPath);
    const preserved = (await readdir(target)).find(
      (name) => name.startsWith('before-restore-') && name.endsWith('.sqlite'),
    );
    assert.ok(preserved, 'Restauração deve preservar a base anterior.');
    const previousTarget = path.join(ctx.dir, 'previous');
    await restoreDatabase(previousTarget, path.join(target, preserved));
    restoredApp = await createApp({ dataDir: previousTarget, serveStatic: false });
    assert.equal(
      (await restoredApp.inject({ method: 'GET', url: '/api/state' })).json<AppState>().clients
        .length,
      2,
    );
  } finally {
    await restoredApp?.close();
    await ctx.cleanup();
  }
});

test('requisições externas, token inválido e JSON malformado são recusados', async () => {
  const ctx = await setup();
  try {
    const token = (await ctx.app.inject({ method: 'GET', url: '/api/session' })).json<{
      token: string;
    }>().token;
    for (const url of ['/api/session', '/api/state']) {
      const externalHost = await ctx.app.inject({
        method: 'GET',
        url,
        headers: { host: 'externo.example' },
      });
      assert.equal(externalHost.statusCode, 403, externalHost.body);
      const externalOrigin = await ctx.app.inject({
        method: 'GET',
        url,
        headers: { origin: 'https://externo.example' },
      });
      assert.equal(externalOrigin.statusCode, 403, externalOrigin.body);
    }
    const forged = await ctx.app.inject({
      method: 'POST',
      url: '/api/clients',
      headers: { 'x-csrf-token': token, origin: 'https://externo.example' },
      payload: { name: 'Tentativa externa' },
    });
    assert.equal(forged.statusCode, 403, forged.body);
    const unicode = await ctx.app.inject({
      method: 'POST',
      url: '/api/clients',
      headers: { 'x-csrf-token': 'é'.repeat(64) },
      payload: { name: 'Token inválido' },
    });
    assert.equal(unicode.statusCode, 403, unicode.body);
    const malformed = await ctx.app.inject({
      method: 'POST',
      url: '/api/clients',
      headers: { 'x-csrf-token': token, 'content-type': 'application/json' },
      payload: '{invalido',
    });
    assert.equal(malformed.statusCode, 400, malformed.body);
    assert.equal((await ctx.state()).clients.length, 0);
  } finally {
    await ctx.cleanup();
  }
});

test('vínculos e etapas impedem histórico comercial inconsistente', async () => {
  const ctx = await setup();
  try {
    const { client, opportunity } = await seed(ctx.request);
    const another = await ctx.request<Client>('POST', '/clients', { name: 'Outro cliente' });
    await ctx.request('POST', '/activities', {
      clientId: client.id,
      opportunityId: opportunity.id,
      kind: 'note',
      title: 'Contato registrado',
    });
    await assert.rejects(
      ctx.request('PUT', `/opportunities/${opportunity.id}`, {
        clientId: another.id,
        title: opportunity.title,
      }),
    );
    for (const stage of ['quoted', 'negotiation', 'won'])
      await assert.rejects(
        ctx.request('POST', `/opportunities/${opportunity.id}/stage`, { stage }),
      );
    await ctx.request('POST', `/opportunities/${opportunity.id}/stage`, {
      stage: 'lost',
      lossReason: 'Sem aplicação confirmada',
    });
    await assert.rejects(
      ctx.request('POST', `/opportunities/${opportunity.id}/stage`, { stage: 'new' }),
    );
    const final = (await ctx.state()).opportunities.find((o) => o.id === opportunity.id)!;
    assert.equal(final.clientId, client.id);
    assert.equal(final.stage, 'lost');
  } finally {
    await ctx.cleanup();
  }
});

test('modo demonstração usa base separada e não contamina operação', async () => {
  const ctx = await setup();
  let demo: App | undefined;
  try {
    demo = await createApp({
      dataDir: path.join(ctx.dir, 'demo'),
      mode: 'demo',
      serveStatic: false,
    });
    const demoState = (await demo.inject({ method: 'GET', url: '/api/state' })).json<AppState>();
    assert.equal(demoState.mode, 'demo');
    assert.ok(demoState.clients.length > 0);
    assert.equal((await ctx.state()).clients.length, 0);
    assert.equal((await ctx.state()).mode, 'operational');
  } finally {
    await demo?.close();
    await ctx.cleanup();
  }
});

test('comandos CLI geram backup e restauram preservando a base anterior', async () => {
  const ctx = await setup();
  try {
    await seed(ctx.request);
    await ctx.app.close();
    const backupPath = path.join(ctx.dir, 'cli-copia.sqlite');
    const env = { ...process.env, CRM_DATA_DIR: path.join(ctx.dir, 'data') };
    for (const command of ['backup', 'restore']) {
      const result = spawnSync(
        process.execPath,
        ['--import', 'tsx', `scripts/${command}.ts`, backupPath],
        { env, encoding: 'utf8', windowsHide: true },
      );
      assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    }
    const preserved = (await readdir(env.CRM_DATA_DIR)).some((name) =>
      name.startsWith('before-restore-'),
    );
    assert.ok(preserved);
    const invalid = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/restore.ts'], {
      env,
      encoding: 'utf8',
      windowsHide: true,
    });
    assert.equal(invalid.status, 1);
    assert.match(invalid.stderr, /Uso:/);
  } finally {
    await ctx.cleanup();
  }
});
