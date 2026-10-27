export const STAGES = ['new', 'qualification', 'quoted', 'negotiation', 'won', 'lost'] as const;
export type Stage = (typeof STAGES)[number];
export const STAGE_LABELS: Record<Stage, string> = {
  new: 'Novo atendimento',
  qualification: 'Qualificação',
  quoted: 'Orçamento enviado',
  negotiation: 'Negociação',
  won: 'Ganho',
  lost: 'Perdido',
};
export const AVAILABILITIES = ['unknown', 'available', 'on_order', 'unavailable'] as const;
export type Availability = (typeof AVAILABILITIES)[number];
export const AVAILABILITY_LABELS: Record<Availability, string> = {
  unknown: 'A confirmar',
  available: 'Disponível',
  on_order: 'Sob encomenda',
  unavailable: 'Indisponível',
};
export interface Entity {
  id: string;
  createdAt: string;
  updatedAt: string;
}
export interface Client extends Entity {
  name: string;
  type: 'PF' | 'PJ';
  segment: string;
  document: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  notes: string;
  contacts: { name: string; phone: string; email: string }[];
  archived: boolean;
}
export interface Product extends Entity {
  sku: string;
  description: string;
  manufacturer: string;
  category: string;
  unit: string;
  priceCents: number;
  references: string[];
  application: string;
  location: string;
  availability: Availability;
  availabilityUpdatedAt: string;
  archived: boolean;
}
export interface Opportunity extends Entity {
  clientId: string;
  title: string;
  need: string;
  vehicle: string;
  stage: Stage;
  lossReason: string;
  closedAt: string | null;
  estimatedValueCents: number;
}
export interface Activity extends Entity {
  clientId: string;
  opportunityId: string | null;
  kind: 'task' | 'call' | 'whatsapp' | 'visit' | 'note';
  title: string;
  notes: string;
  dueAt: string | null;
  completedAt: string | null;
}
export interface QuoteItem {
  productId: string;
  sku: string;
  description: string;
  unit: string;
  quantity: number;
  unitPriceCents: number;
}
export interface Quote extends Entity {
  opportunityId: string;
  clientId: string;
  number: number;
  revision: number;
  familyId: string;
  status: 'draft' | 'sent' | 'accepted' | 'superseded';
  validUntil: string;
  paymentTerms: string;
  notes: string;
  items: QuoteItem[];
  discountCents: number;
  freightCents: number;
  totalCents: number;
  clientSnapshot: Client | null;
  sentAt: string | null;
}
export interface Order extends Entity {
  opportunityId: string;
  quoteId: string;
  clientId: string;
  number: number;
  status: 'confirmed' | 'processing' | 'completed' | 'cancelled';
  cancellationReason: string;
  items: QuoteItem[];
  clientSnapshot: Client;
  discountCents: number;
  freightCents: number;
  totalCents: number;
  paymentTerms: string;
  notes: string;
}
export interface AuditEvent {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  detail: string;
  createdAt: string;
}
export interface Settings {
  companyName: string;
  phone: string;
  address: string;
}
export interface Dashboard {
  openCount: number;
  pipelineCents: number;
  overdueCount: number;
  wonCount: number;
  lostCount: number;
  wonCents: number;
  winRate: number | null;
  lossReasons: { reason: string; count: number }[];
  from: string;
  to: string;
}
export interface AppState {
  clients: Client[];
  products: Product[];
  opportunities: Opportunity[];
  activities: Activity[];
  quotes: Quote[];
  orders: Order[];
  events: AuditEvent[];
  settings: Settings;
  dashboard: Dashboard;
  mode: 'operational' | 'demo';
}
export interface ApiError {
  message: string;
  fields?: Record<string, string>;
}
