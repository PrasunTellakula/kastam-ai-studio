export default function Footer() {
  return (
    <footer className="bg-white border-t border-neutral-200 mt-16 mt-auto">
      <div className="max-w-7xl mx-auto px-6 py-12 flex flex-col md:flex-row justify-between items-center gap-6">
        
        {/* Brand Section */}
        <div className="flex flex-col items-center md:items-start gap-2">
          <div className="flex items-center gap-2 opacity-50 hover:opacity-100 transition-opacity cursor-pointer">
            <svg className="w-6 h-6 text-neutral-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3a2.5 2.5 0 0 0-2.5 2.5v.5M12 6l-9 6v2h18v-2z" />
              <path d="M12 14v7" />
            </svg>
            <span className="font-black text-xl tracking-tighter text-neutral-900">KASTAM</span>
          </div>
          <p className="text-sm text-neutral-400 font-medium mt-1">
            AI-generated streetwear. Designed by you.
          </p>
        </div>

        {/* Links Section */}
        <div className="flex gap-8 text-sm font-bold text-neutral-400">
          <a href="/" className="hover:text-neutral-900 transition-colors">Storefront</a>
          <a href="/studio" className="hover:text-neutral-900 transition-colors">Studio</a>
          <a href="#" className="hover:text-neutral-900 transition-colors">Terms</a>
          <a href="#" className="hover:text-neutral-900 transition-colors">Privacy</a>
        </div>
        
      </div>

      {/* Copyright Bar */}
      <div className="border-t border-neutral-100 py-6 text-center">
        <p className="text-xs text-neutral-400 font-mono tracking-wider">
          &copy; {new Date().getFullYear()} KASTAM APPAREL. ALL RIGHTS RESERVED.
        </p>
      </div>
    </footer>
  );
}