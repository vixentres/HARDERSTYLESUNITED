import React, { useState, useEffect } from 'react';
import { SystemConfig } from '../../../types';
import { EventConfigService } from '../../../src/services/eventConfig';

interface AdminConfigProps {
    config: SystemConfig;
    onUpdateConfig: (config: SystemConfig) => void;
}

const AdminConfig: React.FC<AdminConfigProps> = ({ config, onUpdateConfig }) => {
    const [configForm, setConfigForm] = useState<SystemConfig>(config);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => { setConfigForm(config); }, [config]);

    const handleSave = async () => {
        setIsLoading(true);
        try {
            // Map frontend keys to DB keys (Spanish)
            const dbUpdate = {
                titulo_evento: configForm.event_title,
                precio_referencial: configForm.reference_price,
                precio_final: configForm.final_price,
                fecha_evento: configForm.event_date,
                banner_url: configForm.banner_url,
                map_url: configForm.map_url,
                whatsapp_contacto: configForm.whatsapp_contacto,
                event_location: configForm.event_location
            };

            const success = await EventConfigService.updateConfigViaApi(dbUpdate as any);

            if (success) {
                onUpdateConfig(configForm);
                alert("Configuración actualizada correctamente (Single Row).");
            } else {
                throw new Error("API responded with error");
            }
        } catch (e) {
            console.error(e);
            alert("Error al guardar configuración. Verifique la conexión o permisos.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white/5 border border-white/5 rounded-3xl p-6">
                <h3 className="text-xs font-black text-white uppercase tracking-widest mb-6 py-2 border-b border-white/10 block w-fit">Parámetros del Sistema</h3>
                <div className="grid gap-6">
                    <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">Título del Evento</label>
                        <input
                            type="text"
                            className="w-full bg-[#11111a] border border-white/5 rounded-2xl px-4 py-4 text-sm font-black text-white outline-none focus:border-cyan-500/50 transition-all"
                            value={configForm.event_title}
                            onChange={(e) => setConfigForm({ ...configForm, event_title: e.target.value })}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">Precio Referencia</label>
                            <input
                                type="number"
                                className="w-full bg-[#11111a] border border-white/5 rounded-2xl px-4 py-4 text-sm font-black text-white outline-none focus:border-cyan-500/50 transition-all"
                                value={configForm.reference_price}
                                onChange={(e) => setConfigForm({ ...configForm, reference_price: Number(e.target.value) })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">Precio Final</label>
                            <input
                                type="number"
                                className="w-full bg-[#11111a] border border-white/5 rounded-2xl px-4 py-4 text-sm font-black text-white outline-none focus:border-cyan-500/50 transition-all"
                                value={configForm.final_price}
                                onChange={(e) => setConfigForm({ ...configForm, final_price: Number(e.target.value) })}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">Event Date (YYYY-MM-DD)</label>
                        <input
                            type="date"
                            className="w-full bg-[#11111a] border border-white/5 rounded-2xl px-4 py-4 text-sm font-black text-white outline-none focus:border-cyan-500/50 transition-all"
                            value={configForm.event_date}
                            onChange={(e) => setConfigForm({ ...configForm, event_date: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">Ubicación del Evento</label>
                        <input
                            type="text"
                            className="w-full bg-[#11111a] border border-white/5 rounded-2xl px-4 py-4 text-sm font-black text-white outline-none focus:border-cyan-500/50 transition-all"
                            value={configForm.event_location || ''}
                            onChange={(e) => setConfigForm({ ...configForm, event_location: e.target.value })}
                            placeholder="Ej: Espacio Riesco"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">Banner URL</label>
                        <input
                            type="text"
                            className="w-full bg-[#11111a] border border-white/5 rounded-2xl px-4 py-4 text-sm font-black text-white outline-none focus:border-cyan-500/50 transition-all"
                            value={configForm.banner_url || ''}
                            onChange={(e) => setConfigForm({ ...configForm, banner_url: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">Map URL</label>
                        <input
                            type="text"
                            className="w-full bg-[#11111a] border border-white/5 rounded-2xl px-4 py-4 text-sm font-black text-white outline-none focus:border-cyan-500/50 transition-all"
                            value={configForm.map_url || ''}
                            onChange={(e) => setConfigForm({ ...configForm, map_url: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">WhatsApp Contacto (Sin +)</label>
                        <input
                            type="text"
                            className="w-full bg-[#11111a] border border-white/5 rounded-2xl px-4 py-4 text-sm font-black text-white outline-none focus:border-cyan-500/50 transition-all"
                            value={configForm.whatsapp_contacto || ''}
                            onChange={(e) => setConfigForm({ ...configForm, whatsapp_contacto: e.target.value })}
                        />
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={isLoading}
                        className="w-full py-4 bg-white/10 hover:bg-white text-slate-400 hover:text-black text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all disabled:opacity-50"
                    >
                        {isLoading ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AdminConfig;
