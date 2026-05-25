"use strict";

const authLink = document.getElementById("auth-link");
const authModal = document.getElementById("auth-modal");
const modalClose = document.getElementById("modal-close");
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const switchToRegister = document.getElementById("switch-to-register");
const switchToLogin = document.getElementById("switch-to-login");
const loginBtnModal = document.getElementById("modal-login-btn");
const registerBtnModal = document.getElementById("modal-register-btn");
const loginErrorModal = document.getElementById("modal-login-error");
const registerErrorModal = document.getElementById("modal-register-error");

function openAuthModal(mode = "login") {
  if (mode === "login") {
    loginForm.style.display = "block";
    registerForm.style.display = "none";
    document.getElementById("modal-title").innerText = "Sign In";
  } else {
    loginForm.style.display = "none";
    registerForm.style.display = "block";
    document.getElementById("modal-title").innerText = "Register";
  }
  authModal.style.display = "flex";
}

function closeAuthModal() {
  authModal.style.display = "none";
}

modalClose.onclick = closeAuthModal;
switchToRegister.onclick = () => openAuthModal("register");
switchToLogin.onclick = () => openAuthModal("login");
authLink.onclick = (e) => {
  e.preventDefault();
  openAuthModal("login");
};

async function checkAuthAndUpdateNav() {
  try {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    if (!res.ok) throw new Error("Not authed");
    const me = await res.json();

    authLink.textContent = `Sign Out (${me.username})`;
    authLink.onclick = async (e) => {
      e.preventDefault();
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          credentials: "include",
        });
      } catch {}
      authLink.textContent = "Sign In";
      authLink.onclick = (ev) => {
        ev.preventDefault();
        openAuthModal("login");
      };
      loadTasks();
    };
  } catch {
    authLink.textContent = "Sign In";
    authLink.onclick = (e) => {
      e.preventDefault();
      openAuthModal("login");
    };
  }
}

const taskList = document.getElementById("tasks");
const sortByIdCheckbox = document.getElementById("sortById");
const sortByPriorityCheckbox = document.getElementById("sortByPriority");
const sortByCategoryCheckbox = document.getElementById("sortByCategory");

let editingTask = null;

function formatDeadline(deadline) {
  if (!deadline || deadline === "No Deadline") return "No Deadline";
  const d = new Date(deadline);
  if (isNaN(d.getTime())) return "No Deadline";

  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} | ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

function computeDeadlineFlags(task) {
  let oneDayLeft = false;
  let oneHourLeft = false;
  let timeIsUp = false;

  if (task.deadline && task.deadline !== "No Deadline") {
    const deadlineDate = new Date(task.deadline);
    const now = new Date();
    const diffTime = deadlineDate.getTime() - now.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    const diffHours = diffTime / (1000 * 60 * 60);

    if (!task.done) {
      if (diffDays <= 1 && diffDays > 0) oneDayLeft = true;
      if (diffHours <= 1 && diffHours > 0) oneHourLeft = true;
    }
    if (now.getTime() > deadlineDate.getTime()) timeIsUp = true;
  }

  return { oneDayLeft, oneHourLeft, timeIsUp };
}

