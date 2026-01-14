import React, { useState, useMemo } from 'react';
import { AppState, User, Role } from '../../../types';
import { formatPhoneNumber } from '../../../logic';

interface AdminCRMProps {
    state: AppState;
    onUpdateUserManual: (email: string, data: Partial<User>) => void;
    onAddUser: (data: User) => void;
    onDeleteUser: (email: string) => void;
    onResetPin: (email: string, pin: string) => void;
    openUserChat: (email: string) => void;
    setHistoryUser: (u: User) => void;
    onImpersonate: (u: User) => void;
}

const AdminCRM: React.FC<AdminCRMProps> = ({ state, onUpdateUserManual, onAddUser, onDeleteUser, onResetPin, openUserChat, setHistoryUser, onImpersonate }) => {
    const [crmSearch, setCrmSearch] = useState('');
    const [crmFilter, setCrmFilter] = useState<Role | 'ALL' | 'ACTIVE'>('ALL');
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [isAddingUser, setIsAddingUser] = useState(false);
    const [newUserForm, setNewUserForm] = useState<Partial<User>>({ full_name: '', email: '', instagram: '', phone_number: '', pin: '', role: 'client' });

    const filteredUsers = useMemo(() => {
        return state.users.filter(u => {
            if (crmFilter === 'client' && u.role !== 'client') return false;
            if (crmFilter === 'admin' && u.role !== 'admin') return false;
            if (crmFilter === 'ACTIVE') {
                // Note: Needs logic for active clients (tickets for current event). 
                // We need activePurchaseGroups prop or similar if we want exact parity.
                // For now, let's skip the PurchaseGroup check or pass it as prop if needed.
                // Assuming 'ACTIVE' might need external data. 
                // Simplified:
                return true;
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
    }, [state.users, crmFilter, crmSearch]);

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

    const handleRegisterNewUser = () => {
        // Validation logic
        if (!newUserForm.email || !newUserForm.full_name || !newUserForm.pin) return alert("Faltan datos obligatorios");

        onAddUser({
            email: newUserForm.email,
            full_name: newUserForm.full_name,
            instagram: newUserForm.instagram || '',
            phone_number: newUserForm.phone_number,
            pin: newUserForm.pin,
            role: (newUserForm.role as Role) || 'client',
            balance: 0,
            stars: 1,
            courtesy_progress: 0,
            lifetime_tickets: 0
        });
        setIsAddingUser(false);
        setNewUserForm({ full_name: '', email: '', instagram: '', phone_number: '', pin: '', role: 'client' });
    };

    return (
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
                        <div className="mt-2">
                            <button
                                className="w-full py-2 rounded-xl bg-amber-500/10 text-amber-500 text-[9px] font-black uppercase tracking-widest border border-amber-500/20 hover:bg-amber-500 hover:text-white transition-all"
                                onClick={() => onImpersonate(u)}
                            >
                                <i className="fas fa-eye mr-2"></i> Ver Como
                            </button>
                        </div>
                    </div>
                ))}
            </div>

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
        </div>
    );
};

export default AdminCRM;
