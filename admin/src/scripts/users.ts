import { toast } from "bulma-toast";
import "typed-query-selector";
import { ModifyUserBody, User } from "../../function-utils/common-types";
import { getFreshUser, waitForReauth } from "./require-authentication";
import { getUserAvatar } from "./utils";

const usersList = document.querySelector("#users-card div.list");
const usersCard = document.getElementById("users-card");
const btnLoadMore = document.querySelector("#users-card a.load-more");

const userCard = {
    card: document.getElementById("user-card"),
    noUser: document.querySelector("#user-card section.no-user"),
    user: document.querySelector("#user-card section.user"),
    pfp: document.querySelector("#user-card section.user img"),
    displayName: document.querySelector("#user-card section.user span.display-name"),
    email: document.querySelector("#user-card section.user p.email"),
    tags: document.querySelector("#user-card section.user span.tags"),
    actions: {
        toggleAdmin: document.querySelector("#user-card section.user .actions button.toggle-admin"),
        verifyEmail: document.querySelector("#user-card section.user .actions button.verify-email"),
        disable: document.querySelector("#user-card section.user .actions button.disable"),
        delete: document.querySelector("#user-card section.user .actions button.delete-user")
    },
    uid: document.querySelector("#user-card section.user span.uid"),
    created: document.querySelector("#user-card section.user span.created"),
    lastLogin: document.querySelector("#user-card section.user span.last-login"),
    authMethods: document.querySelector("#user-card section.user span.auth-methods"),
    copyUid: document.querySelector("#user-card button.copy-uid"),
};

const usersCache = new Map<string, User>();
let currentPage = 0; // for pagination
let currentUser: User | null = null;

async function fetchUsers(accessToken: string): Promise<User[]> {
    usersCard?.classList.add("has-loader");
    const url = new URL("/api/users", window.location.href);
    url.searchParams.set("page", currentPage.toString());
    const res = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    usersCard?.classList.remove("has-loader");
    const users = await res.json();
    for (const user of users) usersCache.set(user.uid, user);
    return users;
}

async function modifyUser(accessToken: string, body: ModifyUserBody) {
    const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
    if (!res.ok) {
        toast({ message: "Failed to update user!", type: "is-danger", animate: { in: "rubberBand", out: "backOutUp" } });
        throw new Error(await res.json());
    } else toast({ message: "Updated user!", type: "is-success", animate: { in: "rubberBand", out: "backOutUp" } });
}

function showUserDetails(user: User) {
    if (!userCard.card) return;
    userCard.noUser!.hidden = true;
    userCard.user!.hidden = false;
    userCard.pfp?.setAttribute("src", user.photoUrl || new URL("../images/icon-192-maskable.png", import.meta.url).href);
    if (user.googleName && user.displayName !== user.googleName) userCard.displayName!.innerText = `${user.displayName} (${user.googleName})`;
    else userCard.displayName!.innerText = user.displayName;
    userCard.email!.innerText = user.email;
    userCard.tags!.innerHTML = "";

    // tags - admin, email verified, disabled
    if (user.customAttributes.admin) {
        const adminTag = document.createElement("span");
        adminTag.classList.add("tag", "is-primary");
        adminTag.innerText = "Admin";
        userCard.tags?.appendChild(adminTag);
    }
    if (!user.emailVerified) {
        const unverifiedTag = document.createElement("span");
        unverifiedTag.classList.add("tag", "is-warning");
        unverifiedTag.innerText = "Email Not Verified";
        userCard.tags?.appendChild(unverifiedTag);
    }
    if (user.disabled) {
        const disabledTag = document.createElement("span");
        disabledTag.classList.add("tag", "is-danger");
        disabledTag.innerText = "Disabled";
        userCard.tags?.appendChild(disabledTag);
    }
    // change button text based on user state
    (<HTMLSpanElement>userCard.actions.toggleAdmin!.lastElementChild).innerText = user.customAttributes.admin ? "Remove Admin" : "Make Admin";
    (<HTMLSpanElement>userCard.actions.verifyEmail!.lastElementChild).innerText = user.emailVerified ? "Unverify Email" : "Verify Email";
    (<HTMLSpanElement>userCard.actions.disable!.lastElementChild).innerText = user.disabled ? "Enable Account" : "Disable Account";

    userCard.uid!.innerText = user.uid;
    userCard.created!.innerText = new Date(user.createdAt).toLocaleString();
    userCard.lastLogin!.innerText = user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "Never";
    userCard.authMethods!.innerText = user.providers.join(" • ");
}

