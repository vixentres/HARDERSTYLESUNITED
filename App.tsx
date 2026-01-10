import React, { useState, useEffect } from 'react';
import { AppState, User, PurchaseGroup, SystemConfig, InventoryItem, TicketItem, LogType, ActivityLog } from './types';
import LandingPage from './components/LandingPage';
import ClientDashboard from './components/ClientDashboard';
import AdminPanel from './components/AdminPanel';
import { generateMockData } from './mockData';
import { processAction, generateCourtesyTicket, formatPhoneNumber, formatCurrency, mapUserDBToApp, mapInventoryDBToApp, mapGroupDBToApp, mapTicketDBToApp, mapUserAppToDB, mapGroupAppToDB, mapTicketAppToDB, mapInventoryAppToDB } from './logic';
import { supabase } from './src/lib/supabaseClient';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(() => generateMockData());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: invData } = await supabase.from('inventory').select('*');
        const inventory = (invData || []).map(mapInventoryDBToApp);

        setState(prev => ({
          ...prev,
          inventory,
          users: [],
          purchaseGroups: []
        }));
      } catch (err) {
        console.error('Error fetching public data from Supabase:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const addLog = async (action: string, type: LogType, details?: string) => {
    const newLog: ActivityLog = {
      timestamp: Date.now(),
      action,
      user_email: state.currentUser?.email || 'SYSTEM',
      user_full_name: state.currentUser?.full_name || 'System',
      type,
      event_id: state.config.event_internal_id,
      details
    };

    await supabase.from('activity_logs').insert([{
      action,
      user_email: state.currentUser?.email || 'SYSTEM',
      user_full_name: state.currentUser?.full_name || 'System',
      type,
      event_id: state.config.event_internal_id,
      details
    }]);

    setState(prev => ({ ...prev, logs: [newLog, ...prev.logs].slice(0, 1000) }));
  };

  const handleLogin = async (id: string, pass?: string) => {
    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('email', id)
        .single();

      if (userError || !userData) return null;
      if (pass !== undefined && userData.pin !== pass) return null;

      const user = mapUserDBToApp(userData);

      if (pass !== undefined) {
        setLoading(true);
        let users: User[] = [user];
        let groups: PurchaseGroup[] = [];

        if (user.role === 'admin' || user.role === 'staff') {
          const [{ data: allUsers }, { data: allGroups }, { data: allTickets }] = await Promise.all([
            supabase.from('users').select('*'),
            supabase.from('purchase_groups').select('*'),
            supabase.from('tickets').select('*')
          ]);

          users = (allUsers || []).map(mapUserDBToApp);
          groups = (allGroups || []).map(g => {
            const items = (allTickets || []).filter(t => t.group_id === g.id).map(mapTicketDBToApp);
            return mapGroupDBToApp(g, items);
          });
        } else {
          const { data: myData, error: joinError } = await supabase
            .from('tickets')
            .select('*, purchase_groups!inner(*)')
            .eq('purchase_groups.user_email', user.email);

          if (joinError) console.error("Error in relational fetch:", joinError);

          if (myData && myData.length > 0) {
            const ticketMap: Record<string, any[]> = {};
            const groupDataMap: Record<string, any> = {};

            myData.forEach((row: any) => {
              const ticket = row;
              const group = row.purchase_groups;
              if (!ticketMap[group.id]) {
                ticketMap[group.id] = [];
                groupDataMap[group.id] = group;
              }
              ticketMap[group.id].push(mapTicketDBToApp(ticket));
            });

            groups = Object.keys(groupDataMap).map(gid => mapGroupDBToApp(groupDataMap[gid], ticketMap[gid]));
          } else {
            const { data: emptyGroups } = await supabase.from('purchase_groups').select('*').eq('user_email', user.email);
            if (emptyGroups) groups = emptyGroups.map(g => mapGroupDBToApp(g, []));
          }
        }

        setState(prev => ({ ...prev, currentUser: user, users, purchaseGroups: groups }));
        addLog(`Login: ${user.full_name}`, 'LOGIN');
        setLoading(false);
      }
      return user;
    } catch (err) {
      console.error('Error in handleLogin:', err);
      setLoading(false);
      return null;
    }
  };

  const handleRegister = async (data: any) => {
    const cleanPhone = formatPhoneNumber(data.phone_number || '');
    const newUser: User = { ...data, phone_number: cleanPhone, balance: 0, stars: 1, courtesy_progress: 0, lifetime_tickets: 0, role: 'client', is_promoter: false, referral_count: 0 };

    const dbUser = mapUserAppToDB(newUser);
    const { error } = await supabase.from('users').insert([{ ...dbUser, email: newUser.email }]);

    if (error) {
      alert(`Error al registrar usuario: ${error.message}`);
      return null;
    }

    setState(prev => ({ ...prev, users: [...prev.users, newUser], currentUser: newUser }));
    addLog(`Registro: ${newUser.full_name}`, 'LOGIN');
    return newUser;
  };

  const handleLogout = () => {
    addLog(`Logout: ${state.currentUser?.full_name}`, 'LOGIN');
    setState(prev => ({ ...prev, currentUser: null }));
  };

  const handleAddToBag = async (qty: number, sellerCode: string) => {
    if (!state.currentUser) return;

    let finalSellerEmail = '';
    if (sellerCode.trim()) {
      const sellerUser = state.users.find(u =>
        u.full_name.toLowerCase() === sellerCode.trim().toLowerCase() &&
        (u.is_promoter || u.role === 'admin' || u.role === 'staff')
      );
      if (!sellerUser) {
        alert("Código de promotor (Nombre) no encontrado en la base de datos.");
        return;
      }
      if (sellerUser.email === state.currentUser?.email) {
        const isPromoter = state.currentUser?.role === 'promoter' || state.currentUser?.is_promoter;
        if (isPromoter) {
          alert(`Bloqueo de Autoventa: No puedes utilizar tu propio código ("${sellerCode}") para realizar compras personales.`);
          return;
        }
      }
      finalSellerEmail = sellerUser.email;
    }

    const groupId = `G-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    const newItems: TicketItem[] = Array.from({ length: qty }).map((_, i) => ({
      id: `T-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      group_id: groupId,
      status: 'pending',
      price: state.config.final_price,
      paid_amount: 0,
      cost: 0,
      event_name: state.config.event_title,
      event_id: state.config.event_internal_id,
      updated_at: Date.now()
    }));
    const newGroup: PurchaseGroup = {
      id: groupId,
      user_email: state.currentUser.email,
      seller_email: finalSellerEmail,
      items: newItems,
      total_amount: state.config.final_price * qty,
      is_full_payment: false,
      created_at: Date.now(),
      status: 'pending',
      event_id: state.config.event_internal_id
    };

    const { error: gError } = await supabase.from('purchase_groups').insert([mapGroupAppToDB(newGroup)]);
    if (gError) return alert(`Error: ${gError.message}`);

    const { error: tError } = await supabase.from('tickets').insert(newItems.map(mapTicketAppToDB));
    if (tError) return alert(`Error: ${tError.message}`);

    setState(prev => ({ ...prev, purchaseGroups: [...prev.purchaseGroups, newGroup] }));
    addLog(`Bolsa: ${qty} tickets (Promotor: ${sellerCode || 'Ninguno'})`, 'BOLSA');
  };

  const handleGrantCourtesy = async (targetEmail: string) => {
    const courtesyGroup = generateCourtesyTicket(targetEmail, state.config);

    const { error: gError } = await supabase.from('purchase_groups').insert([mapGroupAppToDB(courtesyGroup)]);
    if (gError) return alert(gError.message);

    const { error: tError } = await supabase.from('tickets').insert(courtesyGroup.items.map(mapTicketAppToDB));
    if (tError) return alert(tError.message);

    setState(prev => ({
      ...prev,
      purchaseGroups: [...prev.purchaseGroups, courtesyGroup]
    }));
    addLog(`Cortesía otorgada a ${targetEmail}`, 'SISTEMA');
    alert("Cortesía enviada.");
  };

  const handleAction = async (gid: string, tid: string | null, act: string, val?: number) => {
    const updates = processAction(state, gid, tid, act, val);

    const affectedGroup = updates.purchaseGroups.find(g => g.id === gid);
    if (affectedGroup) {
      await supabase.from('purchase_groups').upsert([mapGroupAppToDB(affectedGroup)]);
      await supabase.from('tickets').upsert(affectedGroup.items.map(mapTicketAppToDB));
    }

    const changedInv = updates.inventory.filter((inv, idx) => inv !== state.inventory[idx]);
    if (changedInv.length > 0) {
      await supabase.from('inventory').upsert(changedInv.map(mapInventoryAppToDB));
    }

    const changedUsers = updates.users.filter((u, idx) => u !== state.users[idx]);
    if (changedUsers.length > 0) {
      await supabase.from('users').upsert(changedUsers.map(mapUserAppToDB));
    }

    setState(prev => ({ ...prev, ...updates }));

    if (act === 'approve') addLog(`Aprobación ${gid}`, 'APROBACION');
    if (act === 'revert_payment') addLog(`Reversión ${gid}`, 'REVERSION');
    if (act === 'reject_delete') addLog(`Rechazo/Borrado ${tid || gid}`, 'ANULACION');
    if (act === 'unlock') addLog(`Unlock ${tid}`, 'SISTEMA');
  };

  const handleSendMessage = (cEmail: string, sEmail: string, text: string) => {
    setState(prev => {
      const convIdx = prev.conversations.findIndex(c => c.client_email === cEmail);
      const role = prev.users.find(u => u.email === (prev.currentUser?.email || sEmail))?.role || 'client';
      const newMessage = { sender: prev.currentUser?.email || sEmail, role, text, timestamp: Date.now() };

      if (convIdx === -1) {
        return {
          ...prev,
          conversations: [...prev.conversations, { client_email: cEmail, staff_email: sEmail, messages: [newMessage] }]
        };
      }

      const nextConvs = [...prev.conversations];
      nextConvs[convIdx] = {
        ...nextConvs[convIdx],
        messages: [...nextConvs[convIdx].messages, newMessage]
      };

      return { ...prev, conversations: nextConvs };
    });
  };

  const handleDeleteUser = async (email: string) => {
    if (confirm(`¿Estás seguro de que deseas eliminar permanentemente al usuario ${email}? Esta acción no se puede deshacer.`)) {
      const { error } = await supabase.from('users').delete().eq('email', email);
      if (error) return alert(`Error: ${error.message}`);

      setState(prev => ({ ...prev, users: prev.users.filter(u => u.email !== email) }));
      addLog(`Usuario eliminado: ${email}`, 'SISTEMA');
    }
  };

  const handleDeleteInventoryItem = async (correlativeId: number) => {
    if (confirm(`¿Eliminar la entrada #${correlativeId} del inventario?`)) {
      const { error } = await supabase.from('inventory')
        .delete()
        .eq('correlative_id', correlativeId)
        .eq('event_id', state.config.event_internal_id);

      if (error) return alert(`Error: ${error.message}`);

      setState(prev => ({
        ...prev,
        inventory: prev.inventory.filter(i => i.correlative_id !== correlativeId || i.event_id !== prev.config.event_internal_id)
      }));
      addLog(`Entrada eliminada Stock #${correlativeId}`, 'SISTEMA');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-cyan-500/30">
      {loading ? (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
        </div>
      ) : !state.currentUser ? (
        <LandingPage
          config={state.config}
          onLoginAttempt={handleLogin}
          onRegister={handleRegister}
          onSuccess={(u) => setState(prev => ({ ...prev, currentUser: u }))}
        />
      ) : state.currentUser.role === 'client' ? (
        <ClientDashboard
          state={state}
          onLogout={handleLogout}
          onAddToBag={handleAddToBag}
          onSendMessage={(txt) => handleSendMessage(state.currentUser!.email, 'admin', txt)}
          onAction={handleAction}
          onUpdateProfile={async (upd) => {
            const email = state.currentUser?.email;
            if (!email) return;

            const formattedUpd = { ...upd };
            if (formattedUpd.phone_number) {
              formattedUpd.phone_number = formatPhoneNumber(formattedUpd.phone_number);
            }

            const dbUpd = mapUserAppToDB(formattedUpd);
            const { error } = await supabase.from('users').update(dbUpd).eq('email', email);

            if (error) {
              alert(`Error al actualizar perfil: ${error.message}`);
              return;
            }

            setState(prev => {
              const nextUsers = [...prev.users];
              const uIdx = nextUsers.findIndex(u => u.email === email);
              if (uIdx === -1) return prev;

              nextUsers[uIdx] = { ...nextUsers[uIdx], ...formattedUpd, pending_edits: undefined };
              addLog(`Perfil Actualizado: ${nextUsers[uIdx].email}`, 'EDICION');

              return {
                ...prev,
                users: nextUsers,
                currentUser: { ...nextUsers[uIdx] }
              };
            });
          }}
        />
      ) : (
        <AdminPanel
          state={state}
          onLogout={handleLogout}
          onUpdateConfig={(cfg) => setState(prev => ({ ...prev, config: cfg }))}
          onUpdateInventory={async (inv) => {
            const { error } = await supabase.from('inventory').upsert(inv.map(mapInventoryAppToDB));
            if (error) return alert(error.message);
            setState(prev => ({ ...prev, inventory: inv }));
          }}
          onUpdateUserManual={async (email, data) => {
            const formattedData = { ...data };
            if (formattedData.phone_number) {
              formattedData.phone_number = formatPhoneNumber(formattedData.phone_number);
            }

            const { error } = await supabase.from('users').update(mapUserAppToDB(formattedData)).eq('email', email);
            if (error) return alert(error.message);

            setState(prev => {
              const nextUsers = [...prev.users];
              const uIdx = nextUsers.findIndex(u => u.email === email);
              let nextCurrentUser = prev.currentUser;
              if (uIdx !== -1) {
                nextUsers[uIdx] = { ...nextUsers[uIdx], ...formattedData };
                if (prev.currentUser?.email === email) {
                  nextCurrentUser = { ...nextUsers[uIdx] };
                }
              }
              return { ...prev, users: nextUsers, currentUser: nextCurrentUser };
            });
          }}
          onAction={handleAction}
          onSendMessage={handleSendMessage}
          onAddUser={async (u) => {
            const { error } = await supabase.from('users').insert([mapUserAppToDB(u)]);
            if (error) return alert(error.message);
            setState(prev => ({ ...prev, users: [...prev.users, u] }));
          }}
          onDeleteUser={handleDeleteUser}
          onResetPin={async (email, pin) => {
            const { error } = await supabase.from('users').update({ pin }).eq('email', email);
            if (error) return alert(error.message);
            setState(prev => {
              const nextUsers = [...prev.users];
              const uIdx = nextUsers.findIndex(u => u.email === email);
              if (uIdx !== -1) nextUsers[uIdx].pin = pin;
              return { ...prev, users: nextUsers };
            });
          }}
          onDeleteInventoryItem={handleDeleteInventoryItem}
          onGrantCourtesy={handleGrantCourtesy}
        />
      )}
    </div>
  );
};

export default App;
