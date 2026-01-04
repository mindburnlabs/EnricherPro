import { db } from '../db/index.js';
import { claims } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export class ClaimsRepository {
  static async create(data: typeof claims.$inferInsert) {
    const [claim] = await db.insert(claims).values(data).returning();
    return claim;
  }

  static async createBatch(data: (typeof claims.$inferInsert)[]) {
    if (data.length === 0) return [];
    return db.insert(claims).values(data).returning();
  }

  static async findByItemId(itemId: string) {
    return db.query.claims.findMany({
      where: eq(claims.itemId, itemId),
    });
  }
}
