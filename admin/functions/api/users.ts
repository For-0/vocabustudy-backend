import { getToken, makeRequest } from "../../function-utils/google-auth";
import { Env, ModifyUserBody, User } from "../../function-utils/common-types";
import type { PagesFunction } from "@cloudflare/workers-types";

async function listUsers({ GCP_PROJECT_ID }: Env, authToken: string, page = 0) {
    const { recordsCount, userInfo } = await makeRequest(
        `https://identitytoolkit.googleapis.com/v1/projects/${GCP_PROJECT_ID}/accounts:query`,
        authToken,
        {
            returnUserInfo: true,
            limit: "10",
            offset: (page * 10).toString(),
            sortBy: "CREATED_AT",
            order: "DESC"
        }
    ) as { recordsCount?: string, userInfo?: any[] };
    if (!recordsCount) throw new Error("Unable to count users");
    if (recordsCount === "0" || !userInfo) return [];
    return userInfo.map((user): User => ({
        displayName: user.displayName,
        createdAt: parseInt(user.createdAt),
        lastLoginAt: parseInt(user.lastLoginAt),
        email: user.email,
        emailVerified: user.emailVerified,
        customAttributes: JSON.parse(user.customAttributes || "{}"),
        disabled: user.disabled,
        uid: user.localId,
        googleName: user.providerUserInfo?.find((provider: { providerId: string; displayName: string; }) => provider.providerId === "google.com")?.displayName,
        providers: user.providerUserInfo?.map((provider: { providerId: string; }) => provider.providerId) || [],
        photoUrl: user.photoUrl
    }));
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
    const url = new URL(request.url);
    const authToken = await getToken(["https://www.googleapis.com/auth/identitytoolkit"], env.SERVICE_ACCOUNT_KEY, env.SERVICE_ACCOUNT_EMAIL);
    const users = await listUsers(env, authToken, parseInt(url.searchParams.get("page") || "0"));
    return new Response(JSON.stringify(users), { status: 200, headers: { "Content-Type": "application/json" } });
}

export const onRequestPatch: PagesFunction<Env> = async ({ request, env }) => {
    const authToken = await getToken(["https://www.googleapis.com/auth/identitytoolkit"], env.SERVICE_ACCOUNT_KEY, env.SERVICE_ACCOUNT_EMAIL);
    const body = await request.json<ModifyUserBody>();
    const { uid, customAttributes, disabled, emailVerified } = body;
    const updates = {};

    if (customAttributes) updates["customAttributes"] = JSON.stringify(customAttributes);
    if (disabled !== undefined) updates["disableUser"] = disabled;
    if (emailVerified !== undefined) updates["emailVerified"] = emailVerified;
    
    const { localId } = await makeRequest(
        `https://identitytoolkit.googleapis.com/v1/projects/${env.GCP_PROJECT_ID}/accounts:update`,
        authToken,
        {
            localId: uid,
            ...updates
        }
    ) as { localId?: string };
    if (!localId) throw new Error("Unable to update user");
    return new Response(JSON.stringify({ message: "success" }), { status: 200, headers: { "Content-Type": "application/json" } });
}