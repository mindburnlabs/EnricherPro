import React, { useState, useRef, useMemo } from 'react';
import { Play, FileText, Camera, Loader2, Sparkles, Wand2, Info } from 'lucide-react';
import { analyzeConsumableImage } from '../services/geminiService';

interface ImportViewProps {
  onImport: (inputs: string[]) => void;
}

const ImportView: React.FC<ImportViewProps> = ({ onImport }) => {
  const [text, setText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const itemCount = useMemo(() => {
    return text.split('\n').filter(l => l.trim().length > 0).length;
  }, [text]);

  const handleImport = () => {
    if (!text.trim()) return;
    const lines = text.split('\n').filter(l => l.trim().length > 0);
    onImport(lines);
    setText('');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAnalyzing(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const result = await analyzeConsumableImage(base64);
        setText(prev => (prev ? prev + '\n' + result : result));
        setAnalyzing(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Image analysis failed", err);
      setAnalyzing(false);
    }
  };

  return (
    <div className="p-4 md:p-12 max-w-6xl mx-auto w-full h-full flex flex-col overflow-y-auto">
      <div className="mb-10 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold mb-4">
          <Sparkles size={14} /> NEW: FIRECRAWL V2 SUPPORT
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-3 tracking-tight">
          Ready to enrich data?
        </h1>
        <p className="text-slate-500 max-w-xl mx-auto">
          Input your raw supplier strings or snap a photo of the product packaging. Our AI agent handles the research.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8 flex flex-col h-full">
          <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden flex flex-col transition-all border-indigo-100/50">
            <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
                <div className="flex items-center gap-2 font-bold text-slate-700">
                    <FileText size={18} className="text-indigo-500" /> 
                    Input Queue <span className="ml-2 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-md text-[10px] uppercase">{itemCount} items detected</span>
                </div>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={analyzing}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-md shadow-indigo-100"
                >
                  {analyzing ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                  {analyzing ? "AI Analysis..." : "Identify from Photo"}
                </button>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleFileChange} />
            </div>
            
            <div className="p-6">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="w-full h-64 md:h-80 p-4 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-mono text-sm resize-none focus:outline-none transition-all placeholder:text-slate-300"
                placeholder="Ex: HP CF234A Imaging Drum&#10;Kyocera DK-7105...&#10;Paste supplier data here..."
              />
            </div>

            <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                <button 
                    onClick={() => setText("Kyocera DK-7105 Drum Unit\nHP W1331X High Yield Black Toner\nHP 34A (CF234A) Set")}
                    className="text-sm text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-2 transition-colors"
                >
                    <Wand2 size={16} /> Load Magic Sample
                </button>
                
                <button 
                    onClick={handleImport}
                    disabled={!text.trim() || analyzing}
                    className="w-full sm:w-auto px-8 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-3 shadow-lg shadow-indigo-200 transition-all active:scale-95"
                >
                    <Play size={18} fill="currentColor" /> Run Enrichment Agent
                </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="bg-indigo-600 rounded-3xl p-6 text-white shadow-xl shadow-indigo-200">
            <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
              <Sparkles size={20} className="text-indigo-200" /> How it works
            </h3>
            <div className="space-y-4 text-sm text-indigo-100">
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center shrink-0 font-bold text-[10px]">1</div>
                <p><strong>Search:</strong> Gemini 3 Flash finds official source URLs.</p>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center shrink-0 font-bold text-[10px]">2</div>
                <p><strong>Scrape:</strong> Firecrawl v2 extracts deep markdown data.</p>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center shrink-0 font-bold text-[10px]">3</div>
                <p><strong>Think:</strong> Gemini 3 Pro reasons through compatibility.</p>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 rounded-3xl p-6 border border-amber-100">
             <div className="flex items-center gap-2 text-amber-800 font-bold mb-2">
               <Info size={18} /> Quality Tips
             </div>
             <p className="text-xs text-amber-700 leading-relaxed">
               For best results, include full manufacturer part numbers (MPNs). Image recognition works best with clear shots of the box labels.
             </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportView;