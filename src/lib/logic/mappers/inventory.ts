import { InventoryItem } from '../../../../types';

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
