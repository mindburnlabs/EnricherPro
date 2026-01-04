
import { EnrichedItem } from '../../types/domain.js';
import { IMarketplaceExporter, ExportResult } from './AbstractExporter.js';

export class YandexExporter implements IMarketplaceExporter {
    name = 'Yandex Market';

    validate(item: EnrichedItem): string[] {
        const errors: string[] = [];
        if (!item.data.mpn_identity.mpn) errors.push('Missing MPN');
        if (!item.data.brand) errors.push('Missing Brand');
        return errors;
    }

    async export(item: EnrichedItem): Promise<ExportResult> {
        const errors = this.validate(item);
        if (errors.length > 0) {
            return {
                success: false,
                errors,
                format: 'xml'
            };
        }

        // YML (Yandex Market Language) snippet
        const yml = `
<offer id="${item.data.mpn_identity.mpn}">
    <name>${item.data.supplier_title_raw || item.data.mpn_identity.canonical_model_name}</name>
    <vendor>${item.data.brand}</vendor>
    <vendorCode>${item.data.mpn_identity.mpn}</vendorCode>
    <description><![CDATA[${item.data.marketing?.description || ''}]]></description>
    ${item.data.images?.map(img => `<picture>${img.url}</picture>`).join('\n    ') || ''}
    <param name="Gewicht">${(item.data.logistics?.package_weight_g || 0) / 1000} kg</param>
    <param name="Compatibility">${item.data.compatible_printers_ru?.map(p => p.model).join(', ')}</param>
</offer>`;

        return {
            success: true,
            data: yml.trim(),
            format: 'xml',
            filename: `yandex_${item.data.mpn_identity.mpn}.xml`
        };
    }
}
