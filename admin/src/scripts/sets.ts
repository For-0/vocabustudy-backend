import { getFreshUser, waitForReauth } from "./require-authentication";
import { API_KEY } from "./local-db";
import { FirestoreRestDocument, VocabSet } from "../../function-utils/common-types";
import { parseMap } from "./firebase-rest-api-converters";
import { toast } from "bulma-toast";

let userProfileCache = {};

const initialStructuredQuery = {
    select: {
        fields: [
            { fieldPath: "name" },
            { fieldPath: "creationTime" },
            { fieldPath: "uid" },
            { fieldPath: "numTerms" },
            { fieldPath: "visibility" },
        ]
    },
    from: [{ collectionId: "sets" }],
    orderBy: [{ field: { fieldPath: "creationTime" }, direction: "DESCENDING" }],
}

const queryEndpoint = "https://firestore.googleapis.com/v1/projects/vocab-u-study/databases/(default)/documents";
const setUrlRegex = /https:\/\/vocabustudy\.org\/set\/([a-zA-Z0-9_-]+)\/view\/?/;

async function parseRunQueryResponse(res: Response) {
    const documents = await res.json() as { document: FirestoreRestDocument }[];
    if (!documents?.[0]?.document) return [];
    return documents.map(({ document }: { document: FirestoreRestDocument }) => {
        return {
            id: document.name.split("/").pop(),
            ...parseMap(document)
        } as unknown as VocabSet;
    });
}

async function getAllProfiles(sets: VocabSet[]): Promise<{ [uid: string]: { displayName: string; photoUrl: string }}> {
    const uids = [...new Set(sets.map(set => set.uid))];
    const profiles = await Promise.all(uids.map(async (uid): Promise<{ displayName: string; photoUrl: string }> => {
        if (uid in userProfileCache) return userProfileCache[uid];
        else {
            // @ts-ignore
            const res = await fetch(`http${process.env.NODE_ENV === "development" ? "://localhost:8000" : "s://dd.vocabustudy.org"}/users/${uid}`);
            const profile = await res.json();
            userProfileCache[uid] = profile;
            return profile;
        }
    }));
    return profiles.reduce((acc, profile, i) => {
        acc[uids[i]] = profile;
        return acc;
    }, {});
}

async function displaySearchResults(sets: VocabSet[]) {
    if (!searchResults.list) return;
    searchResults.list.textContent = "";
    const userProfiles = await getAllProfiles(sets);
    for (const set of sets) {
        const listItem = searchResults.list.appendChild(document.createElement("div"));
        listItem.classList.add("list-item");
        
        const listItemImage = listItem.appendChild(document.createElement("div"));
        listItemImage.classList.add("list-item-image");
        const imageFigure = listItemImage.appendChild(document.createElement("figure"));
        imageFigure.classList.add("image", "is-48x48", "has-tooltip-arrow", "has-tooltip-right", "is-clickable", "has-tooltip-info");
        const image = imageFigure.appendChild(document.createElement("img"));
        image.classList.add("is-rounded");
        image.referrerPolicy = "no-referrer";
        image.src = userProfiles[set.uid].photoUrl || new URL("../images/icon-192-maskable.png", import.meta.url).href;
        imageFigure.dataset.tooltip = "Copy UID";
        imageFigure.addEventListener("click", async () => {
            await navigator.clipboard.writeText(set.uid);
            toast({ message: "Copied to clipboard!", type: "is-success", animate: { in: "rubberBand", out: "backOutUp" }  })
        });

        const listItemContent = listItem.appendChild(document.createElement("div"));
        listItemContent.classList.add("list-item-content");

        // Title - set name
        const listItemTitle = listItemContent.appendChild(document.createElement("div"));
        listItemTitle.classList.add("list-item-title");
        listItemTitle.textContent = set.name;
        // Subtitle - set creation time and creator
        const listItemSubtitle = listItemContent.appendChild(document.createElement("div"));
        listItemSubtitle.classList.add("list-item-description");
        listItemSubtitle.textContent = `Created ${set.creationTime.toLocaleString()} by ${userProfiles[set.uid].displayName} • ${set.numTerms} terms`;
        
        // tags container for the visibility
        const tagsContainer = listItemContent.appendChild(document.createElement("div"));
        tagsContainer.classList.add("list-item-description");
        const tags = tagsContainer.appendChild(document.createElement("div"));
        tags.classList.add("tags");
        // tag for the visibility
        switch (set.visibility) {
            case 0:
                tags.innerHTML = `<span class="tag is-warning is-rounded">Private</span>`;
                break;
            case 1:
                tags.innerHTML = `<span class="tag is-info is-rounded">Unlisted</span>`;
                break;
            case 2:
                tags.innerHTML = `<span class="tag is-success is-rounded">Public</span>`;
                break;
            default:
                // shared sets
                if (!Array.isArray(set.visibility)) break;
                for (const email of set.visibility) {
                    const tag = tags.appendChild(document.createElement("span"));
                    tag.classList.add("tag", "is-link", "is-rounded");
                    tag.textContent = email;
                }
                break;
        }
        const listItemActions = listItem.appendChild(document.createElement("div"));
        listItemActions.classList.add("list-item-controls");
        // actions to the right of the list item
        const buttons = listItemActions.appendChild(document.createElement("div"));
        buttons.classList.add("buttons");
        // link to view the set
        const viewButton = buttons.appendChild(document.createElement("a"));
        viewButton.classList.add("button");
        viewButton.innerHTML = `<span class="icon"><i class="fas fa-eye"></i></span><span>View</span>`;
        viewButton.href = `https://vocabustudy.org/set/${set.id}/view/`;
        // link to edit the set
        const editButton = buttons.appendChild(document.createElement("a"));
        editButton.classList.add("button");
        editButton.innerHTML = `<span class="icon"><i class="fas fa-edit"></i></span><span>Edit</span>`;
        editButton.href = `https://vocabustudy.org/set/${set.id}/edit/`;
        // button to delete the set
        const deleteButton = buttons.appendChild(document.createElement("button"));
        deleteButton.classList.add("button", "is-danger", "is-outlined");
        deleteButton.innerHTML = `<span class="icon"><i class="fas fa-trash"></i></span><span>Delete</span>`;
        deleteButton.addEventListener("click", async () => {
            const user = await getFreshUser();
            if (user && confirm("Are you sure?\nTODO: make this look better")) {
                await fetch(`${queryEndpoint}/sets/${set.id}?key=${API_KEY}`, {
                    method: "DELETE",
                    headers: {
                        Authorization: `Bearer ${user.token.access}`
                    }
                });
                toast({ message: "Set deleted!", type: "is-success", animate: { in: "rubberBand", out: "backOutUp" }  });
                listItem.remove();
            }
        });
    }
    searchResults.modal?.classList.add("is-active");
}

