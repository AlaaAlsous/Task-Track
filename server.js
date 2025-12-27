"use strict";

import express from "express";
import fs from "fs";
const app = express();
const port = 80;

app.use(express.static("public"));
app.use(express.json());

let tasks = [];
let taskId = 1;

if (fs.existsSync("tasks.json")) {
  const data = fs.readFileSync("tasks.json", "utf8");
  tasks = JSON.parse(data);
  if (tasks.length > 0) {
    taskId = Math.max(...tasks.map(t => t.id)) + 1;
  }
}

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
  saveTasks();
  res.status(201).json(newTask);
});

app.patch("/api/tasks/:id", (req, res) => {
  const taskId = Number(req.params.id);
  const { done } = req.body;
  for (let i = 0; i < tasks.length; i++) {
    if (tasks[i].id === taskId) {
      tasks[i].done = done;
      saveTasks();
      return res.json(tasks[i]);
    }
  }
  res.status(404).json({ error: "Task not found" });
});

app.delete("/api/tasks/:id", (req, res) => {
  const taskId = Number(req.params.id);
  for (let i = 0; i < tasks.length; i++) {
    if (tasks[i].id === taskId) {
      tasks.splice(i, 1);
      saveTasks();
      return res.status(204).end();
    }
  }
  res.status(404).json({ error: "Task not found" });
});

app.listen(port, () => {
  console.log(`http://localhost:${port}`);
});

function saveTasks() {
  fs.writeFileSync("tasks.json", JSON.stringify(tasks));
}
