//import { verifyAndExtractJwt } from "function-utils/firebase-jwt";
//import { getToken } from "function-utils/google-auth"
import type { Env } from "function-utils/common-types";
import { getHelperForm, getHelperFormSubmitResponse } from "./discord-interaction-response";
import { kahootChallengeUrl, kahootChallengeUrl2, kahootCreateUrl, parseKahootChallenge, parseKahootCreate } from "./remote-set";

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
            case "/import-remote-set/": {
                if (request.method !== "POST") return new Response("Invalid method", { status: 405 });
                
                const { url } = await request.json<{ url: string; }>();
                if (!url || typeof url !== "string") return new Response("Missing url", { status: 400 });

                const kahootCreateMatch = url.match(kahootCreateUrl);
                if (kahootCreateMatch) {
                    const kahoot = await parseKahootCreate(kahootCreateMatch[1]);
                    if (kahoot)
                        return respondJson(kahoot);
                    else
                        return new Response("Not found", { status: 404 });
                }
                const kahootChallengeMatch = url.match(kahootChallengeUrl) ?? url.match(kahootChallengeUrl2);
                if (kahootChallengeMatch) {
                    const kahoot = await parseKahootChallenge(kahootChallengeMatch[1]);
                    if (kahoot)
                        return respondJson(kahoot);
                    else
                        return new Response("Not found", { status: 404 });
                }
                
                return new Response("Unknown url format", { status: 400 });
            }
            case "/gh-webhook/": {
                if (request.method !== "POST") return new Response("Invalid method", { status: 405 });
                const body = await request.text();

                const signature = request.headers.get("X-Hub-Signature-256");
                if (!signature) return new Response("Missing signature", { status: 401 });
                const signatureBytes = signature.split("=")[1]?.match(/[\da-f]{2}/gi);
                if (!signatureBytes) return new Response("Invalid signature", { status: 401 });

                const secret = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.GH_WEBHOOK_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
                const isVerified = await crypto.subtle.verify(
                    { name: "HMAC" },
                    secret,
                    Uint8Array.from(signatureBytes, h => parseInt(h, 16)),
                    new TextEncoder().encode(body)
                );
                if (!isVerified) return new Response("Invalid signature", { status: 401 });

                const { action, release: { name, body: releaseBody, html_url } } = JSON.parse(body);
                if (action !== "released") return new Response("Not a release", { status: 200 });

                const messageContent = `# ${name}
                
${releaseBody}

As always, report bugs on Github or in the feedback form.`;

                await fetch("https://discord.com/api/channels/1023690939430096907/messages", {
                    method: "POST",
                    headers: {
                        Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
                        "Content-Type": "application/json",
                        "User-Agent": "VocabustudyBot (https://vocabustudy.org, 1.0.0)",
                    },
                    body: JSON.stringify({
                        content: messageContent,
                        components: [{ type: 1, components: [
                            { type: 2, style: 5, label: "Vocabustudy", url: "https://vocabustudy.org" },
                            { type: 2, style: 5, label: "Github Release", url: html_url }
                        ] }]
                    })
                });

                return new Response("OK", { status: 200 });
            }
            default:
                return new Response('404 Not Found', { status: 404 });
        }
	},
};
