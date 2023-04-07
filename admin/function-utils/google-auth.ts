import { SignJWT, importPKCS8 } from "jose";

const GOOGLE_TOKEN_URL = "https://www.googleapis.com/oauth2/v4/token";

async function getKeyData(rawKey: string) {
  if (!rawKey) throw new Error("Private key not found");
  return await importPKCS8(rawKey.replaceAll("\\n", "\n"), "RS256")
}

async function getJwtToken(scopes: string[], rawKey: string, email: string) {
  const secretKey = await getKeyData(rawKey);
  return await new SignJWT({ scope: scopes.join(" ") })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuedAt()
    .setSubject(email)
    .setIssuer(email)
    .setAudience(GOOGLE_TOKEN_URL)
    .setExpirationTime("1h")
    .sign(secretKey);
}

export async function getToken(scopes: string[], rawKey: string, email: string): Promise<string> {
  const jwt = await getJwtToken(scopes, rawKey, email);
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
    headers: { "Content-Type": "application/x-www-form-urlencoded" }
  });
  const { access_token } = await res.json() as { access_token: string };
  if (!access_token) throw new Error("Access token not recieved");
  return access_token;
}

const commonRequestProperties = (authToken: string) => ({
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`
    }
});

export async function makeRequest(endpointUrl: string, authToken: string, body: unknown, extraConfig: Partial<RequestInit<RequestInitCfProperties>> = {}): Promise<unknown> {
    const fetchOptions: RequestInit<RequestInitCfProperties> = {
        ...commonRequestProperties(authToken),
        ...extraConfig
    };
    if (body) fetchOptions.body = JSON.stringify(body);
    const res = await fetch(endpointUrl, fetchOptions);
    return await res.json();
}