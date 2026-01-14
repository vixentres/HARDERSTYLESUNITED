import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { email, updates, token, admin_email, admin_pin } = req.body;

    if (!email || !updates || !token) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Server configuration error' });
    }

    // 1. Verify User is Admin
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    let isAdmin = false;

    if (token) {
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (user) {
            const { data: profile } = await supabase.from('users').select('role').eq('email', user.email).single();
            if (profile && profile.role === 'admin') isAdmin = true;
        }
    }

    if (!isAdmin) {
        // Fallback: Custom PIN Auth (legacy app support)
        const { admin_email, admin_pin } = req.body;
        if (admin_email && admin_pin) {
            const { data: adminUser } = await supabase.from('users').select('role, pin').eq('email', admin_email).single();
            if (adminUser && adminUser.pin === String(admin_pin) && adminUser.role === 'admin') {
                isAdmin = true;
            }
        }
    }

    if (!isAdmin) {
        return res.status(403).json({ error: 'Forbidden: Admins only' });
    }

    // 2. Perform Update (Service Role)
    // Allowed fields
    const { full_name, phone_number, instagram, is_promoter, pin } = updates;
    const safeUpdates: any = {};
    if (full_name !== undefined) safeUpdates.full_name = full_name;
    if (phone_number !== undefined) safeUpdates.phone_number = phone_number;
    if (instagram !== undefined) safeUpdates.instagram = instagram;
    if (is_promoter !== undefined) safeUpdates.is_promoter = is_promoter;
    // Update PIN only if provided
    if (pin !== undefined) safeUpdates.pin = pin;

    try {
        const { data, error } = await supabase
            .from('users')
            .update(safeUpdates)
            .eq('email', email)
            .select()
            .single();

        if (error) throw error;

        return res.status(200).json({ success: true, data });
    } catch (err: any) {
        console.error('Update Client Error:', err);
        return res.status(500).json({ error: err.message });
    }
}
