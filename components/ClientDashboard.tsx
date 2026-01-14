import React, { useState, useMemo } from 'react';
import { AppState, User, TicketItem, PurchaseGroup } from '../types';
import { extractUrl, formatCurrency, formatPhoneNumber } from '../logic';
import { useClientView } from '../src/hooks/useClientView';

interface ClientDashboardProps {
   state: AppState;
   onLogout: () => void;
   onAddToBag: (qty: number, seller: string) => void;
   onSendMessage: (txt: string) => void;
   onAction: (gid: string, tid: string | null, act: string, reserveAmount?: number) => void;
   onUpdateProfile: (upd: Partial<User>) => void;
}

const ClientDashboard: React.FC<ClientDashboardProps> = ({ state, onLogout, onAddToBag, onSendMessage, onAction, onUpdateProfile }) => {
   const user = state.users.find(u => u.email === state.currentUser?.email)!;
   const [qty, setQty] = useState(1);
   const [seller, setSeller] = useState('');
   const [clientTab, setClientTab] = useState<'bag' | 'tickets' | 'promoter'>('bag');
   const [msg, setMsg] = useState('');
   const [isChatMaximized, setIsChatMaximized] = useState(false);

   const { isReadOnly } = useClientView(state);

   const [abonoModal, setAbonoModal] = useState<{ open: boolean; gid: string; tid: string | null; min: number; max: number }>({ open: false, gid: '', tid: null, min: 0, max: 0 });
   const [abonoValue, setAbonoValue] = useState('');
   const [profileModal, setProfileModal] = useState(false);
   const [editData, setEditData] = useState({ full_name: user.full_name, instagram: user.instagram, phone_number: user.phone_number || '', pin: user.pin });

   const currentGroups = state.purchaseGroups.filter(g => g.user_email === user.email && g.event_id === state.config.event_internal_id);
   const myChat = state.conversations.find(c => c.client_email === user.email);

   const bagTickets = useMemo(() => {
      return currentGroups.flatMap(g => g.items.map(item => ({ ...item, seller_email: g.seller_email })))
         .filter(t => t.status === 'pending');
   }, [currentGroups]);

   const activeTickets = useMemo(() => {
      return currentGroups.flatMap(g => g.items.map(item => ({ ...item, seller_email: g.seller_email })))
         .filter(t => t.status !== 'pending');
   }, [currentGroups]);

   const pendingApprovalSum = useMemo(() => {
      return currentGroups.flatMap(g => g.items).reduce((acc, i) => acc + (i.status === 'waiting_approval' ? (i.pending_payment || 0) : 0), 0);
   }, [currentGroups]);

   // Promoter Logic
   const promoterStats = useMemo(() => {
      if (!user.is_promoter) return null;
      const mySalesGroups = state.purchaseGroups.filter(g => g.seller_email === user.email && g.event_id === state.config.event_internal_id);
      const confirmedTickets = mySalesGroups.flatMap(g => g.items).filter(t => t.status === 'paid' && !t.is_courtesy);
      const totalRevenue = confirmedTickets.reduce((acc, t) => acc + t.paid_amount, 0);
      return {
         totalSold: confirmedTickets.length,
         revenue: totalRevenue,
         recentSales: mySalesGroups.map(g => ({
            date: g.created_at,
            buyer: state.users.find(u => u.email === g.user_email)?.full_name || g.user_email,
            count: g.items.filter(t => t.status === 'paid').length
         })).filter(s => s.count > 0).sort((a, b) => b.date - a.date)
      };
   }, [state.purchaseGroups, user]);

   const savings = state.config.reference_price - state.config.final_price;
   const progressToCourtesy = (user.is_promoter ? (user.referral_count || 0) : (user.courtesy_progress || 0)) % 10;

   const handleCopyBankDetails = (amount?: number) => {
      const total = amount || pendingApprovalSum;
      const details = `HSU EXPERIENCE - DATOS DE PAGO\n----------------------------\nBanco: Global Bank\nTipo: Corriente\nCuenta: 123-45678-01\nRUT: 12.345.678-9\nCorreo: pagos@hsu.com\nMonto: ${formatCurrency(total)}\n----------------------------\nEnvía comprobante al chat.`;
      navigator.clipboard.writeText(details);
      // Alert removed as requested
   };

   const handleFullPay = (gid: string, tid: string | null, amount: number) => {
      onAction(gid, tid, 'pay');
      handleCopyBankDetails(amount);
   };

   const confirmAbono = () => {
      const val = parseFloat(abonoValue);
      if (isNaN(val) || val < 10000) return alert(`Mínimo de abono: $10.000`);
      if (val % 1000 !== 0) return alert("Los abonos deben ser en unidades de mil (ej: 11.000, 15.000).");
      if (val > abonoModal.max) return alert(`El monto excede la deuda actual (${formatCurrency(abonoModal.max)}).`);

      if (abonoModal.gid === 'BATCH') {
         const perTicketAbono = val / bagTickets.length;
         bagTickets.forEach(t => onAction(t.group_id, t.id, 'reserve', perTicketAbono));
      } else {
         onAction(abonoModal.gid, abonoModal.tid, 'reserve', val);
      }
      setAbonoModal({ open: false, gid: '', tid: null, min: 0, max: 0 });
      setAbonoValue('');
      handleCopyBankDetails(val);
   };

   return (
      <div className="min-h-screen text-slate-200 pb-32">
         {/* Navbar Glass */}
         <header className="sticky top-4 mx-4 z-40 glass-panel rounded-2xl p-4 flex justify-between items-center mb-6">
            <div className="flex items-center gap-4">
               <div className="w-10 h-10 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(0,243,255,0.2)]">
                  <i className="fas fa-cube text-sm"></i>
               </div>
               <h2 className="text-lg font-syncopate font-bold text-white tracking-widest hidden sm:block">HARDER STYLES UNITED <span className="text-cyan-400 text-sm">CLIENTE</span></h2>
            </div>
            <div className="flex gap-3">
               {!isReadOnly && (
                  <button onClick={() => setProfileModal(true)} className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all">
                     <i className="fas fa-cog text-slate-300"></i>
                  </button>
               )}
               <button onClick={() => setIsChatMaximized(!isChatMaximized)} className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all relative">
                  <i className="fas fa-comment-dots text-slate-300"></i>
                  {myChat && myChat.messages.length > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-pink-500 rounded-full shadow-[0_0_10px_#ec4899]"></span>}
               </button>
               <button onClick={onLogout} className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl border border-red-500/20 text-[10px] font-black uppercase tracking-widest transition-all">Salir</button>
            </div>
         </header>

         <main className="max-w-2xl mx-auto px-4 space-y-6">

            {/* Holographic ID Card */}
            <div className="glass-panel p-8 rounded-[2rem] relative overflow-hidden group">
               <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-purple-500/10 opacity-50"></div>
               <div className="absolute -right-10 -top-10 w-40 h-40 bg-cyan-500/20 blur-[50px] rounded-full"></div>

               <div className="relative z-10 flex flex-col sm:flex-row gap-6 items-center sm:items-start text-center sm:text-left">
                  <div className="relative">
                     <div className="w-20 h-20 rounded-full p-1 bg-gradient-to-br from-cyan-400 to-purple-500">
                        <img src={`https://api.dicebear.com/7.x/identicon/svg?seed=${user.email}`} className="w-full h-full rounded-full bg-black" />
                     </div>
                     <div className="absolute -bottom-2 -right-2 bg-black border border-slate-700 px-2 py-0.5 rounded-md text-[8px] font-bold text-white uppercase tracking-widest">
                        LVL {user.stars}
                     </div>
                  </div>

                  <div className="flex-1 space-y-2">
                     <h3 className="font-syncopate font-bold text-2xl text-white uppercase">{user.full_name}</h3>
                     <p className="text-xs font-bold text-cyan-400 tracking-widest">@{user.instagram}</p>
                     <p className="text-[10px] text-slate-400 font-mono tracking-tighter">+{user.phone_number?.replace('+', '')}</p>
                     <div className="flex flex-wrap justify-center sm:justify-start gap-2">
                        <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] font-bold text-cyan-400 uppercase tracking-widest">
                           <i className="fas fa-star mr-1 text-[8px]"></i> Miembro
                        </span>
                        {user.is_promoter && (
                           <span className="px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 text-[9px] font-bold text-purple-400 uppercase tracking-widest shadow-[0_0_10px_rgba(168,85,247,0.3)]">
                              <i className="fas fa-bolt mr-1 text-[8px]"></i> Promotor
                           </span>
                        )}
                     </div>
                  </div>
               </div>

               {/* Purchase Counter for Regular Client / Promoter */}
               <div className="mt-8 relative z-10 p-4 bg-black/40 rounded-2xl border border-white/5">
                  <div className="flex justify-between items-end mb-2">
                     <span className="text-[9px] font-bold text-cyan-400 uppercase tracking-widest">
                        {user.is_promoter ? 'Progreso Referidos (Cortesía)' : 'Progreso 10 Entradas (Cortesía)'}
                     </span>
                     <span className="text-[9px] font-bold text-white">{progressToCourtesy}/10</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                     <div
                        className={`h-full bg-gradient-to-r ${user.is_promoter ? 'from-purple-600 to-pink-600 shadow-[0_0_10px_rgba(168,85,247,0.5)]' : 'from-cyan-500 to-blue-500 shadow-[0_0_10px_rgba(34,211,238,0.5)]'}`}
                        style={{ width: `${progressToCourtesy * 10}%` }}
                     ></div>
                  </div>
               </div>
            </div>

            {/* Purchase Action Panel */}
            <div className="glass-panel p-6 rounded-[2rem] space-y-6">
               {/* Pricing Display */}
               <div className="flex justify-between items-center border-b border-white/5 pb-4">
                  <div className="flex flex-col">
                     <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest line-through">Precio Ref. {formatCurrency(state.config.reference_price)}</span>
                     <div className="flex items-center gap-2">
                        <span className="text-3xl font-mono font-bold text-white neon-text-blue">{formatCurrency(state.config.final_price * qty)}</span>
                        {savings > 0 && (
                           <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[8px] font-black uppercase">
                              DESC. {formatCurrency(savings * qty)}
                           </span>
                        )}
                     </div>
                  </div>
                  <div className="text-right">
                     <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Cantidad</span>
                     <div className="flex items-center bg-black/40 rounded-xl border border-white/10 p-1">
                        <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-8 h-8 rounded-lg hover:bg-white/5 text-cyan-400 text-lg transition-colors">-</button>
                        <span className="w-8 text-center font-mono font-bold text-white">{qty}</span>
                        <button onClick={() => setQty(qty + 1)} className="w-8 h-8 rounded-lg hover:bg-white/5 text-cyan-400 text-lg transition-colors">+</button>
                     </div>
                  </div>
               </div>

               <div className="flex flex-col gap-2">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1">Código de Promotor (Opcional)</label>
                  <input
                     className="input-neon w-full p-4 rounded-xl text-xs font-bold text-slate-300 uppercase"
                     placeholder="Nombre del Promotor"
                     value={seller}
                     onChange={e => setSeller(e.target.value)}
                  />
               </div>

               <button disabled={isReadOnly} onClick={() => onAddToBag(qty, seller)} className={`neon-button w-full bg-gradient-to-r from-cyan-600 to-blue-600 text-white p-4 rounded-xl font-black uppercase text-xs tracking-[0.3em] shadow-lg shadow-cyan-900/20 ${isReadOnly ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}>
                  {isReadOnly ? 'Modo Vista (Compra Deshabilitada)' : <> <i className="fas fa-cart-plus mr-2"></i> Adquirir Entradas </>}
               </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 p-1 bg-black/40 rounded-2xl border border-white/5 overflow-x-auto">
               <button onClick={() => setClientTab('bag')} className={`flex-1 min-w-[100px] py-3 rounded-xl font-bold uppercase text-[9px] tracking-[0.2em] transition-all ${clientTab === 'bag' ? 'bg-white/10 text-white shadow-inner' : 'text-slate-500 hover:text-slate-300'}`}>
                  Mi Bolsa <span className="ml-1 text-cyan-400">({bagTickets.length})</span>
               </button>
               <button onClick={() => setClientTab('tickets')} className={`flex-1 min-w-[100px] py-3 rounded-xl font-bold uppercase text-[9px] tracking-[0.2em] transition-all ${clientTab === 'tickets' ? 'bg-white/10 text-white shadow-inner' : 'text-slate-500 hover:text-slate-300'}`}>
                  Mis Entradas <span className="ml-1 text-purple-400">({activeTickets.length})</span>
               </button>
               {user.is_promoter && (
                  <button onClick={() => setClientTab('promoter')} className={`flex-1 min-w-[100px] py-3 rounded-xl font-bold uppercase text-[9px] tracking-[0.2em] transition-all ${clientTab === 'promoter' ? 'bg-purple-500/20 text-white shadow-inner border border-purple-500/30' : 'text-slate-500 hover:text-slate-300'}`}>
                     Promotor
                  </button>
               )}
            </div>

            {/* Ticket List */}
            <div className="space-y-4 animate-enter">
               {clientTab === 'bag' ? (
                  bagTickets.length > 0 ? bagTickets.map((ticket, idx) => (
                     <div key={ticket.id} className="bg-white/5 border border-white/5 hover:border-cyan-500/30 p-5 rounded-2xl flex justify-between items-center transition-all group">
                        <div>
                           <div className="flex items-center gap-2 mb-1">
                              <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
                              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">PAGO PENDIENTE</p>
                           </div>
                           <p className="text-xl font-mono font-bold text-white">{formatCurrency(ticket.price)}</p>
                        </div>
                        <div className="flex gap-2">
                           <button disabled={isReadOnly} onClick={() => handleFullPay(ticket.group_id, ticket.id, ticket.price)} className={`px-4 py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-[9px] font-black uppercase hover:bg-emerald-500/30 transition-all ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}>Pagar Todo</button>
                           <button disabled={isReadOnly} onClick={() => setAbonoModal({ open: true, gid: ticket.group_id, tid: ticket.id, min: 10000, max: ticket.price - ticket.paid_amount })} className={`px-4 py-2 bg-amber-500/20 text-amber-500 border border-amber-500/30 rounded-lg text-[9px] font-black uppercase hover:bg-amber-500/30 transition-all ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}>Abonar</button>
                           <button disabled={isReadOnly} onClick={() => onAction(ticket.group_id, ticket.id, 'delete')} className={`px-3 bg-red-500/10 text-red-500 rounded-lg border border-red-500/20 hover:bg-red-500/20 transition-all ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}><i className="fas fa-trash"></i></button>
                        </div>
                     </div>
                  )) : <div className="text-center py-10 text-slate-600 text-xs font-mono uppercase text-sm">Bolsa Vacía</div>
               ) : clientTab === 'tickets' ? (
                  activeTickets.length > 0 ? activeTickets.map((ticket, idx) => (
                     <div key={ticket.id} className={`glass-panel p-6 rounded-[2rem] border transition-all hover:scale-[1.01] relative overflow-hidden ${ticket.is_courtesy ? 'border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.2)] bg-gradient-to-br from-amber-500/10 to-transparent' : 'border-white/5'}`}>
                        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-white/5 to-transparent -mr-10 -mt-10 rounded-full blur-2xl"></div>
                        <div className="flex justify-between items-start relative z-10">
                           <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                 {ticket.is_courtesy ? <i className="fas fa-star text-amber-500 text-xs animate-pulse"></i> : <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">ID: {ticket.id}</p>}
                              </div>
                              <h4 className={`text-xl font-bold font-syncopate uppercase ${ticket.is_courtesy ? 'text-amber-500 neon-text-purple' : 'text-white'}`}>
                                 {ticket.is_courtesy ? 'Cortesía Harder Styles United' :
                                    (ticket.assigned_link ? (
                                       state.inventory.find(i => i.correlativeId === ticket.internal_correlative && i.eventId === ticket.event_id)?.name || `ENTRADA #${ticket.internal_correlative}`
                                    ) : (ticket.price === 0 ? 'CORTESÍA VIP' : 'ENTRADA GENERAL'))
                                 }
                              </h4>
                              <span className={`inline-block px-3 py-1 rounded-md text-[8px] font-black uppercase tracking-widest border ${ticket.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : (ticket.status === 'reserved' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-orange-500/10 text-orange-400 border-orange-500/20')}`}>
                                 {ticket.status === 'waiting_approval' ? 'PENDIENTE (VALIDANDO)' :
                                    (ticket.status === 'paid' ? 'PAGADO Y LIBERADO' :
                                       (ticket.assigned_link ? 'ASIGNADA (PAGANDO)' : 'RESERVADO / PENDIENTE ASIGNACIÓN'))}
                              </span>
                              {(ticket.paid_amount < ticket.price && !ticket.is_courtesy) && (
                                 <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest bg-black/20 p-2 rounded-lg border border-white/5 inline-block">
                                    Pagado: <span className="text-emerald-400">{formatCurrency(ticket.paid_amount)}</span> / <span className="text-white">{formatCurrency(ticket.price)}</span> (Faltan: <span className="text-red-400">{formatCurrency(ticket.price - ticket.paid_amount)}</span>)
                                 </div>
                              )}
                           </div>

                           <div className="flex flex-col gap-2">
                              {ticket.assigned_link && (
                                 <>
                                    {/* Download/QR & WhatsApp Buttons - Only if Unlocked OR Paid 100% */}
                                    {((ticket.paid_amount >= ticket.price && ticket.price > 0) || ticket.is_unlocked || ticket.is_courtesy) ? (
                                       <div className="flex flex-col gap-2">
                                          <a href={ticket.assigned_link} target="_blank" className="bg-cyan-500 text-black px-4 py-3 rounded-xl shadow-[0_0_15px_rgba(0,243,255,0.4)] hover:scale-105 transition-all flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest" title="Descargar Entrada">
                                             <i className="fas fa-download"></i>
                                             <span>Descargar Ticket</span>
                                          </a>
                                          <a href={`https://wa.me/?text=${encodeURIComponent(`Hola, aquí está mi entrada para ${state.config.event_title}: ${ticket.assigned_link}`)}`} target="_blank" className="w-full bg-emerald-500/20 text-emerald-500 py-2 rounded-xl border border-emerald-500/30 flex items-center justify-center gap-2 text-[8px] font-bold uppercase transition-all" title="Compartir por WhatsApp">
                                             <i className="fab fa-whatsapp"></i> Compartir
                                          </a>
                                       </div>
                                    ) : (
                                       <div className="w-10 h-10 bg-slate-700 text-black flex items-center justify-center rounded-xl opacity-50 grayscale cursor-not-allowed" title="Descarga Bloqueada"><i className="fas fa-lock text-slate-500"></i></div>
                                    )}
                                 </>
                              )}
                           </div>
                           {(ticket.paid_amount < ticket.price && ticket.status !== 'waiting_approval' && !ticket.is_courtesy) && (
                              <div className="flex gap-2">
                                 <button onClick={() => setAbonoModal({ open: true, gid: ticket.group_id, tid: ticket.id, min: 10000, max: ticket.price - ticket.paid_amount })} className="h-10 px-4 bg-amber-500 text-black rounded-xl text-[9px] font-black uppercase shadow-lg shadow-amber-500/20 hover:scale-105 transition-all">Abonar / Pagar</button>
                              </div>
                           )}
                        </div>
                     </div>
                  )) : <div className="text-center py-10 text-slate-600 text-xs font-mono uppercase text-sm">No has adquirido entradas</div>
               ) : (
                  // PROMOTER TAB
                  <div className="space-y-6">
                     <div className="glass-panel p-6 rounded-[2rem] bg-gradient-to-br from-purple-900/10 to-transparent border-purple-500/20">
                        <h3 className="text-xl font-syncopate font-bold text-white uppercase mb-4">Estadísticas Promotor</h3>
                        <div className="grid grid-cols-2 gap-4">
                           <div className="p-4 bg-black/40 rounded-xl border border-white/5">
                              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Total Ventas</p>
                              <p className="text-2xl font-mono font-bold text-purple-400">{promoterStats?.totalSold || 0}</p>
                           </div>
                           <div className="p-4 bg-black/40 rounded-xl border border-white/5">
                              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Progreso Cortesía</p>
                              <p className="text-2xl font-mono font-bold text-white">{promoterStats?.totalSold || 0}/10</p>
                           </div>
                        </div>
                     </div>

                     <div className="glass-panel p-6 rounded-[2rem]">
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Referidos Recientes</h4>
                        <div className="space-y-2">
                           {promoterStats?.recentSales.map((s, i) => (
                              <div key={i} className="flex justify-between items-center p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                                 <div>
                                    <p className="text-xs font-bold text-white uppercase">{s.buyer}</p>
                                    <p className="text-[8px] text-slate-500">{new Date(s.date).toLocaleDateString()}</p>
                                 </div>
                                 <div className="text-right">
                                    <span className="text-purple-400 font-bold text-sm">+{s.count} Entradas</span>
                                 </div>
                              </div>
                           ))}
                           {(!promoterStats?.recentSales || promoterStats.recentSales.length === 0) && (
                              <div className="text-center py-4 text-slate-600 text-xs text-sm">Sin actividad reciente</div>
                           )}
                        </div>
                     </div>
                  </div>
               )}
            </div>
         </main>

         {/* Floating Status Bar */}
         {pendingApprovalSum > 0 && (
            <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-center px-4 animate-enter pointer-events-none">
               <button onClick={() => handleCopyBankDetails()} className="w-full max-w-md glass-panel bg-black/80 backdrop-blur-2xl p-4 rounded-2xl border border-cyan-500/40 shadow-[0_0_30px_rgba(0,243,255,0.15)] flex items-center justify-between pointer-events-auto hover:scale-[1.02] transition-transform">
                  <div className="flex items-center gap-4">
                     <div className="w-10 h-10 rounded-full bg-cyan-500 flex items-center justify-center text-black text-lg animate-pulse"><i className="fas fa-wallet"></i></div>
                     <div className="text-left">
                        <p className="text-[9px] font-bold text-cyan-400 uppercase tracking-widest">Validación de Pago</p>
                        <p className="text-xl font-mono font-bold text-white">${pendingApprovalSum.toFixed(0)}</p>
                     </div>
                  </div>
                  <div className="px-4 py-2 bg-white/5 rounded-lg border border-white/10">
                     <span className="text-[8px] font-black uppercase text-white tracking-widest">Ver Datos</span>
                  </div>
               </button>
            </div>
         )}

         {/* Modals - Simplified for brevity but styled consistent */}
         {profileModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl animate-enter">
               <div className="bg-slate-900 w-full max-w-md rounded-3xl p-8 border border-white/10 shadow-2xl space-y-6">
                  <h5 className="text-xl font-syncopate font-bold text-white uppercase">Datos de Perfil</h5>
                  <div className="space-y-4">
                     <div className="space-y-1">
                        <label className="text-[8px] font-bold text-slate-500 uppercase ml-2">Nombre Completo</label>
                        <input className="input-neon w-full p-4 rounded-xl text-sm" value={editData.full_name} onChange={e => setEditData({ ...editData, full_name: e.target.value })} placeholder="Nombre Completo" />
                     </div>
                     <div className="space-y-1">
                        <label className="text-[8px] font-bold text-slate-500 uppercase ml-2">Instagram (sin @)</label>
                        <div className="relative">
                           <span className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-400 font-bold">@</span>
                           <input className="input-neon w-full p-4 pl-8 rounded-xl text-sm" value={editData.instagram} onChange={e => setEditData({ ...editData, instagram: e.target.value.replace('@', '') })} placeholder="Instagram" />
                        </div>
                     </div>
                     <div className="space-y-1">
                        <label className="text-[8px] font-bold text-slate-500 uppercase ml-2">Teléfono</label>
                        <input className="input-neon w-full p-4 rounded-xl text-sm" value={editData.phone_number} onChange={e => setEditData({ ...editData, phone_number: e.target.value })} placeholder="Teléfono" />
                     </div>
                     <div className="space-y-1">
                        <label className="text-[8px] font-bold text-slate-500 uppercase ml-2">Pin de Acceso / Seguridad</label>
                        <input className="input-neon w-full p-4 rounded-xl text-sm font-mono" value={editData.pin} onChange={e => setEditData({ ...editData, pin: e.target.value })} placeholder="Nuevo PIN" />
                     </div>
                  </div>
                  <div className="flex gap-4">
                     <button onClick={() => setProfileModal(false)} className="flex-1 py-4 rounded-xl text-xs font-bold text-slate-500 uppercase hover:text-white transition-colors">Cancelar</button>
                     <button onClick={() => { onUpdateProfile(editData); setProfileModal(false); }} className="flex-1 bg-cyan-600 text-white py-4 rounded-xl text-xs font-black uppercase shadow-lg shadow-cyan-900/40">Actualizar</button>
                  </div>
               </div>
            </div>
         )}

         {abonoModal.open && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl animate-enter">
               <div className="bg-slate-900 w-full max-w-sm rounded-3xl p-8 border border-amber-500/30 shadow-[0_0_50px_rgba(245,158,11,0.1)]">
                  <h5 className="text-xl font-syncopate font-bold text-amber-500 uppercase mb-6 text-center">Abonar</h5>
                  <input autoFocus type="number" step="1000" min="10000" max={abonoModal.min} className="input-neon w-full p-6 rounded-2xl text-center text-4xl font-mono font-bold text-white mb-2 border-amber-500/50 focus:border-amber-500" value={abonoValue} onChange={e => setAbonoValue(e.target.value)} placeholder={formatCurrency(abonoModal.min)} />
                  <p className="text-[10px] text-center text-slate-500 font-bold uppercase tracking-widest mb-6">Mínimo: $10.000 | Incrementos: $1.000</p>
                  <div className="flex gap-4">
                     <button onClick={() => { setAbonoModal({ open: false, gid: '', tid: null, min: 0 }); setAbonoValue(''); }} className="flex-1 py-4 rounded-xl text-xs font-bold text-slate-500 uppercase hover:text-white">Cancelar</button>
                     <button onClick={confirmAbono} className="flex-1 bg-amber-500 text-black py-4 rounded-xl text-xs font-black uppercase shadow-lg hover:bg-amber-400">Confirmar</button>
                  </div>
               </div>
            </div>
         )}

         {/* Chat UI */}
         {isChatMaximized && (
            <div className="fixed inset-0 z-[110] bg-black flex flex-col animate-enter">
               <header className="p-6 bg-slate-900/80 backdrop-blur-md border-b border-white/10 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 rounded-full bg-cyan-600 flex items-center justify-center shadow-[0_0_15px_rgba(8,145,178,0.5)]"><i className="fas fa-headset text-white"></i></div>
                     <h4 className="font-syncopate font-bold text-sm text-white uppercase tracking-widest">Soporte Técnico</h4>
                  </div>
                  <button onClick={() => setIsChatMaximized(false)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"><i className="fas fa-times text-slate-300"></i></button>
               </header>
               <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gradient-to-b from-slate-950 to-black">
                  {myChat?.messages.map((m, i) => (
                     <div key={i} className={`flex ${m.sender === user.email ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] p-4 rounded-2xl text-xs font-medium leading-relaxed ${m.sender === user.email ? 'bg-cyan-600/20 border border-cyan-500/30 text-cyan-100 rounded-tr-sm' : 'bg-slate-800/50 border border-slate-700 text-slate-300 rounded-tl-sm'}`}>
                           {m.text}
                        </div>
                     </div>
                  ))}
               </div>
               <div className="p-6 bg-slate-900 border-t border-white/10 flex gap-3 pb-10">
                  <input
                     className="flex-1 input-neon p-4 rounded-xl text-xs"
                     placeholder="Escribe un mensaje..."
                     value={msg}
                     onChange={e => setMsg(e.target.value)}
                     onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey && msg.trim()) {
                           onSendMessage(msg.trim());
                           setMsg('');
                        }
                     }}
                  />
                  <button onClick={() => { if (msg.trim()) { onSendMessage(msg.trim()); setMsg(''); } }} className="bg-cyan-600 w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg"><i className="fas fa-arrow-up"></i></button>
               </div>
            </div>
         )}
      </div>
   );
};

export default ClientDashboard;