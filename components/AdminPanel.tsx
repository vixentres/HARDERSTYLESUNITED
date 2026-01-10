import React, { useState, useMemo, useEffect } from 'react';
import { AppState, SystemConfig, InventoryItem, User, LogType, Role, TicketItem, PurchaseGroup } from '../types';
import { extractUrl, formatCurrency, formatPhoneNumber } from '../logic';

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
}

const AdminPanel: React.FC<AdminPanelProps> = (props) => {
    const { state, onLogout, onUpdateConfig, onUpdateInventory, onUpdateUserManual, onAction, onSendMessage, onAddUser, onDeleteUser, onDeleteInventoryItem, onGrantCourtesy } = props;

    const [tab, setTab] = useState<'home' | 'validation' | 'crm' | 'chat' | 'inventory' | 'stock_fusion' | 'logs' | 'config'>('home');

    // Search & Filter States
    const [crmSearch, setCrmSearch] = useState('');
    const [validationSearch, setValidationSearch] = useState('');
    const [chatSearch, setChatSearch] = useState('');
    const [logSearch, setLogSearch] = useState('');
    const [invSearch, setInvSearch] = useState('');
    const [invTab, setInvTab] = useState<'all' | 'free' | 'assigned'>('all');

    const [crmFilter, setCrmFilter] = useState<Role | 'ALL' | 'ACTIVE'>('ALL');
    const [logFilter, setLogFilter] = useState<LogType | 'ALL'>('ALL');
    const [invSortOrder, setInvSortOrder] = useState<'asc' | 'desc'>('asc');

    const [configForm, setConfigForm] = useState<SystemConfig>(state.config);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [isAddingUser, setIsAddingUser] = useState(false);
    const [editingInvItem, setEditingInvItem] = useState<{ idx: number, data: InventoryItem } | null>(null);

    useEffect(() => { setConfigForm(state.config); }, [state.config]);

    const [dashboardEventFilter, setDashboardEventFilter] = useState<string>(state.config.event_internal_id);
    const [inventoryInput, setInventoryInput] = useState('');
    const [batchCost, setBatchCost] = useState<number>(0);
    const [stockFusionTab, setStockFusionTab] = useState<'upload' | 'management'>('management');
    const [costMode, setCostMode] = useState<'total' | 'unit'>('total');
    const [expandApprovals, setExpandApprovals] = useState(false);
    const [ticketToAssign, setTicketToAssign] = useState<TicketItem | null>(null);

    const [selectedChatEmail, setSelectedChatEmail] = useState<string | null>(null);
    const [adminMsg, setAdminMsg] = useState('');
    const [historyUser, setHistoryUser] = useState<User | null>(null);
    const [newUserForm, setNewUserForm] = useState<Partial<User>>({ full_name: '', email: '', instagram: '', phone_number: '', pin: '', role: 'client' });

    const currentChat = useMemo(() =>
        state.conversations.find(c => c.client_email === selectedChatEmail),
        [state.conversations, selectedChatEmail]
    );

    const handleSendAdminMessage = () => {
        if (selectedChatEmail && adminMsg.trim()) {
            onSendMessage(selectedChatEmail, state.currentUser?.email || 'admin', adminMsg);
            setAdminMsg('');
        }
    };

    const currentEventId = state.config.event_internal_id;
    const activePurchaseGroups = state.purchaseGroups.filter(g => g.event_id === currentEventId);

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

    const availableStock = useMemo(() => state.inventory.filter(i => !i.is_assigned && i.event_id === currentEventId), [state.inventory, currentEventId]);

    const ticketsInWait = useMemo(() => {
        return state.purchaseGroups
            .filter(g => g.event_id === currentEventId)
            .flatMap(g => g.items.map(it => ({ ...it, user: state.users.find(u => u.email === g.user_email) })))
            .filter(it => (it.status === 'paid' || it.status === 'reserved') && !it.assigned_link && !it.is_courtesy);
    }, [state, currentEventId]);

    const pendingApprovals = useMemo(() => {
        return state.purchaseGroups
            .filter(g => g.event_id === currentEventId)
            .flatMap(g => (g.items || []).map(it => ({
                ...it,
                gid: g.id,
                user_email: g.user_email,
                seller_email: g.seller_email,
                user: state.users.find(u => u.email === g.user_email),
                seller: state.users.find(u => u.email === g.seller_email)
            })))
            .filter(it => it.status === 'waiting_approval');
    }, [state, currentEventId]);

    const validationData = useMemo(() => {
        const pending: Record<string, { user: User; seller?: User; items: { gid: string; item: TicketItem }[] }> = {};
        const approved: Record<string, { user: User; seller?: User; items: { gid: string; item: TicketItem }[] }> = {};
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
                    if (!pending[g.user_email]) pending[g.user_email] = { user: u, seller, items: [] };
                    pending[g.user_email].items.push({ gid: g.id, item });
                } else if (item.status === 'paid') {
                    if (!approved[g.user_email]) approved[g.user_email] = { user: u, seller, items: [] };
                    approved[g.user_email].items.push({ gid: g.id, item });
                }
            });
        });

        return {
            pending: Object.values(pending),
            approved: Object.values(approved).reverse()
        };
    }, [activePurchaseGroups, state.users, validationSearch]);

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

    const getUserTickets = (email: string) => state.purchaseGroups.filter(g => g.user_email === email && g.event_id === currentEventId).flatMap(g => g.items);

    const handleEditUserSave = () => {
        if (!editingUser) return;
        const cleanIG = editingUser.instagram.replace('@', '');
        let cleanPhone = editingUser.phone_number || '';
        if (/^\d+$/.test(cleanPhone)) {
            if (!cleanPhone.startsWith('569')) cleanPhone = '569' + cleanPhone;
        }
        onUpdateUserManual(editingUser.email, { ...editingUser, instagram: cleanIG, phone_number: cleanPhone });
        setEditingUser(null);
    };

    const openUserChat = (email: string) => {
        setSelectedChatEmail(email);
        setTab('chat');
    };

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

    const filteredUsers = useMemo(() => {
        return state.users.filter(u => {
            if (crmFilter === 'client' && u.role !== 'client') return false;
            if (crmFilter === 'admin' && u.role !== 'admin') return false;
            if (crmFilter === 'ACTIVE') {
                const hasTickets = state.purchaseGroups.some(g => g.user_email === u.email && g.event_id === currentEventId && g.items.length > 0);
                if (!hasTickets) return false;
            }
            const search = crmSearch.toLowerCase();
            const cleanIG = (u.instagram || '').replace('@', '').toLowerCase();
            return (
                u.full_name.toLowerCase().includes(search) ||
                u.email.toLowerCase().includes(search) ||
                cleanIG.includes(search) ||
                (u.phone_number || '').includes(search)
            );
        });
    }, [state.users, state.purchaseGroups, currentEventId, crmFilter, crmSearch]);

    // CHUNK_MARKER_2
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
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                        <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(state.currentUser?.full_name || 'A')}&background=06b6d4&color=fff&bold=true`} className="w-8 h-8 rounded-lg" alt="Avatar" />
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto p-4 pb-32">
                {tab === 'home' && (
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
                )}

                {tab === 'validation' && (
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
                )}

                {tab === 'stock_fusion' && (
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
                    </div>
                )}

                {tab === 'crm' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex flex-col md:flex-row gap-3">
                            <div className="flex-1 bg-white/5 border border-white/5 rounded-2xl p-2 flex items-center gap-2">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500">
                                    <i className="fas fa-search text-xs"></i>
                                </div>
                                <input
                                    type="text"
                                    placeholder="Buscar por nombre, correo, IG o teléfono..."
                                    className="bg-transparent border-none outline-none text-sm font-bold text-white placeholder:text-slate-700 flex-1"
                                    value={crmSearch}
                                    onChange={(e) => setCrmSearch(e.target.value)}
                                />
                            </div>
                            <button
                                onClick={() => setIsAddingUser(true)}
                                className="px-5 py-3 bg-cyan-500 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-cyan-500/20 hover:scale-[1.02] active:scale-95 transition-all"
                            >
                                <i className="fas fa-user-plus mr-2"></i> Nuevo Usuario
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredUsers.map((u, idx) => (
                                <div key={idx} className="bg-white/5 border border-white/5 rounded-3xl p-5 hover:border-white/10 transition-all group">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-lg font-black text-cyan-500">
                                                {u.full_name.charAt(0)}
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-black text-white uppercase">{u.full_name}</h4>
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${u.role === 'admin' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-cyan-500/10 text-cyan-500 border border-cyan-500/20'}`}>
                                                        {u.role}
                                                    </span>
                                                    {u.is_promoter && <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 text-[8px] font-black border border-purple-500/20 uppercase">Promotor</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <button onClick={() => setEditingUser(u)} className="w-8 h-8 rounded-lg bg-white/5 text-slate-500 hover:text-white transition-all">
                                            <i className="fas fa-cog"></i>
                                        </button>
                                    </div>

                                    <div className="space-y-2 mb-5">
                                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                                            <i className="fas fa-envelope w-4"></i> {u.email}
                                        </div>
                                        {u.instagram && (
                                            <div className="flex items-center gap-2 text-[10px] font-bold text-cyan-500/80">
                                                <i className="fab fa-instagram w-4"></i> @{u.instagram}
                                            </div>
                                        )}
                                        {u.phone_number && (
                                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                                                <i className="fas fa-phone w-4"></i> {u.phone_number}
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => openUserChat(u.email)}
                                            className="py-2.5 rounded-xl bg-white/5 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:bg-white/10 hover:text-white transition-all"
                                        >
                                            <i className="fas fa-comment-alt mr-2"></i> Chat
                                        </button>
                                        <button
                                            onClick={() => setHistoryUser(u)}
                                            className="py-2.5 rounded-xl bg-white/5 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:bg-white/10 hover:text-white transition-all"
                                        >
                                            <i className="fas fa-history mr-2"></i> Historial
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {tab === 'chat' && (
                    <div className="grid lg:grid-cols-3 gap-6 h-[calc(100vh-200px)] animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Sidebar Chat */}
                        <div className="hidden lg:flex flex-col bg-white/5 border border-white/5 rounded-3xl overflow-hidden">
                            <div className="p-4 border-b border-white/5">
                                <input
                                    type="text"
                                    placeholder="Filtrar conversaciones..."
                                    className="w-full bg-[#11111a] border border-white/5 rounded-xl px-4 py-2 text-[10px] font-bold text-white outline-none"
                                    value={chatSearch}
                                    onChange={(e) => setChatSearch(e.target.value)}
                                />
                            </div>
                            <div className="flex-1 overflow-y-auto divide-y divide-white/5">
                                {state.conversations
                                    .filter(c => c.client_email.toLowerCase().includes(chatSearch.toLowerCase()))
                                    .map((conv, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => setSelectedChatEmail(conv.client_email)}
                                            className={`w-full p-4 text-left hover:bg-white/5 transition-all ${selectedChatEmail === conv.client_email ? 'bg-cyan-500/10 border-l-4 border-cyan-500' : ''}`}
                                        >
                                            <p className="text-[10px] font-black text-white uppercase mb-1">{conv.client_email}</p>
                                            <p className="text-[9px] font-bold text-slate-500 truncate">{conv.messages[conv.messages.length - 1]?.text || 'Sin mensajes'}</p>
                                        </button>
                                    ))}
                            </div>
                        </div>

                        {/* Chat Box */}
                        <div className="lg:col-span-2 flex flex-col bg-white/5 border border-white/5 rounded-3xl overflow-hidden relative">
                            {selectedChatEmail ? (
                                <>
                                    <div className="p-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center text-xs font-black text-cyan-400">
                                                {selectedChatEmail.charAt(0).toUpperCase()}
                                            </div>
                                            <span className="text-[10px] font-black text-white uppercase tracking-widest">{selectedChatEmail}</span>
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0a0a0f]/40">
                                        {currentChat?.messages.map((m, i) => (
                                            <div key={i} className={`flex ${m.role === 'admin' ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[80%] p-3 rounded-2xl text-xs font-bold leading-relaxed ${m.role === 'admin' ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/10' : 'bg-white/10 text-slate-200'}`}>
                                                    {m.text}
                                                    <span className="block text-[8px] opacity-50 mt-1 uppercase mt-1 italic">
                                                        {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="p-4 bg-white/[0.02] border-t border-white/5 flex gap-2">
                                        <input
                                            type="text"
                                            className="flex-1 bg-[#11111a] border border-white/5 rounded-2xl px-4 py-3 text-[10px] font-bold text-white outline-none focus:border-cyan-500/50 transition-all"
                                            placeholder="Escribe un mensaje..."
                                            value={adminMsg}
                                            onChange={(e) => setAdminMsg(e.target.value)}
                                            onKeyPress={(e) => e.key === 'Enter' && handleSendAdminMessage()}
                                        />
                                        <button onClick={handleSendAdminMessage} className="w-12 h-12 rounded-2xl bg-cyan-500 text-white flex items-center justify-center shadow-lg shadow-cyan-500/20 hover:scale-105 active:scale-95 transition-all">
                                            <i className="fas fa-paper-plane text-xs"></i>
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-slate-600 p-8 text-center">
                                    <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mb-4 border border-white/5 text-3xl">
                                        <i className="far fa-comments"></i>
                                    </div>
                                    <p className="text-[10px] font-black uppercase tracking-widest">Selecciona una conversación</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {tab === 'config' && (
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
                                <button
                                    onClick={() => { onUpdateConfig(configForm); alert("Configuración actualizada."); }}
                                    className="w-full py-4 bg-white/10 hover:bg-white text-slate-400 hover:text-black text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all"
                                >
                                    Guardar Cambios
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* Navigation Dock (Refined) */}
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

            {/* Modals */}
            {editingUser && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-[#11111a] border border-white/10 rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl">
                        <div className="p-6 border-b border-white/5 flex items-center justify-between">
                            <h3 className="text-xs font-black text-white uppercase tracking-widest">Editar Usuario</h3>
                            <button onClick={() => setEditingUser(null)} className="text-slate-500 hover:text-white transition-all"><i className="fas fa-times"></i></button>
                        </div>
                        <div className="p-6 grid gap-4">
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">Nombre Completo</label>
                                <input type="text" className="w-full bg-white/5 border border-white/5 rounded-2xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-cyan-500/30" value={editingUser.full_name} onChange={(e) => setEditingUser({ ...editingUser, full_name: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">Role</label>
                                    <select className="w-full bg-white/5 border border-white/5 rounded-2xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-cyan-500/30" value={editingUser.role} onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as any })}>
                                        <option value="client" className="bg-[#11111a]">Cliente</option>
                                        <option value="admin" className="bg-[#11111a]">Admin</option>
                                        <option value="staff" className="bg-[#11111a]">Staff</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">PIN</label>
                                    <input type="text" className="w-full bg-white/5 border border-white/5 rounded-2xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-cyan-500/30" value={editingUser.pin} onChange={(e) => setEditingUser({ ...editingUser, pin: e.target.value })} />
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-4 bg-white/5 border border-white/5 rounded-2xl mt-2">
                                <input type="checkbox" className="w-5 h-5 rounded-lg border-white/10 bg-white/5 text-cyan-500" checked={editingUser.is_promoter} onChange={(e) => setEditingUser({ ...editingUser, is_promoter: e.target.checked })} />
                                <span className="text-[10px] font-black text-white uppercase tracking-widest">Habilitar como Promotor</span>
                            </div>
                            <button onClick={handleEditUserSave} className="w-full py-4 bg-cyan-500 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-cyan-500/20 mt-4 h-14">Guardar Cambios</button>
                        </div>
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

export default AdminPanel;