
import { EnrichedItem } from '../../types/domain.js';
import { IMarketplaceExporter, ExportResult } from './AbstractExporter.js';

export class WildberriesExporter implements IMarketplaceExporter {
    name = 'Wildberries';

    validate(item: EnrichedItem): string[] {
        const errors: string[] = [];
        if (!item.data.mpn_identity.mpn) errors.push('Missing VendorCode');
        if (!item.data.brand) errors.push('Missing Brand');
        // WB is strict about media
        if (!item.data.images || item.data.images.length === 0) errors.push('Missing Images');
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

        // WB Card Content API format (approximate)
        const wbPayload = [
            {
                vendorCode: item.data.mpn_identity.mpn,
                characteristics: [
                    { "Brand": item.data.brand },
                    { "Model": item.data.mpn_identity.canonical_model_name },
                    { "Yield": item.data.tech_specs.yield?.value }
                ],
                sizes: [
                    {
                        techSize: "one size",
                        wbSize: "",
                        price: 0, // Placeholder
                        skus: [ item.data.gtin?.[0] || item.data.mpn_identity.mpn ]
                    }
                ],
                mediaFiles: item.data.images?.map(img => img.url) || []
            }
        ];

        return {
            success: true,
            data: wbPayload,
            format: 'json',
            filename: `wb_${item.data.mpn_identity.mpn}.json`
        };
    }
}
