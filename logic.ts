import { AppState, InventoryItem, PurchaseGroup, TicketItem, User } from './types';


export const extractUrl = (text: string): { url: string | null; isPending: boolean } => {
    const urlMatch = text.match(/(https?:\/\/[^\s)]+)/);
    if (urlMatch) return { url: urlMatch[1], isPending: false };
    return { url: null, isPending: true };
};

export const formatPhoneNumber = (phone: string): string => {
    if (!phone) return '';
    let clean = phone.replace(/\D/g, ''); // Remove all non-digits
    // Rule: 8 digits -> +569
    if (clean.length === 8) return `+569${clean}`;
    // Rule: 9 digits -> +56 (e.g. 9XXXXXXXX becomes +569XXXXXXXX)
    if (clean.length === 9) return `+56${clean}`;
    // Rule: If already prefixed (11 digits starting with 56), ensure +
    if (clean.length === 11 && clean.startsWith('56')) return `+${clean}`;
    // Fallback: if it starts with + just clean it, otherwise return as is
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
                t.pendingPayment = t.price - t.paidAmount;
                t.updatedAt = Date.now();
            }
        });
    } else if (act === 'reserve') {
        nextItems.forEach(t => {
            if (!tid || t.id === tid) {
                t.status = 'waiting_approval';
                t.pendingPayment = val || 10;
                t.updatedAt = Date.now();
            }
        });
    } else if (act === 'revert_assignment') {
        if (tid) {
            const tIdx = nextItems.findIndex(t => t.id === tid);
            if (tIdx > -1) {
                const t = nextItems[tIdx];
                if (t.internalCorrelative !== undefined) {
                    const invIdx = nextInv.findIndex(i => i.correlativeId === t.internalCorrelative && i.eventId === state.config.eventInternalId);
                    if (invIdx > -1) {
                        nextInv[invIdx].isAssigned = false;
                        nextInv[invIdx].assignedUserEmail = undefined;
                        nextInv[invIdx].assignedTo = undefined;
                    }
                }
                nextItems[tIdx] = { ...t, assignedLink: undefined, internalCorrelative: undefined, cost: 0, status: 'waiting_approval', updatedAt: Date.now() };
            }
        }
    } else if (act === 'manual_link' && val !== undefined) {
        // Keeping manual_link as a fallback but we prefer unified approve
        const invIdx = nextInv.findIndex(i => i.correlativeId === val && i.eventId === state.config.eventInternalId && !i.isAssigned);
        if (invIdx > -1 && tid) {
            const targetInv = { ...nextInv[invIdx] };
            targetInv.isAssigned = true;
            targetInv.assignedUserEmail = group.userEmail;
            targetInv.assignedTo = nextUsers.find(u => u.email === group.userEmail)?.fullName;
            nextInv[invIdx] = targetInv;

            const tIdx = nextItems.findIndex(t => t.id === tid);
            if (tIdx > -1) {
                nextItems[tIdx] = {
                    ...nextItems[tIdx],
                    assignedLink: targetInv.link,
                    internalCorrelative: targetInv.correlativeId,
                    cost: targetInv.cost,
                    updatedAt: Date.now()
                };
            }
        }
    } else if (act === 'revert_payment') {
        if (tid) {
            const tIdx = nextItems.findIndex(t => t.id === tid);
            if (tIdx > -1) {
                const t = nextItems[tIdx];
                const amtToRevert = t.paidAmount;

                if (t.internalCorrelative !== undefined) {
                    const invIdx = nextInv.findIndex(i => i.correlativeId === t.internalCorrelative && i.eventId === state.config.eventInternalId);
                    if (invIdx > -1) {
                        // TOTAL LIBERATION: Completely clear the entry
                        nextInv[invIdx].isAssigned = false;
                        nextInv[invIdx].assignedTicketId = undefined;
                        nextInv[invIdx].assignedTo = undefined;
                        nextInv[invIdx].assignedUserEmail = undefined;
                        nextInv[invIdx].status = 'active';
                    }
                }
                nextItems[tIdx] = {
                    ...t,
                    status: 'waiting_approval',
                    pendingPayment: (t.pendingPayment || 0) + amtToRevert,
                    paidAmount: 0,
                    assignedLink: undefined,
                    internalCorrelative: undefined,
                    cost: 0,
                    updatedAt: Date.now()
                };
            }
        }
    } else if (act === 'approve') {
        const promoter = nextUsers.find(u => u.email === group.sellerEmail);
        const buyer = nextUsers.find(u => u.email === group.userEmail);

        nextItems.forEach(t => {
            if (!tid || t.id === tid) {
                if (t.status === 'waiting_approval') {
                    const wasPaid = t.paidAmount >= t.price;
                    const contribution = t.pendingPayment || 0;
                    t.paidAmount += contribution;
                    t.pendingPayment = 0;
                    t.updatedAt = Date.now();
                    t.status = t.paidAmount >= t.price ? 'paid' : 'reserved';

                    // Simultaneous assignment if val is provided (invCorrelativeId)
                    let targetCorrelative: number | undefined;

                    if (t.internalCorrelative) {
                        targetCorrelative = t.internalCorrelative;
                    } else if (isFinite(val as number)) {
                        targetCorrelative = val as number;
                    } else {
                        const existingInv = nextInv.find(i => i.assignedTicketId === t.id && i.eventId === state.config.eventInternalId);
                        if (existingInv) targetCorrelative = existingInv.correlativeId;
                    }

                    if (targetCorrelative !== undefined) {
                        const invIdx = nextInv.findIndex(i => i.correlativeId === targetCorrelative && i.eventId === state.config.eventInternalId);

                        if (invIdx > -1) {
                            const targetInv = { ...nextInv[invIdx] };

                            const isMismatch = targetInv.isAssigned && targetInv.assignedTicketId && targetInv.assignedTicketId !== t.id;

                            if (isMismatch) {
                                console.error(`CRITICAL: Blocked assignment of Ticket ${t.id} to Entry ${targetInv.correlativeId} (Owned by ${targetInv.assignedTicketId})`);
                                t.paidAmount -= contribution;
                                t.pendingPayment = contribution;
                                t.status = 'waiting_approval';
                            } else {
                                // STRICT CHECK 2: Price Limit (100% Cap)
                                const linkedTickets = nextItems.filter(item =>
                                    item.internalCorrelative === targetCorrelative &&
                                    item.status !== 'cancelled' &&
                                    item.id !== t.id
                                );

                                const otherPaid = linkedTickets.reduce((acc, lt) => acc + lt.paidAmount, 0);
                                const totalProjected = otherPaid + t.paidAmount;

                                if (totalProjected > t.price) {
                                    console.warn(`Blocked: Overpayment. Total ${totalProjected} exceeds Price ${t.price}`);
                                    alert(`⛔ Error: El monto excede el precio del ticket ($${t.price}). Operación rechazada.`);
                                    t.paidAmount -= contribution;
                                    t.pendingPayment = contribution;
                                    t.status = 'waiting_approval';
                                } else {
                                    // SUCCESS: Assign
                                    if (!targetInv.isAssigned) {
                                        targetInv.isAssigned = true;
                                        targetInv.assignedUserEmail = group.userEmail;
                                        targetInv.assignedTo = nextUsers.find(u => u.email === group.userEmail)?.fullName || 'Usuario';
                                        targetInv.assignedTicketId = t.id;
                                    }

                                    // Reset reversion status if it was in reversion
                                    if (targetInv.status === 'reversion') {
                                        targetInv.status = 'active';
                                    }

                                    nextInv[invIdx] = targetInv;

                                    t.assignedLink = targetInv.link;
                                    t.internalCorrelative = targetInv.correlativeId;
                                    t.cost = targetInv.cost;
                                }
                            }
                        }
                    }

                    // Counting logic
                    const isNowPaid = t.status === 'paid';
                    if (isNowPaid && !wasPaid && !t.isCourtesy && t.price > 0) {
                        // Transfer benefit to promoter if a code was used, otherwise to buyer
                        const benefitRecipient = promoter || buyer;
                        if (benefitRecipient) {
                            const uIdx = nextUsers.findIndex(u => u.email === benefitRecipient.email);
                            if (uIdx > -1) {
                                const nextU = { ...nextUsers[uIdx] };
                                nextU.lifetimeTickets = (nextU.lifetimeTickets || 0) + 1;
                                nextU.courtesyProgress = (nextU.courtesyProgress || 0) + 1;
                                if (nextU.isPromoter) {
                                    nextU.referralCount = (nextU.referralCount || 0) + 1;
                                }
                                nextUsers[uIdx] = nextU;
                            }
                        }
                    }
                }
            }
        });
    } else if (act === 'complete_payment') {
        const promoter = nextUsers.find(u => u.email === group.sellerEmail);
        const buyer = nextUsers.find(u => u.email === group.userEmail);

        nextItems.forEach(t => {
            if (!tid || t.id === tid) {
                const wasPaid = t.status === 'paid' || t.paidAmount >= t.price;
                t.paidAmount = t.price;
                t.pendingPayment = 0;
                t.status = 'paid';
                t.updatedAt = Date.now();

                // Counting logic
                if (!wasPaid && !t.isCourtesy && t.price > 0) {
                    const benefitRecipient = promoter || buyer;
                    if (benefitRecipient) {
                        const uIdx = nextUsers.findIndex(u => u.email === benefitRecipient.email);
                        if (uIdx > -1) {
                            const nextU = { ...nextUsers[uIdx] };
                            nextU.lifetimeTickets = (nextU.lifetimeTickets || 0) + 1;
                            nextU.courtesyProgress = (nextU.courtesyProgress || 0) + 1;
                            if (nextU.isPromoter) {
                                nextU.referralCount = (nextU.referralCount || 0) + 1;
                            }
                            nextUsers[uIdx] = nextU;
                        }
                    }
                }
            }
        });
    } else if (act === 'unlock') {
        nextItems.forEach(t => {
            if ((!tid || t.id === tid)) {
                t.isUnlocked = true;
            }
        });
    } else if (act === 'lock') {
        nextItems.forEach(t => {
            if ((!tid || t.id === tid)) {
                t.isUnlocked = false;
            }
        });
    } else if (act === 'reject_delete') {
        if (tid) {
            const tIdx = nextItems.findIndex(t => t.id === tid);
            if (tIdx > -1) {
                const t = nextItems[tIdx];
                // Liberation of inventory if assigned
                if (t.internalCorrelative !== undefined) {
                    const invIdx = nextInv.findIndex(i => i.correlativeId === t.internalCorrelative && i.eventId === state.config.eventInternalId);
                    if (invIdx > -1) {
                        nextInv[invIdx].isAssigned = false;
                        nextInv[invIdx].assignedTicketId = undefined;
                        nextInv[invIdx].assignedTo = undefined;
                        nextInv[invIdx].assignedUserEmail = undefined;
                        nextInv[invIdx].status = 'active';
                    }
                }
                // Return to pending status for payment button visibility
                nextItems[tIdx] = {
                    ...t,
                    status: 'pending',
                    paidAmount: 0,
                    pendingPayment: t.price,
                    assignedLink: undefined,
                    internalCorrelative: undefined,
                    cost: 0,
                    updatedAt: Date.now()
                };
            }
        }
    }

    group.items = nextItems;
    nextGroups[gIdx] = group;
    return { purchaseGroups: nextGroups, inventory: nextInv, users: nextUsers };
};

