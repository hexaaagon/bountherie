import { Hono } from "hono";

export const router = new Hono();
// .route("/something", somethingRouter)

export type RouterRoutes = typeof router;
