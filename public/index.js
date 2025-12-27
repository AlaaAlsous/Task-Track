"use strict";

const taskList = document.getElementById("tasks");
const sortByIdCheckbox = document.getElementById("sortById");
const sortByPriorityCheckbox = document.getElementById("sortByPriority");

async function loadTasks() {
  const response = await fetch("/api/tasks");
  let tasks = await response.json();

  tasks = tasks.sort((a, b) => {
    if (a.done !== b.done) return a.done - b.done;
    if (sortByIdCheckbox.checked) {
      return a.id - b.id;
    } else if (sortByPriorityCheckbox.checked) {
      const priorityOrder = { High: 1, Medium: 2, Low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    } else {
      const dateA =
        a.deadline && a.deadline !== "No deadline"
          ? new Date(a.deadline).getTime()
          : Number.MAX_SAFE_INTEGER;
      const dateB =
        b.deadline && b.deadline !== "No deadline"
          ? new Date(b.deadline).getTime()
          : Number.MAX_SAFE_INTEGER;
      return dateA - dateB;
    }
  });

  taskList.innerHTML = "";
  for (const task of tasks) {
    const listItem = document.createElement("li");
    listItem.innerHTML = `<input type="checkbox" class="done-checkbox" ${
      task.done ? "checked" : ""
    }/> ${task.id}- (${task.taskText}) | (${
      task.deadline ?? "No deadline"
    }) | (${task.priority}) | 
      <button class="deleteBtn">Remove</button>`;
    const doneCheckbox = listItem.querySelector(".done-checkbox");
    doneCheckbox.onchange = async (e) => {
      const isDone = e.target.checked;
      await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: isDone }),
      });
      loadTasks();
    };

    const deleteBtn = listItem.querySelector(".deleteBtn");
    deleteBtn.onclick = async () => {
      await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      listItem.remove();
      loadTasks();
    };
    taskList.appendChild(listItem);
  }
}
loadTasks();

const taskTextInput = document.getElementById("new-task");
const priorityInput = document.getElementById("priority");
const deadlineInput = document.getElementById("due-date");
const addBtn = document.getElementById("add-task-btn");

async function addTask() {
  const taskText = taskTextInput.value.trim();
  const taskPriority = priorityInput.value;
  const taskDeadline = deadlineInput.value;
  if (!taskText) return;
  await fetch("/api/tasks", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      taskText: taskText,
      priority: taskPriority ? taskPriority : "Low",
      deadline: taskDeadline ? taskDeadline : null,
    }),
  });
  taskTextInput.value = "";
  priorityInput.value = "Low";
  deadlineInput.value = "";
  loadTasks();
}
addBtn.onclick = addTask;

sortByIdCheckbox.onchange = () => {
  if (sortByIdCheckbox.checked) {
    sortByPriorityCheckbox.checked = false;
  }
  loadTasks();
};

sortByPriorityCheckbox.onchange = () => {
  if (sortByPriorityCheckbox.checked) {
    sortByIdCheckbox.checked = false;
  }
  loadTasks();
};
