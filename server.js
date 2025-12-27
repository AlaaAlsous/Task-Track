"use strict";

import express from "express";
const app = express();
const port = 80;

app.use(express.static("public"));

app.get("/index.html", (req, res) => {
  res.redirect("/");
});

app.get("/api/tasks", (req, res) => {
  res.json(tasks);
});

app.listen(port, () => {
  console.log(`http://localhost:${port}`);
});