export const generateCourtesyTicket = (email: string, config: any): PurchaseGroup => {
    const groupId = `COURTESY-AUTO-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    return {
        id: groupId,
        userEmail: email,
        sellerEmail: 'SYSTEM',
        items: [{
            id: `C-SYM-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
            groupId,
            status: 'paid',
            price: 0,
            paidAmount: 0,
            cost: 0,
            eventName: config.eventTitle,
            eventId: config.eventInternalId,
            isCourtesy: true,
            isUnlocked: true
        }],
        totalAmount: 0,
        isFullPayment: true,
        createdAt: Date.now(),
        status: 'paid',
        eventId: config.eventInternalId
    };
};

// --- Supabase Mapping Helpers ---

export const mapUserDBToApp = (u: any): User => ({
    email: u.email,
    fullName: u.full_name,
    instagram: u.instagram,
    phoneNumber: u.phone_number,
    pin: u.pin, // Nexus Edition uses 'pin'
    role: u.role,
    balance: Number(u.balance || 0),
    stars: Number(u.stars || 1),
    courtesyProgress: Number(u.courtesy_progress || 0),
    lifetimeTickets: Number(u.lifetime_tickets || 0),
    isPromoter: u.is_promoter || false,
    referralCount: Number(u.referral_count || 0),
    pendingEdits: u.pending_edits
});

