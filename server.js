import express from "express";
import session from "express-session";
import bcryptjs from "bcryptjs";
import sql from "mssql";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import crypto from "crypto";

dotenv.config();

let sessionSecret = process.env.SESSIONSECRET;
let sqlConnectionString = process.env.SqlConnectionString;

let db;

async function loadSecretsAndStart() {
  if (sessionSecret && sqlConnectionString) {
    console.log("Running locally with .env secrets");
    await connectToSql();
    startServer();
    return;
  }

  console.log("Loading secrets from Azure Key Vault...");
  const keyVaultName = "kv-task-track";

  const { DefaultAzureCredential } = await import("@azure/identity");
  const { SecretClient } = await import("@azure/keyvault-secrets");

  const credential = new DefaultAzureCredential();
  const client = new SecretClient(
    `https://${keyVaultName}.vault.azure.net`,
    credential,
  );

  const sessionSecretObj = await client.getSecret("SESSIONSECRET");
  const sqlSecretObj = await client.getSecret("SqlConnectionString");

  if (!sessionSecretObj.value || !sqlSecretObj.value) {
    throw new Error("Missing required secrets in Key Vault");
  }

  sessionSecret = sessionSecretObj.value;
  sqlConnectionString = sqlSecretObj.value;

  await connectToSql();
  startServer();
}

