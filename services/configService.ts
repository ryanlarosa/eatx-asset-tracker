
// Fix: Simplified and grouped modular imports from firebase/firestore to resolve exported member errors
import { collection, doc, getDoc, getDocs, query, setDoc, where, writeBatch } from "firebase/firestore";
import { db, getColName, sanitizeData, handleFirestoreError, OperationType } from "./firebase";
import { AppConfig, EmailConfig } from "../types";
import emailjs from "@emailjs/browser";

const DEFAULT_CONFIG: AppConfig = {
  categories: ["POS Terminal", "Kitchen Display System", "Network & Wi-Fi", "Office IT (Laptops/Phones)", "Creative Media (Cameras/Audio)", "Camera & Security (CCTV)", "Printers & Scanners", "Furniture", "Other"],
  locations: ["Head Office", "Downtown Branch", "JBR Branch", "Marina Storage", "Creative Studio"],
  departments: ["IT", "Finance", "HR", "Operations", "FOH", "BOH", "Creative"],
};

let _cachedConfig: AppConfig | null = null;

export const getAppConfig = async (): Promise<AppConfig> => {
  const path = getColName("settings");
  try {
    const snap = await getDoc(doc(db, path, "appConfig"));
    if (snap.exists()) {
      const data = snap.data() as AppConfig;
      if (!data.departments) data.departments = DEFAULT_CONFIG.departments;
      _cachedConfig = data;
      return data;
    } else {
      await setDoc(doc(db, path, "appConfig"), DEFAULT_CONFIG);
      _cachedConfig = DEFAULT_CONFIG;
      return DEFAULT_CONFIG;
    }
  } catch (e) {
    handleFirestoreError(e, OperationType.GET, path);
    _cachedConfig = DEFAULT_CONFIG;
    return DEFAULT_CONFIG;
  }
};

export const getCachedConfigSync = (): AppConfig => _cachedConfig || DEFAULT_CONFIG;

export const saveAppConfig = async (config: AppConfig) => {
  _cachedConfig = config;
  const path = getColName("settings");
  try {
    await setDoc(doc(db, path, "appConfig"), config);
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, path);
  }
};

export const getEmailConfig = async (): Promise<EmailConfig | null> => {
  const path = "settings";
  try {
    const snap = await getDoc(doc(db, path, "emailConfig"));
    return snap.exists() ? (snap.data() as EmailConfig) : null;
  } catch (e) {
    handleFirestoreError(e, OperationType.GET, path);
    return null;
  }
};

export const saveEmailConfig = async (config: EmailConfig) => {
  const path = "settings";
  try {
    await setDoc(doc(db, path, "emailConfig"), config);
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, path);
  }
};

export const sendSystemEmail = async (subject: string, message: string, link: string = "", specificRecipient?: string, useConfirmationTemplate: boolean = false) => {
  try {
    const config = await getEmailConfig();
    if (!config || !config.enabled || !config.serviceId) return;
    const activeTemplate = (useConfirmationTemplate && config.confirmationTemplateId) ? config.confirmationTemplateId : config.templateId;
    const templateParams = { to_email: specificRecipient || config.targetEmail, title: subject, message, link, date: new Date().toLocaleString() };
    await emailjs.send(config.serviceId, activeTemplate, templateParams, config.publicKey);
  } catch (e) { console.warn("Email failed:", e); }
};

export const renameMasterDataItem = async (type: "category" | "location" | "department", oldVal: string, newVal: string) => {
  const path = getColName("assets");
  let assetsSnap;
  try {
    assetsSnap = await getDocs(query(collection(db, path), where(type, "==", oldVal)));
  } catch (e) {
    handleFirestoreError(e, OperationType.GET, path);
    return;
  }
  const batch = writeBatch(db);
  assetsSnap.docs.forEach((d) => batch.update(d.ref, { [type]: newVal, lastUpdated: new Date().toISOString() }));
  const config = await getAppConfig();
  if (type === "category") config.categories = config.categories.map((c) => c === oldVal ? newVal : c);
  if (type === "location") config.locations = config.locations.map((l) => l === oldVal ? newVal : l);
  if (type === "department") config.departments = (config.departments || []).map((d) => d === oldVal ? newVal : d);
  batch.set(doc(db, getColName("settings"), "appConfig"), config);
  try {
    await batch.commit();
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, "multiple_collections");
  }
};
