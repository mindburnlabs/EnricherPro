import React from 'react';
import { Package, Truck, Info, AlertTriangle, CheckCircle } from 'lucide-react';
import { EnrichedItem } from '../../types/domain.js';

interface SKUCardProps {
    data: EnrichedItem | null;
    isLoading?: boolean;
}

export function SKUCard({ data, isLoading }: SKUCardProps) {
    if (isLoading) {
        return <div className="p-8 text-center text-gray-500 animate-pulse">Loading SKU Data...</div>;
    }

    if (!data) {
        return <div className="p-8 text-center text-gray-400">No SKU selected. Start a research job to see details.</div>;
    }

    const { data: sku } = data;

    return (
        <div className="p-6 space-y-8 animate-in slide-in-from-bottom-4 duration-500">
            {/* Identity Header */}
            <div className="space-y-2">
                <div className="flex items-center space-x-2">
                    <span className="px-2 py-1 text-xs font-bold uppercase tracking-wider bg-blue-100 text-blue-700 rounded-md dark:bg-blue-900/30 dark:text-blue-400">
                        {sku.brand || "Unknown Brand"}
                    </span>
                    {sku.mpn_identity?.mpn && (
                        <span className="text-sm font-mono text-gray-500">{sku.mpn_identity.mpn}</span>
                    )}
                </div>
                <h1 className="text-2xl font-bold leading-tight text-gray-900 dark:text-white">
                    {sku.supplier_title_raw || "Untitled Product"}
                </h1>
            </div>

            {/* Sections Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Technical Specs */}
                <section className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                    <h3 className="flex items-center text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
                        <Info className="w-4 h-4 mr-2 text-indigo-500" />
                        Technical Specifications
                    </h3>
                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-500 text-muted-foreground">Color</span>
                            <span className="font-medium text-gray-900 dark:text-gray-200">{sku.tech_specs?.color || "N/A"}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500 text-muted-foreground">Yield</span>
                            <span className="font-medium text-gray-900 dark:text-gray-200">
                                {sku.tech_specs?.yield?.value 
                                    ? `${sku.tech_specs.yield.value} ${sku.tech_specs.yield.unit || ''}` 
                                    : "N/A"}
                            </span>
                        </div>
                    </div>
                </section>

                {/* Logistics */}
                <section className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                    <h3 className="flex items-center text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
                        <Truck className="w-4 h-4 mr-2 text-emerald-500" />
                        Logistics
                    </h3>
                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-500 text-muted-foreground">Package Weight</span>
                            <span className="font-medium text-gray-900 dark:text-gray-200">
                                {sku.logistics?.package_weight_g 
                                    ? `${(sku.logistics.package_weight_g / 1000).toFixed(2)} kg` 
                                    : "N/A"}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500 text-muted-foreground">Dimensions</span>
                            <span className="font-medium text-gray-900 dark:text-gray-200">
                                {sku.logistics?.width_mm 
                                    ? `${sku.logistics.width_mm}x${sku.logistics.height_mm}x${sku.logistics.depth_mm} mm`
                                    : "N/A"}
                            </span>
                        </div>
                    </div>
                </section>
            </div>
            
             {/* Raw Data Accordion (Optional for Dev) */}
             {/* <details className="text-xs text-gray-500">
                <summary>Raw Data</summary>
                <pre>{JSON.stringify(sku, null, 2)}</pre>
            </details> */}
        </div>
    );
}
