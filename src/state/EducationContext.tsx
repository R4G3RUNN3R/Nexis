import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import {
  educationCategories,
  educationCourseMap,
  type EducationCategory,
  type EducationCourse,
} from "../data/educationData";
import { useAuth } from "./AuthContext";
import { usePlayer } from "./PlayerContext";

// ─── Types ────────────────────────────────────────────────────────────────────

type PassiveBonuses = Partial<Record<string, number>>;

/**
 * Represents the currently-active (in-progress) course.
 * Matches the task spec: courseId, categoryId, startedAt, durationMs.
 */
type ActiveCourse = {
  courseId: string;
  categoryId: string;
  startedAt: number;
  durationMs: number;
  /** Pre-computed completion timestamp for fast comparisons */
  completesAt: number;
};

type EducationState = {
  /** IDs of all fully completed courses */
  completedCourses: string[];
  /** Currently active (studying) course, or null */
  activeCourse: ActiveCourse | null;
  passiveBonuses: PassiveBonuses;
  activeUnlocks: string[];
  systemUnlocks: string[];
};

// ─── Context Value ────────────────────────────────────────────────────────────

type EducationContextValue = {
  /** @deprecated prefer completedCourses — kept for back-compat */
  completedCourseIds: string[];
  completedCourses: string[];
  activeCourse: ActiveCourse | null;
  passiveBonuses: PassiveBonuses;
  activeUnlocks: string[];
  systemUnlocks: string[];
  /**
   * Start studying a course.
   * @param categoryId — category the course belongs to
   * @param courseId   — course to start
   */
  startCourse: (categoryId: string, courseId: string) => { ok: boolean; message: string };
  /** Cancel the active course (no refund, just stops). */
  cancelCourse: () => void;
  /** @deprecated use cancelCourse — kept for Education.tsx back-compat */
  leaveCourse: () => void;
  isCourseCompleted: (courseId: string) => boolean;
  isCourseLocked: (course: EducationCourse) => boolean;
  /** Returns remaining ms until the active course finishes, or 0. */
  getRemainingMs: () => number;
};

// ─── Storage ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = "nexis.education";

const defaultState: EducationState = {
  completedCourses: [],
  activeCourse: null,
  passiveBonuses: {},
  activeUnlocks: [],
  systemUnlocks: [],
};

function readStoredState(): EducationState {
  if (typeof window === "undefined") return defaultState;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw) as Partial<EducationState> & {
      // handle legacy key name
      completedCourseIds?: string[];
    };

    // Normalise: legacy key was `completedCourseIds`
    const completedCourses =
      parsed.completedCourses ??
      parsed.completedCourseIds ??
      defaultState.completedCourses;

    return {
      ...defaultState,
      ...parsed,
      completedCourses,
    };
  } catch {
    return defaultState;
  }
}

