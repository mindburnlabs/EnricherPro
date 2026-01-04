
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../src/db/index.js';
import { items } from '../src/db/schema.js';
import { OzonExporter } from '../src/services/exporters/OzonExporter.js';
import { YandexExporter } from '../src/services/exporters/YandexExporter.js';
import { WildberriesExporter } from '../src/services/exporters/WildberriesExporter.js';
import { eq } from 'drizzle-orm';

export default async function handler(request: VercelRequest, response: VercelResponse) {
    if (request.method !== 'GET') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const allItems = await db.select().from(items);

        const marketplace = (request.query.marketplace as string) || 'generic';
        const itemId = request.query.id as string;

        // Single Item Export Mode (if ID provided)
        if (itemId) {
            const item = await db.query.items.findFirst({
                where: eq(items.id, itemId)
            });

            if (!item) return response.status(404).json({ error: 'Item not found' });

            let exporter;
            switch(marketplace.toLowerCase()) {
                case 'ozon': exporter = new OzonExporter(); break;
                case 'yandex': exporter = new YandexExporter(); break;
                case 'wildberries': exporter = new WildberriesExporter(); break;
                default: break;
            }

            if (exporter) {
                const result = await exporter.export(item as any); // Type assertion for now due to DB mismatch
                if (!result.success) {
                    return response.status(400).json({ error: 'Validation Failed', details: result.errors });
                }

                if (result.format === 'xml') response.setHeader('Content-Type', 'application/xml');
                else response.setHeader('Content-Type', 'application/json');
                
                response.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
                return response.status(200).send(typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2));
            }
        }

        // ... Legacy CSV logic for bulk export ...

    } catch (error) {
        console.error("Export Failed:", error);
        response.status(500).json({ error: 'Export failed' });
    }
}
