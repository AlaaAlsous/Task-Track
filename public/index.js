"use strict";

const taskList = document.getElementById("tasks");
const sortByIdCheckbox = document.getElementById("sortById");
const sortByDeadlineCheckbox = document.getElementById("sortByDeadline");

async function loadTasks() {
  const response = await fetch("/api/tasks");
  let tasks = await response.json();

  if (sortByIdCheckbox.checked) {
    tasks = tasks.sort((a, b) => a.id - b.id);
    tasks = tasks.sort((a, b) => a.done - b.done);
  } else if (sortByDeadlineCheckbox.checked) {
    tasks = tasks.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
    tasks = tasks.sort((a, b) => a.done - b.done);
  } else {
    tasks = tasks.sort((a, b) => {
      if (a.done !== b.done) return a.done - b.done;
      return new Date(a.deadline) - new Date(b.deadline);
    });
  }

  taskList.innerHTML = "";
  for (const task of tasks) {
    const listItem = document.createElement("li");
    listItem.innerHTML = `<input type="checkbox" class="done-checkbox" ${
      task.done ? "checked" : ""
    }/> ${task.id}- (${task.taskText}) | (${task.deadline}) | (${
      task.priority
    }) | 
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
      deadline: taskDeadline ? taskDeadline : "No deadline",
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
    sortByDeadlineCheckbox.checked = false;
  }
  loadTasks();
};

sortByDeadlineCheckbox.onchange = () => {
  if (sortByDeadlineCheckbox.checked) {
    sortByIdCheckbox.checked = false;
  }
  loadTasks();
};
