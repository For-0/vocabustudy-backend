import { Env } from "function-utils/common-types";
import { getToken } from "function-utils/google-auth";

type Member = { joined_at: string, nick?: string, user: { global_name?: string, username: string, id: string, avatar: string }, roles: string[] };

const getResolvedName = (member: Member) => member.nick || member.user.global_name || member.user.username;

export async function getHelperForm(member: Member, env: Env) {
    const joinedAt = Date.parse(member.joined_at);
    const daysInGuild = (Date.now() - joinedAt) / (24 * 60 * 60 * 1000);
    let error: string | null = null;
    if (daysInGuild < 3) {
        error = "Unfortunately, you must have been in the server for at least a week to qualify.";
    } else if (member.user.id !== "1129982777039802410" && member.roles.includes("1035026331467010149")) { /* helper role */
        error = "You are already a helper";
    } else {
        // Ensure they haven't applied before
        const firebaseToken = await getToken(["https://www.googleapis.com/auth/datastore"], env.SERVICE_ACCOUNT_KEY, env.SERVICE_ACCOUNT_EMAIL);
        const res = await fetch(`https://firestore.googleapis.com/v1/projects/${env.GCP_PROJECT_ID}/databases/(default)/documents/discord_helper_applications/${member.user.id}`, {
            headers: {
                Authorization: `Bearer ${firebaseToken}`
            }
        });
        
        if (res.ok) {
            error = "You may only apply once";
        }
    }
    if (error) {
        return {
            type: 4,
            data: {
                embeds: [{
                    title: `Hey, **${getResolvedName(member)}**, thank you for your interest in becoming a helper!`,
                    description: error,
                    type: "rich",
                    color: 0xef4444 // red
                }],
                flags: 1 << 6 // ephemeral - only the sender can see this
            }
        };
    } else {
        return {
            type: 9,
            data: {
                type: 9,
                custom_id: "helper_application_modal",
                title: "Helper Application Form",
                components: [
                    {
                        type: 1,
                        components: [
                            {
                                type: 4,
                                custom_id: "first_name",
                                style: 1,
                                label: "First Name",
                                min_length: 1,
                                max_length: 100,
                                required: true
                            }
                        ]
                    },
                    {
                        type: 1,
                        components: [
                            {
                                type: 4,
                                custom_id: "last_name",
                                style: 1,
                                label: "Last Name",
                                min_length: 1,
                                max_length: 100,
                                required: true
                            }
                        ]
                    },
                    {
                        type: 1,
                        components: [
                            {
                                type: 4,
                                custom_id: "mee6_level",
                                style: 1,
                                label: "MEE6 Level",
                                min_length: 1,
                                max_length: 5,
                                required: true,
                                placeholder: "This will be checked for accuracy"
                            }
                        ]
                    }
                ]
            }
        };
    }
}

export async function getHelperFormSubmitResponse(member: Member, data: {
    components: {
        type: 1,
        components: [{
            type: 4,
            custom_id: string,
            value: string
        }]
    }[]
}, env: Env) {
    const firstName = data.components[0].components[0].value;
    const lastName = data.components[1].components[0].value;
    const mee6Level = parseInt(data.components[2].components[0].value);
    // put it into firestore
    const firebaseToken = await getToken(["https://www.googleapis.com/auth/datastore"], env.SERVICE_ACCOUNT_KEY, env.SERVICE_ACCOUNT_EMAIL);
    const res = await fetch(`https://firestore.googleapis.com/v1/projects/${env.GCP_PROJECT_ID}/databases/(default)/documents/discord_helper_applications/${member.user.id}`, {
        method: "PATCH",
        headers: {
            Authorization: `Bearer ${firebaseToken}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            fields: {
                first_name: { stringValue: firstName },
                last_name: { stringValue: lastName },
                mee6_level: { integerValue: mee6Level.toString() },
                username: { stringValue: member.user.username },
            }
        })
    });
    if (!res.ok) {
        return {
            type: 4,
            data: {
                embeds: [{
                    title: `Hey, **${getResolvedName(member)}**, there was an error submitting your application.`,
                    description: "Please try again later.",
                    type: "rich",
                    color: 0xef4444 // red
                }],
                flags: 1 << 6 // ephemeral - only the sender can see this
            }
        };
    }
    await fetch("https://discord.com/api/channels/1023773803194622022/messages", {
        headers: {
            Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
            "Content-Type": "application/json",
            "User-Agent": "VocabustudyBot (https://vocabustudy.org, 1.0.0)",
        },
        method: "POST",
        body: JSON.stringify({
            embeds: [{
                title: `New helper application from **${getResolvedName(member)}**`,
                author: {
                    name: member.user.username,
                    icon_url: member.user.avatar ? `https://cdn.discordapp.com/avatars/${member.user.id}/${member.user.avatar}.png` : undefined
                },
                fields: [
                    {
                        name: "First Name",
                        value: firstName
                    },
                    {
                        name: "Last Name",
                        value: lastName
                    },
                    {
                        name: "MEE6 Level",
                        value: mee6Level.toString()
                    }
                ]
            }]
        })
    });
    return {
        type: 4,
        data: {
            embeds: [{
                title: `Hey, **${getResolvedName(member)}**, thank you for your interest in becoming a helper!`,
                description: "Your application has been submitted. We will get back to you as soon as possible.",
                type: "rich",
                color: 0x10b981 // green
            }],
            flags: 1 << 6 // ephemeral - only the sender can see this
        }
    };
}