"use strict";

const taskList = document.getElementById("tasks");
const sortByIdCheckbox = document.getElementById("sortById");
const sortByPriorityCheckbox = document.getElementById("sortByPriority");
const sortByCategoryCheckbox = document.getElementById("sortByCategory");

async function loadTasks() {
  try {
    const response = await fetch("/api/tasks");
    if (!response.ok) throw new Error("Failed to load tasks");
    let tasks = await response.json();
    document.getElementById("total-tasks").innerText = tasks.length;
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

      let formattedDeadline = task.deadline
        ? task.deadline.replace("T", " ")
        : "No Deadline";

      listItem.innerHTML = `<input type="checkbox" class="done-checkbox" ${
        task.done ? "checked" : ""
      }/> <div class="task-id">${task.id}</div><div class="task-text">${
        task.taskText
      }</div> <div class="task-deadline">${formattedDeadline}</div>  <div class="task-category">${
        task.category
      }</div><div class="task-priority">${task.priority}</div>
      <button class="deleteBtn">X</button>`;

      if (oneDayLeft) {
        listItem.classList.add("one-day-left");
      }

      const doneCheckbox = listItem.querySelector(".done-checkbox");
      doneCheckbox.onchange = async (e) => {
        try {
          const isDone = e.target.checked;
          const response = await fetch(`/api/tasks/${task.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ done: isDone }),
          });
          if (!response.ok) throw new Error("Failed to update task");
          loadTasks();
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
          });
          if (!response.ok) throw new Error("Failed to delete task");
          listItem.remove();
          showNotification("Task deleted!");
          loadTasks();
        } catch (error) {
          alert("Could not delete task. Please try again.");
        }
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
    showNotification("Task added!");
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
  notification.classList.remove("show-notification");
  setTimeout(() => {
    notification.classList.add("show-notification");
  }, 3000);
}
