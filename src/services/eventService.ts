
import { createClient } from '../lib/supabaseClient';

export interface EventConfig {
  id: string;
  event_name: string;
  event_date: string;
  event_location?: string;
  banner_url?: string;
  map_url?: string;
  whatsapp_contact?: string;
  status: 'active' | 'inactive';
}

export const EventService = {
  async getConfig(): Promise<EventConfig | null> {
    const { data, error } = await createClient()
      .from('event_config')
      .select('*')
      .limit(1)
      .single();
    
    if (error) {
      console.error('Error fetching event config:', error);
      return null;
    }
    return data;
  },

  async updateConfig(id: string, updates: Partial<EventConfig>): Promise<EventConfig | null> {
    const { data, error } = await createClient()
      .from('event_config')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating event config:', error);
      throw error;
    }
    return data;
  },

  async createInitialConfig(): Promise<void> {
      // Helper to ensure at least one row exists
     const { count } = await createClient().from('event_config').select('*', { count: 'exact', head: true });
     if (count === 0) {
         await createClient().from('event_config').insert({ 
             event_name: 'Evento Inicial', 
             status: 'active' 
         });
     }
  }
};