function createUserListItem(user: User) {
    const listItem = document.createElement("div");
    listItem.classList.add("list-item");
    listItem.appendChild(getUserAvatar(user.uid, user.photoUrl));

    const listItemContent = listItem.appendChild(document.createElement("div"));
    listItemContent.classList.add("list-item-content");
    const listItemTitle = listItemContent.appendChild(document.createElement("div"));
    listItemTitle.classList.add("list-item-title");
    const titleIconText = listItemTitle.appendChild(document.createElement("span"));
    titleIconText.classList.add("icon-text");
    const titleText = titleIconText.appendChild(document.createElement("span"));
    if (user.googleName && user.displayName !== user.googleName) titleText.innerText = `${user.displayName} (${user.googleName})`
    else titleText.innerText = user.displayName;

    // show icons for admin and disabled
    if (user.customAttributes.admin) {
        const adminIcon = titleIconText.appendChild(document.createElement("span"));
        adminIcon.classList.add("icon", "has-text-primary");
        adminIcon.innerHTML = `<i class="fas fa-crown"></i>`;
        adminIcon.title = "Admin";
    } else if (user.disabled) {
        const disabledIcon = titleIconText.appendChild(document.createElement("span"));
        disabledIcon.classList.add("icon", "has-text-danger");
        disabledIcon.innerHTML = `<i class="fas fa-ban"></i>`;
        disabledIcon.title = "Disabled";
    }

    const listItemDescription = listItemContent.appendChild(document.createElement("div"));
    listItemDescription.classList.add("list-item-description");
    listItemDescription.innerText = user.email;

    const listItemControls = listItem.appendChild(document.createElement("div"));
    listItemControls.classList.add("list-item-controls");
    const buttons = listItemControls.appendChild(document.createElement("div"));
    buttons.classList.add("buttons", "is-right");
    const buttonMoreDetails = buttons.appendChild(document.createElement("button"));
    buttonMoreDetails.classList.add("button");
    buttonMoreDetails.innerHTML = `<span class="icon"><i class="fas fa-info-circle"></i></span>`;
    buttonMoreDetails.title = "More Details";
    buttonMoreDetails.addEventListener("click", () => {
        currentUser = user;
        showUserDetails(user);
    });
    return listItem;
}

async function displayAllUsers(accessToken: string) {
    const users = await fetchUsers(accessToken);
    for (const user of users) usersList?.appendChild(createUserListItem(user));
    if (users.length < 10) btnLoadMore!.hidden = true; // page size is 100
}

waitForReauth().then(async user => {
    if (user) displayAllUsers(user.token.access);
});

btnLoadMore?.addEventListener("click", async () => {
    const user = await getFreshUser(); // get the admin portal user
    if (!user) return;
    currentPage++;
    btnLoadMore!.disabled = true;
    btnLoadMore!.classList.add("has-loader");
    await displayAllUsers(user.token.access);
    btnLoadMore!.disabled = false;
    btnLoadMore!.classList.remove("has-loader");
});

userCard.copyUid?.addEventListener("click", async () => {
    if (currentUser) {
        await navigator.clipboard.writeText(currentUser.uid);
        toast({ message: "Copied to clipboard!", type: "is-success", animate: { in: "rubberBand", out: "backOutUp" } });
    }
});

userCard.actions.toggleAdmin?.addEventListener("click", async () => {
    if (currentUser) {
        const user = await getFreshUser(); // get the admin portal user
        if (!user) return;
        await modifyUser(user.token.access, { uid: currentUser.uid, customAttributes: { admin: !currentUser.customAttributes.admin } });
        currentUser.customAttributes.admin = !currentUser.customAttributes.admin;
        showUserDetails(currentUser);
    }
});

userCard.actions.verifyEmail?.addEventListener("click", async () => {
    if (currentUser) {
        const user = await getFreshUser(); // get the admin portal user
        if (!user) return;
        await modifyUser(user.token.access, { uid: currentUser.uid, emailVerified: !currentUser.emailVerified });
        currentUser.emailVerified = !currentUser.emailVerified;
        showUserDetails(currentUser);
    }
});

userCard.actions.disable?.addEventListener("click", async () => {
    if (currentUser) {
        const user = await getFreshUser(); // get the admin portal user
        if (!user) return;
        await modifyUser(user.token.access, { uid: currentUser.uid, disabled: !currentUser.disabled });
        currentUser.disabled = !currentUser.disabled;
        showUserDetails(currentUser);
    }
});