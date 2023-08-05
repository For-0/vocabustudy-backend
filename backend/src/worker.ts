import { verifyAndExtractJwt } from "function-utils/firebase-jwt";
import { getToken } from "function-utils/google-auth"
import type { Env } from "function-utils/common-types";

const unauthorized = () => new Response("Unauthorized", { status: 401 });

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);
        switch (url.pathname) {
            case '/delete-set/': {
                if (request.method === "OPTIONS" && ["https://vocabustudy.org", "http://localhost:5173"].includes(request.headers.get("Origin") as string)) return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": request.headers.get("Origin") as string } });
                if (request.method !== "POST") return new Response("Invalid method", { status: 405 });

                console.debug("Deleting set...");
                const reqBody = await request.json<{ id: string }>();
                if (!("id" in reqBody) || !reqBody.id) return new Response("Missing id", { status: 400 });
                const payload = await verifyAndExtractJwt(request.headers.get("Authorization"), env, caches.default);
                if (!payload) return unauthorized();
                console.debug("Verified JWT");
                // get the auth token
                const authToken = env.USE_FIREBASE_EMULATORS ? "owner" : await getToken(["https://www.googleapis.com/auth/datastore"], env.SERVICE_ACCOUNT_KEY, env.SERVICE_ACCOUNT_EMAIL);
                const setName = `projects/${env.GCP_PROJECT_ID}/databases/(default)/documents/sets/${reqBody.id}`;
                // setName but with the endpoint
                const endpoint = env.USE_FIREBASE_EMULATORS ? "http://localhost:8080/v1/" : "https://firestore.googleapis.com/v1/";
                const baseSetPath = `${endpoint}${setName}`;
                
                // fetch the set
                const docResponse = await fetch(`${baseSetPath}?mask=uid`, { headers: { Authorization: `Bearer ${authToken}` } });
                if (!docResponse.ok) return new Response("Non existent document", { status: 404 });
                const doc = await docResponse.json<{ fields: { uid: { stringValue: string } } }>();
                console.debug(doc);
                if (doc.fields?.uid?.stringValue !== payload.sub) return unauthorized();
                console.debug("Verified ownership and fetched set");

                // fetch all the social docs
                const listDocsResponse = await fetch(`${baseSetPath}/social?mask=__name__`, { headers: { Authorization: `Bearer ${authToken}` } });
                if (!listDocsResponse.ok) return new Response("Non existent document", { status: 404 });
                const listDocs = await listDocsResponse.json<{ documents: { name: string }[] }>();
                console.debug("Fetched social docs");
                const deleteDocs = [
                    ...listDocs.documents.map(doc => ({ delete: doc.name })),
                    { delete: setName }
                ];

                const deleteResponse = await fetch(`${endpoint}projects/${env.GCP_PROJECT_ID}/databases/(default)/documents:commit`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${authToken}` },
                    body: JSON.stringify({ writes: deleteDocs })
                });
                if (!deleteResponse.ok) return new Response("Failed to delete", { status: 500 });
                console.debug("Deleted set and socials");
                return new Response("Deleted", { status: 200 });
            }
            default:
                return new Response('404 Not Found', { status: 404 });
        }
	},
};
