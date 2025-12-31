
import type { VercelRequest } from '@vercel/node';

export const getTenantId = (req: VercelRequest): string => {
    const tenantHeader = req.headers['x-tenant-id'];
    if (!tenantHeader) return 'default';

    // Safety check: ensure tenant ID is alphanumeric to prevent injection (though prepared statements handle SQL)
    if (typeof tenantHeader === 'string' && /^[a-zA-Z0-9_\-]+$/.test(tenantHeader)) {
        return tenantHeader;
    }

    return 'default';
};