const searchBy = {
    name: {
        input: document.querySelector("#search-by-name input"),
        button: document.querySelector("#search-by-name button"),
        async getSets(setName: string, accessToken: string) {
            // query for all the sets with the given name
            const res = await fetch(`${queryEndpoint}:runQuery?key=${API_KEY}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`
                },
                body: JSON.stringify({
                    structuredQuery: {
                        ...initialStructuredQuery,
                        where: {
                            fieldFilter: {
                                field: { fieldPath: "name" },
                                op: "EQUAL",
                                value: { stringValue: setName }
                            }
                        }
                    }
                })
            });
            return await parseRunQueryResponse(res);
        }
    },
    uid: {
        input: document.querySelector("#search-by-uid input"),
        button: document.querySelector("#search-by-uid button"),
        async getSets(uid: string, accessToken: string) {
            // query for all the sets created by the given user with the given uid
            const res = await fetch(`${queryEndpoint}:runQuery?key=${API_KEY}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`
                },
                body: JSON.stringify({
                    structuredQuery: {
                        ...initialStructuredQuery,
                        where: {
                            fieldFilter: {
                                field: { fieldPath: "uid" },
                                op: "EQUAL",
                                value: { stringValue: uid }
                            }
                        }
                    }
                })
            });
            return await parseRunQueryResponse(res);
        }
    },
    dynamicLink: {
        input: document.querySelector("#search-by-dynamic-link input"),
        button: document.querySelector("#search-by-dynamic-link button"),
        async getSets(dynamicLink: string, accessToken: string) {
            // evaluate the dynamic link to get the set id
            const res = await fetch(`/api/stats?type=dynamic-link&path=${dynamicLink}`, {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            });
            if (!res.ok) return [];
            const setUrl = await res.text();
            const setId = setUrl.match(setUrlRegex)?.[1];
            if (!setId) return [];
            // then use use search by ID to get the set
            return await searchBy.id.getSets(setId, accessToken);
        }
    },
    id: {
        input: document.querySelector("#search-by-id input"),
        button: document.querySelector("#search-by-id button"),
        async getSets(setId: string, accessToken: string) {
            // get one specific set by id
            const url = new URL(`${queryEndpoint}/sets/${setId}`);
            url.searchParams.set("key", API_KEY);
            ["name", "uid", "creationTime", "numTerms", "visibility"].forEach(field => url.searchParams.append(`mask.fieldPaths`, field));
            const res = await fetch(url, {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`
                }
            });
            const document = await res.json() as FirestoreRestDocument;
            if (!document) return [];
            return [{
                id: document.name.split("/").pop(),
                ...parseMap(document)
            } as unknown as VocabSet];
        }
    }
};

const searchResults = {
    modal: document.querySelector("div#search-results-modal"),
    btnsClose: document.querySelectorAll("#search-results-modal button.action-close"),
    list: document.querySelector("#search-results-modal div.list")
};

searchResults.btnsClose.forEach(btn => btn.addEventListener("click", () => searchResults.modal?.classList.remove("is-active")));

waitForReauth().then(() => {
    // add event listeners to search buttons, and call the appropriate search function
    Object.values(searchBy).forEach(({ input, button, getSets }) => {
        button?.addEventListener("click", async () => {
            if (input?.reportValidity()) {
                try {
                    button.disabled = true;
                    button.classList.add("is-loading");
                    const user = await getFreshUser();
                    if (!user) return;
                    const sets = await getSets(input.value, user.token.access);
                    await displaySearchResults(sets);
                } catch (err) {
                    toast({ message: `Error: ${err.message}`, type: "is-danger", duration: 10000, animate: { in: "headShake", out: "bounceOutUp" }  });
                    throw err;
                } finally {
                    button.disabled = false;
                    button.classList.remove("is-loading");
                }
            }
        });
    });
});
