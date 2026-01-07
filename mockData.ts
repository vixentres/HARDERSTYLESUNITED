import { AppState, User, InventoryItem, PurchaseGroup, SystemConfig } from './types';

export const generateMockData = (): AppState => {
    const EVENT_ID = "SK-2026-01";
    const EVENT_NAME = "SUPERKLUB";

    // Only the Master Admin remains
    const users: User[] = [
        {
            email: 'admin',
            fullName: 'Master Admin',
            instagram: 'hsu_master',
            pin: 'admin',
            role: 'admin',
            balance: 0,
            stars: 5,
            courtesyProgress: 0,
            lifetimeTickets: 0,
            phoneNumber: '56911223344'
        },
    ];

    const inventory: InventoryItem[] = [];
    const purchaseGroups: PurchaseGroup[] = [];

    const config: SystemConfig = {
        eventTitle: EVENT_NAME,
        eventInternalId: EVENT_ID,
        eventDate: "10/01/2026",
        referencePrice: 50000,
        finalPrice: 43000
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
