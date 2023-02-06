import axios from "axios";
import { ClassicLevel } from "classic-level";

const db = new ClassicLevel("./quizlet-sets-cache", { valueEncoding: "json" });

function parseQuizletMedia(mediaObject) {
  switch (mediaObject.type) {
    case 1:
      return mediaObject.plainText
    case 2:
      return `[image](${mediaObject.url})`
    case 3:
      return "We couldn't decode this part. Ask Siddhant";
  }
}

function parseQuizletSet(setData) {
  return setData.responses[0].models.studiableItem.map(el => el.cardSides.map(el => el.media.map(parseQuizletMedia).join(" ")).join("  ")).join("\n")
}

async function getCachedSet(setId) {
  try {
    return await db.get(setId);
  } catch {
    return null;
  }
}

async function getSet(setId) {
  let cachedSet = await getCachedSet(setId);
  if (cachedSet) return cachedSet;
  let res = await axios.get(`https://api.scrapingant.com/v2/general`, {headers: {useQueryString: true}, params: {
    url: `https://quizlet.com/webapi/3.4/studiable-item-documents?filters%5BstudiableContainerId%5D=${setId}&filters%5BstudiableContainerType%5D=1`,
    browser: false,
    "x-api-key": process.env.SCRAPINGANT_API_KEY
  }});
  let parsedSet = parseQuizletSet(res.data);
  await db.put(setId, parsedSet);
  return parsedSet;
}
console.log(await getSet("19442797"));