import { getToken, makeRequest } from "../../function-utils/google-auth";
import type { Env, Release } from "../../function-utils/common-types";
import type { PagesFunction } from "@cloudflare/workers-types";

interface RequestBody {
    type: "all" | "hosting" | "self";
};

const hostingMonitoringQuery = `fetch firebase_domain
| metric 'firebasehosting.googleapis.com/network/sent_bytes_count'
| filter (resource.domain_name == 'vocabustudy.org')
| group_by 1d,
    [value_sent_bytes_count_aggregate: aggregate(value.sent_bytes_count)]
| every 1d
| within 1d`;

function getOpenFormsQuery(formType: "feedback" | "bug" | "other" | "takedown") {
    return {
        aggregations: [{
            count: {
                upTo: "25"
            },
            alias: "openFormsCount"
        }],
        structuredQuery: {
            from: [{ collectionId: formType }],
            where: {
                unaryFilter: {
                    field: { fieldPath: "response" },
                    op: "IS_NULL"
                }
            }
        }
    };
};

const setsCountQuery = {
    aggregations: [{
        count: {
            upTo: "500"
        },
        alias: "setsCount"
    }],
    structuredQuery: {
        from: [{ collectionId: "sets" }]
    }
};



async function fetchHostingStats({ GCP_PROJECT_ID }: Env, authToken: string) {
    const { timeSeriesData } = await makeRequest(
        `https://monitoring.googleapis.com/v3/projects/${GCP_PROJECT_ID}/timeSeries:query`,
        authToken,
        { query: hostingMonitoringQuery }
    ) as { timeSeriesData: any };
    if (!timeSeriesData) throw new Error("Unable to fetch hosting data");
    const [{ pointData: [{ values: [{ int64Value }] }] }] = timeSeriesData;
    return int64Value as number;
}

async function countOpenForms({ GCP_PROJECT_ID }: Env, authToken: string) {
    const result = await Promise.all((<("feedback" | "bug" | "takedown" | "other")[]>["feedback", "bug", "takedown", "other"])
        .map(formType => makeRequest(
            `https://firestore.googleapis.com/v1/projects/${GCP_PROJECT_ID}/databases/(default)/documents/form_data/types:runAggregationQuery`,
            authToken,
            { structuredAggregationQuery: getOpenFormsQuery(formType) }
        ) as Promise<[{ result: any }]>
    ));
    if (!result.every(form => form?.[0]?.result)) throw new Error(JSON.stringify(result));
    const openFormsCount = result.reduce((prev, form) => {
        const increaseBy = parseInt(form[0].result.aggregateFields.openFormsCount.integerValue);
        return prev + increaseBy;
    }, 0);
    return openFormsCount;
}

async function countUsers({ GCP_PROJECT_ID }: Env, authToken: string) {
    const { recordsCount } = await makeRequest(
        `https://identitytoolkit.googleapis.com/v1/projects/${GCP_PROJECT_ID}/accounts:query`,
        authToken,
        { returnUserInfo: false } // we only count users rather than fetching data
    ) as { recordsCount?: string };
    if (!recordsCount) throw new Error("Unable to count users");
    return parseInt(recordsCount);
}

async function countSets({ GCP_PROJECT_ID }: Env, authToken: string) {
    const result = await makeRequest(
        `https://firestore.googleapis.com/v1/projects/${GCP_PROJECT_ID}/databases/(default)/documents:runAggregationQuery`,
        authToken,
        { structuredAggregationQuery: setsCountQuery }
    ) as [{ result: any }];
    if (!result?.[0].result) throw new Error("Unable to count sets");
    const [{ result: { aggregateFields: { setsCount: { integerValue: setsCount } } } }] = result;
    return parseInt(setsCount) as number;
}

const deploymentMethods = {
    "cli-firebase--action-hosting-deploy": "GITHUB_ACTION",
    "cli-firebase": "CLI"
}

async function getDetailedHostingStats(authToken: string) {
    const { releases } = await makeRequest(
        `https://firebasehosting.googleapis.com/v1beta1/sites/vocabustudyonline/channels/live/releases?pageSize=5`,
        authToken,
        null,
        { method: "GET" }
    ) as { releases: any[] };
    if (!releases) throw new Error("Unable to fetch detailed release info");
    return releases.map(release => ({
        id: release.name.split("/").pop(),
        hash: release.version.name.split("/").pop(),
        deployedWith: deploymentMethods[release.version.labels["deployment-tool"]] || "UNKNOWN",
        timestamp: Date.parse(release.releaseTime),
        type: release.type,
        user: release.releaseUser,
        fileCount: parseInt(release.version.fileCount),
        sizeBytes: parseInt(release.version.versionBytes)
    } as Release))
}

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
    const reqBody = await request.json<RequestBody>();

    // Fetch overall stats
    if (reqBody.type === "all") {
        // read from cache
        const existingValue = await env.VOCABUSTUDY_KV.get("stats_cache", { type: "stream" });
        if (existingValue) return new Response(existingValue, { headers: { "Content-Type": "application/json" } });

        console.debug("Fetching overall statistics")
        const authToken = await getToken(["https://www.googleapis.com/auth/monitoring.read", "https://www.googleapis.com/auth/datastore", "https://www.googleapis.com/auth/identitytoolkit"], env.SERVICE_ACCOUNT_KEY, env.SERVICE_ACCOUNT_EMAIL);
        // Actually get stats
        const [downloads, openForms, users, sets] = await Promise.all([
            fetchHostingStats(env, authToken),
            countOpenForms(env, authToken),
            countUsers(env, authToken),
            countSets(env, authToken)
        ]);
        const statsString = JSON.stringify({
            users,
            sets,
            openForms,
            downloads
        });
        // save to cache
        await env.VOCABUSTUDY_KV.put("stats_cache", statsString, { expirationTtl: 7200 }) // 2 hours
        return new Response(statsString, { headers: { "Content-Type": "application/json" } });
    } else if (reqBody.type === "hosting") {
        const authToken = await getToken(["https://www.googleapis.com/auth/firebase.hosting.readonly"], env.SERVICE_ACCOUNT_KEY, env.SERVICE_ACCOUNT_EMAIL);
        const detailedStats = await getDetailedHostingStats(authToken);
        return new Response(JSON.stringify(detailedStats), { headers: { "Content-Type": "application/json" } })
    } else if (reqBody.type === "self") {
        return new Response(JSON.stringify({ response: "pong" }), { headers: { "Content-Type": "application/json" } });
    }
}