import { importPKCS8, SignJWT } from "jose";
import { readFileSync } from "fs";
import { describe, it } from "mocha";
import axios from "axios";

const apiEndpoint = ([string]) => `http://127.0.0.1:1234${string}`;

/**
 * @param {import("jose").JWTPayload} payload 
 */
async function generateJwt(payload, jwtFile="./private-key.pem") {
    const privateKeyRaw = readFileSync(jwtFile, "utf8");
    const privateKey = await importPKCS8(privateKeyRaw, "RS256");
    return new SignJWT(payload).setProtectedHeader({ alg: "RS256", typ: "JWT", kid: "custom-key" }).sign(privateKey);
}

/**
 * @param {import("jose").JWTPayload} jwtPayload 
 * @param {number?} requireStatus
 * @param {string?} customJwtFile
 */
async function getAxiosConfig(jwtPayload, requireStatus, customJwtFile) {
    const jwt = await generateJwt(jwtPayload, customJwtFile);
    const config = { headers: { Authorization: `Bearer ${jwt}` } };
    if (requireStatus) config.validateStatus = status => status === requireStatus;
    return config;
}

function secondsSinceEpoch(secondOffset) {
    return Math.floor(Date.now() / 1000) + secondOffset;
}

const baseJwtPayload = {
    exp: secondsSinceEpoch(100),
    iat: secondsSinceEpoch(-100),
    auth_time: secondsSinceEpoch(-100).toString(),
    aud: process.env.GCP_PROJECT_ID,
    iss: `https://securetoken.google.com/${process.env.GCP_PROJECT_ID}`,
    sub: "my-user-id"
};

describe("The API", () => {
    it("Disallows unauthenticated requests", async () => {
        await axios.post(apiEndpoint`/api/stats`, {}, {
            validateStatus: status => status === 401 // ensure that the status is 401
        });
    });
    it("Allows requests with a valid, nonexpired, admin token", async () => {
        await axios.post(apiEndpoint`/api/stats`, { type: "self" }, await getAxiosConfig(baseJwtPayload));
    });
    it("Allows unauthenticated requests to non-api endpoints", async () => {
        await axios.get(apiEndpoint`/non-api-endpoint`, {}, {
            validateStatus: status => status === 404
        }); 
    });
    it("Disallows requests with an expired ID token", async () => {
        await axios.post(apiEndpoint`/api/stats`, { type: "self" }, await getAxiosConfig({
            ...baseJwtPayload,
            exp: secondsSinceEpoch(-100), // expired
        }, 401));
    });
    it("Disallows requests with an iat in the future", async () => {
        await axios.post(apiEndpoint`/api/stats`, { type: "self" }, await getAxiosConfig({
            ...baseJwtPayload,
            iat: secondsSinceEpoch(100),
        }, 401));
    });
    it("Disallows requests with an auth_time in the future", async () => {
        await axios.post(apiEndpoint`/api/stats`, { type: "self" }, await getAxiosConfig({
            ...baseJwtPayload,
            auth_time: secondsSinceEpoch(100).toString(),
        }, 401));
    });
    it("Disallows requests with an invalid audience", async () => {
        await axios.post(apiEndpoint`/api/stats`, { type: "self" }, await getAxiosConfig({
            ...baseJwtPayload,
            aud: "a-different-id"
        }, 401));
    });
    it("Disallows requests with an invalid issuer", async () => {
        await axios.post(apiEndpoint`/api/stats`, { type: "self" }, await getAxiosConfig({
            ...baseJwtPayload,
            iss: "a-different-issuer"
        }, 401));
    });
    it("Disallows requests with no user ID", async () => {
        await axios.post(apiEndpoint`/api/stats`, { type: "self" }, await getAxiosConfig({
            ...baseJwtPayload,
            sub: undefined
        }, 401));
    });
    it("Disallows requests not signed correctly", async () => {
        await axios.post(apiEndpoint`/api/stats`, { type: "self" }, await getAxiosConfig(baseJwtPayload, 401, "./fake-private-key.pem"));
    });
});