import React, { useState, useMemo, useEffect } from 'react';
import { AppState, SystemConfig, InventoryItem, User, TicketItem } from '../types';
import AdminStats from '../src/features/admin/AdminStats';
import AdminValidation from '../src/features/admin/AdminValidation';
import AdminInventory from '../src/features/admin/AdminInventory';
import AdminCRM from '../src/features/admin/AdminCRM';
import AdminChat from '../src/features/admin/AdminChat';
import AdminConfig from '../src/features/admin/AdminConfig';

interface AdminPanelProps {
    state: AppState;
    onLogout: () => void;
    onUpdateConfig: (config: SystemConfig) => void;
    onUpdateInventory: (inv: InventoryItem[]) => void;
    onUpdateUserManual: (email: string, data: Partial<User>) => void;
    onAction: (gid: string, tid: string | null, act: string, val?: number) => void;
    onSendMessage: (cEmail: string, sEmail: string, txt: string) => void;
    onAddUser: (data: User) => void;
    onDeleteUser: (email: string) => void;
    onResetPin: (email: string, pin: string) => void;
    onGrantCourtesy: (email: string) => void;
    onDeleteInventoryItem: (correlativeId: number) => void;
    onImpersonate?: (user: User) => void;
}

const AdminPanel: React.FC<AdminPanelProps> = (props) => {
    const { state, onLogout, onUpdateConfig, onUpdateInventory, onUpdateUserManual, onAction, onSendMessage, onAddUser, onDeleteUser, onDeleteInventoryItem, onGrantCourtesy, onResetPin, onImpersonate } = props;

    const [tab, setTab] = useState<'home' | 'validation' | 'crm' | 'chat' | 'inventory' | 'stock_fusion' | 'logs' | 'config'>('home');
    const [dashboardEventFilter, setDashboardEventFilter] = useState<string>(state.config.event_internal_id);

    // Shared State for Validation
    const [validationSearch, setValidationSearch] = useState('');

    // Shared State for Chat (accessed from CRM)
    const [selectedChatEmail, setSelectedChatEmail] = useState<string | null>(null);

    const currentEventId = state.config.event_internal_id;
    const activePurchaseGroups = state.purchaseGroups.filter(g => g.event_id === currentEventId);

    // Stats Logic
    const stats = useMemo(() => {
        const targetEventGroups = state.purchaseGroups.filter(g => g.event_id === dashboardEventFilter);
        const targetEventInv = state.inventory.filter(inv => inv.event_id === dashboardEventFilter);
        const allItems = targetEventGroups.flatMap(g => g.items);

        const paidTickets = allItems.filter(i => i.status === 'paid');
        const pendingApproval = allItems.filter(i => i.status === 'waiting_approval');

        const totalRevenue = paidTickets.reduce((acc, i) => acc + i.paid_amount, 0);
        const totalCostSold = targetEventInv.filter(i => i.is_assigned).reduce((acc, i) => acc + i.cost, 0);

        const stockTotal = targetEventInv.length;
        const stockSold = targetEventInv.filter(i => i.is_assigned).length;

        const stockPending = allItems.filter(i => i.status === 'waiting_approval' && !i.is_courtesy).length;
        const stockFree = stockTotal - stockSold;

        const activeClientsForEvent = new Set(
            targetEventGroups
                .filter(g => state.users.find(u => u.email === g.user_email)?.role !== 'admin')
                .map(g => g.user_email)
        ).size;
        const totalUsers = state.users.filter(u => u.role !== 'admin').length;

        const promoterRanking = state.users
            .filter(u => u.is_promoter)
            .map(u => {
                const sales = state.purchaseGroups.filter(g => g.seller_email === u.email).flatMap(g => g.items).filter(i => i.status === 'paid' && !i.is_courtesy);
                return { name: u.full_name, count: sales.length, revenue: sales.reduce((a, b) => a + b.paid_amount, 0) };
            })
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        const clientRanking = state.users
            .map(u => {
                const purchases = state.purchaseGroups.filter(g => g.user_email === u.email).flatMap(g => g.items).filter(i => i.status === 'paid' && !i.is_courtesy);
                return { name: u.full_name, count: purchases.length, revenue: purchases.reduce((a, b) => a + b.paid_amount, 0) };
            })
            .filter(c => c.count > 0)
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        return {
            revenue: totalRevenue,
            invInvestment: targetEventInv.reduce((acc, i) => acc + i.cost, 0),
            utility: totalRevenue - totalCostSold,
            stockTotal,
            stockFree,
            stockSold,
            stockPending,
            pendingCount: pendingApproval.length,
            activeClients: activeClientsForEvent,
            totalUsers,
            promoterRanking,
            clientRanking
        };
    }, [state, dashboardEventFilter]);

    // Validation Logic
    const validationData = useMemo(() => {
        const pending: { user: User; seller?: User; items: { gid: string; item: TicketItem }[] }[] = [];
        const approved: { user: User; seller?: User; items: { gid: string; item: TicketItem }[] }[] = [];

        // Helper objects for grouping
        const pendingMap: Record<string, { user: User; seller?: User; items: { gid: string; item: TicketItem }[] }> = {};
        const approvedMap: Record<string, { user: User; seller?: User; items: { gid: string; item: TicketItem }[] }> = {};

        const searchTerm = validationSearch.toLowerCase();

        activePurchaseGroups.forEach(g => {
            const items = g.items;
            const u = state.users.find(u => u.email === g.user_email);
            const seller = state.users.find(u => u.email === g.seller_email);
            if (!u) return;

            const matchesSearch = u.full_name.toLowerCase().includes(searchTerm) || items.some(it => it.id.toLowerCase().includes(searchTerm));
            if (!matchesSearch && validationSearch) return;

            items.forEach(item => {
                if (item.status === 'waiting_approval' || (item.paid_amount > 0 && item.paid_amount < item.price)) {
                    if (!pendingMap[g.user_email]) pendingMap[g.user_email] = { user: u, seller, items: [] };
                    pendingMap[g.user_email].items.push({ gid: g.id, item });
                } else if (item.status === 'paid') {
                    if (!approvedMap[g.user_email]) approvedMap[g.user_email] = { user: u, seller, items: [] };
                    approvedMap[g.user_email].items.push({ gid: g.id, item });
                }
            });
        });

        return {
            pending: Object.values(pendingMap),
            approved: Object.values(approvedMap).reverse()
        };
    }, [activePurchaseGroups, state.users, validationSearch]);

    return (
        <div className="min-h-screen bg-[#0a0a0f] text-slate-200 font-['Inter'] selection:bg-cyan-500/30">
            {/* Background Effects */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-cyan-500/5 blur-[120px] rounded-full"></div>
                <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-500/5 blur-[120px] rounded-full"></div>
            </div>

            {/* Header */}
            <header className="sticky top-0 z-40 bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/5 px-4 h-16 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
                        <i className="fas fa-shield-halved text-white text-lg"></i>
                    </div>
                    <div>
                        <h1 className="text-sm font-black text-white uppercase tracking-tighter leading-none">Nexus <span className="text-cyan-400">Admin</span></h1>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Control de Gestión v2.5</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button onClick={onLogout} className="w-10 h-10 rounded-xl bg-white/5 hover:bg-red-500/10 hover:text-red-400 border border-white/5 transition-all text-slate-400 flex items-center justify-center">
                        <i className="fas fa-power-off"></i>
                    </button>
                    <div className="hidden sm:flex flex-col items-end mr-2">
                        <span className="text-[10px] font-black text-white uppercase">{state.currentUser?.full_name}</span>
                        <span className="text-[9px] font-bold text-cyan-500 uppercase">Administrador</span>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto p-4 pb-32">
                {tab === 'home' && <AdminStats stats={stats} />}
                {tab === 'validation' && <AdminValidation validationData={validationData} validationSearch={validationSearch} setValidationSearch={setValidationSearch} onAction={onAction} />}
                {(tab === 'stock_fusion' || tab === 'inventory') && <AdminInventory state={state} currentEventId={currentEventId} onUpdateInventory={onUpdateInventory} onAction={onAction} onDeleteInventoryItem={onDeleteInventoryItem} />}
                {tab === 'crm' && (
                    <AdminCRM
                        state={state}
                        onUpdateUserManual={onUpdateUserManual}
                        onAddUser={onAddUser}
                        onDeleteUser={onDeleteUser}
                        onResetPin={onResetPin}
                        openUserChat={(email) => { setSelectedChatEmail(email); setTab('chat'); }}
                        setHistoryUser={(u) => console.log("History not implemented yet for user:", u.email)}
                    />
                )}
                {tab === 'chat' && <AdminChat state={state} selectedChatEmail={selectedChatEmail} setSelectedChatEmail={setSelectedChatEmail} onSendMessage={onSendMessage} />}
                {tab === 'config' && <AdminConfig config={state.config} onUpdateConfig={onUpdateConfig} />}
            </main>

            {/* Navigation Dock */}
            <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#0a0a0f]/80 backdrop-blur-2xl border border-white/10 rounded-3xl p-2 flex items-center gap-1 shadow-2xl shadow-black">
                {[
                    { id: 'home', icon: 'fa-chart-pie', label: 'In' },
                    { id: 'validation', icon: 'fa-check-circle', label: 'Val' },
                    { id: 'stock_fusion', icon: 'fa-ticket-alt', label: 'Stk' },
                    { id: 'crm', icon: 'fa-users', label: 'CRM' },
                    { id: 'chat', icon: 'fa-comment-dots', label: 'Chat' },
                    { id: 'config', icon: 'fa-sliders-h', label: 'Cfg' }
                ].map(item => (
                    <button
                        key={item.id}
                        onClick={() => setTab(item.id as any)}
                        className={`flex flex-col items-center justify-center w-12 h-12 rounded-2xl transition-all ${tab === item.id ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30 -translate-y-1' : 'text-slate-500 hover:bg-white/5'}`}
                    >
                        <i className={`fas ${item.icon} text-base`}></i>
                        <span className="text-[7px] font-black uppercase mt-0.5">{item.label}</span>
                    </button>
                ))}
            </nav>
        </div>
    );
};

export default AdminPanel;