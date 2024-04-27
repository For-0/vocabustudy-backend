export const kahootCreateUrl = /^https:\/\/create.kahoot.it\/details\/([0-9a-zA-Z-]+)$/;

interface KahootCreateResponse {
    kahoot: {
        uuid: string,
        creator: string, // id
        creator_username: string,
        title: string,
        description: string,
        quizType: string,
        cover: string,
        created: number,
        modified: number,
        type: string,
        questions: (
            {
                type: "content",
                title: string,
                description: string
            } | {
                type: "multiple_select_quiz" | "quiz",
                question: string,
                time: number,
                image?: string,
                choices: {
                    answer: string,
                    correct: boolean
                }[]
            }
        )[]
    }
}

interface StudyGuideQuiz {
    questions: {
        type: 0 | 1,
        question: string,
        answers: string[]
    }[],
    type: 1,
    title: string
};

interface StudyGuideReading {
    body: string,
    type: 0,
    title: string
}

interface VocabustudyStudyGuide {
    name: string;
    description?: string;
    uid: string;
    visibility: number | string[];
    collections: string[];
    terms: (StudyGuideQuiz | StudyGuideReading)[];
    likes: string[];
    comments: Record<string, string>;
    numTerms: number;
    nameWords: string[];
    creationTime: Date;
}

export async function parseKahootCreate(setId: string): Promise<VocabustudyStudyGuide> {
    const res = await fetch(`https://create.kahoot.it/rest/kahoots/${setId}/card/?includeKahoot=true`);
    const { kahoot } = await res.json<KahootCreateResponse>();

    return {
        name: kahoot.title,
        description: kahoot.description,
        uid: kahoot.creator_username,
        visibility: 2, // public
        collections: [],
        likes: [],
        comments: {},
        nameWords: [],
        creationTime: new Date(kahoot.created)
    };
}
