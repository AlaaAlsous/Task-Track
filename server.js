const express = require("express");
const session = require("express-session");
const bcryptjs = require("bcryptjs");
const sql = require("mssql");
const dotenv = require("dotenv");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");

dotenv.config();

const sessionSecret = process.env.SESSIONSECRET;
const sqlConnectionString = process.env.SQL_CONNECTION_STRING;

if (!sessionSecret) {
  throw new Error("SESSIONSECRET is missing");
}

if (!sqlConnectionString) {
  throw new Error("SQL_CONNECTION_STRING is missing");
}

let db = null;
let sqlReady = false;

const app = express();
const port = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === "production";

app.use(express.static("public"));
app.use(express.json());
app.use(cookieParser());
app.set("trust proxy", 1);

app.get("/health", (req, res) => {
  res.status(sqlReady ? 200 : 503).json({
    status: sqlReady ? "healthy" : "unhealthy",
    database: sqlReady ? "connected" : "disconnected",
  });
});

app.use(
  session({
    name: "sid",
    secret: sessionSecret,
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

app.use(async (req, res, next) => {
  try {
    if (!sqlReady || !db) {
      return res
        .status(503)
        .json({ error: "Service unavailable. Database connection pending." });
    }
    if (req.session.userId) return next();

    const token = req.cookies?.rememberMe;
    if (!token) return next();

    const result = await db
      .request()
      .input("token", sql.NVarChar(255), token)
      .query(
        "SELECT userId FROM remember_tokens WHERE token = @token AND expiresAt > GETDATE()",
      );

    if (result.recordset.length === 0) return next();
    req.session.userId = result.recordset[0].userId;
    next();
  } catch (err) {
    console.error("Session middleware error:", err.message);
    next();
  }
});

app.get("/", (req, res) => res.sendFile("index.html", { root: "public" }));

app.post("/api/auth/register", registerUser);
app.post("/api/auth/login", loginUser);
app.post("/api/auth/logout", logoutUser);
app.get("/api/auth/me", getCurrentUser);

app.get("/api/tasks", requireAuth, getTasks);
app.post("/api/tasks", requireAuth, createTask);
app.patch("/api/tasks/:id", requireAuth, updateTask);
app.delete("/api/tasks/:id", requireAuth, deleteTask);

app.use((req, res) => res.status(404).sendFile("404.html", { root: "public" }));

app.listen(port, () => {
  console.log("Server listening on port " + port);
  if (!sqlConnectionString) {
    console.error("SQL_CONNECTION_STRING missing – database disabled");
  } else {
    connectToDatabase();
  }
});

async function connectToDatabase() {
  for (let i = 0; i < 5; i++) {
    try {
      console.log(`Connecting to Azure SQL (attempt ${i + 1}/5)...`);
      db = await sql.connect(sqlConnectionString);
      console.log("Connected to Azure SQL!");
      await initializeDatabase();
      sqlReady = true;
      console.log("Database ready!");
      return;
    } catch (err) {
      console.error(`Connection attempt ${i + 1} failed:`, err.message);
      if (i < 4) await sleep(2000);
    }
  }
  console.error("All connection attempts failed. Running without database.");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function initializeDatabase() {
  await db.request().query(`
    IF OBJECT_ID('users', 'U') IS NULL
    CREATE TABLE users (
      id INT IDENTITY(1,1) PRIMARY KEY,
      username NVARCHAR(50) NOT NULL UNIQUE,
      passwordHash NVARCHAR(255) NOT NULL
    );

    IF OBJECT_ID('tasks', 'U') IS NULL
    CREATE TABLE tasks (
      id INT IDENTITY(1,1) PRIMARY KEY,
      userId INT NOT NULL,
      taskText NVARCHAR(100) NOT NULL,
      priority NVARCHAR(10) NOT NULL,
      deadline DATETIME NULL,
      category NVARCHAR(20) NOT NULL,
      done BIT NOT NULL DEFAULT 0,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );

    IF OBJECT_ID('remember_tokens', 'U') IS NULL
    CREATE TABLE remember_tokens (
      id INT IDENTITY(1,1) PRIMARY KEY,
      userId INT NOT NULL,
      token NVARCHAR(255) NOT NULL,
      expiresAt DATETIME NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_tasks_userId')
      CREATE INDEX IX_tasks_userId ON tasks(userId);
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_remember_tokens_token')
      CREATE INDEX IX_remember_tokens_token ON remember_tokens(token);
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_remember_tokens_expiresAt')
      CREATE INDEX IX_remember_tokens_expiresAt ON remember_tokens(expiresAt);
  `);
  console.log("Database schema initialized");
}

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "The user is not logged in." });
  }
  next();
}

