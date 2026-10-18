import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export default function Wardrobe() {
  const [designs, setDesigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [selectedDesign, setSelectedDesign] = useState(null);
  const [modalView, setModalView] = useState('front'); 
  const [modalShirtColor, setModalShirtColor] = useState('#18181b');

  const brandColors = [
    { name: 'Onyx', hex: '#18181b' },
    { name: 'Bone', hex: '#f4f4f5' },
    { name: 'Slate', hex: '#475569' },
    { name: 'Olive', hex: '#3f4234' },
    { name: 'Clay', hex: '#7c5344' },
  ];

  useEffect(() => {
    // 1. Get the logged-in user from localStorage immediately so the UI doesn't crash
    const savedUser = localStorage.getItem('kastam_user');
    
    if (!savedUser) {
      window.location.href = '/'; 
      return;
    }
    
    const parsedUser = JSON.parse(savedUser);
    setUser(parsedUser); // Temporary optimistic load

    // 2. NEW: Fetch LIVE user data (including real-time publishCredits)
    const fetchLiveProfile = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/user/${parsedUser.id}`);
        const liveUser = await res.json();
        if (liveUser && !liveUser.error) {
          setUser(liveUser);
          // Update localStorage so the cache stays fresh across the app
          localStorage.setItem('kastam_user', JSON.stringify(liveUser));
        }
      } catch (e) {
        console.error("Failed to fetch live profile:", e);
      }
    };
    fetchLiveProfile();

    const fetchMyDesigns = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const searchParam = params.get('search') || '';
        setSearchQuery(searchParam);

        const url = searchParam 
          ? `${import.meta.env.VITE_API_URL}/api/design/all?search=${encodeURIComponent(searchParam)}`
          : `${import.meta.env.VITE_API_URL}/api/design/all`;

        const response = await fetch(url);
        const data = await response.json();
        setDesigns(data);
      } catch (error) {
        console.error('Failed to fetch wardrobe:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchMyDesigns();
  }, []);

  const openModal = (design) => {
    setSelectedDesign(design);
    setModalView(design.frontImageUrl ? 'front' : 'back');
    setModalShirtColor(design.shirtColor);
  };

  const closeModal = () => setSelectedDesign(null);

  const handleRemix = (design) => {
    const remixState = {
      prompts: {
        front: design.frontPrompt || design.prompt || '',
        back: design.backPrompt || ''
      },
      shirtColor: modalShirtColor, 
      designs: {
        front: { url: design.frontImageUrl || null, category: design.frontImageUrl ? design.category : null },
        back: { url: design.backImageUrl || null, category: design.backImageUrl ? design.category : null }
      }
    };
    localStorage.setItem('kastam_studio_state', JSON.stringify(remixState));
    window.location.href = '/studio'; 
  };

  const handleDelete = async (designId) => {
    if (!window.confirm("Are you sure you want to delete this design? This cannot be undone.")) {
      return;
    }
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/design/delete/${designId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete design');
      setDesigns(prevDesigns => prevDesigns.filter(d => d._id !== designId));
      closeModal();
      alert('Design successfully deleted!');
    } catch (error) {
      console.error('Delete error:', error);
      alert('Could not delete the design.');
    }
  };

  if (!user) return null; 

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      <Navbar /> 

      <div className="flex-grow max-w-7xl mx-auto p-6 mt-4">
        <div className="mb-8 border-b pb-4 flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">My Wardrobe</h1>
            <p className="text-gray-600 mt-2">
              {searchQuery ? `Showing your results for "${searchQuery}"` : 'Manage your private collection and published gear.'}
            </p>
          </div>
          {!loading && (
            <div className="flex gap-4">
              <div className="text-sm font-bold text-emerald-600 bg-emerald-50 px-4 py-1.5 rounded-full border border-emerald-200 shadow-sm flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-black">₹</span>
                {user.publishCredits || 0} Credits
              </div>
              <div className="text-sm font-mono text-gray-600 bg-gray-100 px-4 py-1.5 rounded-full border border-gray-200">
                {designs.length} Items
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center items-center min-h-[400px]">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-900 border-t-transparent"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {designs.map((design) => {
              const isLightShirt = design.shirtColor === '#f4f4f5' || design.shirtColor === '#e2e8f0';
              let blendClass = "drop-shadow-md"; 
              if (design.category === 'SCENE') {
                blendClass = isLightShirt ? "mix-blend-multiply" : "mix-blend-screen opacity-90";
              }
              
              // FIX: Determine which side to show on the storefront card
              const hasFront = !!design.frontImageUrl;
              const thumbnailUrl = design.frontImageUrl || design.backImageUrl;
              const baseShirtImg = hasFront ? '/shirt_front.png' : '/shirt_back.png';
              const zoneClass = hasFront 
                ? 'top-[28%] left-[30%] w-[40%] h-[40%] items-center justify-center'
                : 'top-[18%] left-[27%] w-[46%] h-[55%] items-start justify-center pt-2';

              return (
                <div 
                  key={design._id} 
                  className="break-inside-avoid relative group rounded-2xl overflow-hidden bg-neutral-100 border border-neutral-200 transition-all duration-300 hover:shadow-xl hover:border-neutral-300 cursor-pointer"
                  onClick={() => openModal(design)}
                >
                  <div className="relative w-full aspect-[400/460] flex items-center justify-center p-4 select-none">
                    <div className="absolute inset-4 flex items-center justify-center">
                      <div 
                        className="absolute inset-0 transition-all duration-300"
                        style={{ 
                          backgroundColor: design.shirtColor || '#18181b',
                          WebkitMaskImage: `url(${baseShirtImg})`,
                          maskImage: `url(${baseShirtImg})`,
                          WebkitMaskSize: 'contain', maskSize: 'contain', WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat', WebkitMaskPosition: 'center', maskPosition: 'center'
                        }}
                      ></div>
                      <img src={baseShirtImg} alt="Blank Garment" className="absolute inset-0 w-full h-full object-contain mix-blend-multiply pointer-events-none" />
                      
                      <div className={`absolute z-10 flex ${zoneClass}`}>
                        <img src={thumbnailUrl} alt={design.frontPrompt || design.prompt} loading="lazy" className={`w-full max-h-full object-contain transition-transform duration-500 group-hover:scale-105 ${blendClass}`} />
                      </div>
                    </div>
                  </div>
                  <div className="p-5 bg-white border-t border-neutral-100 flex justify-between items-center">
                    <div className="flex flex-col">
                      <span className="text-xs font-mono text-neutral-400 uppercase tracking-wider mb-1">
                        {design.category || 'Apparel'}
                      </span>
                      <p className="text-neutral-900 font-bold text-sm line-clamp-1 w-48">
                        "{design.frontPrompt || design.backPrompt || design.prompt}"
                      </p>
                    </div>
                    <button className="text-xs font-bold bg-neutral-100 text-neutral-600 px-3 py-1.5 rounded hover:bg-neutral-200 transition-colors">Edit</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        {!loading && designs.length === 0 && (
          <div className="text-center py-24 bg-neutral-50 rounded-2xl border border-dashed border-neutral-300">
            <p className="text-neutral-500 mb-6 text-lg">
              {searchQuery ? `No designs matched "${searchQuery}".` : "Your wardrobe is empty. Time to create something."}
            </p>
            <a href="/studio" className="inline-block bg-neutral-900 text-white font-bold py-3 px-8 rounded-lg hover:bg-neutral-800 transition-colors shadow-md">
              Enter the Studio &rarr;
            </a>
          </div>
        )}

        {selectedDesign && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity" onClick={closeModal}>
            <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
              
              <div className="w-full md:w-3/5 bg-neutral-100 p-8 flex flex-col items-center justify-center relative">
                <button onClick={closeModal} className="md:hidden absolute top-4 right-4 p-2 bg-white rounded-full shadow-sm text-gray-500 hover:bg-neutral-200">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
                <div className="absolute top-6 left-6 z-20 flex bg-white/80 backdrop-blur p-1 rounded-lg shadow-sm border border-neutral-200">
                  <button onClick={() => setModalView('front')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-colors ${modalView === 'front' ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:text-neutral-900'}`}>Front</button>
                  <button onClick={() => setModalView('back')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-colors ${modalView === 'back' ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:text-neutral-900'}`}>Back</button>
                </div>
                
                <div className="relative w-full max-w-[450px] aspect-[400/460] flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div 
                      className="absolute inset-0 transition-colors duration-300"
                      style={{ 
                        backgroundColor: modalShirtColor, 
                        WebkitMaskImage: `url(${modalView === 'front' ? '/shirt_front.png' : '/shirt_back.png'})`,
                        maskImage: `url(${modalView === 'front' ? '/shirt_front.png' : '/shirt_back.png'})`,
                        WebkitMaskSize: 'contain', maskSize: 'contain', WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat', WebkitMaskPosition: 'center', maskPosition: 'center'
                      }}
                    ></div>
                    <img src={modalView === 'front' ? '/shirt_front.png' : '/shirt_back.png'} alt="Blank Garment" className="absolute inset-0 w-full h-full object-contain mix-blend-multiply pointer-events-none" />
                  </div>
                  <div className={`absolute z-10 flex transition-all duration-300 overflow-hidden ${modalView === 'front' ? 'top-[28%] left-[30%] w-[40%] h-[40%] items-center justify-center' : 'top-[18%] left-[27%] w-[46%] h-[55%] items-start justify-center pt-2'}`}>
                    {modalView === 'front' && selectedDesign.frontImageUrl ? (
                      <img 
                        src={selectedDesign.frontImageUrl} 
                        alt="Front Artwork" 
                        className={`w-full max-h-full object-contain ${
                          selectedDesign.category === 'SCENE' 
                            ? (modalShirtColor === '#f4f4f5' || modalShirtColor === '#e2e8f0' ? 'mix-blend-multiply' : 'mix-blend-screen opacity-90') 
                            : 'drop-shadow-md'
                        }`} 
                      />
                    ) : modalView === 'back' && selectedDesign.backImageUrl ? (
                      <img 
                        src={selectedDesign.backImageUrl} 
                        alt="Back Artwork" 
                        className={`w-full max-h-full object-contain ${
                          selectedDesign.category === 'SCENE' 
                            ? (modalShirtColor === '#f4f4f5' || modalShirtColor === '#e2e8f0' ? 'mix-blend-multiply' : 'mix-blend-screen opacity-90') 
                            : 'drop-shadow-md'
                        }`} 
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-[10px] font-mono tracking-widest uppercase text-neutral-400 bg-black/5 px-2 py-1 rounded">
                          Plain {modalView} (No Print)
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="w-full md:w-2/5 p-8 md:p-10 flex flex-col overflow-y-auto">
                <div className="hidden md:flex justify-end mb-4">
                  <button onClick={closeModal} className="text-gray-400 hover:text-gray-900 transition-colors p-2 hover:bg-neutral-100 rounded-full">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                  </button>
                </div>
                
                <div className="flex-grow">
                  <div className="flex items-center gap-3 mb-6">
                    <span className="bg-neutral-100 text-neutral-600 px-3 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider border border-neutral-200">{selectedDesign.category || 'Apparel'}</span>
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full border border-neutral-300 shadow-inner" style={{ backgroundColor: modalShirtColor }}></span>
                      <span className="text-xs text-neutral-500 font-medium">Color Target</span>
                    </div>
                  </div>
                  
                  <h2 className="text-2xl font-black text-gray-900 mb-2 leading-tight">My Generated Design</h2>
                  <p className="text-sm font-bold text-emerald-600 mb-6">Private Collection</p>
                  
                  <div className="mt-8 bg-neutral-50 p-6 rounded-xl border border-neutral-200">
                    <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-3">Original Prompt</h3>
                    <p className="text-neutral-800 font-medium leading-relaxed">
                      "{modalView === 'front' 
                        ? (selectedDesign.frontPrompt || selectedDesign.prompt || 'No front design') 
                        : (selectedDesign.backPrompt || selectedDesign.prompt || 'No back design')}"
                    </p>
                  </div>
                </div>

                <div className="mt-10 space-y-6 pt-6 border-t border-neutral-100">
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest mb-3">Select Color</label>
                    <div className="flex gap-3">
                      {brandColors.map((colorObj) => (
                        <button
                          key={colorObj.hex}
                          onClick={() => setModalShirtColor(colorObj.hex)}
                          className={`w-8 h-8 rounded-full border-2 shadow-sm transition-transform hover:scale-110 ${modalShirtColor === colorObj.hex ? 'border-neutral-900 scale-110' : 'border-neutral-200'}`}
                          style={{ backgroundColor: colorObj.hex }}
                          title={colorObj.name}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <button 
                      onClick={() => handleDelete(selectedDesign._id)} 
                      className="w-full bg-red-50 text-red-600 font-bold py-4 rounded-xl hover:bg-red-100 transition-all border border-red-200 flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg> 
                      Delete from Wardrobe
                    </button>
                    <button 
                      onClick={() => handleRemix(selectedDesign)} 
                      className="w-full bg-white text-neutral-900 border-2 border-neutral-200 font-bold py-3.5 rounded-xl hover:border-neutral-900 transition-all flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg> 
                      Remix in Studio
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}