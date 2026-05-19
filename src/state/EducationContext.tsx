import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import { educationCategories, educationCourseMap, type EducationCategory, type EducationCourse } from "../data/educationData";
import { cancelServerEducationCourse, completeServerEducationCourse, getServerEducation, startServerEducationCourse, type ServerEducationPayload } from "../lib/authApi";
import { mergeServerStateIntoCache } from "../lib/runtimeStateCache";
import { useAuth } from "./AuthContext";

type PassiveBonuses = Partial<Record<string, number>>;
type ActiveCourse = { courseId: string; categoryId: string; startedAt: number; durationMs: number; completesAt: number };
type EducationState = { completedCourses: string[]; activeCourse: ActiveCourse | null; passiveBonuses: PassiveBonuses; activeUnlocks: string[]; systemUnlocks: string[]; history?: Array<Record<string, unknown>>; discoveries?: Array<Record<string, unknown>>; serverCategories?: ServerEducationPayload["categories"] | null };
type ActionResult = { ok: boolean; message: string };
type EducationContextValue = {
  completedCourseIds: string[];
  completedCourses: string[];
  activeCourse: ActiveCourse | null;
  passiveBonuses: PassiveBonuses;
  activeUnlocks: string[];
  systemUnlocks: string[];
  history: Array<Record<string, unknown>>;
  discoveries: Array<Record<string, unknown>>;
  startCourse: (categoryId: string, courseId: string) => ActionResult;
  cancelCourse: () => void;
  leaveCourse: () => void;
  completeCourse: (courseId?: string | null) => void;
  refreshEducation: () => Promise<void>;
  isCourseCompleted: (courseId: string) => boolean;
  isCourseLocked: (course: EducationCourse) => boolean;
  getRemainingMs: () => number;
};
const STORAGE_KEY = "nexis.education";
const defaultState: EducationState = { completedCourses: [], activeCourse: null, passiveBonuses: {}, activeUnlocks: [], systemUnlocks: [], history: [], discoveries: [], serverCategories: null };
function readStoredState(): EducationState { if (typeof window === "undefined") return defaultState; try { const raw = window.localStorage.getItem(STORAGE_KEY); if (!raw) return defaultState; const parsed = JSON.parse(raw) as Partial<EducationState> & { completedCourseIds?: string[] }; return { ...defaultState, ...parsed, completedCourses: parsed.completedCourses ?? parsed.completedCourseIds ?? [] }; } catch { return defaultState; } }
function writeStoredState(state: EducationState) { if (typeof window === "undefined") return; window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function courseHasCompletedAllPrerequisites(course: EducationCourse, completed: string[]) { return (course.prerequisites ?? []).every((req) => completed.includes(req)); }
function stateFromPayload(payload: ServerEducationPayload): EducationState { return { completedCourses: payload.completedCourses ?? [], activeCourse: payload.activeCourse ?? null, passiveBonuses: payload.passiveBonuses ?? {}, activeUnlocks: payload.activeUnlocks ?? [], systemUnlocks: payload.systemUnlocks ?? [], history: payload.history ?? [], discoveries: payload.discoveries ?? [], serverCategories: payload.categories ?? null }; }
const EducationContext = createContext<EducationContextValue | null>(null);
export function EducationProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<EducationState>(readStoredState);
  const { activeAccount, authSource, serverHydrationVersion, serverSessionToken, refreshServerState } = useAuth();
  const completingRef = useRef(false);
  const hydrateFromServer = useCallback(async () => {
    if (authSource !== "server" || !serverSessionToken) { setState(readStoredState()); return; }
    const result = await getServerEducation(serverSessionToken);
    if (!result.ok) return;
    if (activeAccount && result.playerState) mergeServerStateIntoCache({ email: activeAccount.email, user: activeAccount, playerState: result.playerState });
    const next = stateFromPayload(result.education);
    setState(next); writeStoredState(next); window.dispatchEvent(new Event("nexis:player-refresh"));
  }, [activeAccount, authSource, serverSessionToken]);
  useEffect(() => { void hydrateFromServer(); }, [hydrateFromServer, serverHydrationVersion]);
  useEffect(() => { writeStoredState(state); }, [state]);
  const isCourseCompleted = useCallback((courseId: string) => state.completedCourses.includes(courseId), [state.completedCourses]);
  const isCourseLocked = useCallback((course: EducationCourse) => !courseHasCompletedAllPrerequisites(course, state.completedCourses), [state.completedCourses]);
  const getRemainingMs = useCallback(() => state.activeCourse ? Math.max(0, state.activeCourse.completesAt - Date.now()) : 0, [state.activeCourse]);
  const completeCourse = useCallback((courseId?: string | null) => { void (async () => { if (!serverSessionToken || completingRef.current) return; completingRef.current = true; const result = await completeServerEducationCourse(serverSessionToken, courseId ?? null); completingRef.current = false; if (!result.ok) return; if (activeAccount && result.playerState) mergeServerStateIntoCache({ email: activeAccount.email, user: activeAccount, playerState: result.playerState }); const next = stateFromPayload(result.education); setState(next); writeStoredState(next); window.dispatchEvent(new Event("nexis:player-refresh")); await refreshServerState(); })(); }, [activeAccount, refreshServerState, serverSessionToken]);
  useEffect(() => { const id = window.setInterval(() => { if (state.activeCourse && Date.now() >= state.activeCourse.completesAt) completeCourse(state.activeCourse.courseId); }, 1000); return () => window.clearInterval(id); }, [completeCourse, state.activeCourse]);
  const startCourse = useCallback((categoryId: string, courseId: string): ActionResult => {
    const course = educationCourseMap[courseId];
    if (!course) return { ok: false, message: "Course not found." };
    if (state.activeCourse) return { ok: false, message: "You are already studying a course." };
    if (state.completedCourses.includes(courseId)) return { ok: false, message: "You have already completed this course." };
    if (isCourseLocked(course)) return { ok: false, message: "Prerequisites are not complete." };
    if (authSource === "server" && serverSessionToken) {
      void (async () => { const result = await startServerEducationCourse(serverSessionToken, courseId); if (!result.ok) return; if (activeAccount && result.playerState) mergeServerStateIntoCache({ email: activeAccount.email, user: activeAccount, playerState: result.playerState }); const next = stateFromPayload(result.education); setState(next); writeStoredState(next); window.dispatchEvent(new Event("nexis:player-refresh")); await refreshServerState(); })();
      return { ok: true, message: `${course.name} is starting.` };
    }
    const startedAt = Date.now(); const durationMs = Math.round(course.durationDays * 24 * 60 * 60 * 1000); setState((current) => ({ ...current, activeCourse: { courseId, categoryId, startedAt, durationMs, completesAt: startedAt + durationMs } })); return { ok: true, message: `${course.name} has started.` };
  }, [activeAccount, authSource, isCourseLocked, refreshServerState, serverSessionToken, state.activeCourse, state.completedCourses]);
  const cancelCourse = useCallback(() => { if (authSource === "server" && serverSessionToken) { void (async () => { const result = await cancelServerEducationCourse(serverSessionToken); if (!result.ok) return; if (activeAccount && result.playerState) mergeServerStateIntoCache({ email: activeAccount.email, user: activeAccount, playerState: result.playerState }); const next = stateFromPayload(result.education); setState(next); writeStoredState(next); window.dispatchEvent(new Event("nexis:player-refresh")); await refreshServerState(); })(); return; } setState((current) => ({ ...current, activeCourse: null })); }, [activeAccount, authSource, refreshServerState, serverSessionToken]);
  const value = useMemo<EducationContextValue>(() => ({ completedCourseIds: state.completedCourses, completedCourses: state.completedCourses, activeCourse: state.activeCourse, passiveBonuses: state.passiveBonuses, activeUnlocks: state.activeUnlocks, systemUnlocks: state.systemUnlocks, history: state.history ?? [], discoveries: state.discoveries ?? [], startCourse, cancelCourse, leaveCourse: cancelCourse, completeCourse, refreshEducation: hydrateFromServer, isCourseCompleted, isCourseLocked, getRemainingMs }), [cancelCourse, completeCourse, getRemainingMs, hydrateFromServer, isCourseCompleted, isCourseLocked, startCourse, state]);
  return <EducationContext.Provider value={value}>{children}</EducationContext.Provider>;
}
export function useEducation() { const context = useContext(EducationContext); if (!context) throw new Error("useEducation must be used within an EducationProvider"); return context; }
export function formatRemaining(ms: number): string { if (ms <= 0) return "completed"; const totalSeconds = Math.floor(ms / 1000); const days = Math.floor(totalSeconds / 86400); const hours = Math.floor((totalSeconds % 86400) / 3600); const minutes = Math.floor((totalSeconds % 3600) / 60); const parts: string[] = []; if (days > 0) parts.push(`${days}d`); if (hours > 0) parts.push(`${hours}hrs`); if (minutes > 0) parts.push(`${minutes}min`); if (!parts.length) parts.push("under 1min"); return parts.join(" "); }
export function formatCountdown(ms: number): string { if (ms <= 0) return "done"; const totalSeconds = Math.floor(ms / 1000); const d = Math.floor(totalSeconds / 86400); const h = Math.floor((totalSeconds % 86400) / 3600); const m = Math.floor((totalSeconds % 3600) / 60); if (d > 0) return `${d}d ${h}hrs`; if (h > 0) return `${h}hrs ${m}min`; return `${m}min`; }
export function getCategoryProgress(categoryId: string, completedCourseIds: string[]) { const category = educationCategories.find((item) => item.id === categoryId); if (!category) return { completed: 0, total: 0 }; const completed = category.courses.filter((course) => completedCourseIds.includes(course.id)).length; return { completed, total: category.courses.length }; }
export function firstCourseIdForCategory(category: EducationCategory) { return category.courses[0]?.id ?? ""; }
