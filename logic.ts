
import { AppState, InventoryItem, PurchaseGroup, TicketItem, User } from './types';

export const extractUrl = (text: string): { url: string | null; isPending: boolean } => {
    const urlMatch = text.match(/(https?:\/\/[^\s)]+)/);
    if (urlMatch) return { url: urlMatch[1], isPending: false };
    return { url: null, isPending: true };
};

export const formatPhoneNumber = (phone: string): string => {
    if (!phone) return '';
    let clean = phone.replace(/\D/g, ''); // Remove all non-digits
    if (clean.length === 8) return `+569${clean}`;
    if (clean.length === 9) return `+56${clean}`;
    if (clean.length === 11 && clean.startsWith('56')) return `+${clean}`;
    if (phone.startsWith('+')) return `+${clean}`;
    return phone;
};

export const formatCurrency = (amount: number): string => {
    return (amount || 0).toLocaleString('es-CL');
};

export const processAction = (
    state: AppState,
    gid: string,
    tid: string | null,
    act: string,
    val?: number
): { purchaseGroups: PurchaseGroup[], inventory: InventoryItem[], users: User[] } => {
    const nextGroups = [...state.purchaseGroups];
    const nextInv = [...state.inventory];
    const nextUsers = [...state.users];

    const gIdx = nextGroups.findIndex(g => g.id === gid);
    if (gIdx === -1) return { purchaseGroups: nextGroups, inventory: nextInv, users: nextUsers };

    const group = { ...nextGroups[gIdx] };
    const nextItems = [...group.items];

    if (act === 'delete') {
        if (tid) {
            const tIdx = nextItems.findIndex(t => t.id === tid);
            if (tIdx > -1) nextItems.splice(tIdx, 1);
        } else {
            nextGroups.splice(gIdx, 1);
            return { purchaseGroups: nextGroups, inventory: nextInv, users: nextUsers };
        }
    } else if (act === 'pay') {
        nextItems.forEach(t => {
            if (!tid || t.id === tid) {
                t.status = 'waiting_approval';
                t.pending_payment = t.price - t.paid_amount;
                t.updated_at = Date.now();
            }
        });
    } else if (act === 'reserve') {
        nextItems.forEach(t => {
            if (!tid || t.id === tid) {
                t.status = 'waiting_approval';
                t.pending_payment = val || 10;
                t.updated_at = Date.now();
            }
        });
    } else if (act === 'revert_assignment') {
        if (tid) {
            const tIdx = nextItems.findIndex(t => t.id === tid);
            if (tIdx > -1) {
                const t = nextItems[tIdx];
                if (t.internal_correlative !== undefined) {
                    const invIdx = nextInv.findIndex(i => i.correlative_id === t.internal_correlative && i.event_id === state.config.event_internal_id);
                    if (invIdx > -1) {
                        nextInv[invIdx].is_assigned = false;
                        nextInv[invIdx].assigned_user_email = undefined;
                        nextInv[invIdx].assigned_to = undefined;
                        nextInv[invIdx].assigned_ticket_id = undefined;
                    }
                }
                nextItems[tIdx] = { ...t, assigned_link: undefined, internal_correlative: undefined, cost: 0, status: 'waiting_approval', updated_at: Date.now() };
            }
        }
    } else if (act === 'manual_link' && val !== undefined) {
        const invIdx = nextInv.findIndex(i => i.correlative_id === val && i.event_id === state.config.event_internal_id && !i.is_assigned);
        if (invIdx > -1 && tid) {
            const targetInv = { ...nextInv[invIdx] };
            targetInv.is_assigned = true;
            targetInv.assigned_user_email = group.user_email;
            targetInv.assigned_to = nextUsers.find(u => u.email === group.user_email)?.full_name;
            targetInv.assigned_ticket_id = tid;
            nextInv[invIdx] = targetInv;

            const tIdx = nextItems.findIndex(t => t.id === tid);
            if (tIdx > -1) {
                nextItems[tIdx] = {
                    ...nextItems[tIdx],
                    assigned_link: targetInv.link,
                    internal_correlative: targetInv.correlative_id,
                    cost: targetInv.cost,
                    updated_at: Date.now()
                };
            }
        }
    } else if (act === 'revert_payment') {
        if (tid) {
            const tIdx = nextItems.findIndex(t => t.id === tid);
            if (tIdx > -1) {
                const t = nextItems[tIdx];
                const amtToRevert = t.paid_amount;

                if (t.internal_correlative !== undefined) {
                    const invIdx = nextInv.findIndex(i => i.correlative_id === t.internal_correlative && i.event_id === state.config.event_internal_id);
                    if (invIdx > -1) {
                        nextInv[invIdx].is_assigned = false;
                        nextInv[invIdx].assigned_ticket_id = undefined;
                        nextInv[invIdx].assigned_to = undefined;
                        nextInv[invIdx].assigned_user_email = undefined;
                        nextInv[invIdx].status = 'active';
                    }
                }
                nextItems[tIdx] = {
                    ...t,
                    status: 'waiting_approval',
                    pending_payment: (t.pending_payment || 0) + amtToRevert,
                    paid_amount: 0,
                    assigned_link: undefined,
                    internal_correlative: undefined,
                    cost: 0,
                    updated_at: Date.now()
                };
            }
        }
    } else if (act === 'approve') {
        const promoter = nextUsers.find(u => u.email === group.seller_email);
        const buyer = nextUsers.find(u => u.email === group.user_email);

        nextItems.forEach(t => {
            if (!tid || t.id === tid) {
                if (t.status === 'waiting_approval') {
                    const wasPaid = t.paid_amount >= t.price;
                    const contribution = t.pending_payment || 0;
                    t.paid_amount += contribution;
                    t.pending_payment = 0;
                    t.updated_at = Date.now();

                    // Logic: If fully paid, status = 'paid'
                    t.status = t.paid_amount >= t.price ? 'paid' : 'reserved';

                    let targetCorrelative: number | undefined;
                    if (t.internal_correlative) {
                        targetCorrelative = t.internal_correlative;
                    } else if (isFinite(val as number)) {
                        targetCorrelative = val as number;
                    } else {
                        const existingInv = nextInv.find(i => i.assigned_ticket_id === t.id && i.event_id === state.config.event_internal_id);
                        if (existingInv) targetCorrelative = existingInv.correlative_id;
                    }

                    if (targetCorrelative !== undefined) {
                        const invIdx = nextInv.findIndex(i => i.correlative_id === targetCorrelative && i.event_id === state.config.event_internal_id);
                        if (invIdx > -1) {
                            const targetInv = { ...nextInv[invIdx] };
                            const isMismatch = targetInv.is_assigned && targetInv.assigned_ticket_id && targetInv.assigned_ticket_id !== t.id;

                            if (isMismatch) {
                                t.paid_amount -= contribution;
                                t.pending_payment = contribution;
                                t.status = 'waiting_approval';
                            } else {
                                const linkedTickets = nextItems.filter(item =>
                                    item.internal_correlative === targetCorrelative &&
                                    item.status !== 'cancelled' &&
                                    item.id !== t.id
                                );
                                const otherPaid = linkedTickets.reduce((acc, lt) => acc + lt.paid_amount, 0);
                                const totalProjected = otherPaid + t.paid_amount;

                                if (totalProjected > t.price) {
                                    alert(`⛔ Error: El monto excede el precio ($${t.price}).`);
                                    t.paid_amount -= contribution;
                                    t.pending_payment = contribution;
                                    t.status = 'waiting_approval';
                                } else {
                                    if (!targetInv.is_assigned) {
                                        targetInv.is_assigned = true;
                                        targetInv.assigned_user_email = group.user_email;
                                        targetInv.assigned_to = nextUsers.find(u => u.email === group.user_email)?.full_name || 'Usuario';
                                        targetInv.assigned_ticket_id = t.id;
                                    }
                                    if (targetInv.status === 'reversion') targetInv.status = 'active';
                                    nextInv[invIdx] = targetInv;
                                    t.assigned_link = targetInv.link;
                                    t.internal_correlative = targetInv.correlative_id;
                                    t.cost = targetInv.cost;
                                }
                            }
                        }
                    }

                    if (t.status === 'paid' && !wasPaid && !t.is_courtesy && t.price > 0) {
                        const benefitRecipient = promoter || buyer;
                        if (benefitRecipient) {
                            const uIdx = nextUsers.findIndex(u => u.email === benefitRecipient.email);
                            if (uIdx > -1) {
                                nextUsers[uIdx].lifetime_tickets = (nextUsers[uIdx].lifetime_tickets || 0) + 1;
                                nextUsers[uIdx].courtesy_progress = (nextUsers[uIdx].courtesy_progress || 0) + 1;
                                if (nextUsers[uIdx].is_promoter) {
                                    nextUsers[uIdx].referral_count = (nextUsers[uIdx].referral_count || 0) + 1;
                                }
                            }
                        }
                    }
                }
            }
        });
    } else if (act === 'complete_payment') {
        const promoter = nextUsers.find(u => u.email === group.seller_email);
        const buyer = nextUsers.find(u => u.email === group.user_email);

        nextItems.forEach(t => {
            if (!tid || t.id === tid) {
                const wasPaid = t.status === 'paid' || t.paid_amount >= t.price;
                t.paid_amount = t.price;
                t.pending_payment = 0;
                t.status = 'paid';
                t.updated_at = Date.now();

                if (!wasPaid && !t.is_courtesy && t.price > 0) {
                    const benefitRecipient = promoter || buyer;
                    if (benefitRecipient) {
                        const uIdx = nextUsers.findIndex(u => u.email === benefitRecipient.email);
                        if (uIdx > -1) {
                            nextUsers[uIdx].lifetime_tickets = (nextUsers[uIdx].lifetime_tickets || 0) + 1;
                            nextUsers[uIdx].courtesy_progress = (nextUsers[uIdx].courtesy_progress || 0) + 1;
                            if (nextUsers[uIdx].is_promoter) {
                                nextUsers[uIdx].referral_count = (nextUsers[uIdx].referral_count || 0) + 1;
                            }
                        }
                    }
                }
            }
        });
    } else if (act === 'unlock') {
        nextItems.forEach(t => { if (!tid || t.id === tid) t.is_unlocked = true; });
    } else if (act === 'lock') {
        nextItems.forEach(t => { if (!tid || t.id === tid) t.is_unlocked = false; });
    } else if (act === 'reject_delete') {
        if (tid) {
            const tIdx = nextItems.findIndex(t => t.id === tid);
            if (tIdx > -1) {
                const t = nextItems[tIdx];
                if (t.internal_correlative !== undefined) {
                    const invIdx = nextInv.findIndex(i => i.correlative_id === t.internal_correlative && i.event_id === state.config.event_internal_id);
                    if (invIdx > -1) {
                        nextInv[invIdx].is_assigned = false;
                        nextInv[invIdx].assigned_ticket_id = undefined;
                        nextInv[invIdx].assigned_to = undefined;
                        nextInv[invIdx].assigned_user_email = undefined;
                        nextInv[invIdx].status = 'active';
                    }
                }
                nextItems[tIdx] = {
                    ...t,
                    status: 'pending',
                    paid_amount: 0,
                    pending_payment: t.price,
                    assigned_link: undefined,
                    internal_correlative: undefined,
                    cost: 0,
                    updated_at: Date.now()
                };
            }
        }
    } else if (act === 'edit_price' && val !== undefined) {
        nextItems.forEach(t => {
            if (!tid || t.id === tid) {
                t.price = val;
                t.pending_payment = Math.max(0, t.price - t.paid_amount);
                // Auto-saldar if paid matches new price
                if (t.paid_amount >= t.price) {
                    t.status = 'paid';
                    t.pending_payment = 0;
                }
                t.updated_at = Date.now();
            }
        });
    }

    group.items = nextItems;
    nextGroups[gIdx] = group;
    return { purchaseGroups: nextGroups, inventory: nextInv, users: nextUsers };
};

