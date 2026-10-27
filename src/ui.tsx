import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { ArrowUpRight, Check, LoaderCircle, Plus, X } from 'lucide-react';
import type { AuditEvent } from '../shared/types';
import { date, RequestError } from './api';
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const root = ref.current!;
    const select = () =>
      Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex="0"]',
        ),
      ).filter((el) => el.getClientRects().length);
    const first = select()[0];
    first?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
      if (event.key === 'Tab') {
        const all = select();
        const first = all[0],
          last = all[all.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    root.addEventListener('keydown', key);
    return () => {
      root.removeEventListener('keydown', key);
      document.body.style.overflow = oldOverflow;
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        className={`modal ${wide ? 'modal-wide' : ''}`}
      >
        <div className="modal-head">
          <div>
            <span className="eyebrow">ROTA PESADA / OPERAÇÃO</span>
            <h2 id={id}>{title}</h2>
          </div>
          <button className="icon-button" aria-label="Fechar janela" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const labelId = useId();
  const hintId = `${labelId}-hint`;
  const control = isValidElement<{
    'aria-labelledby'?: string;
    'aria-describedby'?: string;
  }>(children)
    ? cloneElement(children, {
        'aria-labelledby': labelId,
        'aria-describedby': hint ? hintId : children.props['aria-describedby'],
      })
    : children;
  return (
    <label className="field">
      <span id={labelId}>{label}</span>
      {control}
      {hint && <small id={hintId}>{hint}</small>}
    </label>
  );
}
export function ErrorBox({ error }: { error: unknown }) {
  return error ? (
    <div role="alert" className="error-box">
      {error instanceof Error ? error.message : String(error)}
      {error instanceof RequestError && error.fields && (
        <ul>
          {Object.entries(error.fields).map(([key, value]) => (
            <li key={key}>
              {key}: {value}
            </li>
          ))}
        </ul>
      )}
    </div>
  ) : null;
}
export function Empty({
  title,
  description,
  action,
  onAction,
}: {
  title: string;
  description: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty">
      <div className="empty-mark">
        <ArrowUpRight size={27} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action && onAction && (
        <button className="button primary" onClick={onAction}>
          <Plus size={16} />
          {action}
        </button>
      )}
    </div>
  );
}
export function SaveForm({
  children,
  onSave,
  onCancel,
  label = 'Salvar',
}: {
  children: ReactNode;
  onSave: () => Promise<void>;
  onCancel: () => void;
  label?: string;
}) {
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await onSave();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="modal-body">
      <ErrorBox error={error} />
      <fieldset disabled={busy} className="form-fields">
        {children}
      </fieldset>
      <div className="form-actions">
        <button type="button" className="button" onClick={onCancel} disabled={busy}>
          Cancelar
        </button>
        <button className="button primary" disabled={busy}>
          {busy ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}{' '}
          {busy ? 'Salvando…' : label}
        </button>
      </div>
    </form>
  );
}
export function History({ events }: { events: AuditEvent[] }) {
  return (
    <section className="history">
      <h3>Histórico da operação</h3>
      {events.length ? (
        <ol>
          {[...events]
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .map((event) => (
              <li key={event.id}>
                <span className="history-dot" />
                <div>
                  <strong>
                    {event.detail ||
                      (
                        {
                          created: 'Cadastro criado',
                          updated: 'Cadastro atualizado',
                          won: 'Negociação ganha',
                          sent: 'Envio registrado',
                          revised: 'Revisão criada',
                          archived: 'Cadastro arquivado',
                          stage_changed: 'Etapa alterada',
                          status_changed: 'Situação alterada',
                        } as Record<string, string>
                      )[event.action] ||
                      'Movimentação registrada'}
                  </strong>
                  <small>{date(event.createdAt, true)}</small>
                </div>
              </li>
            ))}
        </ol>
      ) : (
        <p className="muted">As movimentações aparecerão aqui.</p>
      )}
    </section>
  );
}
export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
