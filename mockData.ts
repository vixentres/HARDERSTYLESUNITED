import { AppState, User, InventoryItem, PurchaseGroup, SystemConfig } from './types';

export const generateMockData = (): AppState => {
    const EVENT_ID = "SK-2026-01";
    const EVENT_NAME = "SUPERKLUB";

    // Only the Master Admin remains
    const users: User[] = [
        {
            email: 'admin',
            full_name: 'Master Admin',
            instagram: 'hsu_master',
            pin: 'admin',
            role: 'admin',
            balance: 0,
            stars: 5,
            courtesy_progress: 0,
            lifetime_tickets: 0,
            phone_number: '56911223344'
        },
    ];

    const inventory: InventoryItem[] = [];
    const purchaseGroups: PurchaseGroup[] = [];

    const config: SystemConfig = {
        event_title: EVENT_NAME,
        event_internal_id: EVENT_ID,
        event_date: "10/01/2026",
        reference_price: 50000,
        final_price: 43000
    };

    return {
        users,
        purchaseGroups,
        inventory,
        conversations: [],
        config,
        logs: [],
        currentUser: null
    };
};
