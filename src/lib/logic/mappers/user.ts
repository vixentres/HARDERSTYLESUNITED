import { User } from '../../../../types';

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