export const generateCourtesyTicket = (email: string, config: any): PurchaseGroup => {
    const groupId = `COURTESY-AUTO-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    return {
        id: groupId,
        user_email: email,
        seller_email: 'SYSTEM',
        items: [{
            id: `C-SYM-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
            group_id: groupId,
            status: 'paid',
            price: 0,
            paid_amount: 0,
            cost: 0,
            event_name: config.event_title,
            event_id: config.event_internal_id,
            is_courtesy: true,
            is_unlocked: true,
            updated_at: Date.now()
        }],
        total_amount: 0,
        is_full_payment: true,
        created_at: Date.now(),
        status: 'paid',
        event_id: config.event_internal_id
    };
};

export const mapUserDBToApp = (u: any): User => ({
    email: u.email,
    full_name: u.full_name,
    instagram: u.instagram,
    phone_number: u.phone_number,
    pin: u.pin,
    role: u.role,
    balance: Number(u.balance || 0),
    stars: Number(u.stars || 1),
    courtesy_progress: Number(u.courtesy_progress || 0),
    lifetime_tickets: Number(u.lifetime_tickets || 0),
    is_promoter: u.is_promoter || false,
    referral_count: Number(u.referral_count || 0),
    pending_edits: u.pending_edits
});

export const mapUserAppToDB = (u: Partial<User>) => ({
    full_name: u.full_name,
    instagram: u.instagram,
    phone_number: u.phone_number,
    pin: u.pin,
    role: u.role,
    balance: u.balance,
    stars: u.stars,
    courtesy_progress: u.courtesy_progress,
    lifetime_tickets: u.lifetime_tickets,
    is_promoter: u.is_promoter,
    referral_count: u.referral_count,
    pending_edits: u.pending_edits
});

