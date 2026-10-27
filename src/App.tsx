import { useCallback, useEffect, useState } from 'react';
import {
  Activity as ActivityIcon,
  ArrowRight,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  ChevronRight,
  FileText,
  Gauge,
  Layers3,
  LoaderCircle,
  MessageCircle,
  Package,
  Plus,
  RefreshCw,
  Settings,
  ShieldCheck,
  Truck,
  Users,
  X,
} from 'lucide-react';
import type { AppState, Client, Opportunity } from '../shared/types';
import { STAGE_LABELS } from '../shared/types';
import { date, loadState, money, request, valorComercial } from './api';
import { Badge, Empty, ErrorBox, History, Modal } from './ui';
import { ActivityForm, ClientForm, OpportunityForm, ProductForm } from './forms';
import { DocumentView, QuoteForm, QUOTE_LABELS } from './quotes';
import {
  ActivitiesView,
  ClientsView,
  DashboardView,
  DocumentsView,
  PipelineView,
  ProductsView,
  SettingsView,
  type Dialog,
  type Page,
  type ViewProps,
} from './views';
const pages: {
  id: Page;
  label: string;
  caption: string;
  icon: typeof Gauge;
  action?: string;
  dialog?: Dialog['kind'];
}[] = [
  {
    id: 'dashboard',
    label: 'Visão geral',
    caption: 'Um olhar completo sobre sua operação comercial.',
    icon: Gauge,
  },
  {
    id: 'clients',
    label: 'Clientes',
    caption: 'Contatos próximos. Relacionamentos duradouros.',
    icon: Users,
    action: 'Novo cliente',
    dialog: 'client',
  },
  {
    id: 'opportunities',
    label: 'Negociações',
    caption: 'Cada atendimento, do primeiro contato ao pedido.',
    icon: Layers3,
    action: 'Novo atendimento',
    dialog: 'opportunity',
  },
  {
    id: 'products',
    label: 'Catálogo de peças',
    caption: 'A referência certa para um atendimento preciso.',
    icon: Package,
    action: 'Nova peça',
    dialog: 'product',
  },
  {
    id: 'quotes',
    label: 'Orçamentos',
    caption: 'Propostas claras, com cada detalhe no lugar.',
    icon: FileText,
    action: 'Criar orçamento',
    dialog: 'quote',
  },
  {
    id: 'orders',
    label: 'Pedidos',
    caption: 'Acompanhe os compromissos fechados com seus clientes.',
    icon: Truck,
  },
  {
    id: 'activities',
    label: 'Agenda',
    caption: 'O próximo contato faz toda a diferença.',
    icon: ActivityIcon,
    action: 'Agendar atividade',
    dialog: 'activity',
  },
  {
    id: 'settings',
    label: 'Configurações',
    caption: 'Sua empresa e a continuidade da operação.',
    icon: Settings,
  },
];
export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [page, setPage] = useState<Page>('dashboard');
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [error, setError] = useState<unknown>();
  const [toast, setToast] = useState('');
  const [reloading, setReloading] = useState(false);
  const refresh = useCallback(async () => {
    const next = await loadState();
    setState(next);
  }, []);
  useEffect(() => {
    refresh().catch(setError);
  }, [refresh]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 5500);
    return () => clearTimeout(timer);
  }, [toast]);
  const open = (next: Dialog) => {
    if (!state) return;
    if (
      ['opportunity', 'activity'].includes(next.kind) &&
      !next.id &&
      !state.clients.some((c) => !c.archived)
    ) {
      setPage('clients');
      setToast('Cadastre um cliente para iniciar este atendimento.');
      return;
    }
    if (next.kind === 'quote' && !next.id) {
      if (!state.opportunities.some((o) => !['won', 'lost'].includes(o.stage))) {
        setPage('opportunities');
        setToast('Abra uma negociação antes de criar o orçamento.');
        return;
      }
      if (!state.products.some((p) => !p.archived)) {
        setPage('products');
        setToast('Cadastre uma peça para compor seu orçamento.');
        return;
      }
    }
    setDialog(next);
  };
  async function done() {
    await refresh();
    setDialog(null);
    setToast('Alteração salva. Sua operação está atualizada.');
  }
  const current = pages.find((p) => p.id === page)!;
  const view: ViewProps = state
    ? { state, open, refresh, navigate: setPage, notify: setToast }
    : null!;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          href="#"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            setPage('dashboard');
          }}
          aria-label="Rota Pesada, visão geral"
        >
          <span className="brand-mark">
            <Truck size={25} strokeWidth={1.8} />
          </span>
          <span>
            ROTA
            <span>
              PESADA<span className="brand-period">.</span>
            </span>
            <small>CRM DE DISTRIBUIÇÃO</small>
          </span>
        </a>
        <div className="workspace-label">
          <span className="workspace-avatar">
            {state?.settings.companyName?.slice(0, 2).toUpperCase() || 'RP'}
          </span>
          <div>
            <strong>{state?.settings.companyName || 'Sua distribuidora'}</strong>
            <small>Workspace comercial</small>
          </div>
          <ChevronRight size={14} />
        </div>
        <div className="nav-label">CENTRAL DE OPERAÇÕES</div>
        <nav aria-label="Navegação principal">
          {pages.slice(0, 7).map((p) => (
            <button
              className={page === p.id ? 'nav-item active' : 'nav-item'}
              key={p.id}
              aria-label={p.label}
              onClick={() => {
                setPage(p.id);
                setError(null);
              }}
              aria-current={page === p.id ? 'page' : undefined}
            >
              <p.icon size={19} />
              <span>{p.label}</span>
              {p.id === 'activities' && !!state?.dashboard.overdueCount && (
                <b>{state.dashboard.overdueCount}</b>
              )}
              {page === p.id && <ChevronRight size={15} />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="eyebrow">FORÇA EM CADA RELAÇÃO</span>
            <p>
              Mais proximidade.
              <br />
              Mais estrada pela frente.
            </p>
            <ArrowUpRight size={23} />
          </div>
          <button
            className={page === 'settings' ? 'nav-item active' : 'nav-item'}
            onClick={() => setPage('settings')}
          >
            <Settings size={18} />
            <span>Configurações</span>
          </button>
          <div className="sidebar-footer">
            <span className="status-dot" />
            PILOTO LOCAL<span>V. 0.1</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Operação comercial
            <ChevronRight size={13} />
            <strong>{current.label}</strong>
          </div>
          <div className="topbar-right">
            <span className="local-status">
              <span className="status-dot" />
              Local
            </span>
            <button
              className="icon-button"
              aria-label="Atualizar dados"
              disabled={reloading}
              onClick={async () => {
                setReloading(true);
                setError(null);
                try {
                  await refresh();
                  setToast('Dados atualizados.');
                } catch (e) {
                  setError(e);
                } finally {
                  setReloading(false);
                }
              }}
            >
              <RefreshCw size={17} className={reloading ? 'spin' : ''} />
            </button>
            <span className="user-avatar">RP</span>
          </div>
        </header>
        <main id="main-content">
          {state?.mode === 'demo' && (
            <div className="demo-banner">
              <ShieldCheck size={17} />
              <strong>DEMONSTRAÇÃO</strong>Dados fictícios em banco separado. Este não é o ambiente
              operacional.
            </div>
          )}
          <div className="page-heading">
            <div>
              <div className="page-kicker">
                ROTA PESADA <span>/</span>{' '}
                {new Intl.DateTimeFormat('pt-BR', {
                  timeZone: 'America/Sao_Paulo',
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                }).format(new Date())}
              </div>
              <h1>{current.label}</h1>
              <p>{current.caption}</p>
            </div>
            {current.dialog && (
              <button className="button primary" onClick={() => open({ kind: current.dialog! })}>
                <Plus size={17} />
                {current.action}
              </button>
            )}
          </div>
          <ErrorBox error={error} />
          {!state ? (
            error ? (
              <div className="panel">
                <Empty
                  title="Não conseguimos acessar a operação"
                  description="Confira se o servidor local está em execução e tente atualizar os dados."
                  action="Tentar novamente"
                  onAction={() => {
                    setError(null);
                    void refresh().catch(setError);
                  }}
                />
              </div>
            ) : (
              <div className="loading">
                <LoaderCircle size={30} className="spin" />
                <p>Preparando sua operação…</p>
              </div>
            )
          ) : (
            <>
              {page === 'dashboard' && <DashboardView {...view} />}{' '}
              {page === 'clients' && <ClientsView {...view} />}{' '}
              {page === 'products' && <ProductsView {...view} />}{' '}
              {page === 'opportunities' && <PipelineView {...view} />}{' '}
              {page === 'quotes' && <DocumentsView {...view} />}{' '}
              {page === 'orders' && <DocumentsView {...view} isOrder />}{' '}
              {page === 'activities' && <ActivitiesView {...view} />}{' '}
              {page === 'settings' && <SettingsView {...view} />}
            </>
          )}
          <footer className="main-footer">
            <span>
              ROTA PESADA<span className="brand-period">.</span>
            </span>
            <small>Feito para quem mantém o mundo em movimento.</small>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          <span>{toast}</span>
          <button className="icon-button" aria-label="Dispensar aviso" onClick={() => setToast('')}>
            <X size={15} />
          </button>
        </div>
      )}
      {state && dialog && (
        <DialogContent
          key={`${dialog.kind}-${dialog.id ?? 'new'}`}
          dialog={dialog}
          state={state}
          onClose={() => setDialog(null)}
          onDone={done}
          refresh={refresh}
          open={open}
        />
      )}
    </div>
  );
}
function DialogContent({
  dialog,
  state,
  onClose,
  onDone,
  refresh,
  open,
}: {
  dialog: Dialog;
  state: AppState;
  onClose: () => void;
  onDone: () => Promise<void>;
  refresh: () => Promise<void>;
  open: (dialog: Dialog) => void;
}) {
  const { kind, id } = dialog;
  const client = state.clients.find((c) => c.id === id);
  const opportunity = state.opportunities.find((o) => o.id === id);
  const product = state.products.find((p) => p.id === id);
  const quote = state.quotes.find((q) => q.id === id);
  const order = state.orders.find((o) => o.id === id);
  const activity = state.activities.find((a) => a.id === id);
  const titles = {
    client: id ? 'Editar cliente' : 'Novo cliente',
    product: id ? 'Editar peça' : 'Nova peça',
    opportunity: id ? 'Editar atendimento' : 'Novo atendimento',
    activity: id ? 'Editar atividade' : 'Agendar atividade',
    quote: id ? 'Editar orçamento' : 'Criar orçamento',
    clientDetail: client?.name ?? 'Cliente',
    opportunityDetail: opportunity?.title ?? 'Negociação',
    quoteDetail: 'Orçamento comercial',
    orderDetail: 'Pedido de venda',
  };
  return (
    <Modal
      title={titles[kind]}
      onClose={onClose}
      wide={['quote', 'quoteDetail', 'orderDetail', 'clientDetail', 'opportunityDetail'].includes(
        kind,
      )}
    >
      {kind === 'client' && <ClientForm item={client} onClose={onClose} onDone={onDone} />}{' '}
      {kind === 'product' && (
        <>
          <ProductForm item={product} onClose={onClose} onDone={onDone} />
          {product && (
            <ArchiveButton
              endpoint={`/api/products/${product.id}`}
              archived={product.archived}
              onDone={onDone}
            />
          )}
        </>
      )}
      {kind === 'opportunity' && (
        <OpportunityForm
          state={state}
          item={opportunity}
          clientId={dialog.clientId}
          onClose={onClose}
          onDone={onDone}
        />
      )}{' '}
      {kind === 'activity' && (
        <ActivityForm
          state={state}
          item={activity}
          clientId={dialog.clientId}
          opportunityId={dialog.opportunityId}
          onClose={onClose}
          onDone={onDone}
        />
      )}{' '}
      {kind === 'quote' && (
        <QuoteForm
          state={state}
          item={quote}
          opportunityId={dialog.opportunityId}
          onClose={onClose}
          onDone={onDone}
        />
      )}{' '}
      {kind === 'quoteDetail' && quote && (
        <DocumentView
          document={quote}
          state={state}
          onClose={onClose}
          onAction={refresh}
          onEdit={(q) => open({ kind: 'quote', id: q.id })}
        />
      )}{' '}
      {kind === 'orderDetail' && order && (
        <DocumentView document={order} state={state} isOrder onClose={onClose} onAction={refresh} />
      )}{' '}
      {kind === 'clientDetail' && client && (
        <ClientDetail client={client} state={state} open={open} onDone={onDone} />
      )}{' '}
      {kind === 'opportunityDetail' && opportunity && (
        <OpportunityDetail opportunity={opportunity} state={state} open={open} />
      )}
    </Modal>
  );
}
function ArchiveButton({
  endpoint,
  archived,
  onDone,
}: {
  endpoint: string;
  archived: boolean;
  onDone: () => Promise<void>;
}) {
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  return (
    <div className="archive-section">
      <ErrorBox error={error} />
      <button
        className="text-button danger"
        disabled={busy}
        onClick={async () => {
          if (
            !window.confirm(
              archived
                ? 'Reativar este cadastro?'
                : 'Arquivar este cadastro? O histórico será preservado.',
            )
          )
            return;
          setBusy(true);
          try {
            await request(endpoint, 'PUT', { archived: !archived });
            await onDone();
          } catch (e) {
            setError(e);
          } finally {
            setBusy(false);
          }
        }}
      >
        {archived ? 'Reativar cadastro' : 'Arquivar cadastro'}
      </button>
      <small>
        {archived
          ? 'O cadastro poderá voltar a ser usado.'
          : 'O cadastro sai das listas ativas e mantém seus vínculos.'}
      </small>
    </div>
  );
}
function ClientDetail({
  client,
  state,
  open,
  onDone,
}: {
  client: Client;
  state: AppState;
  open: (dialog: Dialog) => void;
  onDone: () => Promise<void>;
}) {
  const deals = state.opportunities.filter((o) => o.clientId === client.id);
  const activities = state.activities.filter((a) => a.clientId === client.id);
  const ids = new Set([
    client.id,
    ...deals.map((o) => o.id),
    ...activities.map((a) => a.id),
    ...state.quotes.filter((q) => q.clientId === client.id).map((q) => q.id),
    ...state.orders.filter((o) => o.clientId === client.id).map((o) => o.id),
  ]);
  const phone = client.phone.replace(/\D/g, '');
  const whatsapp = phone.length === 10 || phone.length === 11 ? `55${phone}` : phone;
  return (
    <div className="modal-body">
      <div className="detail-summary">
        <div className="large-avatar">{client.name.slice(0, 2).toUpperCase()}</div>
        <div>
          <Badge>{client.segment}</Badge>
          <h3>{client.name}</h3>
          <p>
            {client.city}
            {client.state ? ` / ${client.state}` : ''} ·{' '}
            {client.document || 'Documento não informado'}
          </p>
        </div>
        <button className="button small" onClick={() => open({ kind: 'client', id: client.id })}>
          Editar cadastro
        </button>
      </div>
      <div className="detail-facts">
        <div>
          <span>Telefone</span>
          <strong>{client.phone || 'Não informado'}</strong>
        </div>
        <div>
          <span>E-mail</span>
          <strong>{client.email || 'Não informado'}</strong>
        </div>
        <div>
          <span>Cliente desde</span>
          <strong>{date(client.createdAt)}</strong>
        </div>
      </div>
      {client.notes && <p className="detail-note">{client.notes}</p>}
      {client.contacts.length > 0 && (
        <section className="detail-section">
          <h3>Pessoas de contato</h3>
          {client.contacts.map((c, i) => (
            <p key={i}>
              <strong>{c.name}</strong> · {c.phone || 'Sem telefone'} {c.email && `· ${c.email}`}
            </p>
          ))}
        </section>
      )}
      <div className="row-actions detail-actions">
        {!client.archived && (
          <>
            <button
              className="button primary"
              onClick={() => open({ kind: 'opportunity', clientId: client.id })}
            >
              <Plus size={16} />
              Novo atendimento
            </button>
            <button
              className="button"
              onClick={() => open({ kind: 'activity', clientId: client.id })}
            >
              Agendar retorno
            </button>
          </>
        )}
        {whatsapp && (
          <a className="button" target="_blank" rel="noreferrer" href={`https://wa.me/${whatsapp}`}>
            <MessageCircle size={16} />
            Abrir WhatsApp
            <ArrowUpRight size={13} />
          </a>
        )}
      </div>
      <section className="detail-section">
        <h3>
          Negociações <Badge>{deals.length}</Badge>
        </h3>
        {deals.length ? (
          deals.map((o) => (
            <button
              className="detail-row"
              key={o.id}
              onClick={() => open({ kind: 'opportunityDetail', id: o.id })}
            >
              <span>{o.title}</span>
              <Badge tone={o.stage === 'won' ? 'green' : 'neutral'}>{STAGE_LABELS[o.stage]}</Badge>
              <b>{money(valorComercial(state, o))}</b>
              <ArrowRight size={15} />
            </button>
          ))
        ) : (
          <p className="muted">Nenhum atendimento aberto para este cliente.</p>
        )}
      </section>
      <section className="detail-section">
        <h3>Agenda e interações</h3>
        {activities.length ? (
          activities.map((a) => (
            <button
              className="detail-row"
              key={a.id}
              onClick={() => open({ kind: 'activity', id: a.id })}
            >
              <span>{a.title}</span>
              <Badge tone={a.completedAt ? 'green' : 'neutral'}>
                {a.completedAt ? 'Concluída' : date(a.dueAt, true)}
              </Badge>
              <ArrowRight size={15} />
            </button>
          ))
        ) : (
          <p className="muted">Registre uma ligação ou agende o próximo contato.</p>
        )}
      </section>
      <History events={state.events.filter((e) => ids.has(e.entityId))} />
      <ArchiveButton
        endpoint={`/api/clients/${client.id}`}
        archived={client.archived}
        onDone={onDone}
      />
    </div>
  );
}
function OpportunityDetail({
  opportunity,
  state,
  open,
}: {
  opportunity: Opportunity;
  state: AppState;
  open: (dialog: Dialog) => void;
}) {
  const client = state.clients.find((c) => c.id === opportunity.clientId);
  const quotes = state.quotes.filter((q) => q.opportunityId === opportunity.id);
  const activeQuote = quotes.find((q) => q.status === 'draft' || q.status === 'sent');
  const orders = state.orders.filter((o) => o.opportunityId === opportunity.id);
  const activities = state.activities.filter((a) => a.opportunityId === opportunity.id);
  const ids = new Set([
    opportunity.id,
    ...quotes.map((q) => q.id),
    ...orders.map((o) => o.id),
    ...activities.map((a) => a.id),
  ]);
  return (
    <div className="modal-body">
      <div className="detail-summary">
        <div>
          <Badge
            tone={
              opportunity.stage === 'won' ? 'green' : opportunity.stage === 'lost' ? 'red' : 'amber'
            }
          >
            {STAGE_LABELS[opportunity.stage]}
          </Badge>
          <h3>{client?.name}</h3>
          <p>{opportunity.vehicle || 'Veículo / aplicação a confirmar'}</p>
        </div>
        <strong className="detail-value">{money(valorComercial(state, opportunity))}</strong>
      </div>
      {opportunity.need && <p className="detail-note">{opportunity.need}</p>}
      {opportunity.lossReason && (
        <div className="notice">
          <p>Motivo da perda: {opportunity.lossReason}</p>
        </div>
      )}
      <div className="row-actions detail-actions">
        {!['won', 'lost'].includes(opportunity.stage) && (
          <>
            <button
              className="button primary"
              onClick={() =>
                open(
                  activeQuote
                    ? { kind: 'quoteDetail', id: activeQuote.id }
                    : { kind: 'quote', opportunityId: opportunity.id },
                )
              }
            >
              {activeQuote ? <FileText size={16} /> : <Plus size={16} />}{' '}
              {activeQuote ? 'Abrir orçamento atual' : 'Criar orçamento'}
            </button>
            <button
              className="button"
              onClick={() => open({ kind: 'opportunity', id: opportunity.id })}
            >
              Editar atendimento
            </button>
          </>
        )}
        <button
          className="button"
          onClick={() =>
            open({
              kind: 'activity',
              clientId: opportunity.clientId,
              opportunityId: opportunity.id,
            })
          }
        >
          Agendar atividade
        </button>
        {client && (
          <button
            className="text-button"
            onClick={() => open({ kind: 'clientDetail', id: client.id })}
          >
            Ficha do cliente
            <ArrowRight size={15} />
          </button>
        )}
      </div>
      <section className="detail-section">
        <h3>Orçamentos e revisões</h3>
        {quotes.length ? (
          quotes.map((q) => (
            <button
              className="detail-row"
              key={q.id}
              onClick={() => open({ kind: 'quoteDetail', id: q.id })}
            >
              <FileText size={17} />
              <span>
                #{String(q.number).padStart(4, '0')} · Revisão {q.revision}
              </span>
              <Badge>{QUOTE_LABELS[q.status]}</Badge>
              <b>{money(q.totalCents)}</b>
              <ChevronRight size={15} />
            </button>
          ))
        ) : (
          <p className="muted">Crie uma proposta para transformar esta necessidade em pedido.</p>
        )}
      </section>
      {orders.length > 0 && (
        <section className="detail-section">
          <h3>Pedidos vinculados</h3>
          {orders.map((o) => (
            <button
              className="detail-row"
              key={o.id}
              onClick={() => open({ kind: 'orderDetail', id: o.id })}
            >
              <Truck size={17} />
              <span>Pedido #{String(o.number).padStart(4, '0')}</span>
              <b>{money(o.totalCents)}</b>
              <ArrowRight size={15} />
            </button>
          ))}
        </section>
      )}
      <History events={state.events.filter((e) => ids.has(e.entityId))} />
    </div>
  );
}
