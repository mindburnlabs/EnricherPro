
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../src/db';
import { items } from '../src/db/schema';
import Papa from 'papaparse';

export default async function handler(request: VercelRequest, response: VercelResponse) {
    if (request.method !== 'GET') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const allItems = await db.select().from(items);

        const format = (request.query.format as string) || 'csv';

        if (format === 'json') {
            response.setHeader('Content-Type', 'application/json');
            response.setHeader('Content-Disposition', 'attachment; filename="enriched_data.json"');
            return response.status(200).send(JSON.stringify(allItems, null, 2));
        }

        // Flatten data for CSV
        const csvData = allItems.map(item => {
            const d = item.data as any;
            return {
                id: item.id,
                status: item.status,
                mpn: d?.mpn_identity?.mpn || "",
                canonical_name: d?.mpn_identity?.canonical_name || "",
                brand: d?.brand || "",
                part_numbers: Array.isArray(d?.part_numbers) ? d.part_numbers.join(", ") : "",
                weight_g: d?.packaging_from_nix?.weight_g || d?.logistics?.weight || "",
                width_mm: d?.packaging_from_nix?.width_mm || d?.logistics?.width || "",
                depth_mm: d?.packaging_from_nix?.depth_mm || d?.logistics?.depth || "",
                height_mm: d?.packaging_from_nix?.height_mm || d?.logistics?.height || "",
                compatible_printers: (d?.compatible_printers_ru || d?.compatibility_ru?.printers || []).join("; "),
                yield_pages: d?.specs?.yield_pages || "",
                color: d?.specs?.color || "",
                updated_at: item.updatedAt
            };
        });

        const csvString = Papa.unparse(csvData);

        // Add BOM for Excel compatibility
        const bom = "\uFEFF";

        response.setHeader('Content-Type', 'text/csv; charset=utf-8');
        response.setHeader('Content-Disposition', 'attachment; filename="enriched_data.csv"');
        response.status(200).send(bom + csvString);

    } catch (error) {
        console.error("Export Failed:", error);
        response.status(500).json({ error: 'Export failed' });
    }
}