export const mapTicketDBToApp = (t: any): TicketItem => ({
    id: t.id,
    group_id: t.group_id,
    status: t.status as any,
    price: Number(t.price || 0),
    paid_amount: Number(t.paid_amount || 0),
    pending_payment: Number(t.pending_payment || 0),
    cost: Number(t.cost || 0),
    assigned_link: t.assigned_link,
    event_name: t.event_name,
    event_id: t.event_id,
    is_unlocked: t.is_unlocked || false,
    is_courtesy: t.is_courtesy || false,
    internal_correlative: t.internal_correlative,
    updated_at: t.updated_at ? new Date(t.updated_at).getTime() : Date.now()
});

export const mapTicketAppToDB = (t: TicketItem) => ({
    id: t.id,
    group_id: t.group_id,
    status: t.status,
    price: t.price,
    paid_amount: t.paid_amount,
    pending_payment: t.pending_payment,
    cost: t.cost,
    assigned_link: t.assigned_link,
    event_name: t.event_name,
    event_id: t.event_id,
    is_unlocked: t.is_unlocked,
    is_courtesy: t.is_courtesy,
    internal_correlative: t.internal_correlative,
    updated_at: t.updated_at ? new Date(t.updated_at).toISOString() : new Date().toISOString()
});

export const mapGroupDBToApp = (g: any, items: TicketItem[]): PurchaseGroup => ({
    id: g.id,
    user_email: g.user_email,
    seller_email: g.seller_email,
    items: items,
    total_amount: Number(g.total_amount),
    is_full_payment: g.is_full_payment,
    created_at: new Date(g.created_at).getTime(),
    status: g.status,
    event_id: g.event_id
});

