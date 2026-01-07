import { useState } from "react";
import { Search, Upload, ArrowRight, Zap, Shield, Clock, Box } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface HomeScreenProps {
  onStartEnrichment: (supplierString: string) => void;
  onBulkUpload: () => void;
}

const suggestions = [
  "HP CE505X Black LaserJet Toner 80A",
  "Canon PG-545XL Black Ink Cartridge",
  "Epson T1281 Black Fox Series",
  "Brother TN-2420 Toner Cartridge",
];

export function HomeScreen({ onStartEnrichment, onBulkUpload }: HomeScreenProps) {
  const { t } = useTranslation('home');
  const [inputValue, setInputValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const features = [
    {
      icon: Zap,
      title: t('features.extraction_title', "AI-Powered Extraction"),
      description: t('features.extraction_desc', "Automatically extract MPN, brand, and specs from any supplier string"),
    },
    {
      icon: Shield,
      title: t('features.verification_title', "Multi-Source Verification"),
      description: t('features.verification_desc', "Cross-reference data from official sites, marketplaces, and PDFs"),
    },
    {
      icon: Clock,
      title: t('features.realtime_title', "Real-Time Processing"),
      description: t('features.realtime_desc', "Watch agents work in real-time with full transparency"),
    },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onStartEnrichment(inputValue.trim());
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion);
    onStartEnrichment(suggestion);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-3xl mx-auto space-y-12 animate-fade-in">
        {/* Hero */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <Box className="w-4 h-4" />
            <span>{t('badge', 'AI Data Enrichment')}</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
              beta
            </Badge>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
            {t('title_prefix', 'Enrich product data')}
            <br />
            <span className="text-primary">{t('title_suffix', 'in seconds')}</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            {t('subtitle', 'Paste a supplier string and let our AI agents extract, verify, and format product data for any marketplace.')}
          </p>
        </div>

        {/* Search Input */}
        <form onSubmit={handleSubmit} className="relative">
          <div 
            className={cn(
              "relative rounded-2xl border-2 bg-card transition-all duration-300",
              isFocused 
                ? "border-primary shadow-lg shadow-primary/10" 
                : "border-border hover:border-muted-foreground/30"
            )}
          >
            <div className="flex items-center px-5 py-4">
              <Search className={cn(
                "w-5 h-5 mr-4 transition-colors flex-shrink-0",
                isFocused ? "text-primary" : "text-muted-foreground"
              )} />
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder={t('search_placeholder', "Enter supplier string (e.g., 'HP CE505X Black LaserJet Toner 80A')")}
                className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground outline-none text-lg"
              />
              <Button 
                type="submit" 
                size="lg"
                disabled={!inputValue.trim()}
                className="ml-4 rounded-xl px-6 gap-2"
              >
                <span>{t('enrich_btn', 'Enrich')}</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Bulk Upload */}
          <div className="flex items-center justify-center mt-4">
            <Button 
              type="button" 
              variant="ghost" 
              onClick={onBulkUpload}
              className="text-muted-foreground hover:text-foreground gap-2"
            >
              <Upload className="w-4 h-4" />
              <span>{t('bulk_upload', 'Or upload CSV for bulk processing')}</span>
            </Button>
          </div>
        </form>

        {/* Suggestions */}
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground text-center">{t('try_example', 'Try an example:')}</p>
          <div className="flex flex-wrap justify-center gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => handleSuggestionClick(suggestion)}
                className="px-4 py-2 rounded-full bg-secondary/50 hover:bg-secondary text-sm text-foreground transition-colors border border-border hover:border-muted-foreground/30"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8">
          {features.map((feature) => (
            <div 
              key={feature.title}
              className="text-center p-6 rounded-xl bg-card/50 border border-border/50"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