async function loadTasks() {
  try {
    const response = await fetch("/api/tasks", { credentials: "include" });
    if (response.status === 401) {
      openAuthModal("login");
      return;
    }
    if (!response.ok) throw new Error("Failed to load tasks");

    let tasks = await response.json();

    document.getElementById("total-tasks").innerText = tasks.length;
    document.getElementById("completed-tasks").innerText = tasks.filter(
      (t) => t.done,
    ).length;

    tasks = tasks.sort((a, b) => {
      if (a.done !== b.done) return a.done - b.done;

      if (sortByIdCheckbox.checked) {
        return a.id - b.id;
      } else if (sortByPriorityCheckbox.checked) {
        const priorityOrder = { High: 1, Medium: 2, Low: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      } else if (sortByCategoryCheckbox.checked) {
        const categoryOrder = {
          Private: 1,
          Work: 2,
          School: 3,
          "No Category": 4,
        };
        return categoryOrder[a.category] - categoryOrder[b.category];
      } else {
        const dateA =
          a.deadline && a.deadline !== "No Deadline"
            ? new Date(a.deadline).getTime()
            : Number.MAX_SAFE_INTEGER;
        const dateB =
          b.deadline && b.deadline !== "No Deadline"
            ? new Date(b.deadline).getTime()
            : Number.MAX_SAFE_INTEGER;
        return dateA - dateB;
      }
    });

    taskList.innerHTML = "";

    for (const task of tasks) {
      const listItem = document.createElement("li");

      const { oneDayLeft, oneHourLeft, timeIsUp } = computeDeadlineFlags(task);

      if (oneDayLeft) listItem.classList.add("one-day-left");
      if (oneHourLeft) listItem.classList.add("one-hour-left");
      if (timeIsUp) listItem.classList.add("time-is-up");

      const doneCheckbox = document.createElement("input");
      doneCheckbox.type = "checkbox";
      doneCheckbox.className = "done-checkbox";
      doneCheckbox.style.accentColor = "#d4a574";
      doneCheckbox.checked = !!task.done;

      const idDiv = document.createElement("div");
      idDiv.className = "task-id";
      idDiv.textContent = task.userTaskNumber ?? task.id;

      const textDiv = document.createElement("div");
      textDiv.className = "task-text";
      textDiv.textContent = task.taskText;

      if (timeIsUp) {
        const expiredSpan = document.createElement("span");
        expiredSpan.style.color = "#750000";
        expiredSpan.textContent = " Expired!";
        textDiv.appendChild(expiredSpan);
      }

      const deadlineDiv = document.createElement("div");
      deadlineDiv.className = "task-deadline";
      deadlineDiv.textContent = formatDeadline(task.deadline);

      const categoryDiv = document.createElement("div");
      categoryDiv.className = "task-category";
      categoryDiv.textContent = task.category;

      const priorityDiv = document.createElement("div");
      priorityDiv.className = "task-priority";
      priorityDiv.textContent = task.priority;

      const editBtn = document.createElement("button");
      editBtn.className = "editBtn";
      editBtn.textContent = "Edit";

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "deleteBtn";
      deleteBtn.textContent = "X";

      listItem.appendChild(doneCheckbox);
      listItem.appendChild(idDiv);
      listItem.appendChild(textDiv);
      listItem.appendChild(deadlineDiv);
      listItem.appendChild(categoryDiv);
      listItem.appendChild(priorityDiv);
      listItem.appendChild(editBtn);
      listItem.appendChild(deleteBtn);

      doneCheckbox.onchange = async (e) => {
        try {
          const isDone = e.target.checked;
          const response = await fetch(`/api/tasks/${task.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ done: isDone }),
          });
          if (!response.ok) throw new Error("Failed to update task");

          if (isDone) {
            listItem.classList.add("done-task");
            setTimeout(() => {
              showNotification("✅ Task Completed!");
              loadTasks();
            }, 500);
          } else {
            listItem.classList.add("undone-task");
            setTimeout(() => {
              showNotification("❌ Task Unchecked!");
              loadTasks();
            }, 500);
          }
        } catch {
          alert("Could not update task. Please try again.");
          e.target.checked = !e.target.checked;
        }
      };

      deleteBtn.onclick = () => {
        const deleteModal = document.getElementById("delete-modal");
        deleteModal.style.display = "flex";
        const confirmBtn = document.getElementById("delete-confirm-btn");
        const cancelBtn = document.getElementById("delete-cancel-btn");

        confirmBtn.onclick = null;
        cancelBtn.onclick = null;

        const handleEnter = (e) => handleEnterConfirmBtn(e, confirmBtn);
        deleteModal.addEventListener("keydown", handleEnter);

        confirmBtn.onclick = async () => {
          try {
            const response = await fetch(`/api/tasks/${task.id}`, {
              method: "DELETE",
              credentials: "include",
            });
            if (!response.ok) throw new Error("Failed to delete task");
            deleteModal.style.display = "none";
            listItem.classList.add("remove-task");
            setTimeout(() => {
              listItem.remove();
              showNotification("❌ Task Deleted!");
              loadTasks();
            }, 500);
          } catch {
            alert("Could not delete task. Please try again.");
            deleteModal.style.display = "none";
          }
          deleteModal.removeEventListener("keydown", handleEnter);
        };

        cancelBtn.onclick = () => {
          deleteModal.style.display = "none";
          deleteModal.removeEventListener("keydown", handleEnter);
        };

        confirmBtn.focus();
      };

      editBtn.onclick = () => {
        if (editingTask && editingTask !== listItem) {
          showEditModal(
            () => {
              const saveBtn = editingTask.querySelector(".saveBtn");
              if (saveBtn) saveBtn.click();
            },
            () => {
              editingTask = null;
              loadTasks();
            },
            () => {
              if (editingTask) {
                const input = editingTask.querySelector("#edit-text");
                if (input) input.focus();
              }
            },
          );
          return;
        }

        editingTask = listItem;
        const deadlineValue = task.deadline ? task.deadline : "";

        listItem.innerHTML = `
          <div class="task-id">${task.userTaskNumber ?? task.id}</div>
          <input id="edit-text" type="text" maxlength="100" style="outline:none;" value="${task.taskText.replace(
            /"/g,
            "&quot;",
          )}" class="task-text" />
          <input id="edit-deadline" type="datetime-local" value="${deadlineValue || ""}" class="task-deadline" />
          <select id="edit-category" class="task-category">
            <option value="Private" ${
              task.category === "Private" ? "selected" : ""
            }>Private</option>
            <option value="Work" ${
              task.category === "Work" ? "selected" : ""
            }>Work</option>
            <option value="School" ${
              task.category === "School" ? "selected" : ""
            }>School</option>
            <option value="No Category" ${
              task.category === "No Category" ? "selected" : ""
            }>No Category</option>
          </select>
          <select id="edit-priority" class="task-priority">
            <option value="Low" ${
              task.priority === "Low" ? "selected" : ""
            }>Low</option>
            <option value="Medium" ${
              task.priority === "Medium" ? "selected" : ""
            }>Medium</option>
            <option value="High" ${
              task.priority === "High" ? "selected" : ""
            }>High</option>
          </select>
          <button class="saveBtn">Save</button>
          <button class="cancelBtn">Cancel</button>
        `;

        const saveBtn = listItem.querySelector(".saveBtn");
        const cancelBtn = listItem.querySelector(".cancelBtn");
        const editText = listItem.querySelector("#edit-text");
        const editDeadline = listItem.querySelector("#edit-deadline");
        const editCategory = listItem.querySelector("#edit-category");
        const editPriority = listItem.querySelector("#edit-priority");

        [editText, editDeadline, editCategory, editPriority].forEach((el) => {
          el.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              saveBtn.click();
            }
          });
        });

        saveBtn.onclick = async () => {
          const newText = editText.value.trim();
          const newDeadline = editDeadline.value;
          const newCategory = editCategory.value;
          const newPriority = editPriority.value;

          if (!newText) return;

          try {
            const response = await fetch(`/api/tasks/${task.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                taskText: newText,
                deadline: newDeadline ? newDeadline : null,
                category: newCategory,
                priority: newPriority,
              }),
            });
            if (!response.ok) throw new Error("Failed to update task");
            showNotification("✏️ Task Updated!");
            editingTask = null;
            loadTasks();
          } catch {
            alert("Could not update task. Please try again.");
          }
        };

        cancelBtn.onclick = () => {
          editingTask = null;
          loadTasks();
        };
      };

      taskList.appendChild(listItem);
    }
  } catch {
    alert("Could not load tasks. Please try again.");
  }
}

