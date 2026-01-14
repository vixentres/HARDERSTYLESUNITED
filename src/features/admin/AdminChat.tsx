import React, { useState } from 'react';
import { AppState } from '../../../types';

interface AdminChatProps {
    state: AppState;
    selectedChatEmail: string | null;
    setSelectedChatEmail: (email: string | null) => void;
    onSendMessage: (cEmail: string, sEmail: string, txt: string) => void;
}

const AdminChat: React.FC<AdminChatProps> = ({ state, selectedChatEmail, setSelectedChatEmail, onSendMessage }) => {
    const [chatSearch, setChatSearch] = useState('');
    const [adminMsg, setAdminMsg] = useState('');

    const currentChat = state.conversations.find(c => c.client_email === selectedChatEmail);

    const handleSendAdminMessage = () => {
        if (selectedChatEmail && adminMsg.trim()) {
            onSendMessage(selectedChatEmail, state.currentUser?.email || 'admin', adminMsg);
            setAdminMsg('');
        }
    };

    return (
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
    );
};

export default AdminChat;
