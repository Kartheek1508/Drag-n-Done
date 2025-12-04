from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import json
import os

app = FastAPI(title="Kanban Task Manager API")

# CORS configuration to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Data Models
class Subtask(BaseModel):
    text: str
    done: bool = False

class Task(BaseModel):
    id: Optional[str] = None
    title: str
    tags: List[str] = []
    priority: str = "low"
    due: Optional[str] = None
    status: str = "todo"
    subtasks: List[Subtask] = []

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    tags: Optional[List[str]] = None
    priority: Optional[str] = None
    due: Optional[str] = None
    status: Optional[str] = None
    subtasks: Optional[List[Subtask]] = None

# File-based storage (replace with database in production)
TASKS_FILE = "tasks.json"
TRASH_FILE = "trash.json"

def load_data(filename):
    """Load data from JSON file"""
    if os.path.exists(filename):
        with open(filename, 'r') as f:
            return json.load(f)
    return []

def save_data(filename, data):
    """Save data to JSON file"""
    with open(filename, 'w') as f:
        json.dump(data, f, indent=2)

def generate_id():
    """Generate a unique ID for tasks"""
    return str(int(datetime.now().timestamp() * 1000))

# API Endpoints

@app.get("/")
async def root():
    return {"message": "Kanban Task Manager API", "status": "running"}

# Task Endpoints
@app.get("/api/tasks", response_model=List[Task])
async def get_tasks():
    """Get all tasks"""
    tasks = load_data(TASKS_FILE)
    return tasks

@app.get("/api/tasks/{task_id}", response_model=Task)
async def get_task(task_id: str):
    """Get a specific task by ID"""
    tasks = load_data(TASKS_FILE)
    task = next((t for t in tasks if t["id"] == task_id), None)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

@app.post("/api/tasks", response_model=Task)
async def create_task(task: Task):
    """Create a new task"""
    tasks = load_data(TASKS_FILE)
    
    # Generate ID if not provided
    if not task.id:
        task.id = generate_id()
    
    task_dict = task.dict()
    tasks.append(task_dict)
    save_data(TASKS_FILE, tasks)
    
    return task_dict

@app.put("/api/tasks/{task_id}", response_model=Task)
async def update_task(task_id: str, task_update: TaskUpdate):
    """Update an existing task"""
    tasks = load_data(TASKS_FILE)
    
    task_index = next((i for i, t in enumerate(tasks) if t["id"] == task_id), None)
    if task_index is None:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Update only provided fields
    update_data = task_update.dict(exclude_unset=True)
    tasks[task_index].update(update_data)
    
    save_data(TASKS_FILE, tasks)
    return tasks[task_index]

@app.delete("/api/tasks/{task_id}")
async def delete_task(task_id: str):
    """Delete a task"""
    tasks = load_data(TASKS_FILE)
    
    task = next((t for t in tasks if t["id"] == task_id), None)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    tasks = [t for t in tasks if t["id"] != task_id]
    save_data(TASKS_FILE, tasks)
    
    return {"message": "Task deleted successfully", "id": task_id}

# Trash Endpoints
@app.get("/api/trash", response_model=List[Task])
async def get_trash():
    """Get all items in trash"""
    trash = load_data(TRASH_FILE)
    return trash

@app.post("/api/trash", response_model=Task)
async def add_to_trash(task: Task):
    """Add a task to trash"""
    trash = load_data(TRASH_FILE)
    
    task_dict = task.dict()
    trash.append(task_dict)
    save_data(TRASH_FILE, trash)
    
    return task_dict

@app.delete("/api/trash/{task_id}")
async def remove_from_trash(task_id: str):
    """Remove a task from trash (for restore)"""
    trash = load_data(TRASH_FILE)
    
    task = next((t for t in trash if t["id"] == task_id), None)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found in trash")
    
    trash = [t for t in trash if t["id"] != task_id]
    save_data(TRASH_FILE, trash)
    
    return {"message": "Task removed from trash", "id": task_id}

@app.delete("/api/trash")
async def empty_trash():
    """Empty the entire trash"""
    save_data(TRASH_FILE, [])
    return {"message": "Trash emptied successfully"}

# Health check
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "tasks_count": len(load_data(TASKS_FILE)),
        "trash_count": len(load_data(TRASH_FILE))
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3000)