async function connectToSql() {
  try {
    db = await sql.connect(sqlConnectionString);
    console.log("Connected to Azure SQL!");

    await db.request().query(`
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'users')
      CREATE TABLE users (
        id INT IDENTITY(1,1) PRIMARY KEY,
        username NVARCHAR(50) NOT NULL UNIQUE,
        passwordHash NVARCHAR(255) NOT NULL
      );

      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'tasks')
      CREATE TABLE tasks (
        id INT IDENTITY(1,1) PRIMARY KEY,
        userId INT NOT NULL,
        taskText NVARCHAR(100) NOT NULL,
        priority NVARCHAR(10) NOT NULL,
        deadline DATETIME NULL,
        category NVARCHAR(20) NOT NULL,
        done BIT NOT NULL,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      );

      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'remember_tokens')
      CREATE TABLE remember_tokens (
        id INT IDENTITY(1,1) PRIMARY KEY,
        userId INT NOT NULL,
        token NVARCHAR(255) NOT NULL,
        expiresAt DATETIME NOT NULL,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
  } catch (err) {
    console.error("SQL connection failed:", err);
    throw new Error("Could not connect to SQL: " + err.message);
  }
}

function startServer() {
  console.log("Starting server...");

  const app = express();
  const port = process.env.PORT || 3000;
  const isProd = process.env.NODE_ENV === "production";

  app.use(express.static("public"));
  app.use(express.json());
  app.use(cookieParser());
  app.set("trust proxy", 1);

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
      if (req.session.userId) return next();

      const token = req.cookies?.rememberMe;
      if (!token) return next();

      const result = await db
        .request()
        .input("token", sql.NVarChar(255), token)
        .query(
          "SELECT userId, expiresAt FROM remember_tokens WHERE token = @token",
        );

      if (result.recordset.length === 0) return next();

      const row = result.recordset[0];
      if (new Date(row.expiresAt) < new Date()) return next();

      req.session.userId = row.userId;
      next();
    } catch {
      next();
    }
  });

  app.get("/", (req, res) => {
    res.sendFile("index.html", { root: "public" });
  });

  app.post("/api/auth/register", registerUser);
  app.post("/api/auth/login", loginUser);
  app.post("/api/auth/logout", logoutUser);
  app.get("/api/auth/me", getCurrentUser);

  app.get("/api/tasks", requireAuth, getTasks);
  app.post("/api/tasks", requireAuth, createTask);
  app.patch("/api/tasks/:id", requireAuth, updateTask);
  app.delete("/api/tasks/:id", requireAuth, deleteTask);

  app.use((req, res) => {
    res.status(404).sendFile("404.html", { root: "public" });
  });

  app.listen(port, () => {
    console.log(`Listening on port ${port}`);
  });
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

    const userId = insert.recordset[0].id;
    req.session.userId = userId;

    res.status(201).json({ id: userId, username });
  } catch {
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
  } catch {
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
    }

    res.clearCookie("rememberMe");

    req.session.destroy((err) => {
      if (err) return res.status(500).json({ error: "Could not logout." });
      res.clearCookie("sid");
      res.status(204).end();
    });
  } catch {
    res.status(500).json({ error: "Could not logout." });
  }
}

async function getCurrentUser(req, res) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "The user is not logged in." });
  }

  try {
    const result = await db
      .request()
      .input("id", sql.Int, req.session.userId)
      .query("SELECT id, username FROM users WHERE id = @id");

    if (result.recordset.length === 0) {
      return res.status(401).json({ error: "The user is not logged in." });
    }

    const user = result.recordset[0];
    res.json({ id: user.id, username: user.username });
  } catch {
    res.status(500).json({ error: "Internal server error." });
  }
}

async function getTasks(req, res) {
  try {
    const result = await db
      .request()
      .input("userId", sql.Int, req.session.userId).query(`
        SELECT *,
          ROW_NUMBER() OVER (ORDER BY id) AS userTaskNumber
        FROM tasks
        WHERE userId = @userId
        ORDER BY id
      `);

    res.json(result.recordset);
  } catch {
    res
      .status(500)
      .json({ error: "Internal server error. Please try again later." });
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

    const priorityVal = allowedPriorities.has(priority) ? priority : "Low";
    const categoryVal = allowedCategories.has(category)
      ? category
      : "No Category";

    const insertResult = await db
      .request()
      .input("userId", sql.Int, req.session.userId)
      .input("taskText", sql.NVarChar(100), String(taskText).trim())
      .input("priority", sql.NVarChar(10), priorityVal)
      .input("deadline", sql.DateTime, deadline || null)
      .input("category", sql.NVarChar(20), categoryVal)
      .input("done", sql.Bit, false)
      .query(
        `INSERT INTO tasks (userId, taskText, priority, deadline, category, done)
         OUTPUT INSERTED.*
         VALUES (@userId, @taskText, @priority, @deadline, @category, @done)`,
      );

    res.status(201).json(insertResult.recordset[0]);
  } catch {
    res
      .status(500)
      .json({ error: "Internal server error. Please try again later." });
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
    const params = { id: taskId, userId: req.session.userId };

    if (typeof done === "boolean") {
      updates.push("done = @done");
      params.done = done;
    }

    if (typeof taskText === "string") {
      const trimmed = taskText.trim();
      if (!trimmed) {
        return res.status(400).json({ error: "Task text is required." });
      }
      updates.push("taskText = @taskText");
      params.taskText = trimmed;
    }

    if (typeof priority === "string") {
      const allowedPriorities = new Set(["Low", "Medium", "High"]);
      if (!allowedPriorities.has(priority)) {
        return res.status(400).json({ error: "Invalid priority value." });
      }
      updates.push("priority = @priority");
      params.priority = priority;
    }

    if (category !== undefined) {
      if (category === null) {
        updates.push("category = @category");
        params.category = "No Category";
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
        updates.push("category = @category");
        params.category = category;
      }
    }

    if (deadline !== undefined) {
      if (deadline === null || deadline === "") {
        updates.push("deadline = @deadline");
        params.deadline = null;
      } else if (typeof deadline === "string") {
        updates.push("deadline = @deadline");
        params.deadline = deadline;
      }
    }

    if (updates.length === 0) {
      return res.json(task);
    }

    let reqSql = db
      .request()
      .input("id", sql.Int, params.id)
      .input("userId", sql.Int, params.userId);

    if ("done" in params) {
      reqSql = reqSql.input("done", sql.Bit, params.done);
    }
    if ("taskText" in params) {
      reqSql = reqSql.input("taskText", sql.NVarChar(100), params.taskText);
    }
    if ("priority" in params) {
      reqSql = reqSql.input("priority", sql.NVarChar(10), params.priority);
    }
    if ("category" in params) {
      reqSql = reqSql.input("category", sql.NVarChar(20), params.category);
    }
    if ("deadline" in params) {
      reqSql = reqSql.input("deadline", sql.DateTime, params.deadline);
    }

    await reqSql.query(
      `UPDATE tasks SET ${updates.join(", ")} WHERE id = @id AND userId = @userId`,
    );

    const updated = await db
      .request()
      .input("id", sql.Int, taskId)
      .query("SELECT * FROM tasks WHERE id = @id");

    res.json(updated.recordset[0]);
  } catch {
    res
      .status(500)
      .json({ error: "Internal server error. Please try again later." });
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
  } catch {
    res
      .status(500)
      .json({ error: "Internal server error. Please try again later." });
  }
}

loadSecretsAndStart();
