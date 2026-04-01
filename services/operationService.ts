
// Fix: Cleaned up modular imports from firebase/firestore to resolve module resolution issues
import { 
  collection, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  orderBy, 
  query, 
  setDoc 
} from "firebase/firestore";
import { db, getColName, snapToData, sanitizeData, handleFirestoreError, OperationType } from "./firebase";
import { Project, ProjectItem, Invoice, Task } from "../types";

export const listenToProjects = (cb: (projects: Project[]) => void) => {
  const path = getColName("projects");
  return onSnapshot(query(collection(db, path), orderBy("targetDate", "asc")), (snap) => {
    cb(snapToData<Project>(snap));
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, path);
  });
};

export const saveProject = async (p: Project) => {
  const path = getColName("projects");
  try {
    await setDoc(doc(db, path, p.id), sanitizeData(p));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const deleteProject = async (id: string) => {
  const path = getColName("projects");
  try {
    await deleteDoc(doc(db, path, id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

export const getOverdueItems = async (projects: Project[]): Promise<ProjectItem[]> => {
  const overdue: ProjectItem[] = [];
  const now = new Date();
  projects.forEach((p) => p.items.forEach((i) => {
    if (i.status !== "Received" && i.dueDate && new Date(i.dueDate) < now) overdue.push(i);
  }));
  return overdue;
};

export const listenToInvoices = (cb: (invoices: Invoice[]) => void) => {
  const path = getColName("invoices");
  return onSnapshot(query(collection(db, path), orderBy("date", "desc")), (snap) => {
    cb(snapToData<Invoice>(snap));
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, path);
  });
};

export const saveInvoice = async (inv: Invoice) => {
  const path = getColName("invoices");
  try {
    await setDoc(doc(db, path, inv.id), sanitizeData(inv));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const deleteInvoice = async (id: string) => {
  const path = getColName("invoices");
  try {
    await deleteDoc(doc(db, path, id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

export const listenToTasks = (cb: (tasks: Task[]) => void) => {
  const path = getColName("tasks");
  return onSnapshot(query(collection(db, path), orderBy("createdAt", "desc")), (snap) => {
    cb(snapToData<Task>(snap));
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, path);
  });
};

export const saveTask = async (t: Task) => {
  const path = getColName("tasks");
  try {
    await setDoc(doc(db, path, t.id), sanitizeData(t));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const deleteTask = async (id: string) => {
  const path = getColName("tasks");
  try {
    await deleteDoc(doc(db, path, id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};