export const mapGroupAppToDB = (g: PurchaseGroup) => ({
    id: g.id,
    user_email: g.user_email,
    seller_email: g.seller_email,
    total_amount: g.total_amount,
    is_full_payment: g.is_full_payment,
    status: g.status,
    event_id: g.event_id,
    created_at: new Date(g.created_at).toISOString()
});

export const mapInventoryDBToApp = (i: any): InventoryItem => ({
    name: i.name,
    link: i.link,
    cost: Number(i.cost),
    is_assigned: i.is_assigned,
    assigned_to: i.assigned_to,
    assigned_user_email: i.assigned_user_email,
    event_name: i.event_name,
    event_id: i.event_id,
    batch_number: i.batch_number,
    upload_date: i.upload_date ? new Date(i.upload_date).getTime() : undefined,
    is_pending_link: i.is_pending_link,
    correlative_id: i.correlative_id,
    assigned_ticket_id: i.assigned_ticket_id,
    status: i.status
});

export const mapInventoryAppToDB = (i: InventoryItem) => ({
    name: i.name,
    link: i.link,
    cost: i.cost,
    is_assigned: i.is_assigned,
    assigned_to: i.assigned_to,
    assigned_user_email: i.assigned_user_email,
    event_name: i.event_name,
    event_id: i.event_id,
    batch_number: i.batch_number,
    upload_date: i.upload_date ? new Date(i.upload_date).toISOString() : new Date().toISOString(),
    is_pending_link: i.is_pending_link,
    correlative_id: i.correlative_id,
    assigned_ticket_id: i.assigned_ticket_id,
    status: i.status
});

export const saveEventConfig = async (productId: string, config: any) => {
  const { data, error } = await supabase
    .from('event_settings')
    .upsert({ 
      product_id: productId, 
      event_date: config.date,
      access_code: config.code,
      location: config.location 
    });
  if (error) throw error;
  return data;
};
