import React from 'react';
import { formatCurrency } from '../../../logic';

interface AdminStatsProps {
    stats: {
        revenue: number;
        utility: number;
        invInvestment: number;
        stockTotal: number;
        stockFree: number;
        stockSold: number;
        stockPending: number;
        pendingCount: number;
        activeClients: number;
        totalUsers: number;
        promoterRanking: { name: string; count: number; revenue: number }[];
        clientRanking: { name: string; count: number; revenue: number }[];
    };
}

const AdminStats: React.FC<AdminStatsProps> = ({ stats }) => {
    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Ingresos Totales</span>
                    <div className="flex items-baseline gap-1">
                        <span className="text-xl font-black text-white">${formatCurrency(stats.revenue)}</span>
                    </div>
                    <div className="mt-2 text-[9px] font-bold text-cyan-500 uppercase flex items-center gap-1">
                        <i className="fas fa-chart-line"></i> +12% vs ayer
                    </div>
                </div>
                <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Utilidad Neta</span>
                    <div className="flex items-baseline gap-1">
                        <span className="text-xl font-black text-emerald-400">${formatCurrency(stats.utility)}</span>
                    </div>
                    <div className="mt-2 text-[9px] font-bold text-slate-500 uppercase">Margen: {stats.revenue > 0 ? ((stats.utility / stats.revenue) * 100).toFixed(0) : 0}%</div>
                </div>
                <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Stock Disponible</span>
                    <div className="flex items-baseline gap-2">
                        <span className="text-xl font-black text-white">{stats.stockFree}</span>
                        <span className="text-[10px] font-bold text-slate-500">/ {stats.stockTotal}</span>
                    </div>
                    <div className="mt-2 w-full bg-white/5 h-1 rounded-full overflow-hidden">
                        <div className="h-full bg-cyan-500" style={{ width: `${(stats.stockSold / stats.stockTotal) * 100}%` }}></div>
                    </div>
                </div>
                <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Validaciones</span>
                    <div className="flex items-baseline gap-1">
                        <span className={`text-xl font-black ${stats.pendingCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {stats.pendingCount}
                        </span>
                    </div>
                    <div className="mt-2 text-[9px] font-bold text-slate-500 uppercase">{stats.pendingCount > 0 ? 'Requiere atención' : 'Todo al día'}</div>
                </div>
            </div>

            {/* Top Clients & Promoters */}
            <div className="grid lg:grid-cols-2 gap-6">
                <div className="bg-white/5 border border-white/5 rounded-3xl overflow-hidden">
                    <div className="p-5 border-b border-white/5 flex items-center justify-between">
                        <h3 className="text-xs font-black text-white uppercase tracking-widest">Ranking Promotores</h3>
                        <i className="fas fa-medal text-amber-500"></i>
                    </div>
                    <div className="divide-y divide-white/5">
                        {stats.promoterRanking.map((p, i) => (
                            <div key={i} className="p-4 flex items-center justify-between hover:bg-white/5 transition-all">
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-black text-slate-600 w-4">{i + 1}</span>
                                    <div>
                                        <p className="text-xs font-black text-white uppercase">{p.name}</p>
                                        <p className="text-[10px] font-bold text-slate-500">{p.count} Ventas</p>
                                    </div>
                                </div>
                                <span className="text-xs font-black text-cyan-400">${formatCurrency(p.revenue)}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="bg-white/5 border border-white/5 rounded-3xl overflow-hidden">
                    <div className="p-5 border-b border-white/5 flex items-center justify-between">
                        <h3 className="text-xs font-black text-white uppercase tracking-widest">Top Clientes</h3>
                        <i className="fas fa-crown text-cyan-500"></i>
                    </div>
                    <div className="divide-y divide-white/5">
                        {stats.clientRanking.map((p, i) => (
                            <div key={i} className="p-4 flex items-center justify-between hover:bg-white/5 transition-all">
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-black text-slate-600 w-4">{i + 1}</span>
                                    <div>
                                        <p className="text-xs font-black text-white uppercase">{p.name}</p>
                                        <p className="text-[10px] font-bold text-slate-500">{p.count} Entradas</p>
                                    </div>
                                </div>
                                <span className="text-xs font-black text-cyan-400">${formatCurrency(p.revenue)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminStats;
