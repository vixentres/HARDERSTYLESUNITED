import React, { useState, useMemo } from 'react';
import { AppState, InventoryItem, TicketItem } from '../../../types';

interface AdminInventoryProps {
    state: AppState;
    currentEventId: string;
    onUpdateInventory: (inv: InventoryItem[]) => void;
    onAction: (gid: string, tid: string | null, act: string, val?: number) => void;
    onDeleteInventoryItem: (correlativeId: number) => void;
}

const AdminInventory: React.FC<AdminInventoryProps> = ({ state, currentEventId, onUpdateInventory, onAction, onDeleteInventoryItem }) => {
    const [invSearch, setInvSearch] = useState('');
    const [invTab, setInvTab] = useState<'all' | 'free' | 'assigned'>('all');
    const [invSortOrder, setInvSortOrder] = useState<'asc' | 'desc'>('asc');
    const [stockFusionTab, setStockFusionTab] = useState<'upload' | 'management'>('management');
    const [inventoryInput, setInventoryInput] = useState('');
    const [batchCost, setBatchCost] = useState<number>(0);
    const [costMode, setCostMode] = useState<'total' | 'unit'>('total');
    const [ticketToAssign, setTicketToAssign] = useState<TicketItem | null>(null);
    const [editingInvItem, setEditingInvItem] = useState<{ idx: number, data: InventoryItem } | null>(null);

    const filteredInventory = useMemo(() => {
        let items = state.inventory
            .filter(i => i.event_id === currentEventId)
            .filter(i => {
                if (invTab === 'free') return !i.is_assigned;
                if (invTab === 'assigned') return i.is_assigned;
                return true;
            })
            .filter(i =>
                i.link.toLowerCase().includes(invSearch.toLowerCase()) ||
                (i.original_text || '').toLowerCase().includes(invSearch.toLowerCase()) ||
                (i.name || '').toLowerCase().includes(invSearch.toLowerCase())
            );
        return items.sort((a, b) => {
            const idA = a.correlative_id || 0;
            const idB = b.correlative_id || 0;
            return invSortOrder === 'asc' ? idA - idB : idB - idA;
        });
    }, [state.inventory, currentEventId, invTab, invSearch, invSortOrder]);

    const handleAddInventory = () => {
        const rawLines = inventoryInput.split('\n').filter(line => line.trim() !== '');
        if (rawLines.length === 0 || batchCost <= 0) return alert("Ingresa los nombres correlativos y el costo total del conjunto.");

        const currentBatches = state.inventory.filter(i => i.event_id === currentEventId).map(i => i.batch_number || 0);
        const nextBatch = currentBatches.length > 0 ? Math.max(...currentBatches) + 1 : 1;

        const validItems: InventoryItem[] = [];
        let currentCorrelativeCount = state.inventory.filter(i => i.event_id === state.config.event_internal_id).length;

        rawLines.forEach(line => {
            currentCorrelativeCount++;
            validItems.push({
                name: line.trim(),
                link: '',
                cost: 0,
                is_assigned: false,
                event_name: state.config.event_title,
                event_id: state.config.event_internal_id,
                batch_number: nextBatch,
                upload_date: Date.now(),
                original_text: line.trim(),
                is_pending_link: true,
                correlative_id: currentCorrelativeCount
            });
        });

        const costPerUnit = costMode === 'total' ? batchCost / validItems.length : batchCost;
        validItems.forEach(i => i.cost = costPerUnit);

        onUpdateInventory([...state.inventory, ...validItems]);
        setInventoryInput('');
        setBatchCost(0);
        alert(`Carga Exitosa Tanda #${nextBatch}.\n${validItems.length} Entradas agregadas correctamente.`);
    };

    const handleEditInventoryItem = () => {
        if (!editingInvItem) return;
        if (editingInvItem.data.link) {
            const isDuplicate = state.inventory.some((inv, i) =>
                inv.link === editingInvItem.data.link &&
                inv.event_id === currentEventId &&
                i !== editingInvItem.idx
            );
            if (isDuplicate) {
                alert("⚠️ Error: Esta URL ya existe en el inventario para este evento. Evita duplicados.");
                return;
            }
        }
        const nextInv = [...state.inventory];
        nextInv[editingInvItem.idx] = editingInvItem.data;
        onUpdateInventory(nextInv);
        setEditingInvItem(null);
    };

    const handleInlineEditInventory = (idx: number, newLink: string) => {
        const actualIdx = state.inventory.findIndex((_, i) => i === idx);
        if (actualIdx === -1) return;
        if (newLink) {
            const isDuplicate = state.inventory.some((inv, i) =>
                inv.link === newLink &&
                inv.event_id === currentEventId &&
                i !== actualIdx
            );
            if (isDuplicate) {
                alert("⚠️ Error: Esta URL ya existe en el inventario para este evento. Evita duplicados.");
                return;
            }
        }
        const nextInv = [...state.inventory];
        nextInv[actualIdx] = { ...nextInv[actualIdx], link: newLink, is_pending_link: false };
        onUpdateInventory(nextInv);
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Sub Tabs */}
            <div className="flex p-1 bg-white/5 border border-white/5 rounded-2xl">
                <button
                    onClick={() => setStockFusionTab('management')}
                    className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${stockFusionTab === 'management' ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    <i className="fas fa-tasks mr-2"></i> Gestión
                </button>
                <button
                    onClick={() => setStockFusionTab('upload')}
                    className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${stockFusionTab === 'upload' ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    <i className="fas fa-cloud-upload mr-2"></i> Inyectar Stock
                </button>
            </div>

            {stockFusionTab === 'upload' && (
                <div className="bg-white/5 border border-white/5 rounded-3xl p-6">
                    <div className="flex flex-col gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block px-1">Nombres de Correlativos (Uno por línea)</label>
                            <textarea
                                className="w-full bg-[#11111a] border border-white/5 rounded-2xl p-4 text-sm font-bold text-white placeholder:text-slate-700 min-h-[200px] outline-none focus:border-cyan-500/50 transition-all font-mono"
                                placeholder="Nexus-001&#10;Nexus-002&#10;Nexus-003..."
                                value={inventoryInput}
                                onChange={(e) => setInventoryInput(e.target.value)}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block px-1">Costo</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 font-black">$</span>
                                    <input
                                        type="number"
                                        className="w-full bg-[#11111a] border border-white/5 rounded-2xl py-4 pl-8 pr-4 text-sm font-black text-white outline-none focus:border-cyan-500/50 transition-all"
                                        value={batchCost || ''}
                                        onChange={(e) => setBatchCost(Number(e.target.value))}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block px-1">Modo de Costo</label>
                                <div className="flex bg-[#11111a] p-1 border border-white/5 rounded-2xl h-[58px]">
                                    <button onClick={() => setCostMode('total')} className={`flex-1 text-[9px] font-black uppercase rounded-xl ${costMode === 'total' ? 'bg-white/10 text-white' : 'text-slate-600'}`}>Total Lote</button>
                                    <button onClick={() => setCostMode('unit')} className={`flex-1 text-[9px] font-black uppercase rounded-xl ${costMode === 'unit' ? 'bg-white/10 text-white' : 'text-slate-600'}`}>Por Unidad</button>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={handleAddInventory}
                            className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-cyan-500/20 hover:scale-[1.02] active:scale-95 transition-all"
                        >
                            <i className="fas fa-plus-circle mr-2"></i> Iniciar Procesamiento de Entradas
                        </button>
                    </div>
                </div>
            )}

            {stockFusionTab === 'management' && (
                <div className="space-y-6">
                    {/* Assignment Banner */}
                    {ticketToAssign && (
                        <div className="bg-cyan-500/20 border border-cyan-500/30 rounded-2xl p-4 flex items-center justify-between mb-2 animate-pulse">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-cyan-500 text-white flex items-center justify-center">
                                    <i className="fas fa-link"></i>
                                </div>
                                <div>
                                    <h4 className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">Modo de Vinculación Activo</h4>
                                    <p className="text-[11px] font-black text-white leading-tight">VINCULAR TICKET #{ticketToAssign.id}</p>
                                </div>
                            </div>
                            <button onClick={() => setTicketToAssign(null)} className="text-white/50 hover:text-white transition-all">
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                    )}

                    {/* Inventory Controls */}
                    <div className="flex flex-col md:flex-row gap-3">
                        <div className="flex-1 bg-white/5 border border-white/5 rounded-2xl p-2 flex items-center gap-2">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500">
                                <i className="fas fa-search text-xs"></i>
                            </div>
                            <input
                                type="text"
                                placeholder="Buscar en el maestro..."
                                className="bg-transparent border-none outline-none text-sm font-bold text-white placeholder:text-slate-700 flex-1"
                                value={invSearch}
                                onChange={(e) => setInvSearch(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2">
                            <div className="hidden lg:flex p-1 bg-white/5 border border-white/5 rounded-2xl h-[56px]">
                                {(['all', 'free', 'assigned'] as const).map(t => (
                                    <button
                                        key={t}
                                        onClick={() => setInvTab(t)}
                                        className={`px-4 text-[9px] font-black uppercase rounded-xl transition-all ${invTab === t ? 'bg-white/10 text-white' : 'text-slate-600'}`}
                                    >
                                        {t === 'all' ? 'Ver Todo' : t === 'free' ? 'Libres' : 'Asignados'}
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={() => setInvSortOrder(invSortOrder === 'asc' ? 'desc' : 'asc')}
                                className="w-14 h-14 rounded-2xl bg-white/5 border border-white/5 text-slate-400 flex items-center justify-center hover:bg-white/10 transition-all font-black"
                            >
                                <i className={`fas fa-sort-numeric-${invSortOrder === 'asc' ? 'down' : 'up'}`}></i>
                            </button>
                        </div>
                    </div>

                    {/* Inventory Maestro - Table (Desktop) */}
                    <div className="hidden md:block bg-white/5 border border-white/5 rounded-3xl overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-white/[0.02] border-b border-white/5">
                                    <th className="p-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Correlativo</th>
                                    <th className="p-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Enlace / Asignación</th>
                                    <th className="p-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Estado</th>
                                    <th className="p-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredInventory.map((inv, idx) => (
                                    <tr key={idx} className={`hover:bg-white/5 transition-all group/row ${inv.is_assigned ? 'opacity-80' : ''}`}>
                                        <td className="p-5">
                                            <div className="flex flex-col items-center">
                                                <span className="text-xs font-black text-white uppercase">{inv.name}</span>
                                                <span className="text-[9px] font-bold text-slate-500 uppercase">#{inv.correlative_id} / Tanda {inv.batch_number}</span>
                                            </div>
                                        </td>
                                        <td className="p-5">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black transition-all ${inv.link ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-[0_0_15px_-5px_cyan]' : 'bg-slate-800/50 text-slate-700 border border-white/5'}`}>
                                                    <i className={`fas ${inv.link ? 'fa-link' : 'fa-link-slash'}`}></i>
                                                </div>
                                                <div className="flex-1 max-w-xs">
                                                    {ticketToAssign ? (
                                                        <button
                                                            onClick={() => {
                                                                if (inv.is_assigned) return alert("Esta entrada ya está asignada.");
                                                                onAction(ticketToAssign.group_id, ticketToAssign.id, 'manual_link', inv.correlative_id);
                                                                setTicketToAssign(null);
                                                            }}
                                                            className="w-full py-2 bg-cyan-500/20 text-cyan-400 text-[10px] font-black uppercase rounded-lg border border-cyan-500/30 hover:bg-cyan-500 hover:text-white transition-all"
                                                        >
                                                            VINCULAR AQUÍ
                                                        </button>
                                                    ) : inv.is_assigned ? (
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] font-black text-emerald-400 uppercase flex items-center gap-1.5"><i className="fas fa-user-check text-[8px]"></i> {inv.assigned_to || 'Sin nombre'}</span>
                                                            <span className="text-[8px] font-bold text-slate-500 uppercase truncate">{inv.assigned_user_email}</span>
                                                        </div>
                                                    ) : (
                                                        <input
                                                            type="text"
                                                            className="w-full bg-white/5 border border-white/5 rounded-lg px-3 py-2 text-[10px] font-bold text-white placeholder:text-slate-700 transition-all outline-none focus:border-cyan-500/30"
                                                            placeholder="Pegar enlace aquí..."
                                                            defaultValue={inv.link}
                                                            onBlur={(e) => handleInlineEditInventory(idx, e.target.value)}
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-5">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${inv.is_assigned ? 'bg-emerald-500 shadow-[0_0_8px_emerald]' : 'bg-slate-700'}`}></div>
                                                <span className={`text-[10px] font-black uppercase ${inv.is_assigned ? 'text-emerald-400' : 'text-slate-600'}`}>{inv.is_assigned ? 'Asignado' : 'Disponible'}</span>
                                            </div>
                                        </td>
                                        <td className="p-5 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => setEditingInvItem({ idx, data: inv })}
                                                    className="w-9 h-9 rounded-xl bg-white/5 text-slate-500 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center border border-white/5"
                                                >
                                                    <i className="fas fa-edit text-xs"></i>
                                                </button>
                                                <button
                                                    onClick={() => { if (confirm("¿Eliminar entrada?")) onDeleteInventoryItem(inv.correlative_id); }}
                                                    className="w-9 h-9 rounded-xl bg-red-500/5 text-red-500/50 hover:text-red-500 hover:bg-red-500/10 transition-all flex items-center justify-center border border-red-500/10"
                                                >
                                                    <i className="fas fa-trash-alt text-xs"></i>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Inventory Maestro - Mobile Cards (NEW Redesign) */}
                    <div className="md:hidden grid gap-4">
                        {filteredInventory.map((inv, idx) => (
                            <div key={idx} className={`bg-white/5 border border-white/5 rounded-3xl p-4 transition-all ${inv.is_assigned ? 'opacity-80' : ''}`}>
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black transition-all ${inv.link ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-slate-800/50 text-slate-700 border border-white/5'}`}>
                                            <i className={`fas ${inv.link ? 'fa-link' : 'fa-link-slash'}`}></i>
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-black text-white uppercase">{inv.name}</h4>
                                            <p className="text-[9px] font-bold text-slate-500 uppercase">#{inv.correlative_id} / Tanda {inv.batch_number}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase border ${inv.is_assigned ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-slate-500/10 text-slate-500 border-slate-500/20'}`}>
                                            {inv.is_assigned ? 'Asignado' : 'Libre'}
                                        </div>
                                        <button onClick={() => setEditingInvItem({ idx, data: inv })} className="w-8 h-8 rounded-lg bg-white/5 text-slate-500 flex items-center justify-center">
                                            <i className="fas fa-ellipsis-v text-xs"></i>
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    {ticketToAssign ? (
                                        <button
                                            onClick={() => {
                                                if (inv.is_assigned) return alert("Esta entrada ya está asignada.");
                                                onAction(ticketToAssign.group_id, ticketToAssign.id, 'manual_link', inv.correlative_id);
                                                setTicketToAssign(null);
                                            }}
                                            className="w-full py-3 bg-cyan-500 text-white text-[10px] font-black uppercase rounded-2xl shadow-lg shadow-cyan-500/20"
                                        >
                                            VINCULAR TICKET #{ticketToAssign.id}
                                        </button>
                                    ) : inv.is_assigned ? (
                                        <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-3">
                                            <span className="text-[9px] font-black text-slate-500 uppercase block mb-1">Dueño</span>
                                            <p className="text-[10px] font-black text-white uppercase">{inv.assigned_to || 'Sin nombre'}</p>
                                            <p className="text-[9px] font-bold text-slate-500 lowercase truncate">{inv.assigned_user_email}</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <span className="text-[9px] font-black text-slate-500 uppercase px-1">Enlace de descarga</span>
                                            <input
                                                type="text"
                                                className="w-full bg-white/5 border border-white/5 rounded-2xl px-4 py-3 text-[10px] font-bold text-white outline-none focus:border-cyan-500/30"
                                                placeholder="Pegar URL aquí..."
                                                defaultValue={inv.link}
                                                onBlur={(e) => handleInlineEditInventory(idx, e.target.value)}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {editingInvItem && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-[#11111a] border border-white/10 rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl">
                        <div className="p-6 border-b border-white/5 flex items-center justify-between">
                            <h3 className="text-xs font-black text-white uppercase tracking-widest">Gestionar Entrada</h3>
                            <button onClick={() => setEditingInvItem(null)} className="text-slate-500 hover:text-white transition-all"><i className="fas fa-times"></i></button>
                        </div>
                        <div className="p-6 grid gap-4">
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">Enlace de Descarga</label>
                                <input type="text" className="w-full bg-white/5 border border-white/5 rounded-2xl px-4 py-3 text-[10px] font-bold text-white outline-none focus:border-cyan-500/30" value={editingInvItem.data.link} onChange={(e) => setEditingInvItem({ ...editingInvItem, data: { ...editingInvItem.data, link: e.target.value, is_pending_link: !e.target.value } })} />
                            </div>
                            <div className="flex bg-white/5 border border-white/5 rounded-2xl p-4 items-center justify-between">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Estado de Venta</span>
                                <div className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase ${editingInvItem.data.is_assigned ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-500'}`}>
                                    {editingInvItem.data.is_assigned ? 'Asignada' : 'Disponible'}
                                </div>
                            </div>
                            <button onClick={handleEditInventoryItem} className="w-full py-4 bg-white hover:bg-cyan-500 text-black hover:text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all h-14">Actualizar Maestro</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminInventory;
