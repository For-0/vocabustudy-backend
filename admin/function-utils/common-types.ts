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