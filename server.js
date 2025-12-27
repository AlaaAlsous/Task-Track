"use strict";

import express from "express";
const app = express();
const port = 80;

app.use(express.static("public"));
app.use(express.json());

let tasks = [];
let taskId = 1;

app.get("/index.html", (req, res) => {
  res.redirect("/");
});

app.get("/api/tasks", (req, res) => {
  res.json(tasks);
});

app.post("/api/tasks", (req, res) => {
  const { taskText, deadline, priority } = req.body;
  if (!taskText || !deadline || !priority) {
    return res.status(400).json({ error: "Task, Deadline och Priority krävs" });
  }
  const newTask = {
    id: taskId++,
    taskText,
    priority,
    deadline,
    done: false,
  };
  tasks.push(newTask);
  res.status(201).json(newTask);
});

app.listen(port, () => {
  console.log(`http://localhost:${port}`);
});
