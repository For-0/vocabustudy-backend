import express from "express";
import cors from "cors";
import { ClassicLevel } from "classic-level";
import MiniSearch from "minisearch";
import { userTokenDecoder } from "./utils.js"; 
const app = express();
const port = 80;
const db = new ClassicLevel("./db", { valueEncoding: "json" });
import axios from "axios";
const miniSearchOptions = {
	fields: ["name", "creator", "description"], 
	searchOptions: {
		boost: { name: 2 }
	}
};
let miniSearch = new MiniSearch(miniSearchOptions);

try {
	let existingSearchIndex = await db.get("search-index");
	miniSearch = MiniSearch.loadJS(existingSearchIndex, miniSearchOptions);
} catch {}

async function persistIndex() {
	await db.put("search-index", miniSearch.toJSON());
}

const allowedOrigins = ["https://vocabustudy.org", "https://nightly.vocabustudy.org", "https://backend.vocabustudy.org"];

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
  console.log(req.subdomains);
  return res.status(200).send("success");
});

/*async function getResponses(formName = "default") {
	let res = await pageclip.fetch(formName);
	return res.data.filter(el => el.archivedAt === null && el.payload.name !== "Omkar Patil").map(el => el.payload);
}
app.post('/responses-fanclub/', async (_req, res) => {
	let responses = await getResponses("omkarfanclub");
	res.status(200).set({ "Access-Control-Allow-Origin": "https://forzero.vocabustudy.org" }).send({ responses });
});
app.post('/post-response/', async (req, res) => {
	let name = req.body.name;
	await pageclip.send("omkarfanclub", { name });
	res.status(200).set({ "Access-Control-Allow-Origin": "https://forzero.vocabustudy.org" }).send({result: "success"});
});*/

await userTokenDecoder.updateGooglePublicKeys();

app.listen(port, () => {
	console.log(`Form getter listening on port ${port}`)
});