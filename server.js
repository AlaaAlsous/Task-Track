"use strict";

import express from "express";
import fs from "fs";
import session from "express-session";

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

app.set("trust proxy", 1);

app.use(express.static("public"));
app.use(express.json());

const isProd = process.env.NODE_ENV === "production";
app.use(
  session({
    name: "sid",
    secret: process.env.SESSION_SECRET || "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  }),
);

let tasks = [];
let taskId = 1;

if (fs.existsSync("tasks.json")) {
  loadTasks();
}

app.get("/index.html", (req, res) => {
  res.redirect("/");
});

app.get("/api/tasks", (req, res) => {
  res.json(tasks);
});

app.post("/api/tasks", async (req, res) => {
  try {
    const { taskText, deadline, priority, category } = req.body;
    if (!taskText) {
      return res.status(400).json({ error: "Task text are required." });
    }
    const newTask = {
      id: taskId++,
      taskText,
      priority,
      deadline: deadline || null,
      category,
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

async function loadTasks() {
  try {
    const data = await fs.promises.readFile("tasks.json", "utf8");
    tasks = JSON.parse(data);
    taskId = tasks.length > 0 ? Math.max(...tasks.map((t) => t.id)) + 1 : 1;
  } catch {
    tasks = [];
    taskId = 1;
  }
}

async function saveTasks() {
  try {
    await fs.promises.writeFile("tasks.json", JSON.stringify(tasks));
  } catch (error) {
    throw error;
  }
}

app.use((req, res) => {
  res.status(404).sendFile("404.html", { root: "public" });
});

app.listen(port, () => {
  console.log(`http://localhost:${port}`);
});
