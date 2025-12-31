import { db } from "../db/index.js";
import { sourceDocuments } from "../db/schema.js";
import { eq } from "drizzle-orm";
import crypto from "crypto";

export class SourceDocumentRepository {

    static async create(data: typeof sourceDocuments.$inferInsert) {
        // Generate content hash
        const hash = crypto.createHash('md5').update(data.rawContent || data.url).digest('hex');

        // Simple dedupe by URL + Content Hash? Or just URL?
        // For now, let's just insert. A unique constraint on URL might be good per job, but we might re-crawl.

        const [doc] = await db.insert(sourceDocuments).values({
            ...data,
            contentHash: hash
        }).returning();

        return doc;
    }

    static async findByJobId(jobId: string) {
        return db.query.sourceDocuments.findMany({
            where: eq(sourceDocuments.jobId, jobId)
        });
    }
}
