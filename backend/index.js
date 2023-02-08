import express from "express";
import cors from "cors";
import MiniSearch from "minisearch";
import { userTokenDecoder, loadEncryptedString, saveEncryptString } from "../utils.js";
export const app = express();

const miniSearchOptions = {
	fields: ["name", "creator", "description"], 
	searchOptions: {
		boost: { name: 2 }
	}
};
let miniSearch = new MiniSearch(miniSearchOptions);

try {
	let existingSearchIndex = loadEncryptedString("./search-index.store");
	miniSearch = MiniSearch.loadJSON(existingSearchIndex, miniSearchOptions);
} catch {}

async function persistIndex() {
  await saveEncryptString("./search-index.store", JSON.stringify(miniSearch));
}

const allowedOrigins = ["https://vocabustudy.org", "https://nightly.vocabustudy.org", "https://backend.vocabustudy.org", "https://admin.vocabustudy.org"];

app.use(express.json());
app.use(cors({
	origin: (origin, callback) => {
		if (allowedOrigins.includes(origin) || !origin) callback(null, true);
		else callback(new Error("Not allowed by CORS"));
	},
	optionsSuccessStatus: 204 // some legacy browsers (IE11, various SmartTVs) choke on 204
}));
app.post("/update-set-index/", async (req, res) => {
	let { setId, authToken } = req.body;
	let userId = await userTokenDecoder.getUserId(authToken);
});

app.get("/", (req, res) => {
  return res.status(200).send("success");
});

await userTokenDecoder.updateGooglePublicKeys();