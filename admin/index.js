import express from "express";

export const app = express();
app.set("view engine", "pug");
app.set('views', "./admin/views");
app.use(express.static("./admin/public"));

app.get("/", (_req, res) => res.render("index.pug"));