
import { db } from "../src/db/index";
import { frontier } from "../src/db/schema";
import { sql } from "drizzle-orm";

async function verify() {
    try {
        console.log("Verifying frontier table existence...");
        // Try to select 1 item or just count
        const result = await db.select({ count: sql<number>`count(*)` }).from(frontier);
        console.log("Success! Frontier table exists. Count:", result[0].count);
        process.exit(0);
    } catch (e) {
        console.error("Verification Failed:", e);
        process.exit(1);
    }
}

verify();
