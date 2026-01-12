
// Fixed firestore modular imports to resolve naming and visibility issues in the build environment
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, setDoc } from "firebase/firestore";
import { db, getColName, snapToData, sanitizeData } from "./firebase";
import { Project, ProjectItem, Invoice, Task } from "../types";

export const listenToProjects = (cb: (projects: Project[]) => void) => {
  return onSnapshot(query(collection(db, getColName("projects")), orderBy("targetDate", "asc")), (snap) => {
    cb(snapToData<Project>(snap));
  });
};

export const saveProject = async (p: Project) => setDoc(doc(db, getColName("projects"), p.id), sanitizeData(p));
export const deleteProject = async (id: string) => deleteDoc(doc(db, getColName("projects"), id));

export const getOverdueItems = async (projects: Project[]): Promise<ProjectItem[]> => {
  const overdue: ProjectItem[] = [];
  const now = new Date();
  projects.forEach((p) => p.items.forEach((i) => {
    if (i.status !== "Received" && i.dueDate && new Date(i.dueDate) < now) overdue.push(i);
  }));
  return overdue;
};

export const listenToInvoices = (cb: (invoices: Invoice[]) => void) => {
  return onSnapshot(query(collection(db, getColName("invoices")), orderBy("date", "desc")), (snap) => {
    cb(snapToData<Invoice>(snap));
  });
};

export const saveInvoice = async (inv: Invoice) => setDoc(doc(db, getColName("invoices"), inv.id), sanitizeData(inv));
export const deleteInvoice = async (id: string) => deleteDoc(doc(db, getColName("invoices"), id));

export const listenToTasks = (cb: (tasks: Task[]) => void) => {
  return onSnapshot(query(collection(db, getColName("tasks")), orderBy("createdAt", "desc")), (snap) => {
    cb(snapToData<Task>(snap));
  });
};

export const saveTask = async (t: Task) => setDoc(doc(db, getColName("tasks"), t.id), sanitizeData(t));
export const deleteTask = async (id: string) => deleteDoc(doc(db, getColName("tasks"), id));