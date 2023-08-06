import { KVNamespace } from "@cloudflare/workers-types";

export interface Release {
    id: string;
    hash: string;
    deployedWith: "GITHUB_ACTION" | "CLI" | "UNKNOWN";
    timestamp: number;
    type: "ROLLBACK" | "DEPLOY";
    user: {
        email: string;
        imageUrl: string;
    };
    fileCount: number;
    sizeBytes: number;
    hasExpired: boolean;
};

export interface Env {
    VOCABUSTUDY_KV: KVNamespace;
    SERVICE_ACCOUNT_KEY: string;
    SERVICE_ACCOUNT_EMAIL: string;
    GCP_PROJECT_ID: string;
    CUSTOM_JWK?: string;
    USE_FIREBASE_EMULATORS?: boolean;
    DISCORD_BOT_TOKEN: string;
}

/** This is a Partial of T intersected with a union of all possible subsets of T */
export type AtLeastOne<T, U = { [K in keyof T]: Pick<T, K> }> = Partial<T> & U[keyof U];

export type RawFirestoreField = AtLeastOne<{
    integerValue: string;
    doubleValue: string;
    booleanValue: boolean;
    stringValue: string;
    referenceValue: string;
    mapValue: { fields: RawFirestoreFieldObject; };
    arrayValue: { values: RawFirestoreField[]; };
    nullValue: null;
    timestampValue: string;
}>;

export type RawFirestoreFieldObject = { [key: string]: RawFirestoreField };

export type FirestoreField = null | number | boolean | string | Date | FirestoreField[] | FirestoreFieldObject;

export type FirestoreFieldObject = { [key: string]: FirestoreField };

export type FirestoreRestDocument = { name: string, fields: RawFirestoreFieldObject };

export type VocabSet = {
    id: string;
    name: string;
    creationTime: Date;
    uid: string;
    numTerms: number;
    visibility: number | string[];
};

export type User = {
    displayName: string;
    googleName?: string;
    photoUrl?: string;
    uid: string;
    customAttributes: {
        admin?: boolean;
    };
    createdAt: number;
    lastLoginAt: number;
    disabled: boolean;
    emailVerified: boolean;
    email: string;
    providers: ("google.com" | "password")[]
};

export interface ModifyUserBody {
    uid: string;
    emailVerified?: boolean;
    disabled?: boolean;
    customAttributes?: {
        admin?: boolean;
    }
};