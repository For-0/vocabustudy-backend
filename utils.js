import { jwtVerify, decodeProtectedHeader, decodeJwt, importX509 } from "jose";
import axios from "axios";
import * as FirestoreParser from "firestore-parser";
import { randomBytes, createCipheriv, createDecipheriv } from "crypto";
import { writeFile, readFileSync } from "fs";

/**
	* Compare a token date with the current date
 	* Mode 0 = equality
	* Mode -1 = token date must be in the past
 	* Mode 1 = token date must be in the future
	* @param {number} secondsSinceEpoch the token date
 	* @param {(-1|0|1)} mode the mode of comparison.
	* @returns {boolean} whether the token date satisfies the conditions
	*/
function compareTokenDate(secondsSinceEpoch, mode) {
	let currentDate = Date.now();
	let tokenDate = parseInt(secondsSinceEpoch) * 1000;
	if (Number.isNaN(tokenDate)) return false;
	switch(mode) {
		case -1:
			return currentDate > tokenDate;
		case 0:
			return currentDate === tokenDate;
		case 1:
			return currentDate < tokenDate;
		default:
			throw new Error("invalid mode");
	}
}

export const userTokenDecoder = {
	googlePublicKeys: {},
	async updateGooglePublicKeys() {
		let res = await axios.get("https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com");
		this.googlePublicKeys = res.data;
		for (let key in this.googlePublicKeys) {
			if (this.googlePublicKeys.hasOwnProperty(key))
				this.googlePublicKeys[key] = await importX509(this.googlePublicKeys[key], "RS256");
		}
		let tokensAge = parseInt(res.headers["age"]) || 0;
		let tokensMaxAgeHeaderPart = res.headers["cache-control"].split(",").map(a => a.trim().split("=")).find(a => a[0] === "max-age");
		if (tokensMaxAgeHeaderPart) {
			let tokensMaxAge = parseInt(tokensMaxAgeHeaderPart[1]) || 0;
			let fetchIn = tokensMaxAge - tokensAge;
			if (fetchIn < 10) return;
			setTimeout(() => this.updateGooglePublicKeys(), fetchIn * 1000);
		}
	},
	async getUserId(idToken) {
		try {
			let header = decodeProtectedHeader(idToken);
			let claimSet = decodeJwt(idToken);
			if (header.alg === "RS256" && header.kid in googlePublicKeys &&
				compareTokenDate(claimSet.exp, 1) &&
				compareTokenDate(claimSet.iat, -1) &&
				compareTokenDate(claimSet.auth_time, -1) &&
				claimSet.aud === process.env.GCP_PROJECT_ID &&
				claimSet.iss === `https://securetoken.google.com/${process.env.GCP_PROJECT_ID}` &&
				claimSet.sub
		 	) {
				let keySignedWith = this.googlePublicKeys[header.kid];
				let { payload: { sub: userId } } = await jwtVerify(idToken, keySignedWith);
				return userId;
		 	} else return null;
		} catch {
			return null;
		}
	}
};

export function saveEncryptString(filename, string) {
  return new Promise((resolve, reject) => {
    const dataBuffer = Buffer.from(string, "utf8");
    const iv = randomBytes(16);
    const cipher = createCipheriv("aes-256-ctr", process.env.FILESTORE_SECRET_KEY, iv);
    writeFile(filename, Buffer.concat([iv, cipher.update(dataBuffer), cipher.final()]).toString("hex"), err => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function loadEncryptedString(filename) {
  const inputBuffer = Buffer.from(readFileSync(filename).toString(), "hex");
  const iv = inputBuffer.subarray(0, 16);
  const cipher = createDecipheriv("aes-256-ctr", process.env.FILESTORE_SECRET_KEY, iv)
  return Buffer.concat([cipher.update(inputBuffer.subarray(16)), cipher.final()]).toString();
}

export async function getSet(setId) {
	try {
		let res = await axios.get(`https://firestore.googleapis.com/v1/projects/${process.env.GCP_PROJECT_ID}/databases/(default)/documents/sets/${setId}`);
		let document = FirestoreParser(res.data);
	} catch {
		return null;
	}
}