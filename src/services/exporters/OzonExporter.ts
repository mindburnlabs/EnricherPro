
import { EnrichedItem } from '../../types/domain.js';
import { IMarketplaceExporter, ExportResult } from './AbstractExporter.js';

export class OzonExporter implements IMarketplaceExporter {
    name = 'Ozon';

    validate(item: EnrichedItem): string[] {
        const errors: string[] = [];
        if (!item.data.mpn_identity.mpn) errors.push('Missing MPN');
        if (!item.data.supplier_title_raw && !item.data.mpn_identity.canonical_model_name) errors.push('Missing Name');
        // Ozon specific requiremenets
        if (!item.data.tech_specs.yield?.value) errors.push('Missing Yield (Rec. Attribute)');
        return errors;
    }

    async export(item: EnrichedItem): Promise<ExportResult> {
        const errors = this.validate(item);
        if (errors.length > 0) {
            return {
                success: false,
                errors,
                format: 'json'
            };
        }

        // Mapping to Ozon Item API V3 format (simplified)
        const ozonPayload = {
            attributes: [
                {
                    complex_id: 0,
                    id: 85, // Brand
                    values: [ { value: item.data.brand || "Unknown" } ]
                },
                {
                    complex_id: 0,
                    id: 9048, // Name
                    values: [ { value: item.data.supplier_title_raw || item.data.mpn_identity.canonical_model_name } ]
                },
                {
                    complex_id: 0,
                    id: 4194, // Images
                    values: item.data.images?.map(img => ({ value: img.url })) || []
                }
            ],
            offer_id: item.data.mpn_identity.mpn,
            barcode: item.data.gtin?.[0] || "",
            description_category_id: 17028760, // Consumables category ID (example)
            details: {
                weight: item.data.logistics?.package_weight_g || 0,
                weight_unit: "g",
                width: item.data.logistics?.width_mm,
                height: item.data.logistics?.height_mm,
                depth: item.data.logistics?.depth_mm,
                dimension_unit: "mm"
            }
        };

        return {
            success: true,
            data: ozonPayload,
            format: 'json',
            filename: `ozon_${item.data.mpn_identity.mpn}.json`
        };
    }
}
