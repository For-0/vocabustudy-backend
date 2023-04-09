import "typed-query-selector";
import { Release } from "../../function-utils/common-types";
import { getCurrentUser } from "./local-db";
import { waitForReauth } from "./require-authentication";
import { toast } from "bulma-toast";

const releasesContainer = document.getElementById("releases-container");
const releasesCard = document.getElementById("releases-card");

async function fetchReleases(accessToken: string): Promise<Release[]> {
    releasesCard?.classList.add("has-loader");
    const res = await fetch("/api/stats", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ type: "hosting" })
    });
    releasesCard?.classList.remove("has-loader");
    return await res.json();
}

/**
 * @param versionHash The hash of the version to rollback to
 * @returns The newly created release
 */
async function rollbackToVersion(versionHash: string, accessToken: string) {
    const res = await fetch("/api/rollback", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ versionHash })
    });
    if (!res.ok) throw new Error(await res.text());
}

function createReleaseTableItem(release: Release, isCurrent: boolean) {
    const iconColor = isCurrent ? "has-text-primary" : (release.type === "ROLLBACK" ? "has-text-danger" : "has-text-secondary");
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
        .innerText = `${release.fileCount} files • ${(release.sizeBytes / (10 ** 3)).toFixed(2)} KB`
    tableItem.appendChild(document.createElement("td"))
        .innerText = deployedWithText;
    const rollbackCell = tableItem.appendChild(document.createElement("td"));
    rollbackCell.classList.add("has-text-right");
    const rollbackBtn = rollbackCell.appendChild(document.createElement("button"));
    rollbackBtn.classList.add("button", "is-small");
    if (isCurrent) {
        rollbackBtn.classList.add("is-info", "is-static");
        rollbackBtn.innerText = "Current";
    } else if (release.hasExpired) {
        rollbackBtn.classList.add("is-danger", "is-static");
        rollbackBtn.innerText = "Expired";
    } else {
        rollbackBtn.innerText = "Rollback";
        rollbackBtn.classList.add("is-warning");
        rollbackBtn.addEventListener("click", async () => {
            // rollback and refresh the releases list
            const user = await getCurrentUser();
            if (!user) return toast({ type: "is-warning", message: "Please reauthenticate" });
            rollbackBtn.disabled = true;
            rollbackBtn.classList.add("is-loading");
            try {
                await rollbackToVersion(release.hash, user.token.access);
                await displayAllReleases(user.token.access)
            } catch (err) {
                toast({ type: "is-danger", message: "An error occurred" });
                throw err;
            } finally {
                rollbackBtn.disabled = false;
                rollbackBtn.classList.remove("is-loading");
            }
        });
    }
    return tableItem;
}

async function displayAllReleases(accessToken: string) {
    if (releasesContainer) releasesContainer.textContent = "";
    const releases = await fetchReleases(accessToken);
    for (const [i, release] of releases.entries()) releasesContainer?.appendChild(createReleaseTableItem(release, i === 0));
}

waitForReauth().then(async user => {
    if (user) displayAllReleases(user.token.access);
});