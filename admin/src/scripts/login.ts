import { signInWithGoogleCredential } from "./local-db";
import { toast } from "bulma-toast";

const onetapContainer = document.getElementById("google-onetap-container") as HTMLDivElement;

addEventListener("load", () => {
    window.google.accounts.id.initialize({
        client_id: "230085427328-qenpln5lodm47t04dqqgeiuc5acpm7sv.apps.googleusercontent.com",
        context: "signin",
        ux_mode: "popup",
        auto_select: true,
        callback: async response => {
            const result = await signInWithGoogleCredential(response.credential);
            if (result === "SUCCESS")
                location.href = "/";
            else if (result === "NOT_ADMIN")
                toast({ message: "You don't have access to the Admin Portal", duration: 7000, type: "is-danger", animate: { in: "headShake", out: "bounceOutUp" } })
        }
    });
    window.google.accounts.id.renderButton(onetapContainer, {
        type: "standard",
        shape: "rectangular",
        theme: "outline",
        text: "continue_with",
        size: "large",
        logo_alignment: "left",
        width: 215
    });
});