async function registerUser(req, res) {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Username and password are required." });
    }

    const existing = await db
      .request()
      .input("username", sql.NVarChar(50), username)
      .query("SELECT id FROM users WHERE LOWER(username) = LOWER(@username)");

    if (existing.recordset.length > 0) {
      return res.status(409).json({ error: "User already exists." });
    }

    const passwordHash = await bcryptjs.hash(String(password), 10);
    const insert = await db
      .request()
      .input("username", sql.NVarChar(50), username)
      .input("passwordHash", sql.NVarChar(255), passwordHash)
      .query(
        "INSERT INTO users (username, passwordHash) OUTPUT INSERTED.id VALUES (@username, @passwordHash)",
      );

    req.session.userId = insert.recordset[0].id;
    res.status(201).json({ id: insert.recordset[0].id, username });
  } catch (err) {
    console.error("registerUser:", err.message);
    res.status(500).json({ error: "Internal server error." });
  }
}

async function loginUser(req, res) {
  try {
    const { username, password, remember } = req.body;
    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Username and password are required." });
    }

    const result = await db
      .request()
      .input("username", sql.NVarChar(50), username)
      .query(
        "SELECT id, passwordHash FROM users WHERE LOWER(username) = LOWER(@username)",
      );

    if (result.recordset.length === 0) {
      return res
        .status(401)
        .json({ error: "Username or password is incorrect." });
    }

    const user = result.recordset[0];
    const valid = await bcryptjs.compare(String(password), user.passwordHash);
    if (!valid) {
      return res
        .status(401)
        .json({ error: "Username or password is incorrect." });
    }

    req.session.userId = user.id;

    if (remember) {
      const token = crypto.randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 180);
      const isProd = process.env.NODE_ENV === "production";

      await db
        .request()
        .input("userId", sql.Int, user.id)
        .input("token", sql.NVarChar(255), token)
        .input("expiresAt", sql.DateTime, expires)
        .query(
          "INSERT INTO remember_tokens (userId, token, expiresAt) VALUES (@userId, @token, @expiresAt)",
        );

      res.cookie("rememberMe", token, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? "none" : "lax",
        maxAge: 1000 * 60 * 60 * 24 * 180,
      });
    }

    res.json({ id: user.id, username });
  } catch (err) {
    console.error("loginUser:", err.message);
    res.status(500).json({ error: "Internal server error." });
  }
}

async function logoutUser(req, res) {
  try {
    const token = req.cookies?.rememberMe;
    if (token) {
      await db
        .request()
        .input("token", sql.NVarChar(255), token)
        .query("DELETE FROM remember_tokens WHERE token = @token");
      db.request()
        .query("DELETE FROM remember_tokens WHERE expiresAt < GETDATE()")
        .catch(() => {});
    }
    res.clearCookie("rememberMe");
    req.session.destroy((err) => {
      if (err) return res.status(500).json({ error: "Could not logout." });
      res.clearCookie("sid");
      res.status(204).end();
    });
  } catch (err) {
    console.error("logoutUser:", err.message);
    res.status(500).json({ error: "Could not logout." });
  }
}

