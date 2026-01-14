import { supabase } from '../lib/supabaseClient';
import { SystemConfig } from '../../types';

export interface DBEventConfig {
    id: string;
    titulo_evento: string;
    id_interno: string;
    fecha_evento: string;
    precio_referencial: number;
    precio_final: number;
    banner_url?: string;
    map_url?: string;
    whatsapp_contacto?: string;
    estado_evento: string;
}

export const EventConfigService = {
    async getConfig(): Promise<SystemConfig | null> {
        const { data, error } = await supabase
            .from('event_config')
            .select('*')
            .eq('singleton_key', 'current')
            .single();

        if (error) {
            console.warn('Could not fetch event config:', error.message);
            return null;
        }

        // Map DB (Spanish) -> Frontend (Snake/Existing Types)
        // Note: SystemConfig in types.ts uses snake_case keys like event_title, reference_price
        return {
            event_title: data.titulo_evento,
            event_internal_id: data.id_interno,
            event_date: data.fecha_evento, // Ensure format is compatible or parse it
            reference_price: data.precio_referencial,
            final_price: data.precio_final,
            banner_url: data.banner_url,
            map_url: data.map_url,
            whatsapp_contacto: data.whatsapp_contacto,
            event_location: data.event_location
        };
    },

    async updateConfigViaApi(config: Partial<DBEventConfig>): Promise<boolean> {
        try {
            const res = await fetch('/api/event-config/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });
            if (!res.ok) throw new Error('API Error');
            return true;
        } catch (e) {
            console.error(e);
            return false;
        }
    }
};
