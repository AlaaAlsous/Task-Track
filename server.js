"use strict";

import express from "express";
import fs from "fs";
import session from "express-session";
import bcrypt from "bcrypt";
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

const TASKS_DIR = "Users";
if (!fs.existsSync(TASKS_DIR)) {
  fs.mkdirSync(TASKS_DIR, { recursive: true });
}

let users = [];

const USERS_FILE = "users.json";
if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, "[]");
}
loadUsers();

app.get("/index.html", (req, res) => {
  res.redirect("/");
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Username and password are required." });
    }
    const existing = users.find(
      (u) => u.username.toLowerCase() === String(username).toLowerCase(),
    );
    if (existing) {
      return res.status(409).json({ error: "User already exists." });
    }
    const passwordHash = await bcrypt.hash(String(password), 10);
    const newUser = {
      id: users.length > 0 ? Math.max(...users.map((u) => u.id)) + 1 : 1,
      username: String(username),
      passwordHash,
      createdAt: new Date().toISOString(),
    };
    users.push(newUser);
    await saveUsers();

    req.session.userId = newUser.id;
    res.status(201).json({ id: newUser.id, username: newUser.username });
  } catch (err) {
    res.status(500).json({ error: "Internal server error." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Username and password are required." });
    }
    const user = users.find(
      (u) => u.username.toLowerCase() === String(username).toLowerCase(),
    );
    if (!user) {
      return res
        .status(401)
        .json({ error: "Username or password is incorrect." });
    }
    const valid = await bcrypt.compare(String(password), user.passwordHash);
    if (!valid) {
      return res
        .status(401)
        .json({ error: "Username or password is incorrect." });
    }
    req.session.userId = user.id;
    res.json({ id: user.id, username: user.username });
  } catch (err) {
    res.status(500).json({ error: "Internal server error." });
  }
}); 

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: "Could not logout." });
    res.clearCookie("sid");
    res.status(204).end();
  });
});

app.get("/api/auth/me", (req, res) => {
  const user = users.find((u) => u.id === req.session.userId);
  if (!user)
    return res.status(401).json({ error: "The user is not logged in." });
  res.json({ id: user.id, username: user.username });
});

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "The user is not logged in." });
  }
  next();
}

app.get("/api/tasks", requireAuth, async (req, res) => {
  try {
    const tasks = await loadUserTasks(req.session.userId);
    res.json(tasks);
  } catch {
    res
      .status(500)
      .json({ error: "Internal server error. Please try again later." });
  }
});


app.post("/api/tasks", requireAuth, async (req, res) => {
  try {
    const { taskText, deadline, priority, category } = req.body;
    if (!taskText) {
      return res.status(400).json({ error: "Task text is required." });
    }
    const tasks = await loadUserTasks(req.session.userId);
    const nextId =
      tasks.length > 0 ? Math.max(...tasks.map((t) => t.id)) + 1 : 1;
    const newTask = {
      id: nextId,
      taskText,
      priority,
      deadline: deadline || null,
      category,
      done: false,
    };
    tasks.push(newTask);
    await saveUserTasks(req.session.userId, tasks);
    res.status(201).json(newTask);
  } catch {
    res
      .status(500)
      .json({ error: "Internal server error. Please try again later." });
  }
});
app.get("/index.html", (req, res) => {
  res.redirect("/");
});
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

app.patch("/api/tasks/:id", requireAuth, async (req, res) => {
  try {
    const taskId = Number(req.params.id);
    const { done, taskText, priority, deadline, category } = req.body;
    const tasks = await loadUserTasks(req.session.userId);
    for (let i = 0; i < tasks.length; i++) {
      if (tasks[i].id === taskId) {
        if (typeof done === "boolean") {
          tasks[i].done = done;
        }
        if (typeof taskText === "string") {
          const trimmed = taskText.trim();
          if (!trimmed) {
            return res.status(400).json({ error: "Task text is required." });
          }
          tasks[i].taskText = trimmed;
        }
        if (typeof priority === "string") {
          const allowedPriorities = new Set(["Low", "Medium", "High"]);
          if (!allowedPriorities.has(priority)) {
            return res.status(400).json({ error: "Invalid priority value." });
          }
          tasks[i].priority = priority;
        }
        if (category !== undefined) {
          if (category === null) {
            tasks[i].category = "No Category";
          } else if (typeof category === "string") {
            const allowedCategories = new Set([
              "Private",
              "Work",
              "School",
              "No Category",
            ]);
            if (!allowedCategories.has(category)) {
              return res.status(400).json({ error: "Invalid category value." });
            }
            tasks[i].category = category;
          }
        }
        if (deadline !== undefined) {
          if (deadline === null || deadline === "") {
            tasks[i].deadline = null;
          } else if (typeof deadline === "string") {
            const valid = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(deadline);
            if (!valid) {
              return res
                .status(400)
                .json({ error: "Invalid deadline format." });
            }
            tasks[i].deadline = deadline;
          }
        }
        await saveUserTasks(req.session.userId, tasks);
        return res.json(tasks[i]);
      }
    }
    res.status(404).json({ error: "Task not found." });
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
