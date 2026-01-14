import React, { useMemo } from 'react';
import { User, TicketItem, PurchaseGroup } from '../../../types';
import { formatCurrency } from '../../../logic';

interface AdminValidationProps {
    validationData: {
        pending: { user: User; seller?: User; items: { gid: string; item: TicketItem }[] }[];
        approved: { user: User; seller?: User; items: { gid: string; item: TicketItem }[] }[];
    };
    validationSearch: string;
    setValidationSearch: (s: string) => void;
    onAction: (gid: string, tid: string | null, act: string, val?: number) => void;
}

const AdminValidation: React.FC<AdminValidationProps> = ({ validationData, validationSearch, setValidationSearch, onAction }) => {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Search Bar */}
            <div className="bg-white/5 border border-white/5 rounded-2xl p-2 flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500">
                    <i className="fas fa-search text-xs"></i>
                </div>
                <input
                    type="text"
                    placeholder="Buscar por cliente o ID de ticket..."
                    className="bg-transparent border-none outline-none text-sm font-bold text-white placeholder:text-slate-600 flex-1"
                    value={validationSearch}
                    onChange={(e) => setValidationSearch(e.target.value)}
                />
            </div>

            {/* Pending Approvals */}
            <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Pagos por Validar</h3>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 text-[10px] font-black border border-amber-500/20">{validationData.pending.length} Pendientes</span>
                </div>

                <div className="grid gap-3">
                    {validationData.pending.map((group, idx) => (
                        <div key={idx} className="bg-white/5 border border-white/5 rounded-3xl overflow-hidden hover:border-white/10 transition-all">
                            <div className="p-4 flex items-center justify-between border-b border-white/5 bg-white/[0.02]">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                                        <span className="text-xs font-black text-cyan-500">{group.user.full_name.charAt(0)}</span>
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-black text-white uppercase">{group.user.full_name}</h4>
                                        <p className="text-[9px] font-bold text-slate-500 uppercase">{group.user.email}</p>
                                    </div>
                                </div>
                                {group.seller && (
                                    <div className="text-right">
                                        <p className="text-[8px] font-black text-slate-500 uppercase mb-0.5">Vendido por</p>
                                        <span className="px-2 py-1 rounded-lg bg-purple-500/10 text-purple-400 text-[9px] font-black border border-purple-500/20 uppercase">{group.seller.full_name}</span>
                                    </div>
                                )}
                            </div>
                            <div className="p-4 divide-y divide-white/5">
                                {group.items.map(({ gid, item }, iidx) => (
                                    <div key={iidx} className="py-3 first:pt-0 last:pb-0">
                                        <div className="flex items-center justify-between mb-3">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-[10px] font-black text-white uppercase tracking-tighter">{item.event_name}</span>
                                                    <span className="text-[8px] font-bold text-slate-500">ID: {item.id}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex flex-col">
                                                        <span className="text-[9px] font-bold text-slate-500 uppercase">Precio</span>
                                                        <span className="text-xs font-black text-white">${formatCurrency(item.price)}</span>
                                                    </div>
                                                    <div className="w-px h-6 bg-white/5"></div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[9px] font-bold text-amber-500 uppercase">Abonado</span>
                                                        <span className="text-xs font-black text-amber-400">${formatCurrency(item.paid_amount)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => onAction(gid, item.id, 'reject_delete')}
                                                    className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 transition-all hover:text-white flex items-center justify-center"
                                                >
                                                    <i className="fas fa-times text-sm"></i>
                                                </button>
                                                <button
                                                    onClick={() => onAction(gid, item.id, 'approve')}
                                                    className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500 transition-all hover:text-white flex items-center justify-center font-black"
                                                >
                                                    <i className="fas fa-check text-sm"></i>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                    {validationData.pending.length === 0 && (
                        <div className="p-12 text-center bg-white/5 border border-dashed border-white/10 rounded-3xl">
                            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
                                <i className="fas fa-check-double text-2xl"></i>
                            </div>
                            <h3 className="text-sm font-black text-white uppercase tracking-widest">¡Todo Validado!</h3>
                            <p className="text-[10px] font-bold text-slate-500 uppercase mt-2">No hay pagos pendientes de aprobación.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminValidation;
