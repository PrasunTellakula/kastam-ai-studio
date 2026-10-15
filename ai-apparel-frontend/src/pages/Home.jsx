import { useState, useEffect } from 'react';

export default function Home() {
  const [designs, setDesigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDesigns = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/design/all');
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

  return (
    <div className="max-w-7xl mx-auto p-6 mt-8">
      {/* Header Section */}
      <div className="mb-10 border-b pb-6 flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">Community Storefront</h1>
          <p className="text-gray-500 mt-2 text-lg">Discover and collect AI-generated streetwear.</p>
        </div>
        {!loading && (
          <div className="text-sm font-mono text-gray-600 bg-gray-100 px-4 py-1.5 rounded-full border border-gray-200">
            {designs.length} Designs Published
          </div>
        )}
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-900 border-t-transparent"></div>
        </div>
      ) : (
        /* Minimalist Masonry Grid */
        <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-6 space-y-6">
          {designs.map((design) => {
            const isLightShirt = design.shirtColor === '#f4f4f5' || design.shirtColor === '#e2e8f0';
            let blendClass = "drop-shadow-md"; 
            if (design.category === 'SCENE') {
              blendClass = isLightShirt ? "mix-blend-multiply" : "mix-blend-screen opacity-90";
            }

            return (
              <div 
                key={design._id} 
                className="break-inside-avoid relative group rounded-2xl overflow-hidden bg-neutral-100 border border-neutral-200 transition-all duration-300 hover:shadow-xl hover:border-neutral-300"
              >
                {/* Photorealistic T-Shirt Mockup Canvas */}
                <div className="relative w-full aspect-[400/460] flex items-center justify-center p-4 select-none">
                  
                  <div className="absolute inset-4 flex items-center justify-center">
                    {/* Fabric Color Fill */}
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

                    {/* Wrinkles & Shadows */}
                    <img 
                      src="/shirt_front.png" 
                      alt="Blank Garment" 
                      className="absolute inset-0 w-full h-full object-contain mix-blend-multiply pointer-events-none"
                    />

                    {/* Artwork Rendered into Print Zone */}
                    <div className="absolute z-10 flex items-center justify-center top-[28%] left-[30%] w-[40%] h-[40%]">
                      <img 
                        src={design.frontImageUrl || design.backImageUrl} 
                        alt={design.prompt} 
                        loading="lazy"
                        className={`w-full h-full object-contain transition-transform duration-500 group-hover:scale-105 ${blendClass}`}
                      />
                    </div>
                  </div>
                </div>
                
                {/* Product Metadata Footer */}
                <div className="p-5 bg-white border-t border-neutral-100">
                  <p className="text-neutral-900 font-bold text-sm line-clamp-2 leading-snug">
                    "{design.prompt}"
                  </p>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs font-mono text-neutral-400 uppercase tracking-wider">
                      {design.category || 'Apparel'}
                    </span>
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
          <svg className="mx-auto h-12 w-12 text-neutral-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
          </svg>
          <p className="text-neutral-500 mb-6 text-lg">No designs have been published to the storefront yet.</p>
          <a href="/studio" className="inline-block bg-neutral-900 text-white font-bold py-3 px-8 rounded-lg hover:bg-neutral-800 transition-colors shadow-md">
            Head to the Studio &rarr;
          </a>
        </div>
      )}
    </div>
  );
}