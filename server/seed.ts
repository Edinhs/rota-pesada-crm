import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { Client, Product, Opportunity, Quote, Activity, Order } from '../shared/types.ts';

export function seedDemo({
  save,
  audit,
  db,
}: {
  save: (table: any, entity: any) => void;
  audit: (type: string, id: string, action: string, detail?: string) => void;
  db: DatabaseSync;
}) {
  const today = new Date(),
    stamp = today.toISOString();
  const meta = () => ({ id: randomUUID(), createdAt: stamp, updatedAt: stamp });
  const after = (days: number) => new Date(today.getTime() + days * 86400000).toISOString();
  const clients: Client[] = [
    ['Transportadora Horizonte', 'Frotista', 'Curitiba', 'PR'],
    ['Oficina Diesel Norte', 'Oficina', 'Belo Horizonte', 'MG'],
    ['Via Carga Logística', 'Transportadora', 'Joinville', 'SC'],
    ['Mecânica Rota 040', 'Oficina', 'Contagem', 'MG'],
  ].map(([name, segment, city, state]) => ({
    ...meta(),
    name,
    type: 'PJ',
    segment,
    document: '',
    phone: '',
    email: '',
    city,
    state,
    notes: 'Empresa fictícia para demonstração. Não usar como cadastro real.',
    contacts: [],
    archived: false,
  }));
  clients.forEach((c) => save('clients', c));
  const products: Product[] = [
    ['DEMO-FLT-001', 'Filtro de óleo — linha pesada', 'Filtros', 18990, 'available'],
    ['DEMO-FRE-002', 'Jogo de pastilhas de freio', 'Freios', 45900, 'available'],
    ['DEMO-SUS-003', 'Amortecedor dianteiro', 'Suspensão', 68900, 'on_order'],
    ['DEMO-EMB-004', 'Kit de embreagem', 'Transmissão', 289900, 'unknown'],
    ['DEMO-COR-005', 'Correia de acessórios', 'Motor', 24990, 'available'],
  ].map(([sku, description, category, priceCents, availability], index) => ({
    ...meta(),
    sku: String(sku),
    description: String(description),
    manufacturer: 'Marca demonstrativa',
    category: String(category),
    unit: 'UN',
    priceCents: Number(priceCents),
    references: [`REF-FICTICIA-${index + 1}`],
    application:
      'Exemplo fictício. Confirme a aplicação no catálogo do fabricante antes de vender.',
    location: `A${index + 1}-01`,
    availability: availability as Product['availability'],
    availabilityUpdatedAt: stamp,
    archived: false,
  }));
  products.forEach((p) => save('products', p));
  const opportunities: Opportunity[] = [
    ['Reposição preventiva da frota', 'qualification', 0, 125000],
    ['Orçamento de freios', 'quoted', 1, 91800],
    ['Kit para revisão do motor', 'new', 2, 320000],
    ['Troca de amortecedores', 'negotiation', 3, 137800],
    ['Manutenção concluída', 'won', 0, 75960],
    ['Cotação de embreagem', 'lost', 1, 289900],
  ].map(([title, stage, index, value]) => ({
    ...meta(),
    clientId: clients[Number(index)].id,
    title: String(title),
    need: 'Atendimento demonstrativo para validar o fluxo comercial.',
    vehicle: 'Caminhão — dados a confirmar',
    stage: stage as Opportunity['stage'],
    lossReason: stage === 'lost' ? 'Prazo de entrega' : '',
    closedAt: ['won', 'lost'].includes(String(stage)) ? stamp : null,
    estimatedValueCents: Number(value),
  }));
  opportunities.forEach((o) => save('opportunities', o));
  for (const [index, productIndex, quantity] of [
    [1, 1, 2],
    [3, 2, 2],
    [4, 0, 4],
  ]) {
    const o = opportunities[index],
      p = products[productIndex];
    const quote: Quote = {
      ...meta(),
      opportunityId: o.id,
      clientId: o.clientId,
      number: index + 100,
      revision: 1,
      familyId: randomUUID(),
      status: o.stage === 'won' ? 'accepted' : 'sent',
      validUntil: after(7).slice(0, 10),
      paymentTerms: 'A combinar',
      notes: 'Proposta de demonstração; valores fictícios.',
      items: [
        {
          productId: p.id,
          sku: p.sku,
          description: p.description,
          unit: p.unit,
          quantity,
          unitPriceCents: p.priceCents,
        },
      ],
      discountCents: 0,
      freightCents: 0,
      totalCents: p.priceCents * quantity,
      clientSnapshot: clients.find((c) => c.id === o.clientId)!,
      sentAt: stamp,
    };
    save('quotes', quote);
    if (o.stage === 'won') {
      const order: Order = {
        ...meta(),
        opportunityId: o.id,
        quoteId: quote.id,
        clientId: o.clientId,
        number: 1,
        status: 'completed',
        cancellationReason: '',
        items: quote.items,
        clientSnapshot: quote.clientSnapshot!,
        discountCents: 0,
        freightCents: 0,
        totalCents: quote.totalCents,
        paymentTerms: quote.paymentTerms,
        notes: quote.notes,
      };
      save('orders', order);
    }
  }
  const activities: Activity[] = [
    ['Retornar orçamento de freios', 1, -1, 'call'],
    ['Confirmar aplicação da peça', 3, 0, 'task'],
    ['Contato de acompanhamento', 0, 1, 'whatsapp'],
  ].map(([title, index, days, kind]) => ({
    ...meta(),
    clientId: opportunities[Number(index)].clientId,
    opportunityId: opportunities[Number(index)].id,
    kind: kind as Activity['kind'],
    title: String(title),
    notes: 'Atividade fictícia.',
    dueAt: after(Number(days)),
    completedAt: null,
  }));
  activities.forEach((a) => save('activities', a));
  db.prepare('INSERT INTO settings(id,payload) VALUES(1,?)').run(
    JSON.stringify({
      companyName: 'Rota Pesada • Demonstração',
      phone: '',
      address: 'Ambiente fictício de treinamento',
    }),
  );
  audit('system', 'demo', 'seeded', 'Base fictícia criada somente na área de demonstração.');
}
