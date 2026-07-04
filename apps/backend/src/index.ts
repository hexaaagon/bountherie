import { Hono } from 'hono';
import { type RouterRoutes, router } from './routes';

export type AppType = RouterRoutes;
const app = new Hono();

app.route('/', router);

export { router };
export default app;
