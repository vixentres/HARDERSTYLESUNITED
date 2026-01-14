import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const {
        titulo_evento,
        id_interno,
        fecha_evento,
        precio_final,
        precio_referencial,
        banner_url,
        map_url,
        whatsapp_contacto
    } = req.body;

    // Basic Validation
    if (!titulo_evento || !id_interno) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const { data, error } = await supabase
            .from('event_config')
            .upsert({
                singleton_key: 'current',
                titulo_evento,
                id_interno,
                fecha_evento,
                precio_final: Number(precio_final),
                precio_referencial: Number(precio_referencial),
                banner_url,
                map_url,
                whatsapp_contacto,
                updated_at: new Date().toISOString()
            }, { onConflict: 'singleton_key' })
            .select()
            .single();

        if (error) throw error;

        return res.status(200).json({ success: true, data });
    } catch (err: any) {
        console.error('Update Config Error:', err);
        return res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
}
