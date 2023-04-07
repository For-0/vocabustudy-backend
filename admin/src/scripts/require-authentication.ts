import { getCurrentUser, logout } from "./local-db";
import "typed-query-selector";

export async function waitForReauth() {
    const sidebar = {
        logout: document.querySelector("a#sidebar-logout")
    };
    sidebar.logout?.addEventListener("click", async () => {
        await logout();
        location.href = "/login";
    });
    
    const user = await getCurrentUser(true);
    if (!user) {
        location.href = "/login";
        return null;
    } else return user;
}