export const mapUserAppToDB = (u: Partial<User>) => ({
    full_name: u.fullName,
    instagram: u.instagram,
    phone_number: u.phoneNumber,
    pin: u.pin,
    role: u.role,
    balance: u.balance,
    stars: u.stars,
    courtesy_progress: u.courtesyProgress,
    lifetime_tickets: u.lifetimeTickets,
    is_promoter: u.isPromoter,
    referral_count: u.referralCount,
    pending_edits: u.pendingEdits
});

export const mapTicketDBToApp = (t: any): TicketItem => ({
    id: t.id,
    groupId: t.group_id, // Nexus Edition uses group_id
    status: t.status as any,
    price: Number(t.price || 0),
    paidAmount: Number(t.paid_amount || 0),
    pendingPayment: Number(t.pending_payment || 0),
    cost: Number(t.cost || 0),
    assignedLink: t.assigned_link,
    eventName: t.event_name,
    eventId: t.event_id,
    isUnlocked: t.is_unlocked || false,
    isCourtesy: t.is_courtesy || false,
    internalCorrelative: t.internal_correlative,
    updatedAt: t.updated_at ? new Date(t.updated_at).getTime() : Date.now()
});

export const mapTicketAppToDB = (t: TicketItem) => ({
    id: t.id,
    group_id: t.groupId,
    status: t.status,
    price: t.price,
    paid_amount: t.paidAmount,
    pending_payment: t.pendingPayment,
    cost: t.cost,
    assigned_link: t.assignedLink,
    event_name: t.eventName,
    event_id: t.eventId,
    is_unlocked: t.isUnlocked,
    is_courtesy: t.isCourtesy,
    internal_correlative: t.internalCorrelative,
    updated_at: t.updatedAt ? new Date(t.updatedAt).toISOString() : new Date().toISOString()
});

