import { Env } from "../../function-utils/common-types";
import { getToken, makeRequest } from "../../function-utils/google-auth";

interface RequestBody {
    versionHash: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
    const reqBody = await request.json<RequestBody>();
    if (!reqBody.versionHash) return new Response("Bad Request", { status: 400 });

    const authToken = await getToken(["https://www.googleapis.com/auth/firebase.hosting"], env.SERVICE_ACCOUNT_KEY, env.SERVICE_ACCOUNT_EMAIL);
    const requestUrl = new URL("https://firebasehosting.googleapis.com/v1beta1/sites/vocabustudyonline/channels/live/releases");
    requestUrl.searchParams.set("versionName", `sites/vocabustudyonline/versions/${reqBody.versionHash}`)
    await makeRequest(
        requestUrl.href,
        authToken,
        {  }
    );
    return new Response(JSON.stringify({ message: "Success" }), { headers: { "Content-Type": "application/json" } })
}