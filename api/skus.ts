import { db } from '../src/db/index.js';
import { skus } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';

export default async function handler(req: any, res: any) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { id } = req.query;

    if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid id' });
    }

    try {
        const skuData = await db.query.skus.findFirst({
            where: eq(skus.id, id),
            with: {
                claims: {
                    with: {
                        evidence: true
                    }
                },
                conflicts: true,
                printerCompatibility: {
                    with: {
                        printer: true,
                        evidence: true
                    }
                },
                similarProducts: true
            }
        });

        if (!skuData) {
            return res.status(404).json({ error: 'SKU not found' });
        }

        return res.status(200).json({ sku: skuData });

    } catch (error) {
        console.error('Failed to fetch SKU:', error);
        return res.status(500).json({ error: 'Internal Server Error', details: String(error) });
    }
}
