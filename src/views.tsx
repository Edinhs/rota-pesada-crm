import { useEffect, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  ChevronRight,
  Clock3,
  FileText,
  MessageCircle,
  Plus,
  Search,
  Truck,
  Users,
  Package,
  TrendingUp,
} from 'lucide-react';
import type { AppState, Dashboard, Stage } from '../shared/types';
import { STAGES, STAGE_LABELS, AVAILABILITY_LABELS } from '../shared/types';
import { date, download, money, request, saoPauloDay, valorComercial } from './api';
import { Badge, Empty, ErrorBox, Field } from './ui';
import { ORDER_LABELS, QUOTE_LABELS } from './quotes';
export type Page =
  | 'dashboard'
  | 'clients'
  | 'opportunities'
  | 'products'
  | 'quotes'
  | 'orders'
  | 'activities'
  | 'settings';
export type Dialog = {
  kind:
    | 'client'
    | 'clientDetail'
    | 'product'
    | 'opportunity'
    | 'opportunityDetail'
    | 'activity'
    | 'quote'
    | 'quoteDetail'
    | 'orderDetail';
  id?: string;
  clientId?: string;
  opportunityId?: string;
};
export type ViewProps = {
  state: AppState;
  open: (dialog: Dialog) => void;
  refresh: () => Promise<void>;
  navigate: (page: Page) => void;
  notify: (message: string) => void;
};
export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="search-box">
      <Search size={17} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