function writeStoredState(state: EducationState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function courseHasCompletedAllPrerequisites(
  course: EducationCourse,
  completed: string[],
) {
  return (course.prerequisites ?? []).every((req) => completed.includes(req));
}

function finalizeRewards(
  course: EducationCourse,
  current: EducationState,
): Pick<EducationState, "passiveBonuses" | "activeUnlocks" | "systemUnlocks"> {
  const passiveBonuses = { ...current.passiveBonuses };
  const activeUnlocks = [...current.activeUnlocks];
  const systemUnlocks = [...current.systemUnlocks];

  for (const effect of course.systemEffects ?? []) {
    const lowered = effect.toLowerCase();

    if (lowered.includes("education speed +5%")) {
      passiveBonuses.educationSpeed = (passiveBonuses.educationSpeed ?? 0) + 5;
    }
    if (lowered.includes("health regeneration +10%")) {
      passiveBonuses.healthRegen = (passiveBonuses.healthRegen ?? 0) + 10;
    }
    if (lowered.includes("mission success +5%")) {
      passiveBonuses.missionSuccess = (passiveBonuses.missionSuccess ?? 0) + 5;
    }
    if (lowered.includes("market efficiency +5%")) {
      passiveBonuses.marketEfficiency =
        (passiveBonuses.marketEfficiency ?? 0) + 5;
    }
    if (lowered.includes("all battle stats +5%")) {
      passiveBonuses.battleStats = (passiveBonuses.battleStats ?? 0) + 5;
    }
    if (lowered.includes("all working stats +5%")) {
      passiveBonuses.workingStats = (passiveBonuses.workingStats ?? 0) + 5;
    }

    if (!activeUnlocks.includes(effect)) {
      activeUnlocks.push(effect);
    }
  }

  for (const unlock of course.unlocksSystems ?? []) {
    if (!systemUnlocks.includes(unlock)) {
      systemUnlocks.push(unlock);
    }
  }

  return { passiveBonuses, activeUnlocks, systemUnlocks };
}

// ─── Provider ─────────────────────────────────────────────────────────────────

const EducationContext = createContext<EducationContextValue | null>(null);

export function EducationProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<EducationState>(readStoredState);
  const { serverHydrationVersion } = useAuth();
  const { addBattleStat, addWorkingStat, addExperience } = usePlayer();

  // Persist to localStorage whenever state changes
  useEffect(() => {
    writeStoredState(state);
  }, [state]);

  useEffect(() => {
    setState(readStoredState());
  }, [serverHydrationVersion]);

  // ── checkCompletion ────────────────────────────────────────────────────────
  // Called every 1000ms. If the active course has passed its completesAt
  // timestamp, finalize it: add to completedCourses, apply rewards, clear activeCourse.
  const checkCompletion = useCallback(() => {
    setState((current) => {
      if (!current.activeCourse) return current;

      const now = Date.now();
      if (now < current.activeCourse.completesAt) return current;

      const { courseId } = current.activeCourse;
      if (current.completedCourses.includes(courseId)) {
        // Already marked — just clear activeCourse
        return { ...current, activeCourse: null };
      }

      const course = educationCourseMap[courseId];
      if (!course) return { ...current, activeCourse: null };

      const rewards = finalizeRewards(course, current);

      if (course.statRewards) {
        for (const [stat, value] of Object.entries(course.statRewards)) {
          if (!value) continue;
          addBattleStat(stat as "strength" | "defense" | "speed" | "dexterity", value);
        }
      }

      if (course.workingStatRewards) {
        for (const [stat, value] of Object.entries(course.workingStatRewards)) {
          if (!value) continue;
          addWorkingStat(stat as "manualLabor" | "intelligence" | "endurance", value);
        }
      }

      addExperience(Math.max(10, Math.round(course.durationDays * 2)));

      return {
        ...current,
        ...rewards,
        completedCourses: [...current.completedCourses, courseId],
        activeCourse: null,
      };
    });
  }, [addBattleStat, addExperience, addWorkingStat]);

  // 1-second polling interval for completion check
  useEffect(() => {
    const id = window.setInterval(checkCompletion, 1000);
    return () => window.clearInterval(id);
  }, [checkCompletion]);

  // ── startCourse ────────────────────────────────────────────────────────────
  const educationSpeedBonus = state.passiveBonuses.educationSpeed ?? 0;

  const isCourseCompleted = useCallback(
    (courseId: string) => state.completedCourses.includes(courseId),
    [state.completedCourses],
  );

  const isCourseLocked = useCallback(
    (course: EducationCourse) =>
      !courseHasCompletedAllPrerequisites(course, state.completedCourses),
    [state.completedCourses],
  );

  const startCourse = useCallback(
    (categoryId: string, courseId: string): { ok: boolean; message: string } => {
      const course = educationCourseMap[courseId];
      if (!course) return { ok: false, message: "Course not found." };
      if (state.activeCourse) {
        return { ok: false, message: "You are already studying a course." };
      }
      if (state.completedCourses.includes(courseId)) {
        return {
          ok: false,
          message: "You have already completed this course.",
        };
      }
      if (isCourseLocked(course)) {
        return { ok: false, message: "Prerequisites are not complete." };
      }

      const multiplier = Math.max(0.1, 1 - educationSpeedBonus / 100);
      const durationMs = Math.round(
        course.durationDays * 24 * 60 * 60 * 1000 * multiplier,
      );
      const startedAt = Date.now();
      const completesAt = startedAt + durationMs;

      setState((current) => ({
        ...current,
        activeCourse: {
          courseId,
          categoryId,
          startedAt,
          durationMs,
          completesAt,
        },
      }));

      return { ok: true, message: `${course.name} has started.` };
    },
    [
      educationSpeedBonus,
      isCourseLocked,
      state.activeCourse,
      state.completedCourses,
    ],
  );

  // ── cancelCourse ───────────────────────────────────────────────────────────
  const cancelCourse = useCallback(() => {
    setState((current) => ({ ...current, activeCourse: null }));
  }, []);

  // ── getRemainingMs ─────────────────────────────────────────────────────────
  const getRemainingMs = useCallback(() => {
    if (!state.activeCourse) return 0;
    return Math.max(0, state.activeCourse.completesAt - Date.now());
  }, [state.activeCourse]);

  // ── Context value ──────────────────────────────────────────────────────────
  const value = useMemo<EducationContextValue>(
    () => ({
      completedCourseIds: state.completedCourses, // back-compat alias
      completedCourses: state.completedCourses,
      activeCourse: state.activeCourse,
      passiveBonuses: state.passiveBonuses,
      activeUnlocks: state.activeUnlocks,
      systemUnlocks: state.systemUnlocks,
      startCourse,
      cancelCourse,
      leaveCourse: cancelCourse, // back-compat alias
      isCourseCompleted,
      isCourseLocked,
      getRemainingMs,
    }),
    [
      state,
      startCourse,
      cancelCourse,
      isCourseCompleted,
      isCourseLocked,
      getRemainingMs,
    ],
  );

  return (
    <EducationContext.Provider value={value}>
      {children}
    </EducationContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useEducation() {
  const context = useContext(EducationContext);
  if (!context) {
    throw new Error("useEducation must be used within an EducationProvider");
  }
  return context;
}

// ─── Utilities (exported for Education.tsx) ───────────────────────────────────

/** Format remaining ms as "X days, H hours, M minutes, and S seconds" */
export function formatRemaining(ms: number): string {
  if (ms <= 0) return "completed";

  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const parts: string[] = [];

  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}hrs`);
  if (minutes > 0) parts.push(`${minutes}min`);
  if (!parts.length) parts.push("under 1min");

  return parts.join(" ");
}

/** Format remaining ms as a short human countdown */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return "done";
  const totalSeconds = Math.floor(ms / 1000);
  const d = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}hrs`;
  if (h > 0) return `${h}hrs ${m}min`;
  return `${m}min`;
}

export function getCategoryProgress(
  categoryId: string,
  completedCourseIds: string[],
) {
  const category = educationCategories.find((item) => item.id === categoryId);
  if (!category) return { completed: 0, total: 0 };

  const completed = category.courses.filter((course) =>
    completedCourseIds.includes(course.id),
  ).length;
  return { completed, total: category.courses.length };
}

export function firstCourseIdForCategory(category: EducationCategory) {
  return category.courses[0]?.id ?? "";
}
