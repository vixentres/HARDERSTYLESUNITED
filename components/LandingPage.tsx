import React, { useState, useEffect } from 'react';
import { SystemConfig, User } from '../types';

interface LandingPageProps {
  config: SystemConfig;
  onLoginAttempt: (id: string, pass?: string) => Promise<User | null>;
  onRegister: (data: Omit<User, 'balance' | 'stars' | 'courtesyProgress' | 'lifetimeTickets'>) => Promise<User | null>;
  onSuccess: (user: User) => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ config, onLoginAttempt, onRegister, onSuccess }) => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [identifier, setIdentifier] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [pin, setPin] = useState('');
  const [showRegister, setShowRegister] = useState(false);
  const [regData, setRegData] = useState({ fullName: '', instagram: '', pin: '', phoneNumber: '' });

  useEffect(() => {
    const calculateTime = () => {
      const parts = config.eventDate.split('/');
      if (parts.length !== 3) return;

      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);

      const eventDateObj = new Date(year, month, day);
      const diff = eventDateObj.getTime() - Date.now();

      if (diff > 0) {
        setTimeLeft({
          days: Math.floor(diff / (1000 * 60 * 60 * 24)),
          hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((diff / 1000 / 60) % 60),
          seconds: Math.floor((diff / 1000) % 60),
        });
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    };

    calculateTime();
    const timer = setInterval(calculateTime, 1000);
    return () => clearInterval(timer);
  }, [config.eventDate]);

  const handleCheck = async () => {
    if (!identifier) return;
    setIsSearching(true);
    try {
      const userFound = await onLoginAttempt(identifier);
      setIsSearching(false);
      if (userFound) setShowPin(true);
      else setShowRegister(true);
    } catch (err) {
      setIsSearching(false);
      alert("Error al verificar identidad");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-600/20 blur-[120px] rounded-full animate-float"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-cyan-500/10 blur-[120px] rounded-full animate-float" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="w-full max-w-md glass-panel rounded-3xl p-1 relative z-10 animate-enter">
        <div className="bg-black/40 rounded-[22px] overflow-hidden">

          {/* Header */}
          <div className="p-10 text-center relative border-b border-white/5">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-50"></div>
            <img src={`https://api.dicebear.com/7.x/identicon/svg?seed=${identifier || 'HSU'}`} className="w-24 h-24 mx-auto rounded-full border-2 border-white/10 mb-6 shadow-[0_0_30px_rgba(0,243,255,0.2)]" />
            <h1 className="text-3xl font-syncopate font-bold mb-2 text-white tracking-widest">{config.eventTitle}</h1>
            <p className="text-[10px] font-bold text-cyan-400 uppercase tracking-[0.6em] animate-pulse">Acceso al Sistema v2.0</p>
          </div>

          <div className="p-8 space-y-8">
            {/* Timer */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { val: timeLeft.days, lbl: 'DÍAS' },
                { val: timeLeft.hours, lbl: 'HRS' },
                { val: timeLeft.minutes, lbl: 'MIN' },
                { val: timeLeft.seconds, lbl: 'SEG' }
              ].map((unit, i) => (
                <div key={i} className="bg-white/5 border border-white/5 rounded-xl p-3 text-center backdrop-blur-md">
                  <span className="block text-2xl font-mono font-bold text-white neon-text-purple">{String(unit.val).padStart(2, '0')}</span>
                  <span className="text-[8px] uppercase font-bold text-slate-500 tracking-wider">{unit.lbl}</span>
                </div>
              ))}
            </div>

            {!showPin && !showRegister ? (
              <div className="space-y-5 animate-enter">
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <i className="fas fa-fingerprint text-slate-500 group-focus-within:text-cyan-400 transition-colors"></i>
                  </div>
                  <input
<<<<<<< HEAD
                    placeholder="IDENTIFICADOR / EMAIL"
=======
                    placeholder="CORREO ELECTRÓNICO"
>>>>>>> 52911ce (Configuración inicial con Antigravity y Supabase MCP)
                    className="input-neon w-full py-4 pl-12 pr-4 rounded-xl text-sm font-bold tracking-widest uppercase text-center placeholder-slate-600"
                    value={identifier} onChange={e => setIdentifier(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && handleCheck()}
                  />
                </div>
                <button onClick={handleCheck} disabled={isSearching} className="neon-button w-full bg-cyan-500 hover:bg-cyan-400 text-black font-black py-4 rounded-xl shadow-[0_0_20px_rgba(0,243,255,0.3)] active:scale-95 transition-all text-sm tracking-[0.2em] uppercase">
                  {isSearching ? <i className="fas fa-circle-notch animate-spin"></i> : "Inicializar"}
                </button>
              </div>
            ) : showPin ? (
              <div className="space-y-6 animate-enter">
                <div className="text-center">
                  <p className="text-cyan-400 font-mono text-[10px] uppercase mb-4 tracking-[0.3em] blink">Se requiere autorización de seguridad</p>
                  <input
                    autoFocus
                    type="password"
                    placeholder="••••"
                    className="input-neon w-full py-5 text-center text-5xl tracking-[0.5em] rounded-2xl font-black text-white"
                    value={pin} onChange={e => setPin(e.target.value)}
                    onKeyPress={async e => {
                      if (e.key === 'Enter') {
                        const u = await onLoginAttempt(identifier, pin);
                        if (u) onSuccess(u);
                        else alert("Acceso Denegado");
                      }
                    }}
                  />
                </div>
                <button onClick={async () => {
                  const u = await onLoginAttempt(identifier, pin);
                  if (u) onSuccess(u);
                  else alert("Acceso Denegado");
                }} className="neon-button w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-black py-4 rounded-xl shadow-lg uppercase tracking-widest text-xs">Verificar Credenciales</button>
                <button onClick={() => { setShowPin(false); setPin(''); }} className="w-full text-slate-500 text-[10px] font-bold uppercase tracking-widest hover:text-white transition-colors">Abortar Secuencia</button>
              </div>
            ) : (
              <form onSubmit={async e => {
                e.preventDefault();
                // Sanitize IG: remove @ if exists
                const cleanIG = regData.instagram.replace('@', '');
                // Sanitize Phone: ensure +569 logic if it's just numbers
                let cleanPhone = regData.phoneNumber;
                if (/^\d+$/.test(cleanPhone)) {
                  if (!cleanPhone.startsWith('569')) cleanPhone = '569' + cleanPhone;
                  if (!cleanPhone.startsWith('+')) cleanPhone = '+' + cleanPhone;
                }
                const newUser = await onRegister({ email: identifier, ...regData, instagram: cleanIG, phoneNumber: cleanPhone, role: 'client' });
                if (newUser) onSuccess(newUser);
              }} className="space-y-4 animate-enter">
                <p className="text-center text-cyan-400 font-bold text-[10px] uppercase mb-4 tracking-[0.2em]">Nueva Identidad Detectada</p>
                <input required placeholder="Nombre Completo" className="input-neon w-full p-4 rounded-xl text-xs" value={regData.fullName} onChange={e => setRegData({ ...regData, fullName: e.target.value })} />
                <input required placeholder="Instagram (sin @)" className="input-neon w-full p-4 rounded-xl text-xs" value={regData.instagram} onChange={e => setRegData({ ...regData, instagram: e.target.value.replace('@', '') })} />
                <input required placeholder="Teléfono (ej: 912345678)" className="input-neon w-full p-4 rounded-xl text-xs" value={regData.phoneNumber} onChange={e => setRegData({ ...regData, phoneNumber: e.target.value })} />
                <input required maxLength={4} placeholder="Pin de 4 dígitos" className="input-neon w-full p-4 rounded-xl text-center font-black tracking-widest text-lg" value={regData.pin} onChange={e => setRegData({ ...regData, pin: e.target.value })} />
                <button type="submit" className="neon-button w-full bg-white text-black font-black py-4 rounded-xl mt-4 uppercase text-[10px] tracking-[0.3em] shadow-[0_0_20px_rgba(255,255,255,0.3)]">Crear Perfil</button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Footer Decoration */}
      <div className="absolute bottom-6 text-[9px] text-slate-700 font-mono uppercase tracking-[0.5em] opacity-50">
        Protegido por Protocolo Nexus
      </div>
    </div>
  );
};

export default LandingPage;