loadTasks();

async function doLoginModal() {
  loginErrorModal.textContent = "";
  try {
    const username = document
      .getElementById("modal-login-username")
      .value.trim();
    const password = document
      .getElementById("modal-login-password")
      .value.trim();
    if (!username || !password) {
      loginErrorModal.textContent = "Please enter your username and password.";
      return;
    }
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Login failed" }));
      loginErrorModal.textContent = data.error || "Login failed";
      return;
    }
    closeAuthModal();
    await checkAuthAndUpdateNav();
    loadTasks();
  } catch {
    loginErrorModal.textContent = "Technical error. Please try again.";
  }
}

async function doRegisterModal() {
  registerErrorModal.textContent = "";
  try {
    const username = document.getElementById("modal-reg-username").value.trim();
    const password = document.getElementById("modal-reg-password").value.trim();
    if (!username || !password) {
      registerErrorModal.textContent =
        "Please enter your username and password.";
      return;
    }
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const data = await res
        .json()
        .catch(() => ({ error: "Registration failed" }));
      registerErrorModal.textContent = data.error || "Registration failed";
      return;
    }
    closeAuthModal();
    await checkAuthAndUpdateNav();
    loadTasks();
  } catch {
    registerErrorModal.textContent = "Technical error. Please try again.";
  }
}

