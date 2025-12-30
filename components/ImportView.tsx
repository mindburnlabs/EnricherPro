import React, { useState, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, FileText, Camera, Loader2, Sparkles, Wand2, Info } from 'lucide-react';

interface ImportViewProps {
  onImport: (inputs: string[]) => void;
}

const ImportView: React.FC<ImportViewProps> = ({ onImport }) => {
  const { t } = useTranslation('import');
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
    // Image analysis temporarily disabled
    console.warn("Image analysis feature requires an active vision model.");
    setAnalyzing(false);
  };

  return (
    <div className="max-w-6xl mx-auto w-full flex flex-col animate-in">
      <div className="mb-12 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-[10px] font-bold mb-4 border border-indigo-500/20 tracking-wider">
          <Sparkles size={12} /> {t('new_badge')}
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold text-primary mb-4 tracking-tight">
          {t('title_prefix')} <span className="text-indigo-600 dark:text-indigo-400">{t('title_highlight')}</span> {t('title_suffix')}
        </h1>
        <p className="text-primary-subtle max-w-xl mx-auto text-lg">
          {t('subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pb-20">
        <div className="lg:col-span-8 flex flex-col">
          <div className="glass-card rounded-[2rem] overflow-hidden flex flex-col transition-all bg-card border border-border-subtle">
            <div className="px-8 py-6 bg-surface border-b border-border-subtle flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-3 font-bold text-primary">
                <FileText size={20} className="text-primary-accent" />
                <span>{t('input_queue.title')}</span>
                <span className="ml-2 px-2 py-0.5 bg-primary-accent/20 text-primary-accent rounded-lg text-[10px] uppercase tracking-wider">{itemCount} {t('input_queue.detected')}</span>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={analyzing}
                className="premium-button flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-primary-accent rounded-xl disabled:opacity-50 shadow-lg shadow-indigo-900/40"
              >
                {analyzing ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                {analyzing ? t('input_queue.analyzing') : t('input_queue.identify_btn')}
              </button>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleFileChange} />
            </div>

            <div className="p-8">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="w-full h-64 md:h-80 p-6 bg-surface/50 border-2 border-border-subtle rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 text-base font-mono text-primary resize-none focus:outline-none transition-all placeholder:text-primary-subtle"
                placeholder={t('input_queue.placeholder')}
              />
            </div>

            <div className="px-8 py-6 bg-surface border-t border-border-subtle flex flex-col sm:flex-row justify-between items-center gap-4">
              <button
                onClick={() => setText("Kyocera DK-7105 Drum Unit\nHP W1331X High Yield Black Toner\nHP 34A (CF234A) Set")}
                className="text-sm text-primary-accent hover:text-primary-accent-hover font-bold flex items-center gap-2 transition-colors"
              >
                <Wand2 size={16} /> {t('input_queue.magic_sample')}
              </button>

              <button
                onClick={handleImport}
                disabled={!text.trim() || analyzing}
                className="premium-button w-full sm:w-auto px-10 py-4 bg-primary-accent text-white rounded-2xl text-sm font-bold hover:bg-primary-accent-hover disabled:opacity-50 flex items-center justify-center gap-3 shadow-xl shadow-indigo-900/40"
              >
                <Play size={18} fill="currentColor" /> {t('input_queue.run_agent')}
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="glass-card rounded-[2rem] p-8 relative overflow-hidden group bg-card border border-border-subtle">
            <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-indigo-600/10 rounded-full blur-3xl transition-all group-hover:bg-indigo-600/20"></div>
            <h3 className="font-bold text-xl text-primary mb-6 flex items-center gap-3">
              <Sparkles size={22} className="text-primary-accent" /> {t('how_it_works.title')}
            </h3>
            <div className="space-y-6 text-sm">
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-xl bg-primary-accent/20 border border-primary-accent/20 flex items-center justify-center shrink-0 font-bold text-primary-accent">1</div>
                <div>
                  <p className="text-primary font-bold mb-1">{t('how_it_works.step1_title')}</p>
                  <p className="text-primary-subtle leading-relaxed uppercase text-[10px] tracking-widest font-bold">{t('how_it_works.step1_subtitle')}</p>
                  <p className="text-xs text-primary-subtle mt-1">{t('how_it_works.step1_desc')}</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-xl bg-primary-accent/20 border border-primary-accent/20 flex items-center justify-center shrink-0 font-bold text-primary-accent">2</div>
                <div>
                  <p className="text-primary font-bold mb-1">{t('how_it_works.step2_title')}</p>
                  <p className="text-primary-subtle leading-relaxed uppercase text-[10px] tracking-widest font-bold">{t('how_it_works.step2_subtitle')}</p>
                  <p className="text-xs text-primary-subtle mt-1">{t('how_it_works.step2_desc')}</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-xl bg-primary-accent/20 border border-primary-accent/20 flex items-center justify-center shrink-0 font-bold text-primary-accent">3</div>
                <div>
                  <p className="text-primary font-bold mb-1">{t('how_it_works.step3_title')}</p>
                  <p className="text-primary-subtle leading-relaxed uppercase text-[10px] tracking-widest font-bold">{t('how_it_works.step3_subtitle')}</p>
                  <p className="text-xs text-primary-subtle mt-1">{t('how_it_works.step3_desc')}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-amber-500/5 rounded-[2rem] p-8 border border-amber-500/10 bg-card">
            <div className="flex items-center gap-2 text-amber-500 font-bold mb-3 uppercase text-[10px] tracking-widest">
              <Info size={16} /> {t('tips.title')}
            </div>
            <p className="text-xs text-primary-subtle leading-relaxed">
              {t('tips.desc')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportView;