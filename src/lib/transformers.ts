
import { ConsumableData } from '../types/domain';
import { items } from '../db/schema';
import { InferSelectModel } from 'drizzle-orm';

// Type alias for DB Item
type DbItem = InferSelectModel<typeof items>;

export const Transformers = {
    // Convert DB Row -> Domain Type
    toDomain: (dbItem: DbItem): ConsumableData => {
        // We trust the JSON data stored in 'data' column
        return dbItem.data as unknown as ConsumableData;
    },

    // Convert Domain Type -> DB Insert Structure
    toDbData: (domainData: ConsumableData) => {
        // In strict mode, we might filter fields, but for now we store the whole blob
        return domainData;
    }
};
