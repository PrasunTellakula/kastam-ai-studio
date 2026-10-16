import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';

export default function Home() {
  const [designs, setDesigns] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [selectedDesign, setSelectedDesign] = useState(null);
  const [modalView, setModalView] = useState('front'); 
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchDesigns = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const searchParam = params.get('search') || '';
        setSearchQuery(searchParam);

        const url = searchParam 
          ? `http://localhost:5000/api/design/all?search=${encodeURIComponent(searchParam)}`
          : 'http://localhost:5000/api/design/all';

        const response = await fetch(url);
        const data = await response.json();
        setDesigns(data);
      } catch (error) {
        console.error('Failed to fetch designs:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchDesigns();
  }, []);

  const openModal = (design) => {
    setSelectedDesign(design);
    setModalView(design.frontImageUrl ? 'front' : 'back');
  };

  const closeModal = () => setSelectedDesign(null);

  const handleRemix = (design) => {
    // Package the specific design data exactly how Studio.jsx expects it
    const remixState = {
      prompts: {
        front: design.frontPrompt || design.prompt || '',
        back: design.backPrompt || ''
      },
      shirtColor: design.shirtColor,
      designs: {
        front: { 
          url: design.frontImageUrl || null, 
          category: design.frontImageUrl ? design.category : null 
        },
        back: { 
          url: design.backImageUrl || null, 
          category: design.backImageUrl ? design.category : null 
        }
      }
    };
    localStorage.setItem('kastam_studio_state', JSON.stringify(remixState));
    window.location.href = '/studio'; 
  };

  return (
    <div className="min-h-screen bg-white">
      {/* GLOBAL NAVBAR */}
      <Navbar /> 

      <div className="max-w-7xl mx-auto p-6 mt-4">
        
        {/* Header Section */}
        <div className="mb-10 border-b pb-6 flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black text-gray-900 tracking-tight">Community Storefront</h1>
            <p className="text-gray-500 mt-2 text-lg">
              {searchQuery ? `Showing results for "${searchQuery}"` : 'Discover and collect AI-generated streetwear.'}
            </p>
          </div>
          {!loading && (
            <div className="text-sm font-mono text-gray-600 bg-gray-100 px-4 py-1.5 rounded-full border border-gray-200">
              {designs.length} Designs Found
            </div>
          )}
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex justify-center items-center min-h-[400px]">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-900 border-t-transparent"></div>
          </div>
        ) : (
          /* Masonry Grid */
          <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-6 space-y-6">
            {designs.map((design) => {
              const isLightShirt = design.shirtColor === '#f4f4f5' || design.shirtColor === '#e2e8f0';
              let blendClass = "drop-shadow-md"; 
              if (design.category === 'SCENE') {
                blendClass = isLightShirt ? "mix-blend-multiply" : "mix-blend-screen opacity-90";
              }
              const thumbnailUrl = design.frontImageUrl || design.backImageUrl;

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
                          WebkitMaskImage: `url(/shirt_front.png)`,
                          maskImage: `url(/shirt_front.png)`,
                          WebkitMaskSize: 'contain',
                          maskSize: 'contain',
                          WebkitMaskRepeat: 'no-repeat',
                          maskRepeat: 'no-repeat',
                          WebkitMaskPosition: 'center',
                          maskPosition: 'center'
                        }}
                      ></div>
                      <img 
                        src="/shirt_front.png" 
                        alt="Blank Garment" 
                        className="absolute inset-0 w-full h-full object-contain mix-blend-multiply pointer-events-none"
                      />
                      <div className="absolute z-10 flex items-center justify-center top-[28%] left-[30%] w-[40%] h-[40%]">
                        <img 
                          src={thumbnailUrl} 
                          alt={design.frontPrompt || design.prompt} 
                          loading="lazy"
                          className={`w-full h-full object-contain transition-transform duration-500 group-hover:scale-105 ${blendClass}`}
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Card Footer */}
                  <div className="p-5 bg-white border-t border-neutral-100">
                    <p className="text-neutral-900 font-bold text-sm line-clamp-2 leading-snug">
                      "{design.frontPrompt || design.backPrompt || design.prompt}"
                    </p>
                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-xs font-mono text-neutral-400 uppercase tracking-wider">
                          {design.category || 'Apparel'}
                        </span>
                        <span className="text-xs font-bold text-neutral-600 mt-1">
                          by {design.creatorName || 'Anonymous'}
                        </span>
                      </div>
                      <button className="text-xs font-bold bg-neutral-900 text-white px-4 py-2 rounded-md hover:bg-neutral-800 transition-colors">
                        View
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        {/* Empty State */}
        {!loading && designs.length === 0 && (
          <div className="text-center py-24 bg-neutral-50 rounded-2xl border border-dashed border-neutral-300">
            <p className="text-neutral-500 mb-6 text-lg">No designs found.</p>
            <a href="/studio" className="inline-block bg-neutral-900 text-white font-bold py-3 px-8 rounded-lg hover:bg-neutral-800 transition-colors shadow-md">
              Head to the Studio &rarr;
            </a>
          </div>
        )}

        {/* ==================================================================== */}
        {/* QUICK-VIEW MODAL OVERLAY */}
        {/* ==================================================================== */}
        {selectedDesign && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity" onClick={closeModal}>
            <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
              
              <div className="w-full md:w-3/5 bg-neutral-100 p-8 flex flex-col items-center justify-center relative">
                <button onClick={closeModal} className="md:hidden absolute top-4 right-4 p-2 bg-white rounded-full shadow-sm text-gray-500 hover:bg-neutral-200">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
                <div className="absolute top-6 left-6 z-20 flex bg-white/80 backdrop-blur p-1 rounded-lg shadow-sm border border-neutral-200">
                  <button onClick={() => setModalView('front')} disabled={!selectedDesign.frontImageUrl} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-colors ${modalView === 'front' ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:text-neutral-900 disabled:opacity-30 disabled:hover:text-neutral-500'}`}>Front</button>
                  <button onClick={() => setModalView('back')} disabled={!selectedDesign.backImageUrl} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-colors ${modalView === 'back' ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:text-neutral-900 disabled:opacity-30 disabled:hover:text-neutral-500'}`}>Back</button>
                </div>
                
                <div className="relative w-full max-w-[450px] aspect-[400/460]">
                  <div className="absolute inset-0 transition-colors duration-300" style={{ backgroundColor: selectedDesign.shirtColor || '#18181b', WebkitMaskImage: `url(${modalView === 'front' ? '/shirt_front.png' : '/shirt_back.png'})`, maskImage: `url(${modalView === 'front' ? '/shirt_front.png' : '/shirt_back.png'})`, WebkitMaskSize: 'contain', maskSize: 'contain', WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat', WebkitMaskPosition: 'center', maskPosition: 'center'}}></div>
                  <img src={modalView === 'front' ? '/shirt_front.png' : '/shirt_back.png'} alt="Blank Garment" className="absolute inset-0 w-full h-full object-contain mix-blend-multiply pointer-events-none" />
                  <div className={`absolute z-10 flex transition-all duration-300 overflow-hidden ${modalView === 'front' ? 'top-[28%] left-[30%] w-[40%] h-[40%] items-center justify-center' : 'top-[18%] left-[27%] w-[46%] h-[55%] items-start justify-center pt-2'}`}>
                    <img src={modalView === 'front' ? selectedDesign.frontImageUrl : selectedDesign.backImageUrl} alt="Artwork" className={`w-full max-h-full object-contain ${selectedDesign.category === 'SCENE' ? (selectedDesign.shirtColor === '#f4f4f5' || selectedDesign.shirtColor === '#e2e8f0' ? 'mix-blend-multiply' : 'mix-blend-screen opacity-90') : 'drop-shadow-md'}`} />
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
                      <span className="w-4 h-4 rounded-full border border-neutral-300 shadow-inner" style={{ backgroundColor: selectedDesign.shirtColor }}></span>
                      <span className="text-xs text-neutral-500 font-medium">Color Target</span>
                    </div>
                  </div>
                  
                  <h2 className="text-2xl font-black text-gray-900 mb-2 leading-tight">AI Generated Design</h2>
                  <p className="text-sm font-bold text-emerald-600 mb-6">Designed by {selectedDesign.creatorName || 'Anonymous'}</p>
                  
                  <div className="mt-8 bg-neutral-50 p-6 rounded-xl border border-neutral-200">
                    <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-3">Original Prompt</h3>
                    {/* THIS IS THE FIX: Dynamically reads the front or back prompt! */}
                    <p className="text-neutral-800 font-medium leading-relaxed">
                      "{modalView === 'front' 
                        ? (selectedDesign.frontPrompt || selectedDesign.prompt || 'No front design') 
                        : (selectedDesign.backPrompt || selectedDesign.prompt || 'No back design')}"
                    </p>
                  </div>
                </div>

                <div className="mt-10 space-y-4 pt-6 border-t border-neutral-100">
                  <button className="w-full bg-neutral-900 text-white font-bold py-4 rounded-xl hover:bg-neutral-800 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg> Purchase Garment
                  </button>
                  <button onClick={() => handleRemix(selectedDesign)} className="w-full bg-white text-neutral-900 border-2 border-neutral-200 font-bold py-3.5 rounded-xl hover:border-neutral-900 transition-all flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg> Remix in Studio
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}