import { AppState, InventoryItem, PurchaseGroup, TicketItem, User } from '../../../types';

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
