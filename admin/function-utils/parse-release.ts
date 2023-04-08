import { Release } from "./common-types";

const deploymentMethods = {
    "cli-firebase--action-hosting-deploy": "GITHUB_ACTION",
    "cli-firebase": "CLI"
}

export function parseRelease(release: any): Release {
    return {
        id: release.name.split("/").pop(),
        hash: release.version.name.split("/").pop(),
        deployedWith: deploymentMethods[release.version.labels["deployment-tool"]] || "UNKNOWN",
        timestamp: Date.parse(release.releaseTime),
        type: release.type,
        user: release.releaseUser,
        fileCount: parseInt(release.version.fileCount),
        sizeBytes: parseInt(release.version.versionBytes),
        hasExpired: release.version.status === "EXPIRED"
    };
}