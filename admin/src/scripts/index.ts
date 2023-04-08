import "typed-query-selector";
import { getCacheValue, setCacheValue } from "./local-db";
import { waitForReauth } from "./require-authentication";

const welcome = {
    name: document.querySelector("#welcome span.name")!,
    date: document.querySelector("#welcome span.date")!
};

const stats = {
    users: document.querySelector("#stats p.users")!,
    sets: document.querySelector("#stats p.sets")!,
    openForms: document.querySelector("#stats p.open-forms")!,
    downloads: document.querySelector("#stats p.downloads")!
};

welcome.date.innerText = new Date().toLocaleDateString();

async function fetchStats(accessToken: string) {
    const res = await fetch("/api/stats", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ type: "all" })
    });
    const resJson = await res.json();
    return await setCacheValue("stats", resJson, 14_400_000);
}

waitForReauth().then(async user => {
    if (user) {
        welcome.name.innerText = user.displayName;
        const cacheResult = await getCacheValue("stats");
        const result = cacheResult || await fetchStats(user.token.access);
        let { users, sets, openForms, downloads } = result;
        stats.users.innerText = users.toString();
        stats.sets.innerText = sets.toString();
        stats.openForms.innerText = openForms.toString();
        stats.downloads.innerText = `${(downloads / (10 ** 6)).toFixed(2)} MB`;
        Object.values(stats).forEach(el => el.parentElement?.classList.remove("has-loader"));
    }
});