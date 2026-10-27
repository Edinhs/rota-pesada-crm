import { useState } from 'react';
import { Check, Copy, FileCheck2, Plus, Printer, Send, Trash2 } from 'lucide-react';
import type { AppState, Quote, Order } from '../shared/types';
import { date, money, moneyInput, parseMoney, request, saoPauloDay } from './api';
import { Badge, ErrorBox, Field, SaveForm } from './ui';
export const QUOTE_LABELS = {
  draft: 'Rascunho',
  sent: 'Enviado',
  accepted: 'Aceito',
  superseded: 'Substituído',
};
export const ORDER_LABELS = {
  confirmed: 'Confirmado',
  processing: 'Em separação',
  completed: 'Concluído',
  cancelled: 'Cancelado',
};
export function QuoteForm({
  state,
  item,
  opportunityId,
  onDone,
  onClose,
}: {
  state: AppState;
  item?: Quote;
  opportunityId?: string;
  onDone: () => Promise<void>;
  onClose: () => void;
}) {
  const [opportunity, setOpportunity] = useState(item?.opportunityId ?? opportunityId ?? '');
  const [validUntil, setValidUntil] = useState(
    item?.validUntil ?? saoPauloDay(new Date(Date.now() + 7 * 86400000)),
  );
  const [terms, setTerms] = useState(item?.paymentTerms ?? 'À vista');
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [discount, setDiscount] = useState(moneyInput(item?.discountCents ?? 0));
  const [freight, setFreight] = useState(moneyInput(item?.freightCents ?? 0));
  const [items, setItems] = useState(
    item?.items.map((i) => ({
      productId: i.productId,
      quantity: String(i.quantity),
      price: moneyInput(i.unitPriceCents),
    })) ?? [{ productId: '', quantity: '1', price: '0,00' }],
  );
  const update = (index: number, key: string, value: string) =>
    setItems((v) => v.map((i, n) => (n === index ? { ...i, [key]: value } : i)));
  let total: number | null = null;
  try {
    total =
      items.reduce((sum, item) => sum + Number(item.quantity) * parseMoney(item.price), 0) -
      parseMoney(discount) +
      parseMoney(freight);
  } catch {}
  return (
    <SaveForm
      label={item ? 'Salvar orçamento' : 'Criar orçamento'}
      onCancel={onClose}
      onSave={async () => {
        const body = {
          opportunityId: opportunity,
          validUntil,
          paymentTerms: terms,
          notes,
          discountCents: parseMoney(discount),
          freightCents: parseMoney(freight),
          items: items.map((i) => {
            if (!/^\d+$/.test(i.quantity) || Number(i.quantity) < 1)
              throw new Error('A quantidade precisa ser um número inteiro maior que zero.');
            return {
              productId: i.productId,
              quantity: Number(i.quantity),
              unitPriceCents: parseMoney(i.price),
            };
          }),
        };
        await request(`/api/quotes${item ? '/' + item.id : ''}`, item ? 'PUT' : 'POST', body);
        await onDone();
      }}
    >
      <div className="form-grid">
        <Field label="Negociação *">
          <select
            required
            disabled={!!item}
            value={opportunity}
            onChange={(e) => setOpportunity(e.target.value)}
          >
            <option value="">Selecione</option>
            {state.opportunities
              .filter((o) => !['won', 'lost'].includes(o.stage) || o.id === opportunity)
              .map((o) => (
                <option key={o.id} value={o.id}>
                  {o.title} · {state.clients.find((c) => c.id === o.clientId)?.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Válido até *">
          <input
            required
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
          />
        </Field>
      </div>
      <div className="section-line">
        <h3>Peças no orçamento</h3>
        <button
          type="button"
          className="text-button"
          onClick={() => setItems((v) => [...v, { productId: '', quantity: '1', price: '0,00' }])}
        >
          <Plus size={14} />
          Adicionar item
        </button>
      </div>
      {items.map((line, index) => (
        <div className="quote-line" key={index}>
          <Field label={`Peça ${index + 1} *`}>
            <select
              required
              value={line.productId}
              onChange={(e) => {
                const product = state.products.find((p) => p.id === e.target.value);
                setItems((v) =>
                  v.map((l, i) =>
                    i === index
                      ? {
                          ...l,
                          productId: e.target.value,
                          price: moneyInput(product?.priceCents ?? 0),
                        }
                      : l,
                  ),
                );
              }}
            >
              <option value="">Escolha uma peça</option>
              {state.products
                .filter((p) => !p.archived || p.id === line.productId)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.sku} — {p.description}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Qtde. *">
            <input
              type="number"
              min={1}
              step={1}
              required
              value={line.quantity}
              onChange={(e) => update(index, 'quantity', e.target.value)}
            />
          </Field>
          <Field label="Unitário (R$) *">
            <input
              required
              inputMode="decimal"
              value={line.price}
              onChange={(e) => update(index, 'price', e.target.value)}
            />
          </Field>
          <button
            type="button"
            disabled={items.length === 1}
            className="icon-button danger"
            aria-label={`Remover item ${index + 1}`}
            onClick={() => setItems((v) => v.filter((_, i) => i !== index))}
          >
            <Trash2 size={17} />
          </button>
        </div>
      ))}
      <div className="form-grid three">
        <Field label="Desconto total (R$)">
          <input
            required
            inputMode="decimal"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
          />
        </Field>
        <Field label="Frete (R$)">
          <input
            required
            inputMode="decimal"
            value={freight}
            onChange={(e) => setFreight(e.target.value)}
          />
        </Field>
        <div className="quote-total">
          <span>Total do orçamento</span>
          <strong>{total === null ? 'Confira os valores' : money(total)}</strong>
        </div>
      </div>
      <Field label="Condições de pagamento *">
        <input required value={terms} onChange={(e) => setTerms(e.target.value)} />
      </Field>
      <Field label="Observações">
        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <p className="inline-note">
        Disponibilidade declarada, sem reserva de estoque. Confirme aplicação e prazo antes de
        fechar a venda.
      </p>
    </SaveForm>
  );
}
export function DocumentView({
  document,
  state,
  isOrder = false,
  onAction,
  onEdit,
  onClose,
}: {
  document: Quote | Order;
  state: AppState;
  isOrder?: boolean;
  onAction: () => Promise<void>;
  onEdit?: (quote: Quote) => void;
  onClose: () => void;
}) {
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const quote = document as Quote;
  const order = document as Order;
  const client = document.clientSnapshot ?? state.clients.find((c) => c.id === document.clientId);
  const [cancel, setCancel] = useState(false);
  const [reason, setReason] = useState('');
  async function action(path: string, body?: unknown) {
    setError(null);
    setBusy(true);
    try {
      await request(path, 'POST', body ?? {});
      await onAction();
      onClose();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-body document-view">
      <ErrorBox error={error} />
      <div className="document-toolbar no-print">
        <Badge
          tone={
            document.status === 'accepted' || document.status === 'completed' ? 'green' : 'amber'
          }
        >
          {isOrder ? ORDER_LABELS[order.status] : QUOTE_LABELS[quote.status]}
        </Badge>
        <div className="row-actions">
          <button className="button small" onClick={() => window.print()}>
            <Printer size={15} />
            Imprimir / PDF
          </button>
          {!isOrder && quote.status === 'draft' && (
            <>
              <button className="button small" onClick={() => onEdit?.(quote)}>
                Editar
              </button>
              <button
                className="button primary small"
                disabled={busy}
                onClick={() => action(`/api/quotes/${quote.id}/send`)}
              >
                <Send size={15} />
                Registrar envio
              </button>
            </>
          )}
          {!isOrder && quote.status === 'sent' && (
            <>
              <button
                className="button small"
                disabled={busy}
                onClick={() => action(`/api/quotes/${quote.id}/revise`)}
              >
                <Copy size={15} />
                Criar revisão
              </button>
              <button
                className="button primary small"
                disabled={busy}
                onClick={() => action(`/api/quotes/${quote.id}/convert`)}
              >
                <FileCheck2 size={15} />
                Aceitar e criar pedido
              </button>
            </>
          )}
          {isOrder && order.status === 'confirmed' && (
            <button
              className="button primary small"
              disabled={busy}
              onClick={() => action(`/api/orders/${order.id}/status`, { status: 'processing' })}
            >
              Iniciar separação
            </button>
          )}
          {isOrder && order.status === 'processing' && (
            <button
              className="button primary small"
              disabled={busy}
              onClick={() => action(`/api/orders/${order.id}/status`, { status: 'completed' })}
            >
              <Check size={15} />
              Concluir pedido
            </button>
          )}
          {isOrder && !['cancelled', 'completed'].includes(order.status) && (
            <button className="button small danger" onClick={() => setCancel(!cancel)}>
              Cancelar pedido
            </button>
          )}
        </div>
      </div>
      {cancel && (
        <div className="cancel-block no-print">
          <Field label="Motivo do cancelamento *">
            <input value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <button
            className="button danger"
            disabled={busy || !reason.trim()}
            onClick={() =>
              action(`/api/orders/${order.id}/status`, {
                status: 'cancelled',
                cancellationReason: reason,
              })
            }
          >
            Confirmar cancelamento
          </button>
        </div>
      )}
      <article className="print-document">
        <div className="document-top">
          <div>
            <span className="eyebrow">{state.settings.companyName || 'Rota Pesada'}</span>
            <h2>{isOrder ? 'Pedido de venda' : 'Orçamento comercial'}</h2>
            <span className="document-status">
              {isOrder ? ORDER_LABELS[order.status] : QUOTE_LABELS[quote.status]}
            </span>
            <p>
              {state.settings.phone}
              <br />
              {state.settings.address}
            </p>
          </div>
          <div className="document-number">
            <strong>#{String(document.number).padStart(4, '0')}</strong>
            {!isOrder && <span>Revisão {quote.revision}</span>}
            <span>{date(document.createdAt)}</span>
          </div>
        </div>
        <div className="document-client">
          <div>
            <span className="eyebrow">CLIENTE</span>
            <h3>{client?.name ?? 'Cliente indisponível'}</h3>
            <p>
              {client?.document}
              <br />
              {client?.city}
              {client?.state ? ` / ${client.state}` : ''}
              <br />
              {client?.phone}
              {client?.email ? ` · ${client.email}` : ''}
            </p>
          </div>
          {!isOrder && (
            <div>
              <span className="eyebrow">VALIDADE</span>
              <p>{date(quote.validUntil)}</p>
            </div>
          )}
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Peça / descrição</th>
                <th>Qtd.</th>
                <th>Unitário</th>
                <th className="align-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {document.items.map((item, index) => (
                <tr key={index}>
                  <td>
                    <span className="mono">{item.sku}</span>
                    <strong>{item.description}</strong>
                  </td>
                  <td>
                    {item.quantity} {item.unit}
                  </td>
                  <td>{money(item.unitPriceCents)}</td>
                  <td className="align-right">{money(item.quantity * item.unitPriceCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="document-totals">
          <div>
            <span>Subtotal</span>
            <b>{money(document.items.reduce((s, i) => s + i.quantity * i.unitPriceCents, 0))}</b>
          </div>
          <div>
            <span>Desconto</span>
            <b>− {money(document.discountCents)}</b>
          </div>
          <div>
            <span>Frete</span>
            <b>{money(document.freightCents)}</b>
          </div>
          <div className="grand-total">
            <span>Total</span>
            <b>{money(document.totalCents)}</b>
          </div>
        </div>
        <div className="document-terms">
          <h4>Condições de pagamento</h4>
          <p>{document.paymentTerms}</p>
          {document.notes && (
            <>
              <h4>Observações</h4>
              <p>{document.notes}</p>
            </>
          )}
          {isOrder && order.cancellationReason && (
            <>
              <h4>Motivo do cancelamento</h4>
              <p>{order.cancellationReason}</p>
            </>
          )}
        </div>
        <footer>DOCUMENTO NÃO FISCAL · Disponibilidade e aplicação sujeitas à confirmação.</footer>
      </article>
      {!isOrder && quote.status === 'draft' && (
        <p className="inline-note no-print">
          Rascunho. Ao registrar o envio, os dados do cliente e das peças ficam preservados nesta
          revisão. A ação registra o envio realizado por você.
        </p>
      )}
      {!isOrder && quote.status === 'sent' && (
        <p className="inline-note no-print">
          Aceitar e criar pedido encerra a negociação como ganha. Um orçamento gera apenas um
          pedido.
        </p>
      )}
    </div>
  );
}
