import { app as backendApp } from "./backend/index.js";
import { app as adminApp } from "./admin/index.js";
import vhost from "vhost";
import express from "express";

const port = 80;

express()
  .use(vhost("backend.vocabustudy.org", backendApp))
  .use(vhost("admin.vocabustudy.org", adminApp))
  .use(vhost("*.*.repl.co", (_, res) => res.status(501).send("This service is unavailable via its Replit URL")))
  .listen(port, () => console.log(`Admin and backend listening on port ${port}`));