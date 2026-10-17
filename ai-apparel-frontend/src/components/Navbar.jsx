import { useState, useEffect } from 'react';
import AuthModal from './AuthModal';

export default function Navbar({ hideSearch = false }) {
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Check if user is logged in when the Navbar loads
  useEffect(() => {
    const savedUser = localStorage.getItem('kastam_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    
    // Auto-fill the search bar if there's a search term in the URL
    const params = new URLSearchParams(window.location.search);
    if (params.get('search')) {
      setSearchTerm(params.get('search'));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('kastam_token');
    localStorage.removeItem('kastam_user');
    setUser(null);
    window.location.href = '/'; // Redirect to home
  };

  const handleSearch = (e) => {
    e.preventDefault();
    
    // NEW: Check if we are currently on the Wardrobe page
    const isWardrobe = window.location.pathname.includes('/wardrobe');
    const basePath = isWardrobe ? '/wardrobe' : '/';

    if (searchTerm.trim()) {
      window.location.href = `${basePath}?search=${encodeURIComponent(searchTerm)}`;
    } else {
      window.location.href = basePath;
    }
  };

  return (
    <>
      <nav className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-neutral-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          
          {/* Logo & Links */}
          <div className="flex items-center gap-8">
            <a href="/" className="flex items-center gap-2">
              {/* Minimalist Boutique Hanger (Static) */}
              <svg className="w-7 h-7 text-neutral-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3a2.5 2.5 0 0 0-2.5 2.5v.5M12 6l-9 6v2h18v-2z" />
                <path d="M12 14v7" />
              </svg>
              <span className="font-black text-2xl tracking-tighter text-neutral-900">KASTAM</span>
            </a>
            <div className="hidden md:flex items-center gap-6 text-sm font-bold text-neutral-500">
              <a href="/" className="hover:text-neutral-900 transition-colors">Storefront</a>
              <a href="/studio" onClick={() => localStorage.removeItem('kastam_studio_state')} className="hover:text-neutral-900 transition-colors">Studio</a>
              {user && (
                <a href="/wardrobe" className="hover:text-neutral-900 transition-colors text-emerald-600">My Wardrobe</a>
              )}
            </div>
          </div>

          {/* Conditionally render the Search Bar */}
          {!hideSearch && (
            <form onSubmit={handleSearch} className="flex-1 max-w-md hidden lg:block relative">
              <input 
                type="text" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search prompts or creators..." 
                className="w-full bg-neutral-100 text-sm font-medium px-4 py-2 rounded-full border border-transparent focus:bg-white focus:border-neutral-300 focus:ring-2 focus:ring-neutral-900 outline-none transition-all"
              />
              <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-900">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              </button>
            </form>
          )}

          {/* Auth Controls */}
          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-4">
                <span className="text-sm font-bold text-neutral-700 hidden sm:block">
                  Hey, {user.name.split(' ')[0]}
                </span>
                <button onClick={handleLogout} className="text-xs font-bold text-neutral-500 hover:text-red-500 transition-colors">
                  Log Out
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setIsAuthOpen(true)}
                className="bg-neutral-900 text-white text-sm font-bold px-5 py-2 rounded-full hover:bg-neutral-800 transition-colors shadow-md"
              >
                Log In
              </button>
            )}
          </div>

        </div>
      </nav>

      {/* Mount the Auth Modal */}
      <AuthModal 
        isOpen={isAuthOpen} 
        onClose={() => setIsAuthOpen(false)} 
        onAuthSuccess={(userData) => setUser(userData)} 
      />
    </>
  );
}