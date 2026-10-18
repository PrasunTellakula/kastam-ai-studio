import { useState, useEffect, useRef } from "react";
import { removeBackground } from "@imgly/background-removal";
import * as htmlToImage from "html-to-image";
import Navbar from "../components/Navbar";
import Footer from '../components/Footer';

const getSavedState = () => {
  try {
    const saved = localStorage.getItem("kastam_studio_state");
    return saved ? JSON.parse(saved) : null;
  } catch (e) {
    return null;
  }
};

export default function Studio() {
  const savedState = getSavedState();

  const [prompts, setPrompts] = useState(
    savedState?.prompts || { front: "", back: "" },
  );
  const [shirtColor, setShirtColor] = useState(
    savedState?.shirtColor || "#18181b",
  );
  const [designs, setDesigns] = useState(
    savedState?.designs || {
      front: { url: null, category: null },
      back: { url: null, category: null },
    },
  );

  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [activeView, setActiveView] = useState("front");

  // NEW: Auth Guard
  useEffect(() => {
    const savedUser = localStorage.getItem("kastam_user");
    if (!savedUser) {
      alert("You must be logged in to access the Studio.");
      window.location.href = "/";
    }
  }, []);

  // DOM Reference for the Mockup Exporter
  const mockupRef = useRef(null);

  const activePrompt = prompts[activeView] || "";

  const handlePromptChange = (val) => {
    setPrompts((prev) => ({ ...prev, [activeView]: val }));
  };

  useEffect(() => {
    if (!loading) {
      const stateToSave = { prompts, shirtColor, designs };
      localStorage.setItem("kastam_studio_state", JSON.stringify(stateToSave));
    }
  }, [prompts, shirtColor, designs, loading]);

  const brandColors = [
    { name: "Onyx", hex: "#18181b" },
    { name: "Bone", hex: "#f4f4f5" },
    { name: "Slate", hex: "#475569" },
    { name: "Olive", hex: "#3f4234" },
    { name: "Clay", hex: "#7c5344" },
  ];

  const loadImage = (src) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });

  // ===========================================================================
  // UNIVERSAL ALPHA DECONTAMINATION + INTERIOR LOCK + FEATHERING
  // ===========================================================================
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
        output[idx] = Math.min(
          255,
          Math.max(0, Math.round((rawPixels[idx] - BG_R * oneMinusA) / a)),
        );
        output[idx + 1] = Math.min(
          255,
          Math.max(0, Math.round((rawPixels[idx + 1] - BG_G * oneMinusA) / a)),
        );
        output[idx + 2] = Math.min(
          255,
          Math.max(0, Math.round((rawPixels[idx + 2] - BG_B * oneMinusA) / a)),
        );
        output[idx + 3] = neuralAlpha;
      }
    }

    const isExterior = new Uint8Array(width * height);
    const queue = new Int32Array(width * height);
    let head = 0,
      tail = 0;

    const tryEnqueue = (x, y) => {
      const pos = y * width + x;
      if (!isExterior[pos] && alphaPixels[pos * 4 + 3] < 128) {
        isExterior[pos] = 1;
        queue[tail++] = pos;
      }
    };

    for (let x = 0; x < width; x++) {
      tryEnqueue(x, 0);
      tryEnqueue(x, height - 1);
    }
    for (let y = 0; y < height; y++) {
      tryEnqueue(0, y);
      tryEnqueue(width - 1, y);
    }

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
          output[idx] = 0;
          output[idx + 1] = 0;
          output[idx + 2] = 0;
          output[idx + 3] = 0;
        } else {
          const touchesExterior =
            (x > 0 && isExterior[i - 1]) ||
            (x < width - 1 && isExterior[i + 1]) ||
            (y > 0 && isExterior[i - width]) ||
            (y < height - 1 && isExterior[i + width]);

          if (!touchesExterior) {
            output[idx] = rawPixels[idx];
            output[idx + 1] = rawPixels[idx + 1];
            output[idx + 2] = rawPixels[idx + 2];
            output[idx + 3] = 255;
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
          extCount += isExterior[pos - 1] ? 1 : 0;
          extCount += isExterior[pos + 1] ? 1 : 0;
          extCount += isExterior[pos - width] ? 1 : 0;
          extCount += isExterior[pos + width] ? 1 : 0;
          extCount += isExterior[pos - width - 1] ? 1 : 0;
          extCount += isExterior[pos - width + 1] ? 1 : 0;
          extCount += isExterior[pos + width - 1] ? 1 : 0;
          extCount += isExterior[pos + width + 1] ? 1 : 0;

          if (extCount > 0) {
            finalOutput[pos * 4 + 3] = Math.max(
              0,
              Math.round(output[pos * 4 + 3] * (1 - extCount * 0.1)),
            );
          }
        }
      }
    }
    return finalOutput;
  };

  const runClientPostProcessing = async (originalBase64, segmentedBlob) => {
    const segmentedUrl = URL.createObjectURL(segmentedBlob);
    try {
      const [origImg, maskImg] = await Promise.all([
        loadImage(originalBase64),
        loadImage(segmentedUrl),
      ]);
      const w = origImg.width;
      const h = origImg.height;

      const origCanvas = document.createElement("canvas");
      origCanvas.width = w;
      origCanvas.height = h;
      const origCtx = origCanvas.getContext("2d");
      origCtx.drawImage(origImg, 0, 0, w, h);
      const origPixels = origCtx.getImageData(0, 0, w, h).data;

      const maskCanvas = document.createElement("canvas");
      maskCanvas.width = w;
      maskCanvas.height = h;
      const maskCtx = maskCanvas.getContext("2d");
      maskCtx.drawImage(maskImg, 0, 0, w, h);
      const maskPixels = maskCtx.getImageData(0, 0, w, h).data;

      const cleanedPixels = decontaminateAndLockAlpha(
        origPixels,
        maskPixels,
        w,
        h,
      );
      const cleanedImageData = new ImageData(cleanedPixels, w, h);
      origCtx.putImageData(cleanedImageData, 0, 0);

      let minX = w,
        minY = h,
        maxX = 0,
        maxY = 0;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (cleanedPixels[(y * w + x) * 4 + 3] > 15) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      if (maxX < minX || maxY < minY) return origCanvas.toDataURL("image/png");

      const padding = 20;
      const cropX = Math.max(0, minX - padding);
      const cropY = Math.max(0, minY - padding);
      const cropW = Math.min(w - cropX, maxX - minX + 1 + padding * 2);
      const cropH = Math.min(h - cropY, maxY - minY + 1 + padding * 2);

      const finalCanvas = document.createElement("canvas");
      finalCanvas.width = cropW;
      finalCanvas.height = cropH;
      const finalCtx = finalCanvas.getContext("2d");
      finalCtx.drawImage(
        origCanvas,
        cropX,
        cropY,
        cropW,
        cropH,
        0,
        0,
        cropW,
        cropH,
      );

      return finalCanvas.toDataURL("image/png");
    } finally {
      URL.revokeObjectURL(segmentedUrl);
    }
  };

  const generateDesign = async () => {
    if (!activePrompt.trim()) return;
    setLoading(true);
    setLoadingStep(
      "Stage 1/3: AI Art Director & Cloudflare Flux Generation...",
    );

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/design/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: activePrompt }),
        },
      );

      const data = await response.json();

      if (!response.ok || !data.imageUrl) {
        throw new Error(data.error || "Failed to generate design");
      }

      setLoadingStep(`Stage 2/3: Running neural alpha segmentation...`);
      const res = await fetch(data.imageUrl);
      const blob = await res.blob();
      const pngBlob = new Blob([blob], { type: "image/png" });

      const segmentedBlob = await removeBackground(pngBlob, {
        model: "medium",
        output: { format: "image/png", quality: 1.0 },
      });

      setLoadingStep("Stage 3/3: Decontaminating edges & auto-cropping...");
      const finalImageUrl = await runClientPostProcessing(
        data.imageUrl,
        segmentedBlob,
      );

      setDesigns((prev) => ({
        ...prev,
        [activeView]: { url: finalImageUrl, category: data.category },
      }));
    } catch (error) {
      console.error(error);
      alert(error.message || "Pipeline failed.");
    } finally {
      setLoading(false);
      setLoadingStep("");
    }
  };

  // ===========================================================================
  // DOWNLOAD MOCKUP (Client-Side DOM Rasterization)
  // ===========================================================================
  const handleDownloadMockup = async () => {
    if (!mockupRef.current) return;

    try {
      // pixelRatio: 2 ensures the exported image is high-definition (Retina quality)
      const dataUrl = await htmlToImage.toJpeg(mockupRef.current, {
        quality: 0.95,
        pixelRatio: 2,
      });

      const link = document.createElement("a");
      link.download = `kastam-${activeView}-mockup.jpg`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error("Failed to download mockup", error);
      alert("Failed to generate mockup image.");
    }
  };

  const saveToStorefront = async () => {
    if (!designs.front?.url && !designs.back?.url) return;

    // Grab the user safely from localStorage
    const savedUser = localStorage.getItem("kastam_user");
    const user = savedUser ? JSON.parse(savedUser) : null;

    setIsSaving(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/design/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frontPrompt: prompts.front,
          backPrompt: prompts.back,
          frontImage: designs.front?.url || null,
          backImage: designs.back?.url || null,
          color: shirtColor,
          userId: user?.id || null,
          userName: user?.name || null,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        alert("🎉 Success: " + data.message);
      } else {
        alert("Error: " + data.error);
      }
    } catch (error) {
      console.error(error);
      alert("Failed to publish design.");
    } finally {
      setIsSaving(false);
    }
  };

  const currentDesign = designs[activeView];
  const isLightShirt = shirtColor === "#f4f4f5" || shirtColor === "#e2e8f0";

  let blendClass = "drop-shadow-md";
  if (currentDesign?.category === "SCENE") {
    blendClass = isLightShirt
      ? "mix-blend-multiply"
      : "mix-blend-screen opacity-90";
  }

  return (
    <div className="min-h-screen bg-neutral-50 ">
      <Navbar hideSearch={true} />

      <div className="max-w-5xl mx-auto p-6 mt-4">
        {/* RESTORED & UNIFIED HEADER SECTION */}
        <div className="mb-10 border-b pb-6 flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black text-gray-900 tracking-tight">AI Design Studio</h1>
            <p className="text-gray-500 mt-2 text-lg">Describe your vision. Our AI will bring it to life.</p>
          </div>
          <div className="text-sm font-mono text-gray-600 bg-gray-100 px-4 py-1.5 rounded-full border border-gray-200 shadow-sm">
            Studio Mode
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-8">
          {/* LEFT SIDE: Controls */}
          <div className="w-full md:w-1/2 space-y-6">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block font-semibold text-gray-700">
                  Garment View
                </label>
                <button
                  onClick={() => {
                    if (window.confirm("Clear all designs and start fresh?")) {
                      // Instantly wipe all React state variables
                      setPrompts({ front: "", back: "" });
                      setDesigns({
                        front: { url: null, category: null },
                        back: { url: null, category: null },
                      });
                      setShirtColor("#18181b");

                      // Wipe the browser memory
                      localStorage.removeItem("kastam_studio_state");
                    }
                  }}
                  className="text-xs text-red-500 hover:text-red-700 font-bold transition-colors"
                >
                  Clear Canvas
                </button>
              </div>
              <div className="flex bg-gray-200 p-1 rounded-lg w-fit">
                <button
                  onClick={() => setActiveView("front")}
                  className={`px-6 py-2 rounded-md font-bold transition-all duration-200 ${
                    activeView === "front"
                      ? "bg-white shadow-sm text-gray-900"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Front
                </button>
                <button
                  onClick={() => setActiveView("back")}
                  className={`px-6 py-2 rounded-md font-bold transition-all duration-200 ${
                    activeView === "back"
                      ? "bg-white shadow-sm text-gray-900"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Back
                </button>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-gray-700 mb-2">
                Design Prompt
              </label>
              <textarea
                className="w-full p-4 border border-gray-300 rounded-lg shadow-sm outline-none resize-none focus:ring-2 focus:ring-gray-900"
                rows="4"
                placeholder={
                  activeView === "front"
                    ? "Front chest design (e.g., minimalist samurai dog logo)"
                    : "Full back design (e.g., sunrise from mountains)"
                }
                value={activePrompt}
                onChange={(e) => handlePromptChange(e.target.value)}
              ></textarea>
            </div>

            <div>
              <label className="block font-semibold text-gray-700 mb-2">
                Brand Blanks
              </label>
              <div className="flex gap-4">
                {brandColors.map((colorObj) => (
                  <div
                    key={colorObj.hex}
                    className="flex flex-col items-center gap-1"
                  >
                    <button
                      onClick={() => setShirtColor(colorObj.hex)}
                      className={`w-10 h-10 rounded-full border-2 shadow-sm transition-transform hover:scale-110 ${
                        shirtColor === colorObj.hex
                          ? "border-gray-900 scale-110"
                          : "border-gray-300"
                      }`}
                      style={{ backgroundColor: colorObj.hex }}
                      title={colorObj.name}
                    />
                    <span className="text-xs text-gray-500 font-medium">
                      {colorObj.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={generateDesign}
              disabled={loading || !activePrompt.trim()}
              className="w-full bg-gray-900 text-white font-bold py-4 rounded-lg hover:bg-gray-800 disabled:bg-gray-400 shadow-md"
            >
              {loading ? "🎨 Generating..." : "Generate Design"}
            </button>

            {(designs.front?.url || designs.back?.url) && !loading && (
              <div className="flex gap-4">
                <button
                  onClick={handleDownloadMockup}
                  className="flex-1 bg-white text-neutral-900 border-2 border-neutral-200 font-bold py-4 rounded-lg hover:border-neutral-900 transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    ></path>
                  </svg>
                  Download Mockup
                </button>
                <button
                  onClick={saveToStorefront}
                  disabled={isSaving}
                  className="flex-1 bg-green-600 text-white font-bold py-4 rounded-lg hover:bg-green-700 disabled:bg-green-400 shadow-md flex items-center justify-center gap-2"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                    ></path>
                  </svg>
                  {isSaving ? "Saving..." : "Publish"}
                </button>
              </div>
            )}
          </div>

          {/* RIGHT SIDE: Kastam Studio Canvas */}
          <div className="w-full md:w-1/2 bg-neutral-100 rounded-2xl min-h-[540px] flex items-center justify-center border border-neutral-200 shadow-inner p-6 relative select-none">
            {loading ? (
              <div className="flex flex-col items-center z-30 text-center px-4">
                <div className="animate-spin rounded-full h-12 w-12 border-2 border-neutral-900 border-t-transparent mb-4"></div>
                <p className="text-neutral-700 font-mono text-xs tracking-wide">
                  {loadingStep}
                </p>
              </div>
            ) : (
              // ATTACH THE MOCKUP REF HERE TO CAPTURE THIS EXACT DIV
              <div
                ref={mockupRef}
                className="relative w-full max-w-[380px] aspect-[400/460] flex items-center justify-center bg-neutral-100"
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  {/* 1. Fabric Color Base */}
                  <div
                    className="absolute inset-0 transition-all duration-300"
                    style={{
                      backgroundColor: shirtColor,
                      WebkitMaskImage: `url(${activeView === "front" ? "/shirt_front.png" : "/shirt_back.png"})`,
                      maskImage: `url(${activeView === "front" ? "/shirt_front.png" : "/shirt_back.png"})`,
                      WebkitMaskSize: "contain",
                      maskSize: "contain",
                      WebkitMaskRepeat: "no-repeat",
                      maskRepeat: "no-repeat",
                      WebkitMaskPosition: "center",
                      maskPosition: "center",
                    }}
                  ></div>

                  {/* 2. AUTHENTIC SCREEN-PRINTED NECK LABEL */}
                  <div 
                    className={`absolute left-1/2 -translate-x-1/2 flex flex-col items-center text-center ${
                      activeView === 'front' ? 'top-[11.5%]' : 'top-[13%]'
                    }`}
                  >
                    <span className={`font-black tracking-[0.25em] text-[7px] ${shirtColor === '#f4f4f5' || shirtColor === '#e2e8f0' ? 'text-neutral-500' : 'text-white/40'}`}>
                      KASTAM
                    </span>
                    <span className={`font-mono tracking-widest text-[4px] mt-0.5 ${shirtColor === '#f4f4f5' || shirtColor === '#e2e8f0' ? 'text-neutral-400' : 'text-white/30'}`}>
                      HEAVYWEIGHT
                    </span>
                  </div>

                  {/* 3. Shadow/Wrinkle Map (Blends OVER the label and the color!) */}
                  <img
                    src={activeView === "front" ? "/shirt_front.png" : "/shirt_back.png"}
                    alt="Blank Garment"
                    className="absolute inset-0 w-full h-full object-contain mix-blend-multiply pointer-events-none z-10"
                  />
                </div>

                

                <div
                  className={`absolute z-10 flex items-center justify-center transition-all duration-300 overflow-hidden ${
                    activeView === "front"
                      ? "top-[28%] left-[30%] w-[40%] h-[40%]"
                      : "top-[18%] left-[27%] w-[46%] h-[55%] items-start pt-2"
                  }`}
                >
                  {currentDesign?.url ? (
                    <img
                      src={currentDesign.url}
                      alt={`Kastam ${activeView} artwork`}
                      className={`w-full max-h-full object-contain transition-opacity duration-300 ${blendClass}`}
                    />
                  ) : (
                    <div className="w-full h-full border-2 border-dashed border-neutral-400/60 rounded-lg flex flex-col items-center justify-center text-center p-3 bg-white/10 backdrop-blur-[1px] transition-colors hover:border-neutral-500">
                      <span className="text-[11px] font-mono font-bold tracking-wider text-neutral-600 uppercase">
                        {activeView} Zone
                      </span>
                      <span className="text-[9px] text-neutral-500 font-mono mt-0.5">
                        {activeView === "front"
                          ? 'Chest (10x10")'
                          : 'Full Back (14x16")'}
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
      <Footer />
    </div>
  );
}
