"use strict";

const taskList = document.getElementById("tasks");
async function loadTasks() {
  const response = await fetch("/api/tasks");
  let tasks = await response.json();
  tasks = tasks.sort((a, b) => a.done - b.done);
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
      location.reload();
    };
    taskList.appendChild(listItem);
  }
}
loadTasks();