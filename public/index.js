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

      let oneDayLeft = false;
      if (task.deadline && task.deadline !== "No Deadline" && !task.done) {
        const deadlineDate = new Date(task.deadline);
        const now = new Date();
        const diffTime = deadlineDate.getTime() - now.getTime();
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        if (diffDays <= 1 && diffDays > 0) {
          oneDayLeft = true;
        }
      }

      let oneHourLeft = false;
      if (task.deadline && task.deadline !== "No Deadline" && !task.done) {
        const deadlineDate = new Date(task.deadline);
        const now = new Date();
        const diffTime = deadlineDate.getTime() - now.getTime();
        const diffHours = diffTime / (1000 * 60 * 60);
        if (diffHours <= 1 && diffHours > 0) {
          oneHourLeft = true;
        }
      }

      let timeIsUp = false;
      if (task.deadline && task.deadline !== "No Deadline") {
        const deadlineDate = new Date(task.deadline);
        const now = new Date();
        if (now.getTime() > deadlineDate.getTime()) {
          timeIsUp = true;
        }
      }

      let formattedDeadline = task.deadline
        ? task.deadline.replace("T", " | ")
        : "No Deadline";

      listItem.innerHTML = `<input type="checkbox" class="done-checkbox" style="accent-color: #d4a574;" ${
        task.done ? "checked" : ""
      }/> <div class="task-id">${task.id}</div><div class="task-text">${
        task.taskText +
        (timeIsUp ? "<span style = color:#750000> Expired!</span>" : "")
      }</div> <div class="task-deadline">${formattedDeadline}</div>  <div class="task-category">${
        task.category
      }</div><div class="task-priority">${task.priority}</div>
      <button class="editBtn">Edit</button><button class="deleteBtn">X</button>`;

      if (oneDayLeft) {
        listItem.classList.add("one-day-left");
      }
      if (oneHourLeft) {
        listItem.classList.add("one-hour-left");
      }
      if (timeIsUp) {
        listItem.classList.add("time-is-up");
      }

      const doneCheckbox = listItem.querySelector(".done-checkbox");
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
          } else if (!isDone) {
            listItem.classList.add("undone-task");
            setTimeout(() => {
              showNotification("❌ Task Unchecked!");
              loadTasks();
            }, 500);
          }
        } catch (error) {
          alert("Could not update task. Please try again.");
          e.target.checked = !e.target.checked;
        }
      };

      const deleteBtn = listItem.querySelector(".deleteBtn");
      deleteBtn.onclick = async () => {
        try {
          const response = await fetch(`/api/tasks/${task.id}`, {
            method: "DELETE",
            credentials: "include",
          });
          if (!response.ok) throw new Error("Failed to delete task");
          listItem.classList.add("remove-task");
          setTimeout(() => {
            listItem.remove();
            showNotification("❌ Task Deleted!");
            loadTasks();
          }, 500);
        } catch (error) {
          alert("Could not delete task. Please try again.");
        }
      };

      const editBtn = listItem.querySelector(".editBtn");
      editBtn.onclick = () => {
        const deadlineValue = task.deadline ? task.deadline : "";
        listItem.innerHTML = `
          <div class="task-id">${task.id}</div>
          <input id="edit-text" type="text" maxlength="100" style="outline:none;" value="${task.taskText.replace(
            /"/g,
            "&quot;",
          )}" class="task-text" />
          <input id="edit-deadline" type="datetime-local" value="${deadlineValue}" class="task-deadline" />
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

        saveBtn.onclick = async () => {
          const newText = listItem.querySelector("#edit-text").value.trim();
          const newDeadline = listItem.querySelector("#edit-deadline").value;
          const newCategory = listItem.querySelector("#edit-category").value;
          const newPriority = listItem.querySelector("#edit-priority").value;

          if (!newText) {
            return;
          }
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
            loadTasks();
          } catch (error) {
            alert("Could not update task. Please try again.");
          }
        };

        cancelBtn.onclick = () => {
          loadTasks();
        };
      };
      taskList.appendChild(listItem);
    }
  } catch (error) {
    alert("Could not load tasks. Please try again.");
  }
}
loadTasks();

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
  } catch (error) {
    alert("Could not add task. Please try again.");
  }
}
addBtn.onclick = addTask;

taskTextInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addBtn.click();
});

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