loginBtnModal.onclick = doLoginModal;
registerBtnModal.onclick = doRegisterModal;

const registerUsernameInput = document.getElementById("modal-reg-username");
const registerPasswordInput = document.getElementById("modal-reg-password");
if (registerUsernameInput && registerPasswordInput && registerBtnModal) {
  [registerUsernameInput, registerPasswordInput].forEach((el) => {
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        registerBtnModal.click();
      }
    });
  });
}

const loginUsernameInput = document.getElementById("modal-login-username");
const loginPasswordInput = document.getElementById("modal-login-password");
if (loginUsernameInput && loginPasswordInput && loginBtnModal) {
  [loginUsernameInput, loginPasswordInput].forEach((el) => {
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        loginBtnModal.click();
      }
    });
  });
}

checkAuthAndUpdateNav();

const taskTextInput = document.getElementById("new-task");
const priorityInput = document.getElementById("priority");
const deadlineInput = document.getElementById("due-date");
const categoryInput = document.getElementById("category");
const addBtn = document.getElementById("add-task-btn");

async function addTask() {
  try {
    const taskText = taskTextInput.value.trim();
    const taskPriority = priorityInput.value;
    const taskDeadline = deadlineInput.value;
    const taskCategory = categoryInput.value;

    if (!taskText) return;

    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        taskText: taskText,
        priority: taskPriority ? taskPriority : "Low",
        deadline: taskDeadline ? taskDeadline : null,
        category: taskCategory ? taskCategory : "No Category",
      }),
    });

    if (!response.ok) throw new Error("Failed to add task");

    taskTextInput.value = "";
    priorityInput.value = "";
    deadlineInput.value = "";
    categoryInput.value = "";
    loadTasks();
    showNotification("✅ Task Added!");
    taskTextInput.focus();
  } catch {
    alert("Could not add task. Please try again.");
  }
}

addBtn.onclick = addTask;

taskTextInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    addBtn.click();
  }
});

function showEditModal(onSave, onCancel, onContinue) {
  const modal = document.getElementById("save-modal");
  modal.style.display = "flex";
  const saveBtn = document.getElementById("save-modal-save");
  const cancelBtn = document.getElementById("save-modal-cancel");
  const continueBtn = document.getElementById("save-modal-continue");

  saveBtn.onclick = null;
  cancelBtn.onclick = null;
  continueBtn.onclick = null;

  saveBtn.onclick = () => {
    modal.style.display = "none";
    onSave?.();
  };
  cancelBtn.onclick = () => {
    modal.style.display = "none";
    onCancel?.();
  };
  continueBtn.onclick = () => {
    modal.style.display = "none";
    onContinue?.();
  };
}

sortByIdCheckbox.onchange = () => {
  if (sortByIdCheckbox.checked) {
    sortByPriorityCheckbox.checked = false;
    sortByCategoryCheckbox.checked = false;
  }
  loadTasks();
};

sortByPriorityCheckbox.onchange = () => {
  if (sortByPriorityCheckbox.checked) {
    sortByIdCheckbox.checked = false;
    sortByCategoryCheckbox.checked = false;
  }
  loadTasks();
};

sortByCategoryCheckbox.onchange = () => {
  if (sortByCategoryCheckbox.checked) {
    sortByIdCheckbox.checked = false;
    sortByPriorityCheckbox.checked = false;
  }
  loadTasks();
};

function showNotification(message) {
  const notification = document.getElementById("notification");
  notification.innerText = message;
  notification.classList.remove("hide-notification");
  setTimeout(() => {
    notification.classList.add("hide-notification");
  }, 1500);
}

function handleEnterConfirmBtn(e, confirmBtn) {
  if (e.key === "Enter") {
    e.preventDefault();
    confirmBtn.click();
  }
}
