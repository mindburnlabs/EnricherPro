import React, { useState } from 'react';
import { Image as ImageIcon, ZoomIn, X, Download, CheckCircle, AlertOctagon } from 'lucide-react';

interface ImageGalleryProps {
    images?: {
        url: string;
        alt?: string;
        type?: 'product' | 'datasheet';
        status?: 'ok' | 'flagged' | 'pending';
    }[];
}

export const ImageGallery: React.FC<ImageGalleryProps> = ({ images = [] }) => {
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    // Mock images if empty
    const displayImages = images.length > 0 ? images : [
        { url: 'https://placehold.co/600x400/png?text=Product+Image', alt: 'Placeholder 1', status: 'ok' },
        { url: 'https://placehold.co/600x400/png?text=Side+View', alt: 'Placeholder 2', status: 'pending' },
        { url: 'https://placehold.co/600x400/png?text=Datasheet+Snippet', alt: 'Datasheet', status: 'flagged' }
    ] as any[];

    return (
        <section className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
            <h3 className="flex items-center text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
                <ImageIcon className="w-4 h-4 mr-2 text-pink-500" />
                Media Gallery
            </h3>

            <div className="grid grid-cols-3 gap-2">
                {displayImages.map((img, idx) => (
                    <div 
                        key={idx} 
                        className="group relative aspect-square rounded-lg overflow-hidden border border-gray-100 dark:border-gray-800 cursor-pointer bg-gray-50 dark:bg-gray-800"
                        onClick={() => setSelectedImage(img.url)}
                    >
                        <img 
                            src={img.url} 
                            alt={img.alt || 'Product Image'} 
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" 
                        />
                        
                        {/* Hover Overlay */}
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <ZoomIn className="text-white drop-shadow-md" size={24} />
                        </div>

                        {/* Status Badge */}
                        <div className="absolute top-1 right-1">
                             {img.status === 'ok' && <CheckCircle size={14} className="text-emerald-500 fill-white dark:fill-gray-900" />}
                             {img.status === 'flagged' && <AlertOctagon size={14} className="text-red-500 fill-white dark:fill-gray-900" />}
                        </div>
                    </div>
                ))}
            </div>

            {selectedImage && (
                <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setSelectedImage(null)}>
                    <div className="relative max-w-5xl w-full max-h-[90vh]" onClick={e => e.stopPropagation()}>
                        <img 
                            src={selectedImage} 
                            alt="Full Preview" 
                            className="w-full h-full object-contain rounded-lg shadow-2xl" 
                        />
                        
                        <button 
                            onClick={() => setSelectedImage(null)}
                            className="absolute -top-12 right-0 text-white hover:text-gray-300 transition"
                        >
                            <X size={32} />
                        </button>
                    </div>
                </div>
            )}
        </section>
    );
};
