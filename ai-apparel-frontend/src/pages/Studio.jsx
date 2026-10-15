import { useState } from 'react';
import { removeBackground } from '@imgly/background-removal';

export default function Studio() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // View & Garment State
  const [activeView, setActiveView] = useState('front'); // 'front' | 'back'
  const [shirtColor, setShirtColor] = useState('#18181b'); // Default: Onyx Black

  // Independent Dual-Sided Design State
  // Now stores both the image URL and the category to apply proper blending
  const [designs, setDesigns] = useState({
    front: { url: null, category: null },
    back: { url: null, category: null },
  });

  const brandColors = [
    { name: 'Onyx', hex: '#18181b' },
    { name: 'Bone', hex: '#f4f4f5' },
    { name: 'Slate', hex: '#475569' },
    { name: 'Olive', hex: '#3f4234' },
    { name: 'Clay', hex: '#7c5344' },
  ];

  const loadImage = (src) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });

  const decontaminateAndLockAlpha = (rawPixels, alphaPixels, width, height) => {
    const output = new Uint8ClampedArray(rawPixels.length);
    const BG_R = rawPixels[0] || 128;
    const BG_G = rawPixels[1] || 128;
    const BG_B = rawPixels[2] || 128;

    for (let i = 0; i < width * height; i++) {
      const idx = i * 4;
      const neuralAlpha = alphaPixels[idx + 3];

      if (neuralAlpha === 0) {
        output[idx] = 0;
        output[idx + 1] = 0;
        output[idx + 2] = 0;
        output[idx + 3] = 0;
      } else if (neuralAlpha === 255) {
        output[idx] = rawPixels[idx];
        output[idx + 1] = rawPixels[idx + 1];
        output[idx + 2] = rawPixels[idx + 2];
        output[idx + 3] = 255;
      } else {
        const a = neuralAlpha / 255.0;
        const oneMinusA = 1.0 - a;
        const corrR = Math.min(255, Math.max(0, Math.round((rawPixels[idx] - BG_R * oneMinusA) / a)));
        const corrG = Math.min(255, Math.max(0, Math.round((rawPixels[idx + 1] - BG_G * oneMinusA) / a)));
        const corrB = Math.min(255, Math.max(0, Math.round((rawPixels[idx + 2] - BG_B * oneMinusA) / a)));
        output[idx] = corrR;
        output[idx + 1] = corrG;
        output[idx + 2] = corrB;
        output[idx + 3] = neuralAlpha;
      }
    }

    const isExterior = new Uint8Array(width * height);
    const queue = new Int32Array(width * height);
    let head = 0, tail = 0;
    const ALPHA_THRESHOLD = 128;

    const tryEnqueue = (x, y) => {
      const pos = y * width + x;
      if (!isExterior[pos] && alphaPixels[pos * 4 + 3] < ALPHA_THRESHOLD) {
        isExterior[pos] = 1;
        queue[tail++] = pos;
      }
    };

    for (let x = 0; x < width; x++) { tryEnqueue(x, 0); tryEnqueue(x, height - 1); }
    for (let y = 0; y < height; y++) { tryEnqueue(0, y); tryEnqueue(width - 1, y); }

    while (head < tail) {
      const pos = queue[head++];
      const x = pos % width;
      const y = (pos - x) / width;
      if (x > 0) tryEnqueue(x - 1, y);
      if (x < width - 1) tryEnqueue(x + 1, y);
      if (y > 0) tryEnqueue(x, y - 1);
      if (y < height - 1) tryEnqueue(x, y + 1);
      if (x > 0 && y > 0) tryEnqueue(x - 1, y - 1);
      if (x < width - 1 && y > 0) tryEnqueue(x + 1, y - 1);
      if (x > 0 && y < height - 1) tryEnqueue(x - 1, y + 1);
      if (x < width - 1 && y < height - 1) tryEnqueue(x + 1, y + 1);
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const idx = i * 4;
        if (isExterior[i]) {
          output[idx] = 0; output[idx + 1] = 0; output[idx + 2] = 0; output[idx + 3] = 0;
        } else {
          const touchesExterior = (x > 0 && isExterior[i - 1]) || (x < width - 1 && isExterior[i + 1]) || (y > 0 && isExterior[i - width]) || (y < height - 1 && isExterior[i + width]);
          if (!touchesExterior) {
            output[idx] = rawPixels[idx]; output[idx + 1] = rawPixels[idx + 1]; output[idx + 2] = rawPixels[idx + 2]; output[idx + 3] = 255;
          }
        }
      }
    }

    const finalOutput = new Uint8ClampedArray(output);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const pos = y * width + x;
        if (!isExterior[pos] && output[pos * 4 + 3] > 200) {
          let extCount = 0;
          extCount += isExterior[pos - 1] ? 1 : 0; extCount += isExterior[pos + 1] ? 1 : 0;
          extCount += isExterior[pos - width] ? 1 : 0; extCount += isExterior[pos + width] ? 1 : 0;
          extCount += isExterior[pos - width - 1] ? 1 : 0; extCount += isExterior[pos - width + 1] ? 1 : 0;
          extCount += isExterior[pos + width - 1] ? 1 : 0; extCount += isExterior[pos + width + 1] ? 1 : 0;
          if (extCount > 0) {
            const featheredAlpha = Math.max(0, Math.round(output[pos * 4 + 3] * (1 - extCount * 0.10)));
            finalOutput[pos * 4 + 3] = featheredAlpha;
          }
        }
      }
    }
    return finalOutput;
  };

  const runClientPostProcessing = async (originalBase64, segmentedBlob) => {
    const segmentedUrl = URL.createObjectURL(segmentedBlob);
    try {
      const [origImg, maskImg] = await Promise.all([loadImage(originalBase64), loadImage(segmentedUrl)]);
      const w = origImg.width;
      const h = origImg.height;

      const origCanvas = document.createElement('canvas');
      origCanvas.width = w; origCanvas.height = h;
      const origCtx = origCanvas.getContext('2d');
      origCtx.drawImage(origImg, 0, 0, w, h);
      const origPixels = origCtx.getImageData(0, 0, w, h).data;

      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = w; maskCanvas.height = h;
      const maskCtx = maskCanvas.getContext('2d');
      maskCtx.drawImage(maskImg, 0, 0, w, h);
      const maskPixels = maskCtx.getImageData(0, 0, w, h).data;

      const cleanedPixels = decontaminateAndLockAlpha(origPixels, maskPixels, w, h);
      const cleanedImageData = new ImageData(cleanedPixels, w, h);
      origCtx.putImageData(cleanedImageData, 0, 0);

      let minX = w, minY = h, maxX = 0, maxY = 0;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (cleanedPixels[(y * w + x) * 4 + 3] > 15) {
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
          }
        }
      }

      if (maxX < minX || maxY < minY) return origCanvas.toDataURL('image/png');

      const padding = 20;
      const cropX = Math.max(0, minX - padding); const cropY = Math.max(0, minY - padding);
      const cropW = Math.min(w - cropX, maxX - minX + 1 + padding * 2);
      const cropH = Math.min(h - cropY, maxY - minY + 1 + padding * 2);

      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = cropW; finalCanvas.height = cropH;
      const finalCtx = finalCanvas.getContext('2d');
      finalCtx.drawImage(origCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

      return finalCanvas.toDataURL('image/png');
    } finally {
      URL.revokeObjectURL(segmentedUrl);
    }
  };

  const generateDesign = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setLoadingStep('Stage 1/4: Classifying prompt & generating artwork...');

    try {
      const response = await fetch('http://localhost:5000/api/design/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      const data = await response.json();

      if (!response.ok || !data.imageUrl) {
        throw new Error(data.error || 'Failed to generate design');
      }

      let finalImageUrl = data.imageUrl;

      // Only run background removal for SUBJECT and TYPOGRAPHIC prompts
      if (data.category !== 'SCENE') {
        setLoadingStep(`Stage 2/4: Running neural segmentation (${data.category})...`);
        
        // Wrap the Base64 response in a typed Blob to prevent MIME type crashes
        const res = await fetch(data.imageUrl);
        const blob = await res.blob();
        const pngBlob = new Blob([blob], { type: 'image/png' });

        const segmentedBlob = await removeBackground(pngBlob, {
          model: 'medium',
          output: { format: 'image/png', quality: 1.0 },
        });

        setLoadingStep('Stage 3/4: Un-premultiplying edges & tight-cropping...');
        finalImageUrl = await runClientPostProcessing(data.imageUrl, segmentedBlob);
      } else {
        // Skip processing for scenes, they will blend natively via CSS
        setLoadingStep(`Stage 2/4: Optimizing scene rendering...`);
      }

      setLoadingStep('Stage 4/4: Rendering on garment...');
      setDesigns((prev) => ({
        ...prev,
        [activeView]: { url: finalImageUrl, category: data.category },
      }));
    } catch (error) {
      console.error(error);
      alert(error.message || 'Pipeline failed.');
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  const saveToStorefront = async () => {
    if (!designs.front.url && !designs.back.url) return;

    setIsSaving(true);
    try {
      const response = await fetch('http://localhost:5000/api/design/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          frontImage: designs.front.url,
          backImage: designs.back.url,
          color: shirtColor,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        alert('🎉 Success: ' + data.message);
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error) {
      console.error(error);
      alert('Failed to publish design.');
    } finally {
      setIsSaving(false);
    }
  };

  const currentDesign = designs[activeView];

  // Dynamic CSS blending based on the shirt color and prompt category
  const isLightShirt = shirtColor === '#f4f4f5' || shirtColor === '#e2e8f0'; // Bone or light colors
  
  let blendClass = "drop-shadow-md"; // Default for isolated subjects
  if (currentDesign.category === 'SCENE') {
    // For scenes, use Screen blend on dark shirts (makes the black background invisible)
    // and Multiply blend on light shirts
    blendClass = isLightShirt ? "mix-blend-multiply" : "mix-blend-screen opacity-90";
  }

  return (
    <div className="max-w-5xl mx-auto p-6 mt-8">
      <div className="mb-8 border-b pb-4">
        <h1 className="text-3xl font-bold text-gray-900">AI Design Studio</h1>
        <p className="text-gray-600 mt-2">Describe your vision. Our AI will bring it to life.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        <div className="w-full md:w-1/2 space-y-6">
          
          <div>
            <label className="block font-semibold text-gray-700 mb-2">Garment View</label>
            <div className="flex bg-gray-200 p-1 rounded-lg w-fit">
              <button
                onClick={() => setActiveView('front')}
                className={`px-6 py-2 rounded-md font-bold transition-all duration-200 ${
                  activeView === 'front' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Front
              </button>
              <button
                onClick={() => setActiveView('back')}
                className={`px-6 py-2 rounded-md font-bold transition-all duration-200 ${
                  activeView === 'back' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Back
              </button>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-gray-700 mb-2">Design Prompt</label>
            <textarea
              className="w-full p-4 border border-gray-300 rounded-lg shadow-sm outline-none resize-none focus:ring-2 focus:ring-gray-900"
              rows="4"
              placeholder="e.g., sunrise in the dark, or cyberpunk samurai dog"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            ></textarea>
          </div>
          
          <div>
            <label className="block font-semibold text-gray-700 mb-2">Brand Blanks</label>
            <div className="flex gap-4">
              {brandColors.map((colorObj) => (
                <div key={colorObj.hex} className="flex flex-col items-center gap-1">
                  <button
                    onClick={() => setShirtColor(colorObj.hex)}
                    className={`w-10 h-10 rounded-full border-2 shadow-sm transition-transform hover:scale-110 ${
                      shirtColor === colorObj.hex ? 'border-gray-900 scale-110' : 'border-gray-300'
                    }`}
                    style={{ backgroundColor: colorObj.hex }}
                    title={colorObj.name}
                  />
                  <span className="text-xs text-gray-500 font-medium">{colorObj.name}</span>
                </div>
              ))}
            </div>
          </div>
          
          <button
            onClick={generateDesign}
            disabled={loading || !prompt.trim()}
            className="w-full bg-gray-900 text-white font-bold py-4 rounded-lg hover:bg-gray-800 disabled:bg-gray-400 shadow-md"
          >
            {loading ? '🎨 Generating...' : 'Generate Design'}
          </button>

          {(designs.front.url || designs.back.url) && !loading && (
            <button
              onClick={saveToStorefront}
              disabled={isSaving}
              className="w-full bg-green-600 text-white font-bold py-4 rounded-lg hover:bg-green-700 disabled:bg-green-400 shadow-md"
            >
              {isSaving ? '☁️ Uploading & Saving...' : '🛒 Publish to Storefront'}
            </button>
          )}
        </div>

        <div className="w-full md:w-1/2 bg-neutral-100 rounded-2xl min-h-[540px] flex items-center justify-center border border-neutral-200 shadow-inner p-6 relative select-none">
          
          {loading ? (
            <div className="flex flex-col items-center z-30 text-center px-4">
              <div className="animate-spin rounded-full h-12 w-12 border-2 border-neutral-900 border-t-transparent mb-4"></div>
              <p className="text-neutral-700 font-mono text-xs tracking-wide">{loadingStep}</p>
            </div>
          ) : (
            <div className="relative w-full max-w-[380px] aspect-[400/460] flex items-center justify-center">
              
              <div className="absolute inset-0 flex items-center justify-center">
                <div 
                  className="absolute inset-0 transition-all duration-300"
                  style={{ 
                    backgroundColor: shirtColor,
                    WebkitMaskImage: `url(${activeView === 'front' ? '/shirt_front.png' : '/shirt_back.png'})`,
                    maskImage: `url(${activeView === 'front' ? '/shirt_front.png' : '/shirt_back.png'})`,
                    WebkitMaskSize: 'contain',
                    maskSize: 'contain',
                    WebkitMaskRepeat: 'no-repeat',
                    maskRepeat: 'no-repeat',
                    WebkitMaskPosition: 'center',
                    maskPosition: 'center'
                  }}
                ></div>

                <img 
                  src={activeView === 'front' ? '/shirt_front.png' : '/shirt_back.png'} 
                  alt="Blank Garment" 
                  className="w-full h-full object-contain mix-blend-multiply pointer-events-none transition-opacity duration-300"
                />
              </div>

              <div 
                className={`absolute bottom-[10%] z-20 transition-all duration-300 pointer-events-none ${
                  activeView === 'front' ? 'right-[20%]' : 'left-[20%]'
                }`}
              >
                <div className="bg-neutral-900 border border-neutral-700 text-neutral-100 text-[9px] font-mono tracking-widest px-2 py-0.5 rounded shadow-sm flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  KASTAM
                </div>
              </div>

              <div 
                className={`absolute z-10 flex items-center justify-center transition-all duration-300 overflow-hidden ${
                  activeView === 'front' 
                    ? 'top-[28%] left-[30%] w-[40%] h-[40%]'
                    : 'top-[20%] left-[25%] w-[50%] h-[55%]'
                }`}
              >
                {currentDesign.url ? (
                  <img 
                    src={currentDesign.url} 
                    alt={`Kastam ${activeView} artwork`} 
                    className={`w-full h-full object-contain transition-opacity duration-300 ${blendClass}`}
                  />
                ) : (
                  <div className="w-full h-full border-2 border-dashed border-neutral-400/60 rounded-lg flex flex-col items-center justify-center text-center p-3 bg-white/10 backdrop-blur-[1px] transition-colors hover:border-neutral-500">
                    <span className="text-[11px] font-mono font-bold tracking-wider text-neutral-600 uppercase">
                      {activeView} Zone
                    </span>
                    <span className="text-[9px] text-neutral-500 font-mono mt-0.5">
                      {activeView === 'front' ? 'Chest (10x10")' : 'Full Back (14x16")'}
                    </span>
                    <span className="text-[8px] tracking-tight uppercase text-neutral-400 mt-2 font-mono border border-neutral-400/40 px-1.5 py-0.5 rounded">
                      Locked Perimeter
                    </span>
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}