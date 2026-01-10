
export type Role = 'client' | 'admin' | 'staff';

export interface User {
  email: string;
  full_name: string;
  instagram: string;
  phone_number?: string;
  pin: string;
  role: Role;
  balance: number;
  stars: number;
  courtesy_progress: number;
  lifetime_tickets: number;
  pending_edits?: Partial<User>;
  is_promoter?: boolean;
  referral_count?: number;
}

export type TicketStatus = 'pending' | 'waiting_approval' | 'reserved' | 'paid' | 'pending_assignment' | 'cancelled';

export interface TicketItem {
  id: string;
  group_id: string;
  status: TicketStatus;
  price: number;
  paid_amount: number;
  pending_payment?: number;
  cost: number;
  assigned_link?: string;
  event_name?: string;
  event_id?: string;
  is_unlocked?: boolean;
  is_courtesy?: boolean;
  internal_correlative?: number;
  updated_at?: number;
}

export interface PurchaseGroup {
  id: string;
  user_email: string;
  seller_email: string;
  items: TicketItem[];
  total_amount: number;
  is_full_payment: boolean;
  created_at: number;
  status: TicketStatus;
  event_id: string;
}

export interface InventoryItem {
  name: string;
  link: string;
  cost: number;
  is_assigned: boolean;
  assigned_to?: string;
  assigned_user_email?: string;
  event_name: string;
  event_id: string;
  batch_number?: number; // Tanda
  upload_date?: number;
  original_text?: string;
  is_pending_link?: boolean;
  correlative_id: number;
  assigned_ticket_id?: string;
  status?: 'active' | 'reversion';
}

export interface ChatMessage {
  sender: string;
  role: Role;
  text: string;
  timestamp: number;
}

export interface Conversation {
  client_email: string;
  staff_email: string; // Internal naming, now Admin
  messages: ChatMessage[];
}

export interface SystemConfig {
  event_title: string;
  event_internal_id: string;
  event_date: string;
  reference_price: number; // Precio "Real" para tachar
  final_price: number;
}

export type LogType = 'RESERVA' | 'COMPRA' | 'EDICION' | 'LOGIN' | 'BOLSA' | 'APROBACION' | 'SISTEMA' | 'ANULACION' | 'REVERSION' | 'CHAT';

export interface ActivityLog {
  timestamp: number;
  action: string;
  user_email?: string;
  user_full_name?: string;
  type: LogType;
  event_id: string;
  details?: string;
}

export interface AppState {
  users: User[];
  purchaseGroups: PurchaseGroup[];
  inventory: InventoryItem[];
  conversations: Conversation[];
  config: SystemConfig;
  logs: ActivityLog[];
  currentUser: User | null;
}
