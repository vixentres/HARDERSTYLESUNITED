
export type Role = 'client' | 'admin' | 'staff';

export interface User {
  email: string;
  fullName: string;
  instagram: string;
  phoneNumber?: string;
  pin: string;
  role: Role;
  balance: number;
  stars: number;
  courtesyProgress: number;
  lifetimeTickets: number;
  pendingEdits?: Partial<User>;
  isPromoter?: boolean;
  referralCount?: number;
}

export type TicketStatus = 'pending' | 'waiting_approval' | 'reserved' | 'paid' | 'pending_assignment' | 'cancelled';

export interface TicketItem {
  id: string;
  groupId: string;
  status: TicketStatus;
  price: number;
  paidAmount: number;
  pendingPayment?: number;
  cost: number;
  assignedLink?: string;
  eventName?: string;
  eventId?: string;
  isUnlocked?: boolean;
  isCourtesy?: boolean;
  internalCorrelative?: number;
  updatedAt?: number;
}

export interface PurchaseGroup {
  id: string;
  userEmail: string;
  sellerEmail: string;
  items: TicketItem[];
  totalAmount: number;
  isFullPayment: boolean;
  createdAt: number;
  status: TicketStatus;
  eventId: string;
}

export interface InventoryItem {
  name: string;
  link: string;
  cost: number;
  isAssigned: boolean;
  assignedTo?: string;
  assignedUserEmail?: string;
  eventName: string;
  eventId: string;
  batchNumber?: number; // Tanda
  uploadDate?: number;
  originalText?: string;
  isPendingLink?: boolean;
  correlativeId: number;
  assignedTicketId?: string;
  status?: 'active' | 'reversion';
}

export interface ChatMessage {
  sender: string;
  role: Role;
  text: string;
  timestamp: number;
}

export interface Conversation {
  clientEmail: string;
  staffEmail: string; // Internal naming, now Admin
  messages: ChatMessage[];
}

export interface SystemConfig {
  eventTitle: string;
  eventInternalId: string;
  eventDate: string;
  referencePrice: number; // Precio "Real" para tachar
  finalPrice: number;
}
// LogType remains unchanged
export type LogType = 'RESERVA' | 'COMPRA' | 'EDICION' | 'LOGIN' | 'BOLSA' | 'APROBACION' | 'SISTEMA' | 'ANULACION' | 'REVERSION' | 'CHAT';

export interface ActivityLog {
  timestamp: number;
  action: string;
  user: string;
  userFullName?: string;
  type: LogType;
  eventId: string;
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
