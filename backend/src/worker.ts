//import { verifyAndExtractJwt } from "function-utils/firebase-jwt";
//import { getToken } from "function-utils/google-auth"
import type { Env } from "function-utils/common-types";
import { getHelperForm, getHelperFormSubmitResponse } from "./discord-interaction-response";

//const unauthorized = () => new Response("Unauthorized", { status: 401 });
const discordPublicKey = await crypto.subtle.importKey(
    "raw",
    Uint8Array.from([196,96,212,160,198,163,66,168,136,92,222,174,133,204,61,169,47,2,200,184,138,10,121,213,225,234,36,177,219,14,78,170]),
    "Ed25519",
    false,
    ["verify"]
);

function respondJson(json: object) {
    return new Response(JSON.stringify(json), {
        headers: {
            "Content-Type": "application/json"
        },
        status: 200
    });
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);
        switch (url.pathname) {
            /*case '/delete-set/': {
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
            }*/
            case '/discord-interaction/': {
                if (request.method !== "POST") return new Response("Invalid method", { status: 405 });
                const body = await request.text();
                const signature = request.headers.get("X-Signature-Ed25519");
                const timestamp = request.headers.get("X-Signature-Timestamp");
                if (!signature || !timestamp) return new Response("Missing signature or timestamp", { status: 401 });
                const signatureBytes = signature.match(/[\da-f]{2}/gi);
                if (!signatureBytes) return new Response("Invalid signature", { status: 401 });
                const isVerified = await crypto.subtle.verify(
                    { name: "Ed25519" },
                    discordPublicKey,
                    Uint8Array.from(signatureBytes, h => parseInt(h, 16)),
                    new TextEncoder().encode(timestamp + body)
                );
                if (!isVerified) return new Response("Invalid signature", { status: 401 });
                const { member, type, data } = JSON.parse(body);
                if (type === 1) return respondJson({ type: 1 });
                else if (type === 2 && data.name === "helperform") return respondJson(await getHelperForm(member, env));
                else if (type === 5 && data.custom_id === "helper_application_modal") return respondJson(await getHelperFormSubmitResponse(member, data, env));
            }
            default:
                return new Response('404 Not Found', { status: 404 });
        }
	},
};