export function DashboardView({ state, open, navigate }: ViewProps) {
  const [dashboard, setDashboard] = useState<Dashboard>(state.dashboard);
  const [from, setFrom] = useState(state.dashboard.from.slice(0, 10));
  const [to, setTo] = useState(state.dashboard.to.slice(0, 10));
  const [error, setError] = useState<unknown>();
  useEffect(() => setDashboard(state.dashboard), [state.dashboard]);
  const due = state.activities
    .filter((a) => !a.completedAt)
    .sort((a, b) => (a.dueAt ?? 'z').localeCompare(b.dueAt ?? 'z'))
    .slice(0, 5);
  const recent = state.opportunities
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 4);
  return (
    <>
      <section className="hero">
        <div>
          <span className="eyebrow">SUA OPERAÇÃO, NO RUMO CERTO</span>
          <h2>
            Peças certas.
            <br />
            <em>Relações que movem.</em>
          </h2>
          <p>
            Do primeiro contato ao pedido confirmado, acompanhe cada negociação da sua
            distribuidora.
          </p>
          <button
            className="button amber"
            onClick={() =>
              open({ kind: state.clients.some((c) => !c.archived) ? 'opportunity' : 'client' })
            }
          >
            <Plus size={16} />
            {state.clients.some((c) => !c.archived)
              ? 'Novo atendimento'
              : 'Cadastrar primeiro cliente'}
            <ArrowRight size={17} />
          </button>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="route-route" />
          <div className="hero-code">
            RP<span>/01</span>
          </div>
          <Truck size={91} strokeWidth={1} />
          <div className="hero-caption">
            DISTRIBUIÇÃO
            <br />
            LINHA PESADA
          </div>
        </div>
      </section>
      <div className="period-bar">
        <span>
          <Clock3 size={15} />
          Resultados comerciais por fechamento
        </span>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            try {
              setDashboard(await request<Dashboard>(`/api/dashboard?from=${from}&to=${to}`));
            } catch (err) {
              setError(err);
            }
          }}
        >
          <input
            type="date"
            aria-label="Data inicial"
            required
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <span>até</span>
          <input
            type="date"
            aria-label="Data final"
            required
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          <button className="button small">Aplicar</button>
        </form>
      </div>
      <ErrorBox error={error} />
      <div className="stats-grid">
        {[
          {
            label: 'Em negociação',
            value: money(dashboard.pipelineCents),
            foot: `${dashboard.openCount} atendimento${dashboard.openCount !== 1 ? 's' : ''} em aberto`,
            icon: TrendingUp,
          },
          {
            label: 'Vendas ganhas',
            value: money(dashboard.wonCents),
            foot: `${dashboard.wonCount} negociação${dashboard.wonCount !== 1 ? 'ões' : 'o'} ganha${dashboard.wonCount !== 1 ? 's' : ''} no período`,
            icon: Truck,
          },
          {
            label: 'Taxa de conversão',
            value:
              dashboard.winRate === null
                ? '—'
                : `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(dashboard.winRate * 100)}%`,
            foot: `${dashboard.wonCount} ganhas / ${dashboard.wonCount + dashboard.lostCount} encerradas`,
            icon: Check,
          },
          {
            label: 'Retornos atrasados',
            value: String(dashboard.overdueCount).padStart(2, '0'),
            foot: 'Atividades pendentes até agora',
            icon: Clock3,
          },
        ].map((metric, index) => (
          <article className={`stat-card stat-${index}`} key={metric.label}>
            <div>
              <span>{metric.label}</span>
              <metric.icon size={18} />
            </div>
            <strong>{metric.value}</strong>
            <small>{metric.foot}</small>
          </article>
        ))}
      </div>
      <p className="metric-note">
        Carteira e atrasos refletem o momento atual. Vendas ganhas representam pedidos confirmados,
        não recebimentos financeiros.
      </p>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">PRÓXIMA AÇÃO</span>
              <h3>Sua agenda de atendimento</h3>
            </div>
            <button className="text-button" onClick={() => navigate('activities')}>
              Ver agenda
              <ArrowRight size={15} />
            </button>
          </div>
          {due.length ? (
            <div className="activity-list">
              {due.map((a) => (
                <button
                  key={a.id}
                  className="activity-preview"
                  onClick={() => open({ kind: 'activity', id: a.id })}
                >
                  <span
                    className={`activity-symbol ${a.dueAt && a.dueAt < new Date().toISOString() ? 'late' : ''}`}
                  >
                    <Clock3 size={18} />
                  </span>
                  <span>
                    <strong>{a.title}</strong>
                    <small>{state.clients.find((c) => c.id === a.clientId)?.name}</small>
                  </span>
                  <time>{date(a.dueAt, true)}</time>
                  <ChevronRight size={15} />
                </button>
              ))}
            </div>
          ) : (
            <Empty
              title="Tudo pronto para o próximo contato"
              description="Agende retornos e mantenha cada oportunidade em movimento."
              action="Agendar atividade"
              onAction={() => open({ kind: 'activity' })}
            />
          )}
        </section>
        <section className="panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">NO SEU RADAR</span>
              <h3>Últimas negociações</h3>
            </div>
            <button
              className="icon-button"
              aria-label="Ver negociações"
              onClick={() => navigate('opportunities')}
            >
              <ArrowRight size={18} />
            </button>
          </div>
          {recent.length ? (
            recent.map((o) => (
              <button
                className="deal-preview"
                key={o.id}
                onClick={() => open({ kind: 'opportunityDetail', id: o.id })}
              >
                <span>
                  <strong>{o.title}</strong>
                  <small>{state.clients.find((c) => c.id === o.clientId)?.name}</small>
                </span>
                <span>
                  <b>{money(valorComercial(state, o))}</b>
                  <Badge tone={o.stage === 'won' ? 'green' : 'neutral'}>
                    {STAGE_LABELS[o.stage]}
                  </Badge>
                </span>
              </button>
            ))
          ) : (
            <Empty
              title="Seu próximo negócio começa aqui"
              description="Cadastre um cliente e abra o primeiro atendimento."
            />
          )}
        </section>
      </div>
      {dashboard.lossReasons.length > 0 && (
        <section className="panel loss-panel">
          <h3>O que podemos aprender com as perdas</h3>
          {dashboard.lossReasons.map((r) => (
            <div key={r.reason}>
              <span>{r.reason}</span>
              <Badge>{r.count}</Badge>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
export function ClientsView({ state, open, notify }: ViewProps) {
  const [search, setSearch] = useState('');
  const [archived, setArchived] = useState(false);
  const clients = state.clients.filter(
    (c) =>
      c.archived === archived &&
      `${c.name} ${c.document} ${c.phone} ${c.city} ${c.segment}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase()),
  );
  return (
    <>
      <div className="toolbar">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar cliente, documento ou cidade"
        />
        <div className="row-actions">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={archived}
              onChange={(e) => setArchived(e.target.checked)}
            />
            Arquivados
          </label>
          <button
            className="button"
            onClick={() =>
              download('/api/export/clients', 'clientes.csv').catch((e) => notify(e.message))
            }
          >
            <ArrowDownToLine size={16} />
            CSV
          </button>
        </div>
      </div>
      <div className="panel">
        {clients.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Segmento</th>
                  <th>Contato</th>
                  <th>Localização</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <button
                        className="table-link"
                        onClick={() => open({ kind: 'clientDetail', id: c.id })}
                      >
                        <span className="avatar">{c.name.slice(0, 2).toUpperCase()}</span>
                        <span>
                          <strong>{c.name}</strong>
                          <small>{c.document || 'Documento não informado'}</small>
                        </span>
                      </button>
                    </td>
                    <td>
                      <Badge>{c.segment || 'Não informado'}</Badge>
                    </td>
                    <td>
                      {c.phone || '—'}
                      <small>{c.email}</small>
                    </td>
                    <td>
                      {c.city || '—'}
                      {c.state ? ` / ${c.state}` : ''}
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={`Abrir ${c.name}`}
                        onClick={() => open({ kind: 'clientDetail', id: c.id })}
                      >
                        <ArrowRight size={17} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title={
              search
                ? 'Nenhum cliente encontrado'
                : archived
                  ? 'Nenhum cliente arquivado'
                  : 'Conheça quem compra de você'
            }
            description={
              search
                ? 'Tente outro nome, documento ou cidade.'
                : 'Organize contatos, necessidades e todo o histórico comercial em uma ficha.'
            }
            action={!search && !archived ? 'Cadastrar cliente' : undefined}
            onAction={() => open({ kind: 'client' })}
          />
        )}
      </div>
      <div className="list-foot">
        <Users size={15} />
        {clients.length} cliente(s) nesta visualização
      </div>
    </>
  );
}
export function ProductsView({ state, open, notify }: ViewProps) {
  const [search, setSearch] = useState('');
  const [archived, setArchived] = useState(false);
  const products = state.products.filter(
    (p) =>
      p.archived === archived &&
      `${p.sku} ${p.description} ${p.manufacturer} ${p.references.join(' ')} ${p.application}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase()),
  );
  return (
    <>
      <div className="toolbar">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar código, referência, marca ou aplicação"
        />
        <div className="row-actions">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={archived}
              onChange={(e) => setArchived(e.target.checked)}
            />
            Arquivadas
          </label>
          <button
            className="button"
            onClick={() =>
              download('/api/export/products', 'pecas.csv').catch((e) => notify(e.message))
            }
          >
            <ArrowDownToLine size={16} />
            CSV
          </button>
        </div>
      </div>
      <div className="notice">
        <Package size={18} />
        <p>
          Catálogo comercial com disponibilidade manual. Confirme a aplicação com o fabricante e a
          disponibilidade antes da venda.
        </p>
      </div>
      <div className="panel">
        {products.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Peça</th>
                  <th>Marca / categoria</th>
                  <th>Aplicação</th>
                  <th>Disponibilidade</th>
                  <th>Preço referência</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <span className="mono">{p.sku}</span>
                      <strong>{p.description}</strong>
                      <small>{p.references.join(' · ') || 'Sem referências adicionais'}</small>
                    </td>
                    <td>
                      {p.manufacturer || '—'}
                      <small>{p.category}</small>
                    </td>
                    <td className="cell-wrap">
                      {p.application || 'A confirmar'}
                      <small>{p.location && `Localização: ${p.location}`}</small>
                    </td>
                    <td>
                      <Badge
                        tone={
                          p.availability === 'available'
                            ? 'green'
                            : p.availability === 'unavailable'
                              ? 'red'
                              : 'amber'
                        }
                      >
                        {AVAILABILITY_LABELS[p.availability]}
                      </Badge>
                      <small>Atualizado {date(p.availabilityUpdatedAt)}</small>
                    </td>
                    <td className="price">
                      {money(p.priceCents)}
                      <small>por {p.unit}</small>
                    </td>
                    <td>
                      <button
                        className="button small"
                        onClick={() => open({ kind: 'product', id: p.id })}
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title={search ? 'Nenhuma peça encontrada' : 'Um catálogo que entende de linha pesada'}
            description="Cadastre códigos, referências e aplicações para agilizar seus orçamentos."
            action={!search ? 'Cadastrar peça' : undefined}
            onAction={() => open({ kind: 'product' })}
          />
        )}
      </div>
      <div className="list-foot">
        <Package size={15} />
        {products.length} peça(s) nesta visualização
      </div>
    </>
  );
}
export function PipelineView({ state, open, refresh }: ViewProps) {
  const [search, setSearch] = useState('');
  const [error, setError] = useState<unknown>();
  const [dragging, setDragging] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const deals = state.opportunities.filter((o) =>
    `${o.title} ${state.clients.find((c) => c.id === o.clientId)?.name}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  async function move(id: string, stage: Stage) {
    if (stage === 'won') {
      setError(
        new Error(
          'Para ganhar uma negociação, aceite um orçamento e crie o pedido na ficha da negociação.',
        ),
      );
      return;
    }
    const current = state.opportunities.find((o) => o.id === id);
    if (current?.stage === stage) return;
    let lossReason: string | undefined;
    if (stage === 'lost') {
      lossReason = window.prompt('Qual foi o motivo da perda?')?.trim();
      if (!lossReason) return;
    }
    setMoving(true);
    setError(null);
    try {
      await request(`/api/opportunities/${id}/stage`, 'POST', { stage, lossReason });
      await refresh();
    } catch (e) {
      setError(e);
    } finally {
      setMoving(false);
      setDragging(null);
    }
  }
  return (
    <>
      <div className="toolbar">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar negociação ou cliente"
        />
        <span className="muted">
          {deals.length} atendimento(s) · Arraste os cartões ou use Mover
        </span>
      </div>
      <ErrorBox error={error} />
      {!state.opportunities.length ? (
        <div className="panel">
          <Empty
            title="Dê partida no seu processo comercial"
            description="Abra um atendimento, entenda a peça necessária e acompanhe até o pedido."
            action="Novo atendimento"
            onAction={() => open({ kind: 'opportunity' })}
          />
        </div>
      ) : (
        <div className="kanban">
          {STAGES.map((stage, index) => {
            const items = deals.filter((o) => o.stage === stage);
            return (
              <section
                className={`kanban-column column-${stage} ${dragging ? 'droppable' : ''}`}
                key={stage}
                onDragOver={(e) => {
                  if (stage !== 'won') e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData('text/plain');
                  if (id && !moving) void move(id, stage);
                }}
              >
                <div className="column-head">
                  <span className="stage-dot" />
                  <h3>{STAGE_LABELS[stage]}</h3>
                  <b>{items.length}</b>
                </div>
                <p className="column-value">
                  {money(items.reduce((s, o) => s + valorComercial(state, o), 0))}
                </p>
                <div className="column-cards">
                  {items.map((o) => (
                    <article
                      className="deal-card"
                      key={o.id}
                      draggable={!moving && !['won', 'lost'].includes(o.stage)}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', o.id);
                        setDragging(o.id);
                      }}
                      onDragEnd={() => setDragging(null)}
                    >
                      <span className="eyebrow">
                        {state.clients.find((c) => c.id === o.clientId)?.name}
                      </span>
                      <button
                        className="deal-title"
                        onClick={() => open({ kind: 'opportunityDetail', id: o.id })}
                      >
                        {o.title}
                      </button>
                      <p>{o.vehicle || 'Aplicação a confirmar'}</p>
                      <strong>{money(valorComercial(state, o))}</strong>
                      <div className="card-bottom">
                        <span>{date(o.updatedAt)}</span>
                        {!['won', 'lost'].includes(o.stage) && (
                          <select
                            aria-label={`Mover ${o.title}`}
                            disabled={moving}
                            value=""
                            onChange={(e) => void move(o.id, e.target.value as Stage)}
                          >
                            <option value="">Mover</option>
                            {STAGES.filter((s) => s !== o.stage && s !== 'won').map((s) => (
                              <option key={s} value={s}>
                                {STAGE_LABELS[s]}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </article>
                  ))}
                  {!items.length && (
                    <div className="column-empty">
                      {String(index + 1).padStart(2, '0')}
                      <span>
                        {stage === 'won'
                          ? 'Pedidos confirmados aparecem aqui'
                          : 'Nenhuma negociação'}
                      </span>
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
      <p className="metric-note">
        Ganho é registrado ao aceitar um orçamento e gerar o pedido. Valor do orçamento/pedido
        vigente; sem proposta usa estimativa.
      </p>
    </>
  );
}
export function DocumentsView({ state, open, isOrder = false }: ViewProps & { isOrder?: boolean }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const records = (isOrder ? state.orders : state.quotes).filter(
    (d) =>
      (status === 'all' || d.status === status) &&
      `${d.number} ${state.clients.find((c) => c.id === d.clientId)?.name}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const labels: Record<string, string> = isOrder ? ORDER_LABELS : QUOTE_LABELS;
  return (
    <>
      <div className="toolbar">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={`Buscar ${isOrder ? 'pedido' : 'orçamento'} ou cliente`}
        />
        <select
          aria-label="Filtrar por situação"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">Todas as situações</option>
          {Object.entries(labels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="panel">
        {records.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{isOrder ? 'Pedido' : 'Orçamento'}</th>
                  <th>Cliente</th>
                  <th>Situação</th>
                  <th>{isOrder ? 'Criado em' : 'Validade'}</th>
                  <th>Total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {records
                  .slice()
                  .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
                  .map((d) => (
                    <tr key={d.id}>
                      <td>
                        <div className="document-id">
                          <FileText size={19} />
                          <strong>#{String(d.number).padStart(4, '0')}</strong>
                        </div>
                        {'revision' in d && <small>Revisão {d.revision}</small>}
                      </td>
                      <td>
                        {d.clientSnapshot?.name ??
                          state.clients.find((c) => c.id === d.clientId)?.name}
                      </td>
                      <td>
                        <Badge
                          tone={
                            ['accepted', 'completed'].includes(d.status)
                              ? 'green'
                              : d.status === 'cancelled'
                                ? 'red'
                                : 'amber'
                          }
                        >
                          {labels[d.status]}
                        </Badge>
                      </td>
                      <td>{date('validUntil' in d ? d.validUntil : d.createdAt)}</td>
                      <td className="price">{money(d.totalCents)}</td>
                      <td>
                        <button
                          className="button small"
                          onClick={() =>
                            open({ kind: isOrder ? 'orderDetail' : 'quoteDetail', id: d.id })
                          }
                        >
                          Abrir
                          <ChevronRight size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title={
              isOrder
                ? 'Do orçamento ao pedido, sem retrabalho'
                : 'Sua próxima proposta começa aqui'
            }
            description={
              isOrder
                ? 'Ao aceitar um orçamento enviado, o pedido é criado com os dados preservados.'
                : 'Monte propostas com peças, condições comerciais, frete e validade.'
            }
            action={!isOrder ? 'Criar orçamento' : undefined}
            onAction={() => open({ kind: 'quote' })}
          />
        )}
      </div>
    </>
  );
}
export function ActivitiesView({ state, open, refresh }: ViewProps) {
  const [filter, setFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState<string | null>(null);
  const activities = state.activities
    .filter(
      (a) =>
        (filter === 'all' ||
          (filter === 'completed'
            ? !!a.completedAt
            : filter === 'overdue'
              ? !a.completedAt && !!a.dueAt && a.dueAt < new Date().toISOString()
              : !a.completedAt)) &&
        `${a.title} ${state.clients.find((c) => c.id === a.clientId)?.name}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) => (a.dueAt ?? 'z').localeCompare(b.dueAt ?? 'z'));
  return (
    <>
      <div className="toolbar">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar atividade ou cliente"
        />
        <div className="segmented">
          {[
            ['pending', 'Pendentes'],
            ['overdue', 'Atrasadas'],
            ['completed', 'Concluídas'],
            ['all', 'Todas'],
          ].map(([value, label]) => (
            <button
              className={filter === value ? 'active' : ''}
              key={value}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <ErrorBox error={error} />
      <div className="panel">
        {activities.length ? (
          <div className="task-list">
            {activities.map((a) => (
              <div className={`task-row ${a.completedAt ? 'task-done' : ''}`} key={a.id}>
                <button
                  className="task-check"
                  aria-label={a.completedAt ? `Reabrir ${a.title}` : `Concluir ${a.title}`}
                  disabled={busy === a.id}
                  onClick={async () => {
                    setBusy(a.id);
                    setError(null);
                    try {
                      await request(`/api/activities/${a.id}`, 'PUT', {
                        ...a,
                        completedAt: a.completedAt ? null : new Date().toISOString(),
                      });
                      await refresh();
                    } catch (e) {
                      setError(e);
                    } finally {
                      setBusy(null);
                    }
                  }}
                >
                  {a.completedAt && <Check size={16} />}
                </button>
                <button
                  className="task-content"
                  onClick={() => open({ kind: 'activity', id: a.id })}
                >
                  <strong>{a.title}</strong>
                  <small>
                    {state.clients.find((c) => c.id === a.clientId)?.name} ·{' '}
                    {
                      {
                        call: 'Ligação',
                        whatsapp: 'WhatsApp',
                        visit: 'Visita',
                        task: 'Tarefa',
                        note: 'Anotação',
                      }[a.kind]
                    }
                  </small>
                  {a.notes && <p>{a.notes}</p>}
                </button>
                <Badge
                  tone={
                    !a.completedAt && a.dueAt && a.dueAt < new Date().toISOString()
                      ? 'red'
                      : 'neutral'
                  }
                >
                  {date(a.dueAt, true)}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <Empty
            title="Espaço para o próximo passo"
            description="Agende ligações, visitas e retornos de orçamento. Todo contato tem uma continuidade."
            action="Agendar atividade"
            onAction={() => open({ kind: 'activity' })}
          />
        )}
      </div>
    </>
  );
}
export function SettingsView({ state, refresh, notify }: ViewProps) {
  const [form, setForm] = useState(state.settings);
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  return (
    <div className="settings-grid">
      <section className="panel settings-panel">
        <span className="eyebrow">IDENTIDADE DA OPERAÇÃO</span>
        <h3>Sua distribuidora</h3>
        <p className="muted">Esses dados identificam sua empresa nos orçamentos e pedidos.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            setBusy(true);
            try {
              await request('/api/settings', 'PUT', form);
              await refresh();
              notify('Dados da empresa salvos.');
            } catch (err) {
              setError(err);
            } finally {
              setBusy(false);
            }
          }}
        >
          <ErrorBox error={error} />
          <Field label="Nome da empresa *">
            <input
              required
              value={form.companyName}
              onChange={(e) => setForm({ ...form, companyName: e.target.value })}
            />
          </Field>
          <Field label="Telefone">
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Field>
          <Field label="Endereço">
            <textarea
              rows={3}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </Field>
          <button className="button primary" disabled={busy}>
            {busy ? 'Salvando…' : 'Salvar alterações'}
          </button>
        </form>
      </section>
      <div>
        <section className="panel settings-panel">
          <span className="eyebrow">CONTINUIDADE</span>
          <h3>Seus dados, sob seu controle</h3>
          <p>
            Baixe uma cópia completa antes de encerrar o dia. Guarde o backup em um local seguro,
            fora da pasta da aplicação.
          </p>
          <button
            className="button primary"
            onClick={() =>
              download('/api/backup', `rota-pesada-${saoPauloDay()}.sqlite`).catch((e) =>
                notify(e.message),
              )
            }
          >
            <ArrowDownToLine size={16} />
            Baixar backup completo
          </button>
          <hr />
          <h4>Restaurar uma cópia</h4>
          <p className="muted">
            A restauração exige interromper o aplicativo para preservar a integridade do banco. Use
            o procedimento do manual de operação; esta tela não sobrescreve seus dados.
          </p>
        </section>
        <section className="local-card">
          <div>
            <span className="status-dot" />
            <strong>{state.mode === 'demo' ? 'Ambiente de demonstração' : 'Operação local'}</strong>
          </div>
          <p>
            {state.mode === 'demo'
              ? 'Dados fictícios em banco separado. Use o modo operacional para cadastrar sua empresa.'
              : 'Dados persistentes neste computador. Este piloto não compartilha informações com outros dispositivos.'}
          </p>
          <span>ROTA PESADA · CRM DE DISTRIBUIÇÃO</span>
        </section>
      </div>
    </div>
  );
}
