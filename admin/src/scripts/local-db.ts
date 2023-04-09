import { openDB, DBSchema } from "idb";
import { decodeJwt } from "jose";

const requestUri = `${location.protocol}//${location.hostname}`;
export const API_KEY = "AIzaSyCsDuM2jx3ZqccS8MS5aumkOKaV2LiVwZk";

export interface User {
    token: {
        access: string;
        refresh: string;
        expiration: number;
    };
    displayName: string;
    photoUrl: string;
    uid: string;
};

interface CacheTypes {
    stats: {
        users: number;
        sets: number;
        openForms: number;
        downloads: number;
    };
};

interface AdminDB extends DBSchema {
    "authentication": {
        key: "console";
        value: User | null;
    } | {
        key: "zoho";
        value: {
            token: {
                access: string;
                refresh: string;
                expiration: number;
            };
        } | null;
    };
    "cache": {
        key: keyof CacheTypes;
        value: CacheTypes[keyof CacheTypes] & { expiration: number }
    }
}

export async function getDB() {
    return await openDB<AdminDB>("admin-db", 1, {
        upgrade(db) {
            db.createObjectStore("authentication");
            db.createObjectStore("cache");
        }
    });
}

export async function setCacheValue<T extends keyof CacheTypes>(key: T, value: CacheTypes[T], expiration: number) {
    const db = await getDB();
    await db.put("cache", { ...value, expiration: Date.now() + expiration }, key);
    return value;
}

export async function getCacheValue<T extends keyof CacheTypes>(key: T): Promise<CacheTypes[T] | null> {
    const db = await getDB();
    const value = await db.get("cache", key);
    if (!value || value.expiration < Date.now()) return null;
    else return value;
}

export async function setCurrentUser(user: User) {
    const db = await getDB();
    await db.put("authentication", user, "console");
}

export async function logout() {
    const db = await getDB();
    await db.put("authentication", null, "console");
    await db.put("authentication", null, "zoho");
}

export async function getCurrentUser(forceRefresh = false) {
    const db = await getDB();
    const user = (await db.get("authentication", "console") || null) as User | null;
    if (user && forceRefresh && Date.now() >= user.token.expiration) {
        const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${API_KEY}`, {
            method: "POST",
            body: JSON.stringify({ grant_type: "refresh_token", refresh_token: user.token.refresh })
        });
        const resJson = await res.json();
        if (!resJson.id_token) {
            await logout();
            return null;
        }
        user.token = {
            access: resJson.id_token,
            refresh: resJson.refresh_token,
            expiration: Date.now() + parseInt(resJson.expires_in) * 1000 // expiresIn is given as a string in seconds
        };
        await setCurrentUser(user);
    }
    return user;
}

/**
 * Sign in with a Google credential
 */
export async function signInWithGoogleCredential(googleIdToken: string) {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${API_KEY}`, {
        method: "POST",
        body: JSON.stringify({postBody: `id_token=${googleIdToken}&providerId=google.com`, requestUri, returnSecureToken: true})
    });
    const resJson = await res.json();
    if (!resJson.idToken) return "NOT_ADMIN";
    const decodedJwt = decodeJwt(resJson.idToken);
    if (decodedJwt.admin !== true) return "NOT_ADMIN";
    const user: User = {
        token: {
            access: resJson.idToken,
            refresh: resJson.refreshToken,
            expiration: Date.now() + parseInt(resJson.expiresIn) * 1000 // expiresIn is given as a string in seconds
        },
        uid: decodedJwt.user_id as string,
        displayName: decodedJwt.name as string,
        photoUrl: decodedJwt.picture as string
    };
    await logout();
    await setCurrentUser(user);
    return "SUCCESS";
}
