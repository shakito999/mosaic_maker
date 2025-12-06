import React, { useState, useRef, useEffect } from 'react';
import PaletteSelector from './components/PaletteSelector';
import AnalysisPanel from './components/AnalysisPanel';
import { MosaicStyle, AnalysisData, PhysicalDimensions } from './types';
import { generateMosaicImage, analyzeMosaicMaterials } from './services/geminiService';

// Helper to safely detect API Key across different build environments (Vite, CRA, Next.js, etc.)
const getEnvironmentApiKey = (): string | null => {
  try {
    // 1. Try standard process.env (Webpack/Node injected)
    if (typeof process !== 'undefined' && process.env) {
      if (process.env.API_KEY) return process.env.API_KEY;
      if (process.env.REACT_APP_API_KEY) return process.env.REACT_APP_API_KEY; // Create React App
    }
    
    // 2. Try import.meta.env (Vite)
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      if (import.meta.env.VITE_API_KEY) return import.meta.env.VITE_API_KEY;
      // @ts-ignore
      if (import.meta.env.API_KEY) return import.meta.env.API_KEY;
    }
  } catch (e) {
    console.warn("Environment variable access failed", e);
  }
  return null;
};

const App: React.FC = () => {
  const [apiKey, setApiKey] = useState<string>('');
  const [selectedStyle, setSelectedStyle] = useState<MosaicStyle>(MosaicStyle.ROMAN_CLASSIC);
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Dimension State
  const [dimensions, setDimensions] = useState<PhysicalDimensions>({
      width: 50,
      height: 50,
      unit: 'cm'
  });

  // Handle API Key initialization
  useEffect(() => {
    const initKey = async () => {
        // 1. Check for Hardcoded/Environment Variable Key
        const envKey = getEnvironmentApiKey();
        if (envKey) {
            console.log("API Key found in environment variables");
            setApiKey(envKey);
            return;
        }

        // 2. Check if user has previously selected a key via AI Studio UI
        const win = window as any;
        if (win.aistudio) {
            try {
                const hasKey = await win.aistudio.hasSelectedApiKey();
                if (hasKey) {
                    setApiKey('AVAILABLE_VIA_ENV'); // Value doesn't matter, just needs to be truthy
                }
            } catch (e) {
                console.error("Error checking AI Studio key", e);
            }
        }
    };
    initKey();
  }, []);

  const handleSelectKey = async () => {
      const win = window as any;
      if (win.aistudio) {
          try {
             await win.aistudio.openSelectKey();
             // Assume success immediately to mitigate race condition
             setApiKey('AVAILABLE_VIA_ENV');
             setError(null);
          } catch (e) {
              console.error(e);
              setError("Failed to select API Key. Please try again.");
          }
      } else {
          setError("API Key configuration required. If deploying, set VITE_API_KEY in your environment variables.");
      }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSourceImage(reader.result as string);
        setGeneratedImage(null); // Reset previous result
        setAnalysisData(null);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDimensionChange = (field: keyof PhysicalDimensions, value: string | number) => {
      setDimensions(prev => ({
          ...prev,
          [field]: value
      }));
  };

  const handleGenerate = async () => {
    if (!sourceImage) return;
    
    // Ensure we have an indicator that a key is available
    const win = window as any;
    if (!apiKey) {
        if (win.aistudio) {
            await handleSelectKey();
        } else {
             setError("API Key is missing. Please add VITE_API_KEY to your environment variables.");
             return;
        }
    }

    setIsProcessing(true);
    setError(null);

    try {
      // If the key is just a placeholder flag, we rely on the env var or the injected key
      const activeKey = (apiKey === 'AVAILABLE_VIA_ENV' && process.env.API_KEY) 
        ? process.env.API_KEY 
        : (apiKey === 'AVAILABLE_VIA_ENV' ? '' : apiKey);
      
      // If we are in a deployed env where apiKey was set from VITE_API_KEY, use that
      const validKey = activeKey || getEnvironmentApiKey() || '';

      if (!validKey && !win.aistudio) {
         throw new Error("No valid API Key found. Please check your Vercel/Environment configuration.");
      }

      const [mosaicBase64, analysis] = await Promise.all([
        generateMosaicImage(validKey, sourceImage, selectedStyle, dimensions),
        analyzeMosaicMaterials(validKey, sourceImage, selectedStyle, dimensions)
      ]);

      // Prepend the data URL scheme if it's missing
      const finalImage = mosaicBase64.startsWith('data:') 
        ? mosaicBase64 
        : `data:image/jpeg;base64,${mosaicBase64}`;

      setGeneratedImage(finalImage);
      setAnalysisData(analysis);
    } catch (err: any) {
      console.error("Gemini Operation Failed:", err);
      let msg = err.message || '';
      
      try {
        if (msg.trim().startsWith('{')) {
             const parsed = JSON.parse(msg);
             if (parsed.error) {
                 msg = `[${parsed.error.code}] ${parsed.error.message} (${parsed.error.status})`;
             }
        }
      } catch (e) {
          // ignore json parse error
      }
      
      // Handle Permission Denied (403) or Not Found (404)
      if (msg.includes("403") || msg.includes("permission") || msg.includes("PERMISSION_DENIED")) {
          setError("Access Denied. Please ensure you have a valid API key selected.");
          setApiKey(''); // Reset local state
          
          const win = window as any;
          if (win.aistudio) {
              try {
                  await win.aistudio.openSelectKey();
                  setApiKey('AVAILABLE_VIA_ENV');
              } catch (selectErr) {
                  console.error("Key re-selection failed", selectErr);
              }
          }
      } else if (msg.includes("not found")) {
          setError("Model not found. Please try refreshing or re-selecting your API key.");
          const win = window as any;
          if (win.aistudio) {
              await win.aistudio.openSelectKey();
          }
      } else {
          setError(msg || "An error occurred while generating the mosaic.");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 selection:bg-amber-500/30 font-sans">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded flex items-center justify-center shadow-lg shadow-amber-500/20">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-slate-900">
                <path fillRule="evenodd" d="M3 6a3 3 0 013-3h2.25a3 3 0 013 3v2.25a3 3 0 01-3 3H6a3 3 0 01-3-3V6zm9.75 0a3 3 0 013-3H18a3 3 0 013 3v2.25a3 3 0 01-3 3h-2.25a3 3 0 01-3-3V6zM3 15.75a3 3 0 013-3h2.25a3 3 0 013 3V18a3 3 0 01-3 3H6a3 3 0 01-3-3v-2.25zm9.75 0a3 3 0 013-3H18a3 3 0 013 3V18a3 3 0 01-3 3h-2.25a3 3 0 01-3-3v-2.25z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-serif text-slate-100 tracking-wider">OPUS MOSAIC ARCHITECT</h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em]">Est. MMXXIV • Gen AI Powered</p>
            </div>
          </div>
          
          {!apiKey && (
             <button 
                onClick={handleSelectKey}
                className="text-xs font-bold text-amber-500 border border-amber-500 px-4 py-2 rounded hover:bg-amber-500/10 transition"
             >
                CONNECT API KEY
             </button>
          )}
           {apiKey && (
             <button
                onClick={handleSelectKey}
                className="text-xs text-green-500 flex items-center gap-1 hover:text-green-400 transition-colors"
                title="Click to change API Key"
             >
                 <span className="w-2 h-2 rounded-full bg-green-500"></span>
                 SYSTEM ONLINE
             </button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        
        {/* Style Selector */}
        <section>
          <PaletteSelector selectedStyle={selectedStyle} onSelect={setSelectedStyle} />
        </section>

        {/* Main Work Area */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left Column: Source & Controls */}
            <div className="lg:col-span-4 space-y-6">
                 {/* Image Uploader */}
                 <div className="bg-slate-900 rounded-lg border border-slate-800 p-4 space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                        <h3 className="text-xs font-bold text-slate-400 uppercase">1. Upload Reference</h3>
                         <label className="cursor-pointer text-xs text-amber-500 hover:text-amber-400 font-bold flex items-center gap-1 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                            </svg>
                            SELECT FILE
                            <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                        </label>
                    </div>
                    
                    <div className="aspect-square relative bg-slate-950 flex items-center justify-center overflow-hidden group rounded border border-slate-800">
                        {sourceImage ? (
                            <img src={sourceImage} alt="Source" className="w-full h-full object-cover" />
                        ) : (
                            <div className="text-center p-8">
                                <p className="text-slate-600 mb-2 text-sm">No Image Selected</p>
                                <label className="inline-block px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer transition text-xs uppercase tracking-wide">
                                    Browse
                                    <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                                </label>
                            </div>
                        )}
                        {sourceImage && (
                             <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                <span className="text-white font-serif tracking-widest text-sm">ORIGINAL</span>
                             </div>
                        )}
                    </div>
                 </div>

                 {/* Dimensions Input */}
                 <div className="bg-slate-900 rounded-lg border border-slate-800 p-4 space-y-4">
                     <div className="border-b border-slate-800 pb-2">
                        <h3 className="text-xs font-bold text-slate-400 uppercase">2. Physical Dimensions</h3>
                     </div>
                     <div className="grid grid-cols-3 gap-3">
                         <div>
                             <label className="block text-[10px] text-slate-500 uppercase mb-1">Width</label>
                             <input 
                                type="number" 
                                value={dimensions.width}
                                onChange={(e) => handleDimensionChange('width', parseFloat(e.target.value))}
                                className="w-full bg-slate-800 border border-slate-700 text-white rounded px-2 py-1 text-sm focus:border-amber-500 outline-none transition"
                             />
                         </div>
                         <div>
                             <label className="block text-[10px] text-slate-500 uppercase mb-1">Height</label>
                             <input 
                                type="number" 
                                value={dimensions.height}
                                onChange={(e) => handleDimensionChange('height', parseFloat(e.target.value))}
                                className="w-full bg-slate-800 border border-slate-700 text-white rounded px-2 py-1 text-sm focus:border-amber-500 outline-none transition"
                             />
                         </div>
                         <div>
                             <label className="block text-[10px] text-slate-500 uppercase mb-1">Unit</label>
                             <select 
                                value={dimensions.unit}
                                onChange={(e) => handleDimensionChange('unit', e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 text-white rounded px-2 py-1 text-sm focus:border-amber-500 outline-none transition"
                             >
                                 <option value="cm">CM</option>
                                 <option value="m">M</option>
                                 <option value="in">IN</option>
                             </select>
                         </div>
                     </div>
                     <p className="text-[10px] text-slate-500 italic">
                        * Dimensions influence the calculated tesserae count and tile density.
                     </p>
                 </div>

                 {/* Action Button */}
                 <button 
                    onClick={handleGenerate}
                    disabled={!sourceImage || isProcessing}
                    className={`
                        w-full py-4 px-6 rounded-lg font-bold tracking-widest text-sm uppercase transition-all duration-300 flex items-center justify-center gap-3
                        ${!sourceImage || isProcessing 
                            ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                            : 'bg-amber-500 hover:bg-amber-400 text-slate-900 shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:shadow-[0_0_30px_rgba(245,158,11,0.5)] translate-y-0 hover:-translate-y-1'}
                    `}
                 >
                    {isProcessing ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-slate-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Laying Tesserae...
                        </>
                    ) : (
                        <>
                           <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                            </svg>
                            GENERATE BLUEPRINT
                        </>
                    )}
                 </button>
                 
                 {error && (
                     <div className="p-4 bg-red-900/30 border border-red-800/50 rounded flex gap-3 items-start animate-in slide-in-from-top-2">
                         <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-red-500 shrink-0 mt-0.5">
                            <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
                         </svg>
                         <p className="text-red-200 text-sm leading-relaxed break-words">{error}</p>
                     </div>
                 )}
            </div>

            {/* Middle & Right: Result & Analysis */}
            <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                 
                 {/* Generated Result */}
                 <div className="bg-slate-900 rounded-lg border border-slate-800 p-1 md:col-span-2 lg:col-span-1 h-fit">
                    <div className="p-3 border-b border-slate-800 flex justify-between items-center">
                        <h3 className="text-xs font-bold text-amber-500 uppercase flex items-center gap-2">
                             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                <path fillRule="evenodd" d="M1.5 6a2.25 2.25 0 012.25-2.25h16.5A2.25 2.25 0 0122.5 6v12a2.25 2.25 0 01-2.25 2.25H3.75A2.25 2.25 0 011.5 18V6zM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0021 18v-1.94l-2.69-2.689a1.5 1.5 0 00-2.12 0l-.88.879.97.97a.75.75 0 11-1.06 1.06l-5.16-5.159a1.5 1.5 0 00-2.12 0L3 16.061zm10.125-7.81a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0z" clipRule="evenodd" />
                             </svg>
                             Mosaic Blueprint
                        </h3>
                         {generatedImage && (
                            <a href={generatedImage} download="mosaic-blueprint.jpg" className="text-xs text-slate-500 hover:text-slate-300">
                                DOWNLOAD
                            </a>
                        )}
                    </div>
                    <div className="aspect-square relative bg-slate-950 flex items-center justify-center overflow-hidden min-h-[300px]">
                        {generatedImage ? (
                            <img src={generatedImage} alt="Generated Mosaic" className="w-full h-full object-cover animate-in fade-in duration-1000" />
                        ) : (
                             <div className="text-center p-8 opacity-20">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-24 h-24 mx-auto mb-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                                </svg>
                                <p className="font-serif">Blueprint Area</p>
                            </div>
                        )}
                    </div>
                 </div>

                 {/* Analysis Panel */}
                 <div className="md:col-span-2 lg:col-span-1">
                     <AnalysisPanel data={analysisData} isLoading={isProcessing && !analysisData} />
                 </div>

            </div>
        </section>

        {/* Footer info */}
        <section className="border-t border-slate-800 pt-8 text-center text-slate-500 text-xs">
            <p className="mb-2">Powered by Google Gemini 2.5 Flash</p>
            <p>
                The generated images are artistic interpretations meant for blueprinting and inspiration. 
                Actual mosaic fabrication requires manual adjustment of tesserae lines.
            </p>
        </section>

      </main>
    </div>
  );
};

export default App;