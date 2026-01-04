import { db } from '../../db/index.js';
import { printerModels, skuPrinterCompatibility } from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';

export class CompatibilityGraphBuilder {
  /**
   * Persists a list of compatible printers for a SKU.
   * Deduplicates printer models and creates edges.
   */
  static async build(
    skuId: string,
    printers: string[],
    sourceUrl: string,
    brand: string = 'Unknown',
  ) {
    if (!printers || printers.length === 0) return;

    console.log(
      `[CompatibilityGraphBuilder] Processing ${printers.length} printers for SKU ${skuId}`,
    );

    for (const printerRaw of printers) {
      const printerName = printerRaw.trim();
      if (!printerName) continue;

      // 1. Upsert Printer Model
      // Since we don't have a complex entity resolution yet, we'll try to match exact name + brand
      // or create new.

      let printerId: string | null = null;

      const existing = await db.query.printerModels.findFirst({
        where: and(eq(printerModels.modelName, printerName), eq(printerModels.brand, brand)),
      });

      if (existing) {
        printerId = existing.id;
      } else {
        // Create new
        // Handle potential race condition with insert-on-conflict or just try/catch
        try {
          const [inserted] = await db
            .insert(printerModels)
            .values({
              brand: brand,
              modelName: printerName,
              metadata: { source: 'miner' },
            })
            .returning();
          printerId = inserted.id;
        } catch (e) {
          // Likely duplicate race, fetch again
          const retry = await db.query.printerModels.findFirst({
            where: and(eq(printerModels.modelName, printerName), eq(printerModels.brand, brand)),
          });
          if (retry) printerId = retry.id;
        }
      }

      if (printerId) {
        // 2. Create Compatibility Edge
        try {
          await db
            .insert(skuPrinterCompatibility)
            .values({
              skuId: skuId,
              printerId: printerId,
              verified: false, // Miner data is unverified by default unless cross-checked
              // We could link an evidence ID here if we stored the source document first
            })
            .onConflictDoNothing();
        } catch (e) {
          console.error(`[CompatibilityGraphBuilder] Failed to link printer ${printerId}:`, e);
        }
      }
    }
  }
}
