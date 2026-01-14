import { supabase } from '../lib/supabaseClient';
import { User } from '../../types';

export const AdminService = {
    async updateClient(targetEmail: string, updates: Partial<User>, adminUser?: User | null) {
        // Get current session token
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        if (!token && !adminUser) {
            console.warn("No auth session or admin user provided.");
            return { success: false, error: "Authentication missing" };
        }

        try {
            const res = await fetch('/api/admin/update-client', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: targetEmail,
                    updates,
                    token,
                    admin_email: adminUser?.email,
                    admin_pin: adminUser?.pin
                })
            });

            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'API Error');
            return { success: true, data: json.data };
        } catch (e: any) {
            console.error("Admin Update Error:", e);
            return { success: false, error: e.message };
        }
    }
};
