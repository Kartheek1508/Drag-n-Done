const API_BASE_URL = 'http://localhost:3000/api';

        let tasks = [];
        let trash = [];
        let editingId = null;
        let subtasks = [];
        let draggedTask = null;

        // DOM Elements
        const addTaskBtn = document.getElementById("addTaskBtn");
        const modal = document.getElementById("taskModal");
        const trashModal = document.getElementById("trashModal");
        const cancelBtn = document.getElementById("cancelBtn");
        const saveBtn = document.getElementById("saveBtn");
        const searchBox = document.getElementById("searchBox");
        const priorityFilter = document.getElementById("priorityFilter");
        const titleInput = document.getElementById("taskTitle");
        const tagsInput = document.getElementById("taskTags");
        const priorityInput = document.getElementById("taskPriority");
        const dueInput = document.getElementById("taskDue");
        const subtaskList = document.getElementById("subtaskList");
        const newSubtaskInput = document.getElementById("newSubtaskInput");
        const addSubtaskBtn = document.getElementById("addSubtaskBtn");
        const toast = document.getElementById("toast");
        const modeBtn = document.getElementById("modeToggle");
        const trashBtn = document.getElementById("trashBtn");
        const closeTrash = document.getElementById("closeTrash");
        const errorContainer = document.getElementById("errorContainer");

        // API Functions
        async function apiRequest(endpoint, method = 'GET', data = null) {
            try {
                const options = {
                    method,
                    headers: {
                        'Content-Type': 'application/json',
                    }
                };

                if (data) {
                    options.body = JSON.stringify(data);
                }

                const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
                
                if (!response.ok) {
                    throw new Error(`API Error: ${response.statusText}`);
                }

                return await response.json();
            } catch (error) {
                showError(`Failed to ${method} data: ${error.message}`);
                throw error;
            }
        }

        async function loadTasks() {
            try {
                tasks = await apiRequest('/tasks');
                render();
            } catch (error) {
                console.error('Failed to load tasks:', error);
            }
        }

        async function loadTrash() {
            try {
                trash = await apiRequest('/trash');
            } catch (error) {
                console.error('Failed to load trash:', error);
            }
        }

        async function createTask(task) {
            const newTask = await apiRequest('/tasks', 'POST', task);
            tasks.push(newTask);
            render();
            return newTask;
        }

        async function updateTask(id, updates) {
            const updatedTask = await apiRequest(`/tasks/${id}`, 'PUT', updates);
            tasks = tasks.map(t => t.id === id ? updatedTask : t);
            render();
            return updatedTask;
        }

        async function deleteTask(id) {
            const task = tasks.find(t => t.id === id);
            await apiRequest(`/tasks/${id}`, 'DELETE');
            await apiRequest('/trash', 'POST', task);
            tasks = tasks.filter(t => t.id !== id);
            trash.push(task);
            render();
        }

        async function restoreTask(id) {
            const task = trash.find(t => t.id === id);
            await apiRequest(`/trash/${id}`, 'DELETE');
            const restored = await apiRequest('/tasks', 'POST', task);
            trash = trash.filter(t => t.id !== id);
            tasks.push(restored);
            render();
        }

        // UI Functions
        function showError(message) {
            errorContainer.innerHTML = `<div class="error">${message}</div>`;
            setTimeout(() => {
                errorContainer.innerHTML = '';
            }, 5000);
        }

        function showToast(msg) {
            toast.innerText = msg;
            toast.classList.add('show');
            setTimeout(() => {
                toast.classList.remove('show');
            }, 2000);
        }

        function openModal() {
            editingId = null;
            subtasks = [];
            subtaskList.innerHTML = "";
            titleInput.value = "";
            tagsInput.value = "";
            priorityInput.value = "low";
            dueInput.value = "";
            modal.classList.add('show');
        }

        function closeModal() {
            modal.classList.remove('show');
        }

        addTaskBtn.onclick = openModal;
        cancelBtn.onclick = closeModal;

        addSubtaskBtn.onclick = () => {
            let text = newSubtaskInput.value.trim();
            if (text) {
                subtasks.push({ text, done: false });
                newSubtaskInput.value = "";
                renderSubtasks();
            }
        };

        function renderSubtasks() {
            subtaskList.innerHTML = "";
            subtasks.forEach((st, i) => {
                let d = document.createElement("div");
                d.className = "subtask";
                d.innerHTML = `
                    <input type="checkbox" ${st.done ? "checked" : ""} data-i="${i}">
                    <span>${st.text}</span>
                    <button data-del="${i}" class="subdel">✖</button>
                `;
                subtaskList.appendChild(d);
            });

            document.querySelectorAll(".subtask input").forEach(inp => {
                inp.onchange = () => {
                    subtasks[inp.dataset.i].done = inp.checked;
                };
            });

            document.querySelectorAll(".subdel").forEach(btn => {
                btn.onclick = () => {
                    subtasks.splice(btn.dataset.del, 1);
                    renderSubtasks();
                };
            });
        }

        saveBtn.onclick = async () => {
            const taskData = {
                title: titleInput.value.trim(),
                tags: tagsInput.value.split(",").map(x => x.trim()).filter(x => x),
                priority: priorityInput.value,
                due: dueInput.value,
                status: "todo",
                subtasks: [...subtasks]
            };

            if (!taskData.title) {
                showError("Task title is required!");
                return;
            }

            try {
                if (editingId) {
                    await updateTask(editingId, taskData);
                    showToast("Task updated");
                } else {
                    await createTask(taskData);
                    showToast("Task created");
                }
                closeModal();
            } catch (error) {
                console.error('Failed to save task:', error);
            }
        };

        function render() {
            const cols = {
                todo: document.getElementById("todoCol"),
                "in-progress": document.getElementById("progressCol"),
                done: document.getElementById("doneCol")
            };

            Object.values(cols).forEach(c => c.innerHTML = "");

            let search = searchBox.value.toLowerCase();
            let pf = priorityFilter.value;

            tasks.forEach(task => {
                if (!task.title.toLowerCase().includes(search) &&
                    !task.tags.join(" ").toLowerCase().includes(search)) return;

                if (pf !== "all" && task.priority !== pf) return;

                let div = document.createElement("div");
                div.className = `task priority-${task.priority}`;
                div.draggable = true;
                div.dataset.id = task.id;

                let tagLabels = task.tags.map(t => `<span class="label">${t}</span>`).join("");
                let stCount = task.subtasks ? 
                    `${task.subtasks.filter(s => s.done).length}/${task.subtasks.length}` : 
                    "0/0";

                div.innerHTML = `
                    <strong>${task.title}</strong><br>
                    ${tagLabels}<br>
                    <small>Due: ${task.due || "No date"}</small><br>
                    <small>Subtasks: ${stCount}</small>
                    <div class="delete-btn">Delete</div>
                `;

                div.querySelector(".delete-btn").onclick = async () => {
                    await deleteTask(task.id);
                    showToast("Moved to trash");
                };

                div.addEventListener("dragstart", function(e) {
                    draggedTask = this;
                    this.classList.add("dragging");
                    e.dataTransfer.effectAllowed = "move";
                });

                div.addEventListener("dragend", function() {
                    this.classList.remove("dragging");
                });

                cols[task.status].appendChild(div);
            });
        }

        // Setup Drag and Drop
        function setupDragAndDrop() {
            const containers = document.querySelectorAll('.task-container');
            
            containers.forEach(container => {
                container.addEventListener('dragover', function(e) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    this.classList.add('drag-over');
                });

                container.addEventListener('dragleave', function() {
                    this.classList.remove('drag-over');
                });

                container.addEventListener('drop', async function(e) {
                    e.preventDefault();
                    this.classList.remove('drag-over');
                    
                    if (draggedTask) {
                        const taskId = draggedTask.dataset.id;
                        const newStatus = this.parentElement.dataset.status;
                        
                        try {
                            await updateTask(taskId, { status: newStatus });
                            showToast(`Task moved to ${newStatus.replace('-', ' ')}`);
                        } catch (error) {
                            console.error('Failed to update task status:', error);
                        }
                    }
                });
            });
        }

        searchBox.oninput = render;
        priorityFilter.onchange = render;

        modeBtn.onclick = () => {
            document.body.classList.toggle("dark");
            let isDark = document.body.classList.contains("dark");
            modeBtn.textContent = isDark ? "☀️" : "🌙";
            localStorage.setItem("mode", isDark ? "dark" : "light");
        };

        if (localStorage.getItem("mode") === "dark") {
            document.body.classList.add("dark");
            modeBtn.textContent = "☀️";
        }

        trashBtn.onclick = async () => {
            await loadTrash();
            renderTrash();
            trashModal.classList.add('show');
        };

        closeTrash.onclick = () => {
            trashModal.classList.remove('show');
        };

        function renderTrash() {
            const box = document.getElementById("trashList");
            box.innerHTML = "";
            
            if (trash.length === 0) {
                box.innerHTML = '<p class="loading">Trash is empty</p>';
                return;
            }

            trash.forEach(task => {
                let d = document.createElement("div");
                d.className = "task";
                d.innerHTML = `
                    <strong>${task.title}</strong>
                    <button class="restore" style="background: #2ecc71; color: white; padding: 5px 15px; border: none; border-radius: 3px; cursor: pointer; margin-top: 10px;">Restore</button>
                `;
                d.querySelector(".restore").onclick = async () => {
                    await restoreTask(task.id);
                    showToast("Task restored");
                    renderTrash();
                };
                box.appendChild(d);
            });
        }

        // Initialize
        setupDragAndDrop();
        loadTasks();