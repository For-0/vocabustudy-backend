import { decodeProtectedHeader, decodeJwt, jwtVerify, importX509, KeyLike } from "jose";
import type { Env } from "./common-types";

const authorizationHeaderRegexp = /^Bearer ((?:[\w-]*\.){2}[\w-]*)$/;

/**
 * Compare a token date with the current date
 * Mode 0 = equality
 * Mode -1 = token date must be in the past
 * Mode 1 = token date must be in the future
 * @param secondsSinceEpoch the token date
 * @param mode the mode of comparison.
 * @returns whether the token date satisfies the conditions
 */
function compareTokenDate(secondsSinceEpoch: number | string, mode: (-1 | 0 | 1)): boolean {
    let currentDate = Date.now();
    let tokenDate = (typeof secondsSinceEpoch === "number" ? secondsSinceEpoch : parseInt(secondsSinceEpoch)) * 1000;
    if (Number.isNaN(tokenDate)) return false;
    switch(mode) {
        case -1:
            return currentDate > tokenDate;
        case 0:
            return currentDate === tokenDate;
        case 1:
            return currentDate < tokenDate;
        default:
            throw new Error("invalid mode");
    }
}

const firebaseJwkUrl = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

const parseJwk = (jwk: { [key: string]: string }): Promise<{ [key: string]: KeyLike }> => Object.entries(jwk)
    .reduce(async (accP, [key, val]) => {
        const acc = await accP;
        acc[key] = await importX509(val, "RS256");
        return acc;
    }, Promise.resolve({}));

async function getFirebaseJwk(cfCache: Cache, customJwk?: string) {
    if (customJwk) {
        console.log("Using custom JWK");
        return await parseJwk({ "custom-key": customJwk.replace(/'/g, "") })
    }
    const existingCachedJwk = await cfCache.match(firebaseJwkUrl);
    if (existingCachedJwk)
        return await parseJwk(await existingCachedJwk.json());
    else {
        console.debug("Fetching Firebase JWK")
        const res = await fetch(firebaseJwkUrl);
        await cfCache.put(firebaseJwkUrl, res.clone());
        return await parseJwk(await res.json());
    }
}

export async function verifyAndExtractJwt(authHeader: string | undefined | null, env: Env, cfCache: Cache) {
    const matched = authHeader?.match(authorizationHeaderRegexp);
    if (!matched) return null;
    const [, idToken] = matched;
    const claimSet = decodeJwt(idToken);

    if (env.USE_FIREBASE_EMULATORS) {
        if (compareTokenDate(claimSet.exp, 1) &&
            compareTokenDate(claimSet.iat, -1) &&
            compareTokenDate(claimSet.auth_time as string, -1) &&
            claimSet.aud === env.GCP_PROJECT_ID &&
            claimSet.iss === `https://securetoken.google.com/${env.GCP_PROJECT_ID}` &&
            claimSet.sub
        ) {
            return claimSet;
        }
    } else {
        const googlePublicKeys = await getFirebaseJwk(cfCache, env.CUSTOM_JWK);
        const header = decodeProtectedHeader(idToken);
        
        if (header.alg === "RS256" && header.kid in googlePublicKeys &&
            compareTokenDate(claimSet.exp, 1) &&
            compareTokenDate(claimSet.iat, -1) &&
            compareTokenDate(claimSet.auth_time as string, -1) &&
            claimSet.aud === env.GCP_PROJECT_ID &&
            claimSet.iss === `https://securetoken.google.com/${env.GCP_PROJECT_ID}` &&
            claimSet.sub
        ) {
            const keySignedWith = googlePublicKeys[header.kid];
            try {
                const { payload } = await jwtVerify(idToken, keySignedWith);
                return payload;
            } catch {
                return null;
            }
        }
    }
}