export const mapGroupDBToApp = (g: any, items: TicketItem[]): PurchaseGroup => ({
    id: g.id,
    userEmail: g.user_email,
    sellerEmail: g.seller_email,
    items: items,
    totalAmount: Number(g.total_amount),
    isFullPayment: g.is_full_payment,
    createdAt: new Date(g.created_at).getTime(),
    status: g.status,
    eventId: g.event_id
});

export const mapGroupAppToDB = (g: PurchaseGroup) => ({
    id: g.id,
    user_email: g.userEmail,
    seller_email: g.sellerEmail,
    total_amount: g.totalAmount,
    is_full_payment: g.isFullPayment,
    status: g.status,
    event_id: g.eventId,
    created_at: new Date(g.createdAt).toISOString()
});

export const mapInventoryDBToApp = (i: any): InventoryItem => ({
    name: i.name,
    link: i.link,
    cost: Number(i.cost),
    isAssigned: i.is_assigned,
    assignedTo: i.assigned_to,
    assignedUserEmail: i.assigned_user_email,
    eventName: i.event_name,
    eventId: i.event_id,
    batchNumber: i.batch_number,
    uploadDate: i.upload_date ? new Date(i.upload_date).getTime() : undefined,
    isPendingLink: i.is_pending_link,
    correlativeId: i.correlative_id,
    assignedTicketId: i.assigned_ticket_id,
    status: i.status
});

export const mapInventoryAppToDB = (i: InventoryItem) => ({
    name: i.name,
    link: i.link,
    cost: i.cost,
    is_assigned: i.isAssigned,
    assigned_to: i.assignedTo,
    assigned_user_email: i.assignedUserEmail,
    event_name: i.eventName,
    event_id: i.eventId,
    batch_number: i.batchNumber,
    upload_date: i.uploadDate ? new Date(i.uploadDate).toISOString() : new Date().toISOString(),
    is_pending_link: i.isPendingLink,
    correlative_id: i.correlativeId,
    assigned_ticket_id: i.assignedTicketId,
    status: i.status
});
