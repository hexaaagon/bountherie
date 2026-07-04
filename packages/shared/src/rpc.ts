import { hc } from 'hono/client';
import type { router as backendRouter } from '../../../apps/backend/src/index';

const baseUrl =
  process.env.DASHBOARD_BACKEND_URL || `${process.env.NEXT_PUBLIC_APP_URL}/api` || '/api';

export type { backendRouter };

export type Client = ReturnType<typeof hc<typeof backendRouter>>;
export const hcWithType = (...args: Parameters<typeof hc>): Client =>
  hc<typeof backendRouter>(...args);

export const client = hcWithType(baseUrl);