async function getCurrentUser(req, res) {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: "The user is not logged in." });
    }
    const result = await db
      .request()
      .input("id", sql.Int, req.session.userId)
      .query("SELECT id, username FROM users WHERE id = @id");

    if (result.recordset.length === 0) {
      return res.status(401).json({ error: "The user is not logged in." });
    }
    res.json(result.recordset[0]);
  } catch (err) {
    console.error("getCurrentUser:", err.message);
    res.status(500).json({ error: "Internal server error." });
  }
}
async function getTasks(req, res) {
  try {
    const result = await db
      .request()
      .input("userId", sql.Int, req.session.userId).query(`
      SELECT id, userId, taskText, priority, deadline, category, done,
        ROW_NUMBER() OVER (ORDER BY id) AS userTaskNumber
      FROM tasks WHERE userId = @userId ORDER BY id
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error("getTasks:", err.message);
    res.status(500).json({ error: "Internal server error." });
  }
}

async function createTask(req, res) {
  try {
    const { taskText, deadline, priority, category } = req.body;
    if (!taskText || !String(taskText).trim()) {
      return res.status(400).json({ error: "Task text is required." });
    }

    const allowedPriorities = new Set(["Low", "Medium", "High"]);
    const allowedCategories = new Set([
      "Private",
      "Work",
      "School",
      "No Category",
    ]);

    const insertResult = await db
      .request()
      .input("userId", sql.Int, req.session.userId)
      .input("taskText", sql.NVarChar(100), String(taskText).trim())
      .input(
        "priority",
        sql.NVarChar(10),
        allowedPriorities.has(priority) ? priority : "Low",
      )
      .input("deadline", sql.DateTime, deadline || null)
      .input(
        "category",
        sql.NVarChar(20),
        allowedCategories.has(category) ? category : "No Category",
      )
      .input("done", sql.Bit, false)
      .query(`INSERT INTO tasks (userId, taskText, priority, deadline, category, done)
              OUTPUT INSERTED.* VALUES (@userId, @taskText, @priority, @deadline, @category, @done)`);

    res.status(201).json(insertResult.recordset[0]);
  } catch (err) {
    console.error("createTask:", err.message);
    res.status(500).json({ error: "Internal server error." });
  }
}

async function updateTask(req, res) {
  try {
    const taskId = Number(req.params.id);
    const { done, taskText, priority, deadline, category } = req.body;

    const result = await db
      .request()
      .input("id", sql.Int, taskId)
      .input("userId", sql.Int, req.session.userId)
      .query("SELECT * FROM tasks WHERE id = @id AND userId = @userId");

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: "Task not found." });
    }

    const task = result.recordset[0];
    const updates = [];
    const params = {};

    if (typeof done === "boolean") {
      updates.push("done = @done");
      params.done = done;
    }
    if (typeof taskText === "string") {
      const trimmed = taskText.trim();
      if (!trimmed)
        return res.status(400).json({ error: "Task text is required." });
      updates.push("taskText = @taskText");
      params.taskText = trimmed;
    }
    if (typeof priority === "string") {
      if (!["Low", "Medium", "High"].includes(priority))
        return res.status(400).json({ error: "Invalid priority." });
      updates.push("priority = @priority");
      params.priority = priority;
    }
    if (category !== undefined) {
      const val = category === null ? "No Category" : category;
      if (!["Private", "Work", "School", "No Category"].includes(val))
        return res.status(400).json({ error: "Invalid category." });
      updates.push("category = @category");
      params.category = val;
    }
    if (deadline !== undefined) {
      updates.push("deadline = @deadline");
      params.deadline = deadline === null || deadline === "" ? null : deadline;
    }

    if (updates.length === 0) return res.json(task);

    let reqSql = db
      .request()
      .input("id", sql.Int, taskId)
      .input("userId", sql.Int, req.session.userId);
    if ("done" in params) reqSql = reqSql.input("done", sql.Bit, params.done);
    if ("taskText" in params)
      reqSql = reqSql.input("taskText", sql.NVarChar(100), params.taskText);
    if ("priority" in params)
      reqSql = reqSql.input("priority", sql.NVarChar(10), params.priority);
    if ("category" in params)
      reqSql = reqSql.input("category", sql.NVarChar(20), params.category);
    if ("deadline" in params)
      reqSql = reqSql.input("deadline", sql.DateTime, params.deadline);

    await reqSql.query(
      `UPDATE tasks SET ${updates.join(", ")} WHERE id = @id AND userId = @userId`,
    );

    const updated = await db
      .request()
      .input("id", sql.Int, taskId)
      .query("SELECT * FROM tasks WHERE id = @id");
    res.json(updated.recordset[0]);
  } catch (err) {
    console.error("updateTask:", err.message);
    res.status(500).json({ error: "Internal server error." });
  }
}

async function deleteTask(req, res) {
  try {
    const taskId = Number(req.params.id);
    const result = await db
      .request()
      .input("id", sql.Int, taskId)
      .input("userId", sql.Int, req.session.userId)
      .query("DELETE FROM tasks WHERE id = @id AND userId = @userId");

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: "Task not found" });
    }
    res.status(204).end();
  } catch (err) {
    console.error("deleteTask:", err.message);
    res.status(500).json({ error: "Internal server error." });
  }
}
