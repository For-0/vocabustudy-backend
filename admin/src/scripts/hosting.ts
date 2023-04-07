import "typed-query-selector";
import { Release } from "../../function-utils/common-types";
import { waitForReauth } from "./require-authentication";

const releasesContainer = document.getElementById("releases-container");

async function fetchReleases(accessToken: string): Promise<Release[]> {
    const res = await fetch("/api/stats", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ type: "hosting" })
    });
    return await res.json();
}

function createReleaseTableItem(release: Release, isCurrent: boolean) {
    const iconColor = isCurrent ? "has-text-primary" : (release.type === "ROLLBACK" ? "has-text-danger" : "has-text-info");
    const deployedWithText = release.deployedWith === "GITHUB_ACTION" ? "Github Action" : (release.deployedWith === "CLI" ? `CLI (${release.user.email})` : "Unknown");
    const tableItem = document.createElement("tr");
    const icon = tableItem
        .appendChild(document.createElement("td"))
        .appendChild(document.createElement("i"));
    icon.classList.add("fa", release.type === "ROLLBACK" ? "fa-clock-rotate-left" : "fa-cloud-arrow-up", iconColor);
    icon.title = release.type === "ROLLBACK" ? "Rollback" : "Deploy";
    tableItem
        .appendChild(document.createElement("th"))
        .innerText = release.hash.slice(-6);
    tableItem
        .appendChild(document.createElement("td"))
        .innerText = new Date(release.timestamp).toLocaleString();
    tableItem
        .appendChild(document.createElement("td"))
        .innerText = `${release.fileCount} files • ${(release.sizeBytes / (10 ** 6)).toFixed(2)} MB`
    tableItem.appendChild(document.createElement("td"))
        .innerText = deployedWithText;
    return releasesContainer?.appendChild(tableItem);
}

waitForReauth().then(async user => {
    if (user) {
        const releases = await fetchReleases(user.token.access);
        for (const [i, release] of releases.entries())  createReleaseTableItem(release, i === 0);
    }
});