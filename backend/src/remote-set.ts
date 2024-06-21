export const kahootCreateUrl = /^https:\/\/create.kahoot.it\/details\/([0-9a-zA-Z-]+)$/;

type KahootContent = {
    type: "content",
    title: string,
    description: string
};

type KahootQuestion = {
    type: "multiple_select_quiz" | "quiz" | "open_ended",
    question: string,
    time: number,
    image?: string,
    choices: {
        answer: string,
        correct: boolean
    }[]
};

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
        questions: (KahootContent | KahootQuestion)[]
    }
}

interface StudyGuideQuiz {
    questions: StudyGuideQuizQuestion[],
    type: 1,
    title: string
};

interface StudyGuideQuizQuestion {
    type: 0 | 1,
    question: string,
    answers: string[],
    correct?: number[]
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

function parseKahootQuestion(question: KahootQuestion): StudyGuideQuizQuestion | undefined {
    const richQuestion = question.image ? `${question.question}\n\n![image](${question.image})` : question.question;

    if (question.type === "open_ended") {
        return {
            question: richQuestion,
            // all answers are correct
            answers: question.choices.map(({ answer }) => answer),
            type: 1
        }
    } else if (question.type === "quiz" || question.type === "multiple_select_quiz") {
        return {
            question: richQuestion,
            answers: question.choices.map(({ answer }) => answer),
            // indices of correct answer choices
            correct: question.choices.map(({ correct }, idx) => ({ correct, idx }))
                .filter(({ correct }) => correct)
                .map(({ idx }) => idx),
            type: 0
        }
    }
}

export async function parseKahootCreate(setId: string): Promise<VocabustudyStudyGuide> {
    const res = await fetch(`https://create.kahoot.it/rest/kahoots/${setId}/card/?includeKahoot=true`);
    const { kahoot } = await res.json<KahootCreateResponse>();

    const richDescription = `${kahoot.description}

![cover](${kahoot.cover})`;

    // we join consecutive questions into one study guide quiz
    const questions = kahoot.questions.reduce((acc, cur, idx) => {
        // content always goes on its own page
        if (cur.type === "content") acc.push({ type: 0, title: cur.title, body: cur.description });
        else {
            const parsedQuestion = parseKahootQuestion(cur);
            // couldn't parse the question
            if (!parsedQuestion) return acc;

            const lastItem = acc[acc.length - 1];
            // a quiz - add this question to it
            if (lastItem?.type === 1) {
                lastItem.questions.push(parsedQuestion);
                // update the title
                lastItem.title = lastItem.title.replace(/\d+$/, (idx + 1).toString());
            } else {
                const newQuiz: StudyGuideQuiz = { type: 1, title: `Questions ${idx + 1}-${idx + 1}`, questions: [parsedQuestion] };
                acc.push(newQuiz);
            }
        }

        return acc;
    }, [] as (StudyGuideQuiz | StudyGuideReading)[]);

    return {
        name: kahoot.title,
        description: richDescription,
        // check what this is about
        uid: kahoot.creator_username,
        visibility: 2, // public
        // study guide
        collections: ["-:1"],
        likes: [],
        comments: {},
        nameWords: [],
        creationTime: new Date(kahoot.created),
        terms: questions,
        numTerms: questions.length
    };
}
