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
  try {
    const data = fs.readFileSync("tasks.json", "utf8");
    tasks = JSON.parse(data);
    taskId = tasks.length > 0 ? Math.max(...tasks.map((t) => t.id)) + 1 : 1;
  } catch {
    tasks = [];
    taskId = 1;
  }
}

app.get("/index.html", (req, res) => {
  res.redirect("/");
});

app.get("/api/tasks", (req, res) => {
  res.json(tasks);
});

app.post("/api/tasks", async (req, res) => {
  try {
    const { taskText, deadline, priority } = req.body;
    if (!taskText || !priority) {
      return res
        .status(400)
        .json({ error: "Task text and priority are required." });
    }
    const newTask = {
      id: taskId++,
      taskText,
      priority,
      deadline: deadline || null,
      done: false,
    };
    tasks.push(newTask);
    await saveTasks();
    res.status(201).json(newTask);
  } catch {
    res
      .status(500)
      .json({ error: "Internal server error. Please try again later." });
  }
});

app.patch("/api/tasks/:id", async (req, res) => {
  try {
    const taskId = Number(req.params.id);
    const { done } = req.body;
    for (let i = 0; i < tasks.length; i++) {
      if (tasks[i].id === taskId) {
        tasks[i].done = done;
        await saveTasks();
        return res.json(tasks[i]);
      }
    }
    res.status(404).json({ error: "Task not found" });
  } catch {
    res
      .status(500)
      .json({ error: "Internal server error. Please try again later." });
  }
});

app.delete("/api/tasks/:id", async (req, res) => {
  try {
    const taskId = Number(req.params.id);
    for (let i = 0; i < tasks.length; i++) {
      if (tasks[i].id === taskId) {
        tasks.splice(i, 1);
        await saveTasks();
        return res.status(204).end();
      }
    }
    res.status(404).json({ error: "Task not found" });
  } catch {
    res
      .status(500)
      .json({ error: "Internal server error. Please try again later." });
  }
});

app.listen(port, () => {
  console.log(`http://localhost:${port}`);
});

async function saveTasks() {
  try {
    await fs.promises.writeFile("tasks.json", JSON.stringify(tasks));
  } catch {
    throw new Error("Failed to save tasks");
  }
}
