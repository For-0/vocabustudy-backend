import type { Env } from "function-utils/common-types";
import { verifyAndExtractJwt } from "function-utils/firebase-jwt";
import type { PagesFunction } from "@cloudflare/workers-types";

const unauthorized = () => new Response("Unauthorized", { status: 401 });

export const onRequest: PagesFunction<Env> = async ({ request, next, env }) => {
    const payload = await verifyAndExtractJwt(request.headers.get("Authorization"), env, caches.default);
    if (!payload) return unauthorized();
    if (payload.admin !== true) return unauthorized();
    return next();
}