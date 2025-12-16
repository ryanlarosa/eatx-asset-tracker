import React, { useState, useEffect } from "react";
import { Task } from "../types";
import {
  listenToTasks,
  saveTask,
  deleteTask,
  getCurrentUserProfile,
} from "../services/storageService";
import {
  Plus,
  Trash2,
  Calendar,
  Edit2,
  Clock,
  CheckCircle,
  AlertCircle,
  X,
  ArrowRight,
  Loader2,
  ClipboardList,
  Save,
  CheckSquare,
} from "lucide-react";

const Tasks: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Create Form State
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<
    "Low" | "Medium" | "High"
  >("Medium");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [newTaskAssignee, setNewTaskAssignee] = useState("");
  const [newChecklist, setNewChecklist] = useState<
    { id: string; text: string; done: boolean }[]
  >([]);

  // Temp checklist input
  const [checkItemText, setCheckItemText] = useState("");

  const user = getCurrentUserProfile();
  const canEdit = user?.role === "admin" || user?.role === "technician";

  useEffect(() => {
    const unsub = listenToTasks((data) => {
      setTasks(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;

    const task: Task = {
      id: "task-" + Date.now(),
      title: newTaskTitle,
      description: newTaskDesc,
      status: "Pending",
      priority: newTaskPriority,
      dueDate: newTaskDueDate,
      assignedTo: newTaskAssignee,
      createdAt: new Date().toISOString(),
      createdBy: user?.email || "System",
      checklist: newChecklist,
    };

    await saveTask(task);
    setIsCreating(false);
    setNewTaskTitle("");
    setNewTaskDesc("");
    setNewTaskPriority("Medium");
    setNewTaskDueDate("");
    setNewTaskAssignee("");
    setNewChecklist([]);
  };

  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !editingTask) return;
    await saveTask(editingTask);
    setEditingTask(null);
  };

  const updateStatus = async (task: Task, status: Task["status"]) => {
    await saveTask({ ...task, status });
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete this task?")) {
      await deleteTask(id);
    }
  };

  // --- Checklist Helpers ---
  const addCheckItem = (isEditMode: boolean) => {
    if (!checkItemText.trim()) return;
    const item = {
      id: Date.now().toString(),
      text: checkItemText,
      done: false,
    };

    if (isEditMode && editingTask) {
      setEditingTask({
        ...editingTask,
        checklist: [...(editingTask.checklist || []), item],
      });
    } else {
      setNewChecklist([...newChecklist, item]);
    }
    setCheckItemText("");
  };

  const toggleCheckItem = (itemId: string, isEditMode: boolean) => {
    if (isEditMode && editingTask) {
      const updated = (editingTask.checklist || []).map((i) =>
        i.id === itemId ? { ...i, done: !i.done } : i
      );
      setEditingTask({ ...editingTask, checklist: updated });
    } else {
      setNewChecklist(
        newChecklist.map((i) => (i.id === itemId ? { ...i, done: !i.done } : i))
      );
    }
  };

  const removeCheckItem = (itemId: string, isEditMode: boolean) => {
    if (isEditMode && editingTask) {
      const updated = (editingTask.checklist || []).filter(
        (i) => i.id !== itemId
      );
      setEditingTask({ ...editingTask, checklist: updated });
    } else {
      setNewChecklist(newChecklist.filter((i) => i.id !== itemId));
    }
  };

  const getPriorityColor = (p: string) => {
    switch (p) {
      case "High":
        return "text-red-600 bg-red-50 border-red-100 dark:bg-red-900/40 dark:text-red-300 dark:border-red-900/50";
      case "Medium":
        return "text-amber-600 bg-amber-50 border-amber-100 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-900/50";
      default:
        return "text-slate-600 bg-slate-50 border-slate-100 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700";
    }
  };

  const TaskColumn = ({
    title,
    status,
    items,
    colorClass,
  }: {
    title: string;
    status: string;
    items: Task[];
    colorClass: string;
  }) => (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800">
      <div
        className={`p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center ${colorClass} bg-opacity-10 rounded-t-xl`}
      >
        <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
          {title}{" "}
          <span className="text-xs bg-white dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-100 dark:border-slate-700 shadow-sm">
            {items.length}
          </span>
        </h3>
      </div>
      <div className="p-3 space-y-3 overflow-y-auto flex-1 custom-scrollbar min-h-[200px]">
        {items.length === 0 && (
          <div className="text-center text-slate-400 text-sm py-8 italic">
            No tasks
          </div>
        )}
        {items.map((t) => {
          const checklist = t.checklist || [];
          const doneCount = checklist.filter((c) => c.done).length;
          const totalCount = checklist.length;
          const progress =
            totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

          return (
            <div
              key={t.id}
              className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow group"
            >
              <div className="flex justify-between items-start mb-2">
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded border uppercase font-bold ${getPriorityColor(
                    t.priority
                  )}`}
                >
                  {t.priority}
                </span>
                {canEdit && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setEditingTask(t)}
                      className="text-slate-300 hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="text-slate-300 hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
              <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm mb-1">
                {t.title}
              </h4>
              {t.description && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 line-clamp-2">
                  {t.description}
                </p>
              )}

              {/* Checklist Progress */}
              {totalCount > 0 && (
                <div className="mb-3">
                  <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 mb-1">
                    <span className="flex items-center gap-1">
                      <CheckSquare size={10} /> Checklist
                    </span>
                    <span>
                      {progress}% ({doneCount}/{totalCount})
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 text-[10px] text-slate-400 mb-3">
                {t.dueDate && (
                  <span
                    className={`flex items-center gap-1 ${
                      new Date(t.dueDate) < new Date() &&
                      t.status !== "Completed"
                        ? "text-red-500 font-bold"
                        : ""
                    }`}
                  >
                    <Calendar size={12} /> {t.dueDate}
                  </span>
                )}
                {t.assignedTo && (
                  <span className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300">
                    {t.assignedTo}
                  </span>
                )}
              </div>

              {canEdit && (
                <div className="flex gap-2 pt-2 border-t border-slate-50 dark:border-slate-800">
                  {status === "Pending" && (
                    <button
                      onClick={() => updateStatus(t, "In Progress")}
                      className="flex-1 py-1.5 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-900/50"
                    >
                      Start
                    </button>
                  )}
                  {status === "In Progress" && (
                    <>
                      <button
                        onClick={() => updateStatus(t, "Pending")}
                        className="flex-1 py-1.5 bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400 rounded text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        Back
                      </button>
                      <button
                        onClick={() => updateStatus(t, "Completed")}
                        className="flex-1 py-1.5 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 rounded text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                      >
                        Done
                      </button>
                    </>
                  )}
                  {status === "Completed" && (
                    <button
                      onClick={() => updateStatus(t, "In Progress")}
                      className="flex-1 py-1.5 bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400 rounded text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      Reopen
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const inputClass =
    "w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white";
  const labelClass =
    "block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1";

  const ChecklistEditor = ({
    items,
    isEditing,
  }: {
    items: { id: string; text: string; done: boolean }[];
    isEditing: boolean;
  }) => (
    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700 mt-2">
      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase block mb-2">
        Checklist
      </label>
      <div className="space-y-2 mb-3">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-2 group">
            <input
              type="checkbox"
              checked={item.done}
              onChange={() => toggleCheckItem(item.id, isEditing)}
              className="rounded border-slate-300 dark:border-slate-600"
            />
            <span
              className={`flex-1 text-sm ${
                item.done
                  ? "line-through text-slate-400"
                  : "text-slate-700 dark:text-slate-200"
              }`}
            >
              {item.text}
            </span>
            <button
              type="button"
              onClick={() => removeCheckItem(item.id, isEditing)}
              className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X size={14} />
            </button>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-xs text-slate-400 italic">No checklist items.</p>
        )}
      </div>
      <div className="flex gap-2">
        <input
          className="flex-1 p-1.5 text-sm border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900 dark:text-white"
          placeholder="Add item..."
          value={checkItemText}
          onChange={(e) => setCheckItemText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCheckItem(isEditing);
            }
          }}
        />
        <button
          type="button"
          onClick={() => addCheckItem(isEditing)}
          className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-white rounded text-xs font-bold"
        >
          Add
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 h-[calc(100vh-140px)] flex flex-col">
      <header className="flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <ClipboardList className="text-slate-900 dark:text-white" /> Task
            Board
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Manage daily IT operations and to-dos.
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setIsCreating(true)}
            className="bg-slate-900 dark:bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-black dark:hover:bg-blue-700 flex items-center gap-2 font-medium shadow-sm transition-all"
          >
            <Plus size={20} /> Add Task
          </button>
        )}
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 overflow-hidden min-h-0">
          <TaskColumn
            title="To Do"
            status="Pending"
            items={tasks.filter((t) => t.status === "Pending")}
            colorClass="bg-slate-100 dark:bg-slate-800"
          />
          <TaskColumn
            title="In Progress"
            status="In Progress"
            items={tasks.filter((t) => t.status === "In Progress")}
            colorClass="bg-blue-100 dark:bg-blue-900"
          />
          <TaskColumn
            title="Done"
            status="Completed"
            items={tasks.filter((t) => t.status === "Completed")}
            colorClass="bg-emerald-100 dark:bg-emerald-900"
          />
        </div>
      )}

      {/* CREATE MODAL */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                New Task
              </h3>
              <button onClick={() => setIsCreating(false)}>
                <X
                  size={20}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                />
              </button>
            </div>
            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className={labelClass}>Task Title</label>
                <input
                  required
                  className={inputClass}
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="e.g. Check Server Backup"
                />
              </div>
              <div>
                <label className={labelClass}>Description</label>
                <textarea
                  className={inputClass}
                  rows={3}
                  value={newTaskDesc}
                  onChange={(e) => setNewTaskDesc(e.target.value)}
                  placeholder="Details..."
                />
              </div>

              <ChecklistEditor items={newChecklist} isEditing={false} />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Priority</label>
                  <select
                    className={inputClass}
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value as any)}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Due Date</label>
                  <input
                    type="date"
                    className={inputClass}
                    value={newTaskDueDate}
                    onChange={(e) => setNewTaskDueDate(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Assignee (Optional)</label>
                <input
                  className={inputClass}
                  value={newTaskAssignee}
                  onChange={(e) => setNewTaskAssignee(e.target.value)}
                  placeholder="Name"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-slate-900 dark:bg-blue-600 text-white py-2.5 rounded-lg font-bold hover:bg-black dark:hover:bg-blue-700 mt-2"
              >
                Create Task
              </button>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Edit Task
              </h3>
              <button onClick={() => setEditingTask(null)}>
                <X
                  size={20}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                />
              </button>
            </div>
            <form onSubmit={handleUpdateTask} className="space-y-4">
              <div>
                <label className={labelClass}>Task Title</label>
                <input
                  required
                  className={inputClass}
                  value={editingTask.title}
                  onChange={(e) =>
                    setEditingTask({ ...editingTask, title: e.target.value })
                  }
                />
              </div>
              <div>
                <label className={labelClass}>Description</label>
                <textarea
                  className={inputClass}
                  rows={3}
                  value={editingTask.description}
                  onChange={(e) =>
                    setEditingTask({
                      ...editingTask,
                      description: e.target.value,
                    })
                  }
                />
              </div>

              <ChecklistEditor
                items={editingTask.checklist || []}
                isEditing={true}
              />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Priority</label>
                  <select
                    className={inputClass}
                    value={editingTask.priority}
                    onChange={(e) =>
                      setEditingTask({
                        ...editingTask,
                        priority: e.target.value as any,
                      })
                    }
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Due Date</label>
                  <input
                    type="date"
                    className={inputClass}
                    value={editingTask.dueDate}
                    onChange={(e) =>
                      setEditingTask({
                        ...editingTask,
                        dueDate: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Assignee (Optional)</label>
                <input
                  className={inputClass}
                  value={editingTask.assignedTo || ""}
                  onChange={(e) =>
                    setEditingTask({
                      ...editingTask,
                      assignedTo: e.target.value,
                    })
                  }
                />
              </div>
              <button
                type="submit"
                className="w-full bg-slate-900 dark:bg-blue-600 text-white py-2.5 rounded-lg font-bold hover:bg-black dark:hover:bg-blue-700 mt-2 flex items-center justify-center gap-2"
              >
                <Save size={18} /> Save Changes
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tasks;
