import { useState } from 'react';
import type { Activity, AppState, Client, Opportunity, Product } from '../shared/types';
import { AVAILABILITY_LABELS, AVAILABILITIES } from '../shared/types';
import { Field, SaveForm } from './ui';
import { localDateInput, moneyInput, parseMoney, request } from './api';
export type FormProps<T> = { item?: T; onDone: () => Promise<void>; onClose: () => void };
export function ClientForm({ item, onDone, onClose }: FormProps<Client>) {
  const [form, setForm] = useState({
    name: item?.name ?? '',
    type: item?.type ?? 'PJ',
    segment: item?.segment ?? 'Oficina',
    document: item?.document ?? '',
    phone: item?.phone ?? '',
    email: item?.email ?? '',
    city: item?.city ?? '',
    state: item?.state ?? '',
    notes: item?.notes ?? '',
  });
  const [contacts, setContacts] = useState(item?.contacts ?? []);
  const update = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));
  return (
    <SaveForm
      onCancel={onClose}
      onSave={async () => {
        await request(`/api/clients${item ? '/' + item.id : ''}`, item ? 'PUT' : 'POST', {
          ...form,
          contacts,
        });
        await onDone();
      }}
    >
      <div className="form-grid">
        <Field label="Nome / razão social *">
          <input
            required
            autoComplete="organization"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
          />
        </Field>
        <Field label="Tipo">
          <select value={form.type} onChange={(e) => update('type', e.target.value)}>
            <option value="PJ">Pessoa jurídica</option>
            <option value="PF">Pessoa física</option>
          </select>
        </Field>
        <Field label="Segmento">
          <select value={form.segment} onChange={(e) => update('segment', e.target.value)}>
            {['Oficina', 'Transportadora / Frotista', 'Revendedor', 'Autônomo', 'Outro'].map(
              (v) => (
                <option key={v}>{v}</option>
              ),
            )}
          </select>
        </Field>
        <Field label="CPF / CNPJ" hint="Opcional. Informe um documento válido, se disponível.">
          <input value={form.document} onChange={(e) => update('document', e.target.value)} />
        </Field>
        <Field label="Telefone / WhatsApp">
          <input type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} />
        </Field>
        <Field label="E-mail">
          <input
            type="email"
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
          />
        </Field>
        <Field label="Cidade">
          <input value={form.city} onChange={(e) => update('city', e.target.value)} />
        </Field>
        <Field label="UF">
          <input
            maxLength={2}
            value={form.state}
            onChange={(e) => update('state', e.target.value.toUpperCase())}
          />
        </Field>
      </div>
      <div className="section-line">
        <h3>Pessoas de contato</h3>
        <button
          type="button"
          className="text-button"
          onClick={() => setContacts((v) => [...v, { name: '', phone: '', email: '' }])}
        >
          + Adicionar contato
        </button>
      </div>
      {contacts.map((contact, index) => (
        <div className="contact-row" key={index}>
          <Field label="Nome">
            <input
              required
              value={contact.name}
              onChange={(e) =>
                setContacts((v) =>
                  v.map((c, i) => (i === index ? { ...c, name: e.target.value } : c)),
                )
              }
            />
          </Field>
          <Field label="Telefone">
            <input
              type="tel"
              value={contact.phone}
              onChange={(e) =>
                setContacts((v) =>
                  v.map((c, i) => (i === index ? { ...c, phone: e.target.value } : c)),
                )
              }
            />
          </Field>
          <Field label="E-mail">
            <input
              type="email"
              value={contact.email}
              onChange={(e) =>
                setContacts((v) =>
                  v.map((c, i) => (i === index ? { ...c, email: e.target.value } : c)),
                )
              }
            />
          </Field>
          <button
            type="button"
            className="text-button danger"
            onClick={() => setContacts((v) => v.filter((_, i) => i !== index))}
          >
            Remover
          </button>
        </div>
      ))}
      <Field label="Observações">
        <textarea rows={3} value={form.notes} onChange={(e) => update('notes', e.target.value)} />
      </Field>
    </SaveForm>
  );
}
export function ProductForm({ item, onDone, onClose }: FormProps<Product>) {
  const [form, setForm] = useState({
    sku: item?.sku ?? '',
    description: item?.description ?? '',
    manufacturer: item?.manufacturer ?? '',
    category: item?.category ?? '',
    unit: item?.unit ?? 'UN',
    application: item?.application ?? '',
    location: item?.location ?? '',
    availability: item?.availability ?? 'unknown',
  });
  const [price, setPrice] = useState(moneyInput(item?.priceCents ?? 0));
  const [references, setReferences] = useState(item?.references.join(', ') ?? '');
  const update = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));
  return (
    <SaveForm
      onCancel={onClose}
      onSave={async () => {
        await request(`/api/products${item ? '/' + item.id : ''}`, item ? 'PUT' : 'POST', {
          ...form,
          priceCents: parseMoney(price),
          references: references
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean),
        });
        await onDone();
      }}
    >
      <div className="form-grid">
        <Field label="Código interno / SKU *">
          <input required value={form.sku} onChange={(e) => update('sku', e.target.value)} />
        </Field>
        <Field label="Descrição *">
          <input
            required
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
          />
        </Field>
        <Field label="Fabricante">
          <input
            value={form.manufacturer}
            onChange={(e) => update('manufacturer', e.target.value)}
          />
        </Field>
        <Field label="Categoria">
          <input
            placeholder="Ex.: Freios e suspensão"
            value={form.category}
            onChange={(e) => update('category', e.target.value)}
          />
        </Field>
        <Field label="Preço de referência (R$) *">
          <input
            required
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </Field>
        <Field label="Unidade">
          <input required value={form.unit} onChange={(e) => update('unit', e.target.value)} />
        </Field>
        <Field label="Disponibilidade informada">
          <select
            value={form.availability}
            onChange={(e) => update('availability', e.target.value)}
          >
            {AVAILABILITIES.map((v) => (
              <option key={v} value={v}>
                {AVAILABILITY_LABELS[v]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Localização física">
          <input value={form.location} onChange={(e) => update('location', e.target.value)} />
        </Field>
      </div>
      <Field
        label="Referências / códigos OEM"
        hint="Separe por vírgula. Dados declarados; valide a compatibilidade antes da venda."
      >
        <input value={references} onChange={(e) => setReferences(e.target.value)} />
      </Field>
      <Field label="Aplicação declarada">
        <textarea
          rows={3}
          placeholder="Marca, modelo, motorização e ano, quando conhecidos"
          value={form.application}
          onChange={(e) => update('application', e.target.value)}
        />
      </Field>
    </SaveForm>
  );
}
export function OpportunityForm({
  item,
  onDone,
  onClose,
  state,
  clientId,
}: { state: AppState; clientId?: string } & FormProps<Opportunity>) {
  const [form, setForm] = useState({
    clientId: item?.clientId ?? clientId ?? '',
    title: item?.title ?? '',
    need: item?.need ?? '',
    vehicle: item?.vehicle ?? '',
  });
  const [value, setValue] = useState(moneyInput(item?.estimatedValueCents ?? 0));
  return (
    <SaveForm
      onCancel={onClose}
      onSave={async () => {
        await request(`/api/opportunities${item ? '/' + item.id : ''}`, item ? 'PUT' : 'POST', {
          ...form,
          estimatedValueCents: parseMoney(value),
        });
        await onDone();
      }}
    >
      <Field label="Cliente *">
        <select
          required
          value={form.clientId}
          onChange={(e) => setForm({ ...form, clientId: e.target.value })}
        >
          <option value="">Selecione um cliente</option>
          {state.clients
            .filter((c) => !c.archived || c.id === form.clientId)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>
      </Field>
      <Field label="Título do atendimento *">
        <input
          required
          value={form.title}
          placeholder="Ex.: Kit de embreagem para frota"
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
      </Field>
      <div className="form-grid">
        <Field label="Veículo / aplicação solicitada">
          <input
            value={form.vehicle}
            onChange={(e) => setForm({ ...form, vehicle: e.target.value })}
          />
        </Field>
        <Field label="Valor estimado (R$)">
          <input
            inputMode="decimal"
            required
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </Field>
      </div>
      <Field label="Necessidade do cliente">
        <textarea
          rows={4}
          value={form.need}
          onChange={(e) => setForm({ ...form, need: e.target.value })}
        />
      </Field>
    </SaveForm>
  );
}
export function ActivityForm({
  item,
  onDone,
  onClose,
  state,
  clientId,
  opportunityId,
}: { state: AppState; clientId?: string; opportunityId?: string } & FormProps<Activity>) {
  const [form, setForm] = useState({
    clientId: item?.clientId ?? clientId ?? '',
    opportunityId: item?.opportunityId ?? opportunityId ?? '',
    kind: item?.kind ?? 'call',
    title: item?.title ?? '',
    notes: item?.notes ?? '',
    dueAt: localDateInput(item?.dueAt ?? null),
  });
  return (
    <SaveForm
      onCancel={onClose}
      onSave={async () => {
        await request(`/api/activities${item ? '/' + item.id : ''}`, item ? 'PUT' : 'POST', {
          ...form,
          opportunityId: form.opportunityId || null,
          dueAt: form.dueAt ? new Date(`${form.dueAt}:00-03:00`).toISOString() : null,
          completedAt: item?.completedAt ?? null,
        });
        await onDone();
      }}
    >
      <div className="form-grid">
        <Field label="Cliente *">
          <select
            required
            value={form.clientId}
            onChange={(e) => setForm({ ...form, clientId: e.target.value, opportunityId: '' })}
          >
            <option value="">Selecione</option>
            {state.clients
              .filter((c) => !c.archived || c.id === form.clientId)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Negociação relacionada">
          <select
            value={form.opportunityId}
            onChange={(e) => setForm({ ...form, opportunityId: e.target.value })}
          >
            <option value="">Sem negociação específica</option>
            {state.opportunities
              .filter((o) => o.clientId === form.clientId)
              .map((o) => (
                <option key={o.id} value={o.id}>
                  {o.title}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Tipo">
          <select
            value={form.kind}
            onChange={(e) => setForm({ ...form, kind: e.target.value as typeof form.kind })}
          >
            <option value="call">Ligação</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="visit">Visita</option>
            <option value="task">Tarefa</option>
            <option value="note">Anotação</option>
          </select>
        </Field>
        <Field label="Data e horário (Brasília)">
          <input
            type="datetime-local"
            value={form.dueAt}
            onChange={(e) => setForm({ ...form, dueAt: e.target.value })}
          />
        </Field>
      </div>
      <Field label="Atividade *">
        <input
          required
          value={form.title}
          placeholder="Ex.: Confirmar aplicação e retornar orçamento"
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
      </Field>
      <Field label="Observações">
        <textarea
          rows={3}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
      </Field>
    </SaveForm>
  );
}
