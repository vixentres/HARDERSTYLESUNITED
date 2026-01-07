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
    // ... (existing state)
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

    const [dashboardEventFilter, setDashboardEventFilter] = useState<string>(state.config.eventInternalId);
    const [inventoryInput, setInventoryInput] = useState('');
    const [batchCost, setBatchCost] = useState<number>(0);
    const [stockFusionTab, setStockFusionTab] = useState<'upload' | 'management'>('management');
    const [costMode, setCostMode] = useState<'total' | 'unit'>('total');
    const [expandApprovals, setExpandApprovals] = useState(false);
    const [ticketToAssign, setTicketToAssign] = useState<{ gid: string, tid: string } | null>(null);
    const [validationAssignedStock, setValidationAssignedStock] = useState<Record<string, string>>({}); // tid -> correlativeId (as string for select)

    const [selectedChatEmail, setSelectedChatEmail] = useState<string | null>(null);
    const [adminMsg, setAdminMsg] = useState('');
    const [historyUser, setHistoryUser] = useState<User | null>(null);
    const [newUserForm, setNewUserForm] = useState<Partial<User>>({ fullName: '', email: '', instagram: '', phoneNumber: '', pin: '', role: 'client' });

    const currentChat = useMemo(() =>
        state.conversations.find(c => c.clientEmail === selectedChatEmail),
        [state.conversations, selectedChatEmail]
    );

    const handleSendAdminMessage = () => {
        if (selectedChatEmail && adminMsg.trim()) {
            onSendMessage(selectedChatEmail, state.currentUser?.email || 'admin', adminMsg);
            setAdminMsg('');
        }
    };

    const currentEventId = state.config.eventInternalId;
    const activePurchaseGroups = state.purchaseGroups.filter(g => g.eventId === currentEventId);

    const stats = useMemo(() => {
        const targetEventGroups = state.purchaseGroups.filter(g => g.eventId === dashboardEventFilter);
        const targetEventInv = state.inventory.filter(inv => inv.eventId === dashboardEventFilter);
        const allItems = targetEventGroups.flatMap(g => g.items);

        const paidTickets = allItems.filter(i => i.status === 'paid');
        const pendingApproval = allItems.filter(i => i.status === 'waiting_approval');

        const totalRevenue = paidTickets.reduce((acc, i) => acc + i.paidAmount, 0);
        const totalCostSold = targetEventInv.filter(i => i.isAssigned).reduce((acc, i) => acc + i.cost, 0);

        const stockTotal = targetEventInv.length;
        const stockSold = targetEventInv.filter(i => i.isAssigned).length;

        // Stock pending: Tickets waiting for approval
        const stockPending = allItems.filter(i => i.status === 'waiting_approval' && !i.isCourtesy).length;
        const stockFree = stockTotal - stockSold;

        const activeClientsForEvent = new Set(
            targetEventGroups
                .filter(g => state.users.find(u => u.email === g.userEmail)?.role !== 'admin')
                .map(g => g.userEmail)
        ).size;
        const totalUsers = state.users.filter(u => u.role !== 'admin').length;

        // Rankings
        const promoterRanking = state.users
            .filter(u => u.isPromoter)
            .map(u => {
                const sales = state.purchaseGroups.filter(g => g.sellerEmail === u.email).flatMap(g => g.items).filter(i => i.status === 'paid' && !i.isCourtesy);
                return { name: u.fullName, count: sales.length, revenue: sales.reduce((a, b) => a + b.paidAmount, 0) };
            })
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        const clientRanking = state.users
            .map(u => {
                const purchases = state.purchaseGroups.filter(g => g.userEmail === u.email).flatMap(g => g.items).filter(i => i.status === 'paid' && !i.isCourtesy);
                return { name: u.fullName, count: purchases.length, revenue: purchases.reduce((a, b) => a + b.paidAmount, 0) };
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
            stockPending, // Added
            pendingCount: pendingApproval.length,
            activeClients: activeClientsForEvent,
            totalUsers,
            promoterRanking,
            clientRanking
        };
    }, [state, dashboardEventFilter]);

    const availableStock = useMemo(() => state.inventory.filter(i => !i.isAssigned && i.eventId === currentEventId), [state.inventory, currentEventId]);

    const ticketsInWait = useMemo(() => {
        return state.purchaseGroups
            .filter(g => g.eventId === currentEventId)
            .flatMap(g => g.items.map(it => ({ ...it, user: state.users.find(u => u.email === g.userEmail) })))
            .filter(it => (it.status === 'paid' || it.status === 'reserved') && !it.assignedLink && !it.isCourtesy);
    }, [state, currentEventId]);

    const pendingApprovals = useMemo(() => {
        return state.purchaseGroups
            .filter(g => g.eventId === currentEventId)
            .flatMap(g => (g.items || []).map(it => ({
                ...it,
                gid: g.id,
                userEmail: g.userEmail,
                sellerEmail: g.sellerEmail,
                user: state.users.find(u => u.email === g.userEmail),
                seller: state.users.find(u => u.email === g.sellerEmail)
            })))
            .filter(it => it.status === 'waiting_approval');
    }, [state, currentEventId]);

    const validationData = useMemo(() => {
        const pending: Record<string, { user: User; seller?: User; items: { gid: string; item: TicketItem }[] }> = {};
        const approved: Record<string, { user: User; seller?: User; items: { gid: string; item: TicketItem }[] }> = {};

        const searchTerm = validationSearch.toLowerCase();

        activePurchaseGroups.forEach(g => {
            const items = g.items;
            const u = state.users.find(u => u.email === g.userEmail);
            const seller = state.users.find(u => u.email === g.sellerEmail);
            if (!u) return;

            const matchesSearch = u.fullName.toLowerCase().includes(searchTerm) || items.some(it => it.id.toLowerCase().includes(searchTerm));
            if (!matchesSearch && validationSearch) return;

            items.forEach(item => {
                if (item.status === 'waiting_approval' || (item.paidAmount > 0 && item.paidAmount < item.price)) {
                    if (!pending[g.userEmail]) pending[g.userEmail] = { user: u, seller, items: [] };
                    pending[g.userEmail].items.push({ gid: g.id, item });
                } else if (item.status === 'paid') {
                    if (!approved[g.userEmail]) approved[g.userEmail] = { user: u, seller, items: [] };
                    approved[g.userEmail].items.push({ gid: g.id, item });
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

        const currentBatches = state.inventory.filter(i => i.eventId === currentEventId).map(i => i.batchNumber || 0);
        const nextBatch = currentBatches.length > 0 ? Math.max(...currentBatches) + 1 : 1;

        const validItems: InventoryItem[] = [];
        let currentCorrelativeCount = state.inventory.filter(i => i.eventId === state.config.eventInternalId).length;

        rawLines.forEach(line => {
            currentCorrelativeCount++;
            validItems.push({
                name: line.trim(),
                link: '',
                cost: 0,
                isAssigned: false,
                eventName: state.config.eventTitle,
                eventId: state.config.eventInternalId,
                batchNumber: nextBatch,
                uploadDate: Date.now(),
                originalText: line.trim(),
                isPendingLink: true,
                correlativeId: currentCorrelativeCount
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

        // Duplicate URL Validation
        if (editingInvItem.data.link) {
            const isDuplicate = state.inventory.some((inv, i) =>
                inv.link === editingInvItem.data.link &&
                inv.eventId === currentEventId &&
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
                inv.eventId === currentEventId &&
                i !== actualIdx
            );
            if (isDuplicate) {
                alert("⚠️ Error: Esta URL ya existe en el inventario para este evento. Evita duplicados.");
                return;
            }
        }

        const nextInv = [...state.inventory];
        nextInv[actualIdx] = { ...nextInv[actualIdx], link: newLink, isPendingLink: false };
        onUpdateInventory(nextInv);
    };

    const getUserTickets = (email: string) => state.purchaseGroups.filter(g => g.userEmail === email && g.eventId === currentEventId).flatMap(g => g.items);

    const getPromoterStats = (email: string) => {
        const sales = state.purchaseGroups.filter(g => g.sellerEmail === email).flatMap(g => g.items).filter(i => i.status === 'paid');
        return { count: sales.length, revenue: sales.reduce((a, b) => a + b.paidAmount, 0) };
    };

    const handleEditUserSave = () => {
        if (!editingUser) return;
        const cleanIG = editingUser.instagram.replace('@', '');
        let cleanPhone = editingUser.phoneNumber || '';
        if (/^\d+$/.test(cleanPhone)) {
            if (!cleanPhone.startsWith('569')) cleanPhone = '569' + cleanPhone;
        }
        onUpdateUserManual(editingUser.email, { ...editingUser, instagram: cleanIG, phoneNumber: cleanPhone });
        setEditingUser(null);
    };

    const openUserChat = (email: string) => {
        setSelectedChatEmail(email);
        setTab('chat');
    };

    // Inventory Filtering
    const filteredInventory = useMemo(() => {
        let items = state.inventory
            .filter(i => i.eventId === currentEventId)
            .filter(i => {
                if (invTab === 'free') return !i.isAssigned;
                if (invTab === 'assigned') return i.isAssigned;
                return true;
            })
            .filter(i =>
                i.link.toLowerCase().includes(invSearch.toLowerCase()) ||
                (i.originalText || '').toLowerCase().includes(invSearch.toLowerCase()) ||
                (i.name || '').toLowerCase().includes(invSearch.toLowerCase())
            );

        return items.sort((a, b) => {
            const idA = a.correlativeId || 0;
            const idB = b.correlativeId || 0;
            return invSortOrder === 'asc' ? idA - idB : idB - idA;
        });
    }, [state.inventory, currentEventId, invTab, invSearch, invSortOrder]);

    // Expanded User Searching
    const filteredUsers = useMemo(() => {
        return state.users.filter(u => {
            if (crmFilter === 'client' && u.role !== 'client') return false;
            if (crmFilter === 'admin' && u.role !== 'admin') return false;
            if (crmFilter === 'ACTIVE') {
                const hasTickets = state.purchaseGroups.some(g => g.userEmail === u.email && g.eventId === currentEventId && g.items.length > 0);
                if (!hasTickets) return false;
            }
            const search = crmSearch.toLowerCase();
            const cleanIG = (u.instagram || '').replace('@', '').toLowerCase();
            return (
                u.fullName.toLowerCase().includes(search) ||
                u.email.toLowerCase().includes(search) ||
                cleanIG.includes(search) ||
                (u.phoneNumber || '').includes(search)
            );
        });
    }, [state.users, state.purchaseGroups, currentEventId, crmFilter, crmSearch]);

    return (
        <div className="flex flex-col min-h-screen text-slate-100 font-sans pb-32">
            <main className="flex-1 p-6 md:p-10 overflow-y-auto max-w-7xl mx-auto w-full">
                <header className="mb-12 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-6">
                    <div className="animate-enter">
                        <h1 className="text-4xl md:text-6xl font-syncopate font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">
                            {tab === 'home' ? 'PANEL' : tab.toUpperCase()} <span className="text-cyan-400 text-2xl align-top">V3.0</span>
                        </h1>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.5em] mt-2">CENTRO DE MANDO // {currentEventId}</p>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3 bg-black/40 px-4 py-2 rounded-2xl border border-white/5">
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Filtro:</span>
                            <select
                                className="bg-transparent border-none outline-none text-[10px] font-black text-cyan-400 uppercase cursor-pointer"
                                value={dashboardEventFilter}
                                onChange={e => setDashboardEventFilter(e.target.value)}
                            >
                                <option value={state.config.eventInternalId}>{state.config.eventTitle} (Actual)</option>
                                {Array.from(new Set(state.inventory.map(i => i.eventId))).filter(id => id !== state.config.eventInternalId).map(id => (
                                    <option key={id} value={id}>{id}</option>
                                ))}
                            </select>
                        </div>
                        {tab === 'crm' && (
                            <button onClick={() => setIsAddingUser(true)} className="neon-button px-6 py-3 rounded-xl bg-cyan-600 text-white font-black uppercase text-[10px] tracking-widest shadow-lg">
                                <i className="fas fa-plus mr-2"></i> Nuevo Usuario
                            </button>
                        )}
                    </div>
                </header>

                {tab === 'home' && (
                    <div className="space-y-8 animate-enter">
                        {/* Removed duplicate filter from here */}

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div className="glass-panel p-8 rounded-3xl border-l-4 border-l-blue-500 hover:bg-white/5 transition-colors">
                                <p className="text-[9px] font-bold text-slate-400 uppercase mb-4 tracking-widest">Inversión Stock</p>
                                <p className="text-4xl font-mono font-bold text-blue-400 drop-shadow-[0_0_10px_rgba(96,165,250,0.5)]">${stats.invInvestment.toLocaleString()}</p>
                            </div>
                            <div className="glass-panel p-8 rounded-3xl border-l-4 border-l-cyan-500 hover:bg-white/5 transition-colors">
                                <p className="text-[9px] font-bold text-slate-400 uppercase mb-4 tracking-widest">Recaudación Total</p>
                                <p className="text-4xl font-mono font-bold text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]">${stats.revenue.toLocaleString()}</p>
                            </div>
                            <div className="glass-panel p-8 rounded-3xl border-l-4 border-l-emerald-500 bg-gradient-to-br from-emerald-900/10 to-transparent">
                                <p className="text-[9px] font-bold text-emerald-500 uppercase mb-4 tracking-widest">Utilidad Est.</p>
                                <p className="text-4xl font-mono font-bold text-white">${stats.utility.toLocaleString()}</p>
                            </div>

                            {/* Stock Heatmap v3 */}
                            <div className="glass-panel p-6 rounded-3xl border border-white/5 space-y-4">
                                <div className="flex justify-between items-end mb-2">
                                    <div>
                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Mapa de Disponibilidad</p>
                                        <h4 className="text-xl font-syncopate font-bold text-white tracking-tighter uppercase">Stock en Vivo</h4>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-2xl font-mono font-bold text-cyan-500">{stats.stockTotal}</p>
                                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Capacidad</p>
                                    </div>
                                </div>

                                <div className="relative h-10 bg-white/5 rounded-2xl overflow-hidden border border-white/5 shadow-inner flex p-1">
                                    {/* Segmento ASIGNADAS (Cyan) */}
                                    <div
                                        className="h-full bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.5)] transition-all duration-1000 relative rounded-l-xl"
                                        style={{ width: `${(stats.stockSold / stats.stockTotal) * 100}%` }}
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-30"></div>
                                    </div>
                                    {/* Segmento PENDIENTES (Amber) */}
                                    <div
                                        className="h-full bg-amber-500/80 shadow-[0_0_15px_rgba(245,158,11,0.3)] transition-all duration-1000 relative"
                                        style={{ width: `${(stats.stockPending / stats.stockTotal) * 100}%` }}
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent"></div>
                                    </div>
                                    {/* Segmento LIBRES (Transparente/Slate) */}
                                    <div className="flex-1 bg-transparent"></div>
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                    <div className="bg-black/40 p-3 rounded-xl border border-white/5">
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_5px_rgba(6,182,212,0.8)]"></div>
                                            <span className="text-[7px] font-black text-slate-500 uppercase">Asignadas</span>
                                        </div>
                                        <p className="text-xs font-mono font-bold text-white">{stats.stockSold}</p>
                                    </div>
                                    <div className="glass-panel p-6 rounded-3xl border border-white/5 group hover:border-cyan-500/30 transition-all">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400"><i className="fas fa-users"></i></div>
                                            <span className="text-[10px] font-bold text-slate-500 uppercase">Clientes</span>
                                        </div>
                                        <p className="text-2xl font-mono font-bold text-white mb-1">{stats.activeClients}/{stats.totalUsers}</p>
                                        <p className="text-[8px] font-black text-cyan-400 uppercase tracking-widest">Activos en Evento</p>
                                    </div>
                                    <div className="bg-black/40 p-3 rounded-xl border border-white/5">
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_5px_rgba(245,158,11,0.8)] animate-pulse"></div>
                                            <span className="text-[7px] font-black text-slate-500 uppercase">Pendientes</span>
                                        </div>
                                        <p className="text-xs font-mono font-bold text-white">{stats.stockPending}</p>
                                    </div>
                                    <div className="bg-black/40 p-3 rounded-xl border border-white/5 text-right">
                                        <div className="flex items-center justify-end gap-2 mb-1">
                                            <span className="text-[7px] font-black text-slate-500 uppercase">Libres</span>
                                            <div className="w-1.5 h-1.5 rounded-full bg-slate-700"></div>
                                        </div>
                                        <p className="text-xs font-mono font-bold text-white">{stats.stockFree}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="glass-panel p-6 rounded-3xl border border-white/5 space-y-4">
                                <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-2 border-b border-white/5 pb-2">Top Promotores</p>
                                <div className="space-y-2">
                                    {stats.promoterRanking.map((p, i) => (
                                        <div key={i} className="flex justify-between items-center text-[10px] bg-black/20 p-2 rounded-lg border border-white/5">
                                            <span className="font-bold text-white truncate max-w-[120px]">{i + 1}. {p.name}</span>
                                            <span className="font-mono text-purple-400 font-bold">{p.count} Tickets</span>
                                        </div>
                                    ))}
                                    {stats.promoterRanking.length === 0 && <p className="text-[9px] text-slate-600 italic text-center py-4 uppercase">Sin ventas registradas</p>}
                                </div>
                            </div>

                            <div className="glass-panel p-6 rounded-3xl border border-white/5 space-y-4">
                                <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-2 border-b border-white/5 pb-2">Top Clientes</p>
                                <div className="space-y-2">
                                    {stats.clientRanking.map((c, i) => (
                                        <div key={i} className="flex justify-between items-center text-[10px] bg-black/20 p-2 rounded-lg border border-white/5">
                                            <span className="font-bold text-white truncate max-w-[120px]">{i + 1}. {c.name}</span>
                                            <span className="font-mono text-cyan-400 font-bold">{c.count} Tickets</span>
                                        </div>
                                    ))}
                                    {stats.clientRanking.length === 0 && <p className="text-[9px] text-slate-600 italic text-center py-4 uppercase">Sin compras registradas</p>}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {tab === 'validation' && (
                    <div className="space-y-8 animate-enter max-w-5xl mx-auto">
                        <div className="glass-panel p-10 rounded-[2.5rem] border border-cyan-500/20 bg-cyan-500/5">
                            <h2 className="text-2xl font-syncopate font-bold text-white mb-2 uppercase tracking-tight">Centro de Historial</h2>
                            <p className="text-[10px] font-black text-cyan-400/60 uppercase tracking-[0.3em] mb-10">Consulta Informativa de Aprobaciones y Rechazos</p>

                            <div className="bg-black/40 p-5 rounded-3xl flex items-center border border-white/5 mb-12 shadow-2xl">
                                <i className="fas fa-search text-slate-600 mx-5 text-sm"></i>
                                <input
                                    className="bg-transparent border-none outline-none text-sm font-bold text-white w-full placeholder:text-slate-600"
                                    placeholder="Buscar en el registro histórico..."
                                    value={validationSearch}
                                    onChange={e => setValidationSearch(e.target.value)}
                                />
                            </div>

                            {/* PENDIENTES SECTION (INFO ONLY) */}
                            <div className="space-y-6 mb-12">
                                <h3 className="text-[10px] font-black text-amber-500 uppercase tracking-[0.4em] flex items-center gap-3 mb-6">
                                    <i className="fas fa-clock text-amber-500"></i> Pendientes de Gestión
                                </h3>
                                {validationData.pending.map((group, gIdx) => (
                                    <div key={gIdx} className="bg-white/5 p-8 rounded-[2rem] border border-white/5 hover:border-amber-500/20 transition-all group">
                                        <div className="flex justify-between items-center mb-6">
                                            <div className="flex items-center gap-5">
                                                <div className="w-12 h-12 rounded-full border border-white/10 p-0.5 bg-black/40">
                                                    <img src={`https://api.dicebear.com/7.x/identicon/svg?seed=${group.userEmail}`} className="w-full h-full rounded-full" />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black text-white uppercase tracking-widest block mb-1">
                                                        <span className="text-slate-500">Cliente:</span> {group.user?.fullName || 'Usuario Desconocido'}
                                                        {group.seller && group.seller.email !== group.user?.email && (
                                                            <> <span className="text-slate-500 mx-1">/</span> <span className="text-purple-400">Promotor:</span> {group.seller.fullName}</>
                                                        )}
                                                    </p>
                                                    <div className="flex items-center gap-3">
                                                        <p className="text-[9px] text-slate-500 font-mono italic">{group.userEmail}</p>
                                                        {group.user?.instagram && (
                                                            <div className="flex items-center gap-1 bg-pink-500/10 px-2 py-0.5 rounded text-pink-500 border border-pink-500/20">
                                                                <i className="fab fa-instagram text-[9px]"></i>
                                                                <span className="text-[9px] font-bold">@{group.user.instagram.replace('@', '')}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <span className="text-[8px] font-black text-amber-500 bg-amber-500/10 px-4 py-2 rounded-full uppercase border border-amber-500/20 tracking-widest shadow-inner">En Cola</span>
                                        </div>
                                        <div className="grid gap-3">
                                            {group.items.map((wrapper, iidx) => (
                                                <div key={iidx} className="flex justify-between items-center p-4 bg-black/30 rounded-2xl border border-white/5">
                                                    <div>
                                                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Ticket ID</p>
                                                        <p className="text-xs font-mono font-bold text-white">{wrapper.item.id}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Monto</p>
                                                        <p className="text-sm font-mono font-bold text-amber-500">${formatCurrency(wrapper.item.price)}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                                {validationData.pending.length === 0 && (
                                    <div className="p-12 text-center bg-black/20 rounded-[2rem] border border-white/5">
                                        <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest">No hay registros pendientes de búsqueda</p>
                                    </div>
                                )}
                            </div>

                            {/* APROBADOS SECTION (RECENT) */}
                            <div className="space-y-6 opacity-80">
                                <h3 className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.4em] flex items-center gap-3 mb-6">
                                    <i className="fas fa-check-circle text-emerald-500"></i> Aprobaciones de Hoy
                                </h3>
                                {validationData.approved.slice(0, 5).map((group, idx) => (
                                    <div key={idx} className="bg-black/20 p-6 rounded-3xl border border-white/5 flex justify-between items-center">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20">
                                                <i className="fas fa-check text-xs"></i>
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-white uppercase">{group.user.fullName}</p>
                                                <p className="text-[8px] text-slate-600 font-mono">ID: {group.items[0]?.item.id}</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-2 items-end">
                                            <span className="text-xs font-mono font-bold text-emerald-500">${formatCurrency(group.items.reduce((acc, it) => acc + it.item.paidAmount, 0))}</span>
                                            <div className="flex gap-2">
                                                {group.items.map((wrapper, iidx) => (
                                                    <button
                                                        key={iidx}
                                                        onClick={() => onAction(wrapper.gid, wrapper.item.id, 'revert_payment')}
                                                        className="text-[8px] font-black text-red-500 hover:text-white bg-red-500/10 hover:bg-red-500 px-2 py-1 rounded border border-red-500/20 transition-all uppercase"
                                                        title="Revertir Pago de este Ticket"
                                                    >
                                                        Rev. {wrapper.item.id.slice(-4)}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {tab === 'stock_fusion' && (
                    <div className="space-y-8 animate-enter">
                        {/* Sub-tabs */}
                        <div className="flex gap-4 p-1 bg-black/40 rounded-2xl border border-white/5 w-fit">
                            <button onClick={() => setStockFusionTab('management')} className={`px-6 py-3 rounded-xl font-bold uppercase text-[10px] tracking-widest transition-all ${stockFusionTab === 'management' ? 'bg-white/10 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Gestión & Conciliación</button>
                            <button onClick={() => setStockFusionTab('upload')} className={`px-6 py-3 rounded-xl font-bold uppercase text-[10px] tracking-widest transition-all ${stockFusionTab === 'upload' ? 'bg-white/10 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Carga de Stock</button>
                        </div>

                        {stockFusionTab === 'upload' && (
                            <div className="space-y-8 animate-enter">
                                <div className="glass-panel p-8 rounded-[2rem] space-y-6">
                                    <h3 className="text-xl font-syncopate font-bold text-white uppercase">Inyección de Stock v4</h3>
                                    <textarea className="input-neon w-full p-6 rounded-xl text-xs font-mono text-cyan-400 h-32" placeholder="Pega los nombres correlativos aquí (uno por línea)... EJ: GENERAL - 0001" value={inventoryInput} onChange={e => setInventoryInput(e.target.value)} />
                                    <div className="space-y-4">
                                        <div className="flex gap-4">
                                            <button onClick={() => setCostMode('total')} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${costMode === 'total' ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400' : 'bg-white/5 border-white/5 text-slate-500'}`}>Costo Total Grupo</button>
                                            <button onClick={() => setCostMode('unit')} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${costMode === 'unit' ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400' : 'bg-white/5 border-white/5 text-slate-500'}`}>Costo Unitario Fijo</button>
                                        </div>
                                        <div className="relative">
                                            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-cyan-500 font-mono text-xs">$</span>
                                            <input type="number" className="input-neon w-full pl-10 pr-5 py-5 rounded-2xl text-lg font-mono text-white" placeholder={costMode === 'total' ? "Costo Total del Lote..." : "Costo por cada Ticket..."} value={batchCost || ''} onChange={e => setBatchCost(parseFloat(e.target.value) || 0)} />
                                        </div>
                                    </div>
                                    <button onClick={handleAddInventory} className="w-full neon-button bg-cyan-600 py-6 rounded-3xl font-syncopate font-bold text-xs uppercase tracking-widest shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all">
                                        <i className="fas fa-plus"></i> Inyectar al Maestro de Stock
                                    </button>
                                </div>
                            </div>
                        )}

                        {stockFusionTab === 'management' && (
                            <div className="space-y-12 animate-enter">
                                {/* APROBACIONES DE PAGO SECTION (Step 1) */}
                                <div className="glass-panel p-8 rounded-[2rem] border border-amber-500/20 bg-amber-500/5 space-y-6">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-500 border border-amber-500/30">
                                                <i className="fas fa-receipt text-xl"></i>
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-syncopate font-bold text-white uppercase">Validación de Pagos</h3>
                                                <p className="text-[10px] font-black text-amber-500/60 uppercase tracking-widest">Paso 1: Confirmar Recepción de Fondos</p>
                                            </div>
                                        </div>
                                        {pendingApprovals.length > 3 && (
                                            <button onClick={() => setExpandApprovals(!expandApprovals)} className="text-[10px] font-black text-slate-500 hover:text-white uppercase tracking-widest transition-colors">
                                                {expandApprovals ? 'Colapsar Vista' : `Ver Todos (${pendingApprovals.length})`}
                                            </button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        {pendingApprovals.map((p, idx) => {
                                            const alreadyPaid = p.paidAmount || 0;
                                            const total = p.price || 0;
                                            const existingAssignment = state.inventory.find(i =>
                                                i.eventId === state.config.eventInternalId &&
                                                i.isAssigned &&
                                                i.assignedUserEmail === p.userEmail
                                            );

                                            return (
                                                <div key={idx} className="bg-white/5 border border-white/5 p-6 rounded-3xl space-y-5 hover:bg-white/10 transition-all group">
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex gap-3">
                                                            <img src={`https://api.dicebear.com/7.x/identicon/svg?seed=${p.userEmail}`} className="w-10 h-10 rounded-xl border border-white/10" />
                                                            <div>
                                                                <p className="text-[10px] font-black text-white uppercase truncate tracking-widest">
                                                                    <span className="text-slate-500">Cliente:</span> {p.user?.fullName}
                                                                    {p.seller && p.seller.email !== p.user?.email && (
                                                                        <> <span className="text-slate-500 mx-1">/</span> <span className="text-purple-400">Promotor:</span> {p.seller.fullName}</>
                                                                    )}
                                                                </p>
                                                                <div className="flex flex-col">
                                                                    <span className="text-[9px] font-mono text-amber-500/80 font-bold mb-0.5">TICKET: {p.id}</span>
                                                                    <a href={`https://instagram.com/${p.user?.instagram}`} target="_blank" className="text-[9px] text-cyan-400 font-bold uppercase tracking-widest hover:underline flex items-center gap-1">
                                                                        <i className="fab fa-instagram"></i> @{p.user?.instagram}
                                                                    </a>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="text-right flex flex-col items-end gap-1">
                                                            <span className="bg-amber-500 text-black px-2 py-1 rounded text-[10px] font-black uppercase shadow-lg shadow-amber-500/20">+${formatCurrency(p.pendingPayment)}</span>
                                                            <p className="text-[8px] font-black text-slate-500 uppercase">Abonado: ${formatCurrency(alreadyPaid)} / ${formatCurrency(total)}</p>
                                                        </div>
                                                    </div>

                                                    <div className="flex gap-2">
                                                        {(() => {
                                                            // STRICT LOGIC: ONLY check if THIS specific ticket has a strict link
                                                            // We prioritize internalCorrelative. If not set, check assignedTicketId.
                                                            const strictLink = state.inventory.find(i =>
                                                                i.eventId === state.config.eventInternalId &&
                                                                (i.correlativeId === p.internalCorrelative || i.assignedTicketId === p.id)
                                                            );

                                                            if (ticketToAssign && ticketToAssign.id === p.id) {
                                                                return (
                                                                    <div className="w-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 rounded-xl py-2.5 flex items-center justify-center gap-2 animate-pulse">
                                                                        <i className="fas fa-hand-pointer"></i>
                                                                        <span className="text-[9px] font-black uppercase tracking-widest">SELECCIONA ENTRADA ABAJO</span>
                                                                        <button onClick={() => setTicketToAssign(null)}><i className="fas fa-times hover:text-white"></i></button>
                                                                    </div>
                                                                );
                                                            }

                                                            return (
                                                                <button
                                                                    onClick={() => {
                                                                        if (strictLink) {
                                                                            if (confirm(`¿CONFIRMAR ABONO AUTOMÁTICO?\n\nTicket: ${p.id}\nEntrada Vinculada: #${strictLink.correlativeId}\n\nSe sumará al historial de esta entrada específica.`)) {
                                                                                onAction(p.gid, p.id, 'approve', strictLink.correlativeId);
                                                                            }
                                                                        } else {
                                                                            // New Assignment Mode
                                                                            setTicketToAssign(p);
                                                                        }
                                                                    }}
                                                                    className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase border transition-all flex flex-col items-center justify-center gap-0.5
                                                                        ${strictLink
                                                                            ? 'bg-purple-500/10 hover:bg-purple-500 text-purple-500 hover:text-white border-purple-500/20'
                                                                            : 'bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-black border-emerald-500/20'}`}
                                                                >
                                                                    <span className="flex items-center gap-2">
                                                                        <i className={`fas ${strictLink ? 'fa-bolt' : 'fa-hand-pointer'}`}></i>
                                                                        {strictLink ? `CONFIRMAR ABONO` : 'VALIDAR PAGO'}
                                                                    </span>
                                                                    <span className="text-[7px] font-mono opacity-70">
                                                                        {strictLink ? `LINK: ENTRADA #${strictLink.correlativeId}` : `TICKET ${p.id.slice(-4)}`}
                                                                    </span>
                                                                </button>
                                                            );
                                                        })()}
                                                        <button
                                                            onClick={() => {
                                                                if (confirm('¿Rechazar y eliminar registro de abono? El ticket volverá a estado pendiente para el cliente.')) {
                                                                    onAction(p.gid, p.id, 'reject_delete');
                                                                }
                                                            }}
                                                            className="px-3 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 transition-all"
                                                        >
                                                            <i className="fas fa-times"></i>
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {pendingApprovals.length === 0 && (
                                            <div className="col-span-full py-12 text-center">
                                                <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Sin pagos por validar actualmente</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* MASTER INVENTORY LIST (Step 2 & Management) */}
                                <div className="space-y-6">
                                    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 flex items-center justify-center text-cyan-500 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                                                <i className="fas fa-database text-xl"></i>
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-syncopate font-bold text-white uppercase">Maestro de Inventario</h3>
                                                <p className="text-[10px] font-black text-cyan-500/60 uppercase tracking-widest">Control Logístico y Asignación Manual</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4 w-full md:w-auto">
                                            <div className="bg-slate-900/50 p-1 rounded-2xl border border-white/5 flex">
                                                {['all', 'free', 'assigned'].map(t => (
                                                    <button key={t} onClick={() => setInvTab(t as any)} className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${invTab === t ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                                                        {t === 'all' ? 'Ver Todo' : t === 'free' ? 'Libres' : 'Asignadas'}
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="relative flex-1 md:w-64">
                                                <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-[10px]"></i>
                                                <input className="input-neon w-full pl-10 pr-4 py-3 rounded-2xl text-[9px] uppercase font-bold" placeholder="Buscar entrada..." value={invSearch} onChange={e => setInvSearch(e.target.value)} />
                                            </div>
                                        </div>
                                    </div>
                                    {/* Active Assignment Banner */}
                                    {ticketToAssign && (
                                        <div className="sticky top-0 z-50 bg-indigo-600 p-4 mb-6 rounded-3xl shadow-2xl border-2 border-indigo-400/50 animate-pulse flex justify-between items-center">
                                            <div className="flex items-center gap-5">
                                                <div className="bg-white text-indigo-600 w-14 h-14 rounded-2xl flex items-center justify-center font-bold shadow-xl text-xl rotate-3">
                                                    <i className="fas fa-crosshairs"></i>
                                                </div>
                                                <div>
                                                    <h4 className="text-white font-black text-sm uppercase tracking-widest drop-shadow-md">MODO DE VINCULACIÓN ACTIVO</h4>
                                                    <div className="flex flex-col gap-1 mt-1">
                                                        <p className="text-indigo-100 text-[10px] font-mono flex items-center gap-2">
                                                            Ticket ID: <span className="bg-black/30 px-2 py-0.5 rounded text-amber-300 font-bold border border-amber-300/30">{ticketToAssign.id}</span>
                                                        </p>
                                                        <p className="text-indigo-100 text-[10px] flex items-center gap-2">
                                                            Cliente: <span className="font-bold text-white border-b border-indigo-300/30 pb-0.5">{ticketToAssign.userEmail}</span>
                                                            {ticketToAssign.internalCorrelative
                                                                ? <span className="bg-emerald-400 text-black px-2 py-0.5 rounded font-black text-[9px] uppercase shadow-lg flex items-center gap-1"><i className="fas fa-link"></i> VINCULADO A #{ticketToAssign.internalCorrelative}</span>
                                                                : <span className="bg-white/20 text-white px-2 py-0.5 rounded font-bold text-[9px] uppercase flex items-center gap-1"><i className="fas fa-plus-circle"></i> NUEVO VÍNCULO</span>
                                                            }
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setTicketToAssign(null)}
                                                className="bg-indigo-800/50 hover:bg-indigo-800 text-white px-6 py-3 rounded-xl text-xs font-black uppercase transition-all border border-white/10 hover:border-white/30"
                                            >
                                                <i className="fas fa-times mr-2"></i> Cancelar Modo
                                            </button>
                                        </div>
                                    )}

                                    <div className="glass-panel rounded-[2.5rem] overflow-hidden border border-white/5">
                                        <div className="max-h-[700px] overflow-y-auto custom-scrollbar">
                                            <table className="w-full text-left">
                                                <thead className="bg-black/60 text-[9px] font-black text-slate-400 uppercase tracking-widest sticky top-0 backdrop-blur-xl z-10">
                                                    <tr>
                                                        <th className="p-7 flex items-center gap-2">
                                                            ID #
                                                            <div className="flex flex-col">
                                                                <button onClick={() => setInvSortOrder('asc')} className={`hover:text-cyan-400 transition-colors ${invSortOrder === 'asc' ? 'text-cyan-400' : ''}`}><i className="fas fa-caret-up"></i></button>
                                                                <button onClick={() => setInvSortOrder('desc')} className={`hover:text-cyan-400 transition-colors ${invSortOrder === 'desc' ? 'text-cyan-400' : ''}`}><i className="fas fa-caret-down"></i></button>
                                                            </div>
                                                        </th>
                                                        <th className="p-7">Identificador / Nombre</th>
                                                        <th className="p-7">Ticket / Link</th>
                                                        <th className="p-7">Costo</th>
                                                        <th className="p-7">Abono</th>
                                                        <th className="p-7">Utilidad</th>
                                                        <th className="p-7">Estado de Entrega</th>
                                                        <th className="p-7 text-right">Acciones</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5">
                                                    {filteredInventory.map((inv, idx) => {
                                                        const assignedUser = state.users.find(u => u.email === inv.assignedUserEmail);
                                                        // Find ALL tickets linked to this inventory item (cumulative installments)
                                                        const linkedTickets = state.purchaseGroups
                                                            .flatMap(g => g.items)
                                                            .filter(it => it.internalCorrelative === inv.correlativeId && it.eventId === inv.eventId);

                                                        const totalPaidByTickets = linkedTickets.reduce((acc, t) => acc + t.paidAmount, 0);
                                                        const utility = totalPaidByTickets - inv.cost;
                                                        const isFullyPaid = linkedTickets.length > 0 && totalPaidByTickets >= (linkedTickets[0]?.price || 0) && linkedTickets.every(t => t.status === 'paid');

                                                        return (
                                                            <tr key={idx} className={`hover:bg-white/5 transition-all group/row ${inv.isAssigned ? 'opacity-80' : ''}`}>
                                                                <td className="p-7">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-[11px] font-black text-white uppercase tracking-wider">{inv.name}</span>
                                                                        <span className="text-[8px] font-bold text-slate-500 uppercase">#{inv.correlativeId} / Tanda {inv.batchNumber}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="p-7 min-w-[280px]">
                                                                    <div className="flex items-center gap-4">
                                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black ${inv.link ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30' : 'bg-slate-800 text-slate-500 border border-white/5'}`}>
                                                                            <i className={`fas ${inv.link ? 'fa-link' : 'fa-link-slash'}`}></i>
                                                                        </div>
                                                                        <div className="flex-1">
                                                                            {/* Visual Assignment Logic */}
                                                                            {ticketToAssign ? (
                                                                                (() => {
                                                                                    // Strict Logic:
                                                                                    // 1. Check if Ticket is explicitly linked to THIS inventory item
                                                                                    const isLinkedToThis = ticketToAssign.internalCorrelative === inv.correlativeId;
                                                                                    // 2. Check implicit link (if ticket has no correlative yet, but inventory has the TicketID)
                                                                                    const isImplicitlyLinked = !ticketToAssign.internalCorrelative && inv.assignedTicketId === ticketToAssign.id;
                                                                                    const isTarget = isLinkedToThis || isImplicitlyLinked;

                                                                                    // 3. Check if Ticket has ANY link anywhere (to disable Manual Assignment on other items)
                                                                                    const ticketHasEstablishedLink = !!ticketToAssign.internalCorrelative || !!state.inventory.find(i => i.assignedTicketId === ticketToAssign.id && i.eventId === state.config.eventInternalId);

                                                                                    const isFree = !inv.isAssigned;

                                                                                    // CASE A: Automatic Sum (Target Found)
                                                                                    if (isTarget) {
                                                                                        if (isFullyPaid) return (
                                                                                            <div className="px-4 py-2 bg-emerald-500 text-black font-black uppercase text-[10px] rounded-lg shadow-lg flex items-center justify-center gap-2">
                                                                                                <i className="fas fa-check-circle"></i> COMPLETADO
                                                                                            </div>
                                                                                        );

                                                                                        return (
                                                                                            <button
                                                                                                onClick={() => {
                                                                                                    if (confirm(`¿CONFIRMAR ABONO AUTOMÁTICO?\n\nTicket: ${ticketToAssign.id}\nEntrada: #${inv.correlativeId}\nUsuario: ${ticketToAssign.userEmail}\n\nEsta acción sumará el saldo.`)) {
                                                                                                        onAction(ticketToAssign.gid, ticketToAssign.id, 'approve', inv.correlativeId);
                                                                                                        setTicketToAssign(null);
                                                                                                    }
                                                                                                }}
                                                                                                className="w-full py-2 bg-purple-500 hover:bg-purple-400 text-white font-black uppercase text-[10px] rounded-lg shadow-lg shadow-purple-500/20 animate-pulse transition-all hover:scale-105"
                                                                                                title={`Abonar Ticket ${ticketToAssign.id}`}
                                                                                            >
                                                                                                <i className="fas fa-bolt mr-2"></i> CONFIRMAR ABONO ({ticketToAssign.id.slice(-4)})
                                                                                            </button>
                                                                                        );
                                                                                    }

                                                                                    // CASE B: New Assignment (Only if ticket is completely new/unlinked AND entry is free)
                                                                                    if (!ticketHasEstablishedLink && isFree) {
                                                                                        return (
                                                                                            <button
                                                                                                onClick={() => {
                                                                                                    if (confirm(`¿VINCULAR NUEVA ENTRADA?\n\nTicket: ${ticketToAssign.id}\nEntrada: #${inv.correlativeId} (LIBRE)\nUsuario: ${ticketToAssign.userEmail}\n\nSe creará un enlace permanente.`)) {
                                                                                                        onAction(ticketToAssign.gid, ticketToAssign.id, 'approve', inv.correlativeId);
                                                                                                        setTicketToAssign(null);
                                                                                                    }
                                                                                                }}
                                                                                                className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase text-[10px] rounded-lg shadow-lg shadow-emerald-500/20 animate-pulse transition-all hover:scale-105"
                                                                                                title={`Vincular Ticket ${ticketToAssign.id}`}
                                                                                            >
                                                                                                <i className="fas fa-link mr-2"></i> VINCULAR ({ticketToAssign.id.slice(-4)})
                                                                                            </button>
                                                                                        );
                                                                                    }

                                                                                    // CASE C: Blocked
                                                                                    return (
                                                                                        <div className="opacity-30 grayscale flex items-center justify-center">
                                                                                            {inv.link ? (
                                                                                                <span className="text-[10px] font-mono text-slate-500 truncate block max-w-[200px]">{inv.link.length > 8 ? inv.link.substring(0, 8) + '...' : inv.link}</span>
                                                                                            ) : <span className="text-[9px] text-slate-600 block text-center border border-white/5 rounded py-1 px-3">⛔ NO DISPONIBLE</span>}
                                                                                        </div>
                                                                                    );
                                                                                })()
                                                                            ) : (
                                                                                inv.link ? (
                                                                                    <a href={inv.link} target="_blank" className="text-[10px] font-bold text-cyan-400 hover:underline truncate max-w-[200px] block">{inv.link.length > 8 ? inv.link.substring(0, 8) + '...' : inv.link}</a>
                                                                                ) : (
                                                                                    <div className="flex items-center gap-2 text-slate-600">
                                                                                        <i className="fas fa-edit text-[10px]"></i>
                                                                                        <input
                                                                                            value={inv.link || ''}
                                                                                            onChange={e => handleInlineEditInventory(idx, e.target.value)}
                                                                                            onPaste={e => {
                                                                                                e.preventDefault();
                                                                                                const pasted = e.clipboardData.getData('text');
                                                                                                handleInlineEditInventory(idx, pasted);
                                                                                            }}
                                                                                            placeholder="Pegar Link Ticket (URL)..."
                                                                                            className="bg-transparent border-none outline-none text-[10px] font-mono text-slate-400 w-full placeholder:text-slate-700 focus:text-white transition-all"
                                                                                        />
                                                                                    </div>
                                                                                )
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="p-7">
                                                                    {inv.assignedTo ? (
                                                                        <div className="flex flex-col">
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="text-[10px] font-bold text-white uppercase">{inv.assignedTo}</span>
                                                                                {assignedUser?.instagram && (
                                                                                    <a href={`https://instagram.com/${assignedUser.instagram}`} target="_blank" className="text-cyan-400 hover:text-white transition-colors">
                                                                                        <i className="fab fa-instagram text-[10px]"></i>
                                                                                    </a>
                                                                                )}
                                                                            </div>
                                                                            <span className="text-[8px] font-bold text-slate-500">{inv.assignedUserEmail}</span>
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-[9px] font-black text-slate-600 uppercase">-- LIBRE --</span>
                                                                    )}
                                                                </td>
                                                                <td className="p-7">
                                                                    <span className="text-xs font-mono font-bold text-slate-400">${formatCurrency(inv.cost)}</span>
                                                                </td>
                                                                <td className="p-7">
                                                                    {linkedTickets.length > 0 ? (
                                                                        <div className="flex flex-col">
                                                                            <span className={`text-xs font-mono font-bold ${isFullyPaid ? 'text-emerald-500' : 'text-amber-500'}`}>${formatCurrency(totalPaidByTickets)}</span>
                                                                            <span className="text-[7px] font-black text-slate-600 uppercase">
                                                                                {linkedTickets.length} Abono{linkedTickets.length !== 1 ? 's' : ''}
                                                                            </span>
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-xs font-mono font-bold text-slate-600">$0</span>
                                                                    )}
                                                                </td>
                                                                <td className="p-7">
                                                                    <span className={`text-xs font-mono font-bold ${utility > 0 ? 'text-emerald-400' : utility < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                                                                        {utility > 0 ? '+' : ''}${formatCurrency(utility)}
                                                                    </span>
                                                                </td>
                                                                <td className="p-7">
                                                                    <div className={`px-4 py-1.5 rounded-lg border w-fit ${inv.isAssigned ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-slate-800 border-white/5 text-slate-500'}`}>
                                                                        <span className="text-[8px] font-black uppercase tracking-widest flex items-center gap-2">
                                                                            <i className={`fas ${inv.isAssigned ? 'fa-check' : 'fa-clock'}`}></i>
                                                                            {inv.isAssigned ? (isFullyPaid ? 'ENTREGADA' : 'RESERVADO (ABONANDO)') : 'DISPONIBLE'}
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                                <td className="p-7 text-right">
                                                                    <div className="flex justify-end gap-3">
                                                                        {inv.isAssigned && linkedTickets.length > 0 && (
                                                                            <>
                                                                                {/* WhatsApp Button */}
                                                                                <a
                                                                                    href={`https://wa.me/${assignedUser?.phoneNumber?.replace('+', '')}?text=${encodeURIComponent(`Hola ${assignedUser?.fullName}, aquí está tu entrada para ${state.config.eventTitle} - ${state.config.eventDate}: ${inv.name} ${inv.link}`)}`}
                                                                                    target="_blank"
                                                                                    className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white flex items-center justify-center transition-all border border-emerald-500/20"
                                                                                    title="Enviar por WhatsApp"
                                                                                >
                                                                                    <i className="fab fa-whatsapp text-[14px]"></i>
                                                                                </a>
                                                                                {/* Lock/Unlock Button */}
                                                                                <button
                                                                                    onClick={() => {
                                                                                        const firstTicket = linkedTickets[0];
                                                                                        onAction(firstTicket.groupId, firstTicket.id, firstTicket.isUnlocked ? 'lock' : 'unlock');
                                                                                    }}
                                                                                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all border ${linkedTickets[0]?.isUnlocked ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-slate-800 text-slate-500 border-white/10'}`}
                                                                                    title={linkedTickets[0]?.isUnlocked ? "Bloquear Descarga" : "Desbloquear Descarga"}
                                                                                >
                                                                                    <i className={`fas ${linkedTickets[0]?.isUnlocked ? 'fa-unlock' : 'fa-lock'} text-[11px]`}></i>
                                                                                </button>
                                                                            </>
                                                                        )}
                                                                        {inv.isAssigned ? (
                                                                            <button
                                                                                onClick={() => {
                                                                                    if (confirm(`¿Revertir TODOS los abonos y liberar la entrada ${inv.name}?`)) {
                                                                                        // Revert ALL linked tickets
                                                                                        linkedTickets.forEach(t => {
                                                                                            onAction(t.groupId, t.id, 'revert_payment');
                                                                                        });
                                                                                    }
                                                                                }}
                                                                                className="px-5 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white text-[9px] font-black uppercase border border-red-500/20 transition-all flex items-center gap-2"
                                                                            >
                                                                                <i className="fas fa-undo"></i> Revertir ({linkedTickets.length})
                                                                            </button>
                                                                        ) : (
                                                                            <span className="text-[8px] font-black text-slate-700 uppercase italic">Esperando Validación</span>
                                                                        )}
                                                                        <button onClick={() => setEditingInvItem({ idx: state.inventory.findIndex(i => i.correlativeId === inv.correlativeId && i.eventId === currentEventId), data: { ...inv } })} className="w-10 h-10 rounded-xl bg-white/5 text-slate-500 hover:bg-white/10 hover:text-white flex items-center justify-center transition-all">
                                                                            <i className="fas fa-edit text-[11px]"></i>
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div >
                        )}
                    </div >
                )
                }

                {
                    tab === 'crm' && (
                        <div className="space-y-8 animate-enter">
                            <div className="glass-panel p-4 rounded-2xl flex flex-wrap gap-4 items-center mb-6">
                                <div className="flex-1 relative">
                                    <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-600"></i>
                                    <input className="input-neon w-full pl-10 pr-4 py-2 rounded-xl text-xs" placeholder="Buscar por Nombre, Email, IG o Tel..." value={crmSearch} onChange={e => setCrmSearch(e.target.value)} />
                                </div>
                                <select className="input-neon px-4 py-2 rounded-xl text-xs" value={crmFilter} onChange={e => setCrmFilter(e.target.value as any)}>
                                    <option value="ALL">TODOS LOS ROLES</option>
                                    <option value="client">CLIENTES</option>
                                    <option value="ACTIVE">CLIENTES ACTIVOS (EVE. ACTUAL)</option>
                                    <option value="admin">ADMINS</option>
                                </select>
                                <button onClick={() => setIsAddingUser(true)} className="neon-button bg-cyan-600 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-white flex items-center gap-2 shadow-lg shadow-cyan-900/40 hover:scale-105 transition-all">
                                    <i className="fas fa-user-plus"></i> Nuevo Usuario
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {filteredUsers.map(u => {
                                    const tickets = getUserTickets(u.email);
                                    return (
                                        <div key={u.email} className={`glass-panel p-8 rounded-[2rem] border-l-4 transition-all hover:bg-white/5 flex flex-col ${tickets.some(t => t.price > t.paidAmount) ? 'border-l-amber-500' : 'border-l-slate-700'}`}>
                                            <div className="flex items-center gap-5 mb-6">
                                                <img src={`https://api.dicebear.com/7.x/identicon/svg?seed=${u.email}`} className="w-16 h-16 rounded-2xl border border-white/10" />
                                                <div className="flex-1">
                                                    <h4 className="font-bold text-white text-xl uppercase">{u.fullName}</h4>
                                                    <p className="text-[10px] font-bold text-cyan-400 mt-1">@{u.instagram}</p>
                                                    <div className="flex gap-2 mt-2">
                                                        {u.isPromoter && <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 text-[8px] font-black uppercase">PROMOTOR</span>}
                                                        <span className="px-2 py-0.5 rounded border border-purple-500/50 text-purple-400 text-[7px] font-black uppercase">LVL {u.stars}</span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-2">
                                                    <div className="flex gap-1 justify-end">
                                                        <button onClick={() => setHistoryUser(u)} className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-all border border-white/5"><i className="fas fa-info text-[9px]"></i></button>
                                                        <button onClick={() => onGrantCourtesy(u.email)} className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-500 border border-amber-500/30 flex items-center justify-center hover:bg-amber-500 hover:text-black transition-all"><i className="fas fa-star text-[9px]"></i></button>
                                                        {u.role !== 'admin' && (
                                                            <button onClick={() => onDeleteUser(u.email)} className="w-8 h-8 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"><i className="fas fa-trash-alt text-[9px]"></i></button>
                                                        )}
                                                    </div>
                                                    <button onClick={() => openUserChat(u.email)} className="w-full h-8 rounded-lg bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center hover:bg-cyan-600 hover:text-white transition-all text-[9px] font-black uppercase"><i className="fas fa-comment-dots mr-2"></i> Chat</button>
                                                </div>
                                            </div>
                                            <div className="flex justify-around bg-black/40 rounded-2xl p-4 border border-white/5 mb-6">
                                                <div className="text-center">
                                                    <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1">Entradas</p>
                                                    <p className="text-xl font-mono font-bold text-white">
                                                        {state.purchaseGroups.filter(g => g.userEmail === u.email).flatMap(g => g.items).filter(it => it.status === 'paid').length}
                                                    </p>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1">Social</p>
                                                    <div className="flex gap-2">
                                                        <a href={`https://instagram.com/${u.instagram}`} target="_blank" className="w-6 h-6 rounded-md bg-pink-600/20 text-pink-500 flex items-center justify-center text-[10px]"><i className="fab fa-instagram"></i></a>
                                                        <a href={`https://wa.me/${u.phoneNumber}`} target="_blank" className="w-6 h-6 rounded-md bg-emerald-600/20 text-emerald-500 flex items-center justify-center text-[10px]"><i className="fab fa-whatsapp"></i></a>
                                                    </div>
                                                </div>
                                            </div>
                                            <button onClick={() => setEditingUser(u)} className="w-full py-3 bg-white/5 rounded-xl text-[9px] font-black uppercase text-slate-400 hover:bg-white/10 hover:text-white transition-all tracking-widest">Editar Perfil</button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )
                }

                {
                    tab === 'chat' && (
                        <div className="h-[75vh] flex flex-col md:flex-row gap-6 animate-enter">
                            <div className="w-full md:w-80 glass-panel rounded-[2rem] flex flex-col overflow-hidden">
                                <div className="p-6 border-b border-white/5 space-y-4">
                                    <h3 className="text-[10px] font-black uppercase tracking-widest text-cyan-400">Canales de Chat</h3>
                                    <div className="relative">
                                        <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 text-[10px]"></i>
                                        <input className="input-neon w-full pl-8 pr-4 py-2 rounded-lg text-[10px] font-bold uppercase" placeholder="Buscar cliente..." value={chatSearch} onChange={e => setChatSearch(e.target.value)} />
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto">
                                    {state.conversations.filter(c => c.clientEmail.toLowerCase().includes(chatSearch.toLowerCase())).map(conv => {
                                        const client = state.users.find(u => u.email === conv.clientEmail);
                                        return (
                                            <button key={conv.clientEmail} onClick={() => setSelectedChatEmail(conv.clientEmail)} className={`w-full p-4 flex items-center gap-4 border-b border-white/5 transition-all ${selectedChatEmail === conv.clientEmail ? 'bg-cyan-500/10 border-l-4 border-l-cyan-500' : 'hover:bg-white/5'}`}>
                                                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-white uppercase truncate">
                                                    {client?.fullName.substring(0, 2) || conv.clientEmail.substring(0, 2)}
                                                </div>
                                                <div className="text-left flex-1 truncate">
                                                    <p className="text-xs font-bold text-white uppercase truncate">{client?.fullName || conv.clientEmail.split('@')[0]}</p>
                                                    <p className="text-[9px] text-slate-500 truncate mt-1">{conv.messages[conv.messages.length - 1]?.text || 'Sin mensajes'}</p>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="flex-1 glass-panel rounded-[2rem] flex flex-col overflow-hidden">
                                {selectedChatEmail ? (
                                    <>
                                        <div className="p-4 bg-white/5 border-b border-white/5 flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <img src={`https://api.dicebear.com/7.x/identicon/svg?seed=${selectedChatEmail}`} className="w-8 h-8 rounded-full" />
                                                <p className="text-xs font-bold text-white uppercase">{state.users.find(u => u.email === selectedChatEmail)?.fullName}</p>
                                            </div>
                                            <button onClick={() => setSelectedChatEmail(null)} className="text-slate-500 hover:text-white"><i className="fas fa-times"></i></button>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-8 space-y-4 bg-gradient-to-b from-slate-950 to-black">
                                            {currentChat?.messages.map((m, i) => (
                                                <div key={i} className={`flex ${m.role === 'client' ? 'justify-start' : 'justify-end'}`}>
                                                    <div className={`max-w-[80%] p-4 rounded-2xl text-xs ${m.role === 'client' ? 'bg-slate-800 text-slate-200 shadow-lg' : 'bg-cyan-600/20 text-cyan-200 border border-cyan-500/30'}`}>
                                                        {m.text}
                                                        <div className="text-[7px] text-slate-500 mt-2 text-right">{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="p-6 bg-black/40 border-t border-white/5 flex gap-4">
                                            <input
                                                className="flex-1 input-neon p-4 rounded-xl text-xs"
                                                placeholder="Respuesta administrativa..."
                                                value={adminMsg}
                                                onChange={e => setAdminMsg(e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter' && !e.shiftKey) {
                                                        e.preventDefault();
                                                        handleSendAdminMessage();
                                                    }
                                                }}
                                            />
                                            <button onClick={handleSendAdminMessage} className="bg-cyan-600 w-12 h-12 rounded-xl flex items-center justify-center hover:bg-cyan-500 transition-all"><i className="fas fa-paper-plane text-white"></i></button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center gap-4 opacity-20"><i className="fas fa-comments text-6xl"></i><p className="font-mono text-xs uppercase">Seleccionar Conversación</p></div>
                                )}
                            </div>
                        </div>
                    )
                }

                {/* Config & Logs placeholders (keep logic but optimize visuals briefly) */}
                {tab === 'logs' && <div className="p-10 text-center text-slate-600 font-mono text-xs uppercase">Logs de Sistema Disponibles</div>}
                {
                    tab === 'config' && (
                        <div className="space-y-10 animate-enter max-w-4xl">
                            {/* Event Config */}
                            <div className="glass-panel p-8 rounded-[2rem] border border-white/5 space-y-6">
                                <h3 className="text-xl font-syncopate font-bold text-white uppercase flex items-center gap-3">
                                    <i className="fas fa-cog text-cyan-400"></i> Ajustes del Evento
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1">Título del Evento</label>
                                        <input className="input-neon w-full p-4 rounded-xl text-sm" value={configForm.eventTitle} onChange={e => setConfigForm({ ...configForm, eventTitle: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1">ID Interno (Nexus)</label>
                                        <input className="input-neon w-full p-4 rounded-xl text-sm" value={configForm.eventInternalId} onChange={e => setConfigForm({ ...configForm, eventInternalId: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1">Fecha del Evento</label>
                                        <input className="input-neon w-full p-4 rounded-xl text-sm" value={configForm.eventDate} onChange={e => setConfigForm({ ...configForm, eventDate: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1">Precio Final ($)</label>
                                        <input type="number" className="input-neon w-full p-4 rounded-xl text-sm" value={configForm.finalPrice} onChange={e => setConfigForm({ ...configForm, finalPrice: Number(e.target.value) })} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1">Precio Referencial / Tachado ($)</label>
                                        <input type="number" className="input-neon w-full p-4 rounded-xl text-sm" value={configForm.referencePrice || 0} onChange={e => setConfigForm({ ...configForm, referencePrice: Number(e.target.value) })} />
                                    </div>
                                </div>
                                <button onClick={() => { onUpdateConfig(configForm); alert("Configuración actualizada."); }} className="neon-button w-full bg-cyan-600 py-4 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg">Actualizar Configuración</button>
                            </div>

                        </div>
                    )
                }

                {/* New User Modal */}
                {
                    isAddingUser && (
                        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl animate-enter">
                            <div className="bg-slate-900 w-full max-w-lg rounded-[2rem] p-10 border border-cyan-500/30 space-y-8">
                                <h3 className="text-xl font-syncopate font-bold text-white uppercase">Registrar Nuevo Usuario</h3>
                                <div className="grid grid-cols-2 gap-6">
                                    <input className="input-neon p-4 rounded-xl text-sm" placeholder="Nombre Completo" value={newUserForm.fullName} onChange={e => setNewUserForm({ ...newUserForm, fullName: e.target.value })} />
                                    <input className="input-neon p-4 rounded-xl text-sm" placeholder="Instagram (sin @)" value={newUserForm.instagram} onChange={e => setNewUserForm({ ...newUserForm, instagram: e.target.value })} />
                                    <input className="input-neon p-4 rounded-xl text-sm" placeholder="Email" value={newUserForm.email} onChange={e => setNewUserForm({ ...newUserForm, email: e.target.value })} />
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1">Pin de Acceso / Seguridad</label>
                                        <input className="input-neon w-full p-4 rounded-xl text-sm font-mono" value={newUserForm.pin} onChange={e => setNewUserForm({ ...newUserForm, pin: e.target.value })} placeholder="Ej: 1234" />
                                    </div>
                                    <input className="input-neon p-4 rounded-xl text-sm col-span-2" placeholder="WhatsApp" value={newUserForm.phoneNumber} onChange={e => setNewUserForm({ ...newUserForm, phoneNumber: e.target.value })} />
                                </div>
                                <div className="flex gap-4 pt-4">
                                    <button onClick={() => { setIsAddingUser(false); setNewUserForm({ fullName: '', email: '', instagram: '', phoneNumber: '', pin: '', role: 'client' }); }} className="flex-1 py-4 rounded-xl text-xs font-bold text-slate-500 uppercase hover:text-white transition-colors">Cancelar</button>
                                    <button onClick={() => {
                                        if (!newUserForm.email || !newUserForm.fullName || !newUserForm.pin) { alert("Completa los campos básicos."); return; }
                                        onAddUser({ ...newUserForm, balance: 0, stars: 1, courtesyProgress: 0, lifetimeTickets: 0, role: 'client' } as User);
                                        setIsAddingUser(false);
                                        setNewUserForm({ fullName: '', email: '', instagram: '', phoneNumber: '', pin: '', role: 'client' });
                                    }} className="neon-button flex-1 bg-cyan-600 text-white py-4 rounded-xl text-xs font-black uppercase shadow-lg shadow-cyan-900/40">Crear Cliente</button>
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* Edit User Modal */}
                {
                    editingUser && (
                        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl animate-enter">
                            <div className="bg-slate-900 w-full max-w-lg rounded-[2rem] p-10 border border-cyan-500/30 space-y-8">
                                <h3 className="text-xl font-syncopate font-bold text-white uppercase">Modificar Perfil</h3>
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-1">
                                        <label className="text-[8px] font-bold text-slate-500 uppercase ml-1">Email (ID)</label>
                                        <input className="input-neon p-4 rounded-xl text-sm w-full opacity-60" value={editingUser.email} disabled />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[8px] font-bold text-slate-500 uppercase ml-1">Pin de Acceso</label>
                                        <input className="input-neon p-4 rounded-xl text-sm w-full" placeholder="PIN" value={editingUser.pin} onChange={e => setEditingUser({ ...editingUser, pin: e.target.value })} />
                                    </div>
                                    <input className="input-neon p-4 rounded-xl text-sm col-span-2" placeholder="Nombre" value={editingUser.fullName} onChange={e => setEditingUser({ ...editingUser, fullName: e.target.value })} />
                                    <input className="input-neon p-4 rounded-xl text-sm col-span-2" placeholder="Instagram" value={editingUser.instagram} onChange={e => setEditingUser({ ...editingUser, instagram: e.target.value })} />
                                    <input className="input-neon p-4 rounded-xl text-sm col-span-2" placeholder="WhatsApp" value={editingUser.phoneNumber} onChange={e => setEditingUser({ ...editingUser, phoneNumber: e.target.value })} />
                                </div>
                                <div className="flex items-center gap-3 p-4 bg-white/5 rounded-xl border border-white/5">
                                    <input
                                        type="checkbox"
                                        id="isPromoter"
                                        checked={editingUser.isPromoter}
                                        onChange={e => setEditingUser({ ...editingUser, isPromoter: e.target.checked })}
                                        className="w-4 h-4 rounded border-white/10 bg-black/40 text-cyan-500 focus:ring-cyan-500"
                                    />
                                    <label htmlFor="isPromoter" className="text-[10px] font-bold text-slate-300 uppercase tracking-widest cursor-pointer select-none">
                                        Habilitar como Promotor (Código: {editingUser.fullName})
                                    </label>
                                </div>

                                <div className="flex gap-4 pt-4">
                                    <button onClick={() => setEditingUser(null)} className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors">Cancelar</button>
                                    <button onClick={() => { onUpdateUserManual(editingUser.email, editingUser); setEditingUser(null); }} className="flex-[2] neon-button bg-cyan-600 py-4 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg">Guardar Cambios</button>
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* History Modal */}
                {
                    historyUser && (
                        <div className="fixed inset-0 z-[250] flex items-center justify-center p-6 bg-black/95 backdrop-blur-2xl animate-enter">
                            <div className="bg-slate-900 w-full max-w-2xl rounded-[3rem] p-10 border border-purple-500/30 space-y-8 flex flex-col max-h-[90vh]">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="text-2xl font-syncopate font-bold text-white uppercase">Historial de Entradas</h3>
                                        <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest mt-1">{historyUser.fullName} // {historyUser.email}</p>
                                    </div>
                                    <button onClick={() => setHistoryUser(null)} className="w-12 h-12 rounded-2xl bg-white/5 text-slate-500 hover:text-white flex items-center justify-center transition-all"><i className="fas fa-times"></i></button>
                                </div>

                                <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                                    {state.purchaseGroups
                                        .filter(g => g.userEmail === historyUser.email)
                                        .map(group => (
                                            <div key={group.id} className="bg-white/5 p-6 rounded-2xl border border-white/5 space-y-4">
                                                <div className="flex justify-between items-center border-b border-white/5 pb-3">
                                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Evento: {group.items[0]?.eventName || group.eventId}</span>
                                                    <span className="text-[9px] font-bold text-slate-400">{new Date(group.createdAt).toLocaleDateString()}</span>
                                                </div>
                                                <div className="grid gap-2">
                                                    {group.items.map(it => (
                                                        <div key={it.id} className="flex justify-between items-center text-[10px] bg-black/20 p-3 rounded-xl">
                                                            <span className="text-white font-mono">{it.id}</span>
                                                            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter ${it.status === 'paid' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-500'}`}>{it.status === 'paid' ? 'Liberada' : 'No Liberada'}</span>
                                                            <span className="font-bold text-cyan-400">${formatCurrency(it.paidAmount)} / ${formatCurrency(it.price)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    {state.purchaseGroups.filter(g => g.userEmail === historyUser.email).length === 0 && (
                                        <div className="text-center py-20 opacity-20"><i className="fas fa-history text-5xl mb-4"></i><p className="uppercase text-xs font-mono">Sin historial registrado</p></div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* Edit Inventory Item Modal */}
                {
                    editingInvItem && (
                        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl animate-enter">
                            <div className="bg-slate-900 w-full max-w-lg rounded-[2rem] p-10 border border-amber-500/30 space-y-8">
                                <div>
                                    <h3 className="text-xl font-syncopate font-bold text-white uppercase">Editar Stock</h3>
                                    <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mt-1">Correlativo #{editingInvItem.data.correlativeId}</p>
                                </div>

                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1">Nombre de Entrada</label>
                                        <input className="input-neon w-full p-4 rounded-xl text-sm font-bold text-white" value={editingInvItem.data.name} onChange={e => setEditingInvItem({ ...editingInvItem, data: { ...editingInvItem.data, name: e.target.value } })} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1">URL del Ticket</label>
                                        <input className="input-neon w-full p-4 rounded-xl text-sm font-mono text-cyan-400" value={editingInvItem.data.link} onChange={e => setEditingInvItem({ ...editingInvItem, data: { ...editingInvItem.data, link: e.target.value } })} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1">Costo Unitario ($)</label>
                                            <input type="number" className="input-neon w-full p-4 rounded-xl text-sm font-mono" value={editingInvItem.data.cost} onChange={e => setEditingInvItem({ ...editingInvItem, data: { ...editingInvItem.data, cost: parseFloat(e.target.value) || 0 } })} />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1">Nro Bote / Tanda</label>
                                            <input type="number" className="input-neon w-full p-4 rounded-xl text-sm font-mono" value={editingInvItem.data.batchNumber} onChange={e => setEditingInvItem({ ...editingInvItem, data: { ...editingInvItem.data, batchNumber: parseInt(e.target.value) || 1 } })} />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-4 pt-4">
                                    <button onClick={() => {
                                        if (confirm("¿Estás seguro de eliminar esta entrada?")) {
                                            onDeleteInventoryItem(editingInvItem.data.correlativeId);
                                            setEditingInvItem(null);
                                        }
                                    }} className="w-12 h-12 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all">
                                        <i className="fas fa-trash-alt"></i>
                                    </button>
                                    <button onClick={() => setEditingInvItem(null)} className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white">Cancelar</button>
                                    <button onClick={() => {
                                        const nextInv = [...state.inventory];
                                        nextInv[editingInvItem.idx] = editingInvItem.data;
                                        onUpdateInventory(nextInv);
                                        setEditingInvItem(null);
                                    }} className="flex-[2] neon-button bg-amber-600 py-4 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg">Guardar Cambios</button>
                                </div>
                            </div>
                        </div>
                    )
                }
            </main >

            {/* Navigation Dock */}
            <nav className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-slate-900/80 backdrop-blur-2xl border border-white/10 px-6 py-4 rounded-full flex gap-6 z-[150] shadow-2xl">
                {
                    [
                        { id: 'home', icon: 'fas fa-chart-pie' },
                        { id: 'stock_fusion', icon: 'fas fa-layer-group' },
                        { id: 'crm', icon: 'fas fa-users' },
                        { id: 'chat', icon: 'fas fa-comments' },
                        { id: 'config', icon: 'fas fa-cog' },
                    ].map(navItem => (
                        <button
                            key={navItem.id}
                            onClick={() => setTab(navItem.id as any)}
                            className={`w-10 h-10 rounded-full transition-all ${tab === navItem.id ? 'bg-cyan-500 text-black shadow-lg scale-110' : 'text-slate-400 hover:text-white'}`}
                        >
                            <i className={`${navItem.icon} text-sm`}></i>
                        </button>
                    ))
                }
                <div className="w-px h-10 bg-white/10 mx-2"></div>
                <button
                    onClick={onLogout}
                    className="w-10 h-10 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center"
                >
                    <i className="fas fa-power-off text-sm"></i>
                </button>
            </nav>
        </div>
    );
};

export default AdminPanel;