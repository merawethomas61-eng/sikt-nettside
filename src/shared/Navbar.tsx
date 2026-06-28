import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { BarChart3, ChevronDown, Settings, CreditCard, LogOut, X, Menu } from 'lucide-react';
import { track } from '../analytics';

const Navbar = ({ onNavigate, currentView, user, onLoginTrigger, onLogout, hasAccess }: any) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Ekte URL-lenker (react-router). På nye sider mangler onNavigate/onLoginTrigger,
  // så «Kom i gang» faller tilbake til /priser i stedet.
  const marketingLinks = [
    { to: '/funksjoner', label: 'Funksjoner' },
    { to: '/priser', label: 'Priser' },
    { to: '/blogg', label: 'Blogg' },
    { to: '/om-oss', label: 'Om oss' },
  ];
  const baseStartCta = onLoginTrigger ?? (() => navigate('/priser'));
  const startCta = () => { track('cta_click', { location: 'navbar', target: 'start' }); baseStartCta(); };

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 15);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const getAvatarUrl = (u: any) => u?.user_metadata?.avatar_url || u?.user_metadata?.picture;

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 navbar-shell-t ${isScrolled || isMobileMenuOpen ? 'bg-white/80 backdrop-blur-md border-b border-[#EBEBE6] py-3 sm:py-4 shadow-sm' : 'bg-transparent py-5 sm:py-8'}`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex justify-between items-center">

        {/* LOGO */}
        <div className="flex items-center gap-2 sm:gap-3 cursor-pointer group" onClick={() => navigate('/')}>
          <div className="w-9 h-9 sm:w-10 sm:h-10 bg-[#1A1A1A] rounded-xl flex items-center justify-center text-white font-bold [@media(hover:hover)_and_(pointer:fine)]:group-hover:bg-violet-700 transition-[background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]">S</div>
          <span className="text-lg sm:text-xl font-black text-[#1A1A1A] [@media(hover:hover)_and_(pointer:fine)]:group-hover:text-violet-700 transition-[color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]">Sikt</span>
        </div>

        {/* DESKTOP MENY */}
        <div className="hidden md:flex items-center gap-8">

          {/* Dashboard-knapp (KUN FOR BETALENDE KUNDER MED TILGANG) */}
          {user && hasAccess && (
            <button
              onClick={() => onNavigate('dashboard')}
              className={`flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-full transition-[background-color,color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] ${currentView === 'dashboard' ? 'bg-[#EBEBE6] text-[#1A1A1A]' : 'text-[#808080] [@media(hover:hover)_and_(pointer:fine)]:hover:text-[#1A1A1A] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[#F5F5F0]'}`}
            >
              <BarChart3 size={18} />
              Dashboard
            </button>
          )}

          {marketingLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`text-sm font-bold transition-[color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] ${location.pathname === l.to ? 'text-[#1A1A1A] font-black' : 'text-[#808080] [@media(hover:hover)_and_(pointer:fine)]:hover:text-[#1A1A1A]'}`}
            >
              {l.label}
            </Link>
          ))}

          {user ? (
            <div className="relative">
              {/* Profilbilde-knapp */}
              <button onClick={() => setIsProfileOpen(!isProfileOpen)} className="flex items-center gap-2 focus:outline-none">
                <img src={getAvatarUrl(user)} className="w-9 h-9 rounded-full border-2 border-white shadow-sm" alt="" />
                <ChevronDown size={14} className={`text-[#808080] transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] ${isProfileOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* DROPDOWN MENYEN */}
              {isProfileOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsProfileOpen(false)}></div>
                  <div className="absolute right-0 mt-3 w-60 bg-white rounded-2xl shadow-2xl border border-[#EBEBE6] py-2 animate-in zoom-in-95 duration-200 z-50 origin-top-right">
                    <div className="px-4 py-3 border-b border-[#EBEBE6] mb-1">
                      <p className="text-[10px] font-black text-[#808080] uppercase tracking-widest">Innlogget som</p>
                      <p className="text-sm font-bold text-[#1A1A1A] truncate">{user.email}</p>
                    </div>

                    {/* Dashboard også i dropdown for enkel tilgang */}
                    {hasAccess && (
                      <button onClick={() => { onNavigate('dashboard'); setIsProfileOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-[#808080] transition-[background-color,color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] text-left [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[#F5F5F0] [@media(hover:hover)_and_(pointer:fine)]:hover:text-[#1A1A1A] active:bg-[#F5F5F0]/80">
                        <BarChart3 size={16} /> Gå til Dashboard
                      </button>
                    )}

                    <button onClick={() => { onNavigate('profile'); setIsProfileOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-[#808080] transition-[background-color,color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] text-left [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[#F5F5F0] [@media(hover:hover)_and_(pointer:fine)]:hover:text-[#1A1A1A] active:bg-[#F5F5F0]/80">
                      <Settings size={16} /> Innstillinger
                    </button>

                    <button onClick={() => { onNavigate('billing'); setIsProfileOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-[#808080] transition-[background-color,color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] text-left [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[#F5F5F0] [@media(hover:hover)_and_(pointer:fine)]:hover:text-[#1A1A1A] active:bg-[#F5F5F0]/80">
                      <CreditCard size={16} /> Abonnement
                    </button>

                    <div className="my-1 border-b border-[#EBEBE6]"></div>

                    <button onClick={() => { onLogout(); setIsProfileOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-rose-500 transition-[background-color,color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] text-left [@media(hover:hover)_and_(pointer:fine)]:hover:bg-rose-50 active:bg-rose-50/80">
                      <LogOut size={16} /> Logg ut
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button onClick={startCta} className="ui-motion bg-[#1A1A1A] text-white px-6 py-2.5 rounded-full text-sm font-bold shadow-lg shadow-[rgba(26,26,26,0.08)] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-violet-700">Kom i gang</button>
          )}
        </div>

        {/* MOBIL MENY KNAPP */}
        <button className="md:hidden p-2 -mr-2 text-[#1A1A1A]" aria-label={isMobileMenuOpen ? "Lukk meny" : "Åpne meny"} onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>{isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}</button>
      </div>

      {/* MOBIL MENY (Expandable) */}
      {isMobileMenuOpen && (
        <div className="absolute top-full left-0 w-full bg-white border-b border-[#EBEBE6] p-6 flex flex-col gap-4 shadow-xl md:hidden animate-in slide-in-from-top-5 duration-200">
          {user && hasAccess && (
            <button onClick={() => { onNavigate('dashboard'); setIsMobileMenuOpen(false); }} className="flex items-center gap-3 text-lg font-bold text-[#1A1A1A] bg-[#F5F5F0] p-3 rounded-xl">
              <BarChart3 size={20} /> Dashboard
            </button>
          )}
          {marketingLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-left font-bold text-[#808080] p-2 rounded-xl transition-[background-color,color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.98] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[#F5F5F0] [@media(hover:hover)_and_(pointer:fine)]:hover:text-[#1A1A1A]"
            >
              {l.label}
            </Link>
          ))}
          {user && (
            <button onClick={() => { onLogout(); setIsMobileMenuOpen(false); }} className="text-left font-bold text-rose-500 p-2 flex items-center gap-2"><LogOut size={16} /> Logg ut</button>
          )}
          {!user && (
            <button onClick={() => { startCta(); setIsMobileMenuOpen(false); }} className="bg-[#1A1A1A] text-white py-3 rounded-xl font-bold ui-motion [@media(hover:hover)_and_(pointer:fine)]:hover:bg-violet-700">Kom i gang</button>
          )}
        </div>
      )}
    </nav>
  );
};

export { Navbar };
