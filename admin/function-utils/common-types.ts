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
};

export interface Env {
    VOCABUSTUDY_KV: KVNamespace;
    SERVICE_ACCOUNT_KEY: string;
    SERVICE_ACCOUNT_EMAIL: string;
    GCP_PROJECT_ID: string;
    CUSTOM_JWK?: string;
}