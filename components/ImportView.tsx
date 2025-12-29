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
    <div className="max-w-6xl mx-auto w-full flex flex-col animate-in">
      <div className="mb-12 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-[10px] font-bold mb-4 border border-indigo-500/20 tracking-wider">
          <Sparkles size={12} /> NEW: FIRECRAWL V2 SUPPORT
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4 tracking-tight">
          Ready to <span className="text-indigo-400">enrich</span> data?
        </h1>
        <p className="text-slate-400 max-w-xl mx-auto text-lg">
          Input your raw supplier strings or snap a photo of the product packaging. Our AI agent handles the research.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pb-20">
        <div className="lg:col-span-8 flex flex-col">
          <div className="glass-card rounded-[2rem] overflow-hidden flex flex-col transition-all">
            <div className="px-8 py-6 bg-white/5 border-b border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-3 font-bold text-slate-200">
                <FileText size={20} className="text-indigo-400" />
                <span>Input Queue</span>
                <span className="ml-2 px-2 py-0.5 bg-indigo-500/20 text-indigo-400 rounded-lg text-[10px] uppercase tracking-wider">{itemCount} items detected</span>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={analyzing}
                className="premium-button flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 rounded-xl disabled:opacity-50 shadow-lg shadow-indigo-900/40"
              >
                {analyzing ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                {analyzing ? "AI Analysis..." : "Identify from Photo"}
              </button>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleFileChange} />
            </div>

            <div className="p-8">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="w-full h-64 md:h-80 p-6 bg-white/5 border-2 border-white/5 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 text-white font-mono text-sm resize-none focus:outline-none transition-all placeholder:text-slate-600"
                placeholder="Ex: HP CF234A Imaging Drum&#10;Kyocera DK-7105...&#10;Paste supplier data here..."
              />
            </div>

            <div className="px-8 py-6 bg-white/5 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
              <button
                onClick={() => setText("Kyocera DK-7105 Drum Unit\nHP W1331X High Yield Black Toner\nHP 34A (CF234A) Set")}
                className="text-sm text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-2 transition-colors"
              >
                <Wand2 size={16} /> Load Magic Sample
              </button>

              <button
                onClick={handleImport}
                disabled={!text.trim() || analyzing}
                className="premium-button w-full sm:w-auto px-10 py-4 bg-indigo-600 text-white rounded-2xl text-sm font-bold hover:bg-indigo-500 disabled:opacity-50 flex items-center justify-center gap-3 shadow-xl shadow-indigo-900/40"
              >
                <Play size={18} fill="currentColor" /> Run Enrichment Agent
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="glass-card rounded-[2rem] p-8 relative overflow-hidden group">
            <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-indigo-600/10 rounded-full blur-3xl transition-all group-hover:bg-indigo-600/20"></div>
            <h3 className="font-bold text-xl text-white mb-6 flex items-center gap-3">
              <Sparkles size={22} className="text-indigo-400" /> How it works
            </h3>
            <div className="space-y-6 text-sm">
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/20 flex items-center justify-center shrink-0 font-bold text-indigo-400">1</div>
                <div>
                  <p className="text-white font-bold mb-1">Search</p>
                  <p className="text-slate-400 leading-relaxed uppercase text-[10px] tracking-widest font-bold">Gemini 3 Flash</p>
                  <p className="text-xs text-slate-500 mt-1">Locates official source URLs for precision.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/20 flex items-center justify-center shrink-0 font-bold text-indigo-400">2</div>
                <div>
                  <p className="text-white font-bold mb-1">Scrape</p>
                  <p className="text-slate-400 leading-relaxed uppercase text-[10px] tracking-widest font-bold">Firecrawl v2</p>
                  <p className="text-xs text-slate-500 mt-1">Deep markdown extraction from raw web sources.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/20 flex items-center justify-center shrink-0 font-bold text-indigo-400">3</div>
                <div>
                  <p className="text-white font-bold mb-1">Think</p>
                  <p className="text-slate-400 leading-relaxed uppercase text-[10px] tracking-widest font-bold">Gemini 3 Pro</p>
                  <p className="text-xs text-slate-500 mt-1">Logic-driven synthesis for global compatibility.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-amber-500/5 rounded-[2rem] p-8 border border-amber-500/10">
            <div className="flex items-center gap-2 text-amber-500 font-bold mb-3 uppercase text-[10px] tracking-widest">
              <Info size={16} /> Quality Tips
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              For best results, include full manufacturer part numbers (MPNs). Image recognition works best with clear shots of the box labels.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportView;