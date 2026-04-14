import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import {
  educationCategories,
  educationCourseMap,
  getCourseState,
} from "../data/educationData";
import {
  formatCountdown,
  formatRemaining,
  getCategoryProgress,
  useEducation,
} from "../state/EducationContext";
import "../styles/education-ui.css";

function CourseLearnArea({
  courseId,
  categoryId,
}: {
  courseId: string;
  categoryId: string;
}) {
  const education = useEducation();
  const course = educationCourseMap[courseId];
  const [remainingMs, setRemainingMs] = useState<number>(() => education.getRemainingMs());
  const intervalRef = useRef<number | null>(null);

  const isThisCourseActive = education.activeCourse?.courseId === courseId;
  const isAnotherCourseActive = !!education.activeCourse && !isThisCourseActive;
  const isCompleted = education.isCourseCompleted(courseId);
  const isLocked = !isCompleted && education.isCourseLocked(course);

  useEffect(() => {
    if (!isThisCourseActive) {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    setRemainingMs(education.getRemainingMs());

    intervalRef.current = window.setInterval(() => {
      const ms = education.getRemainingMs();
      setRemainingMs(ms);
    }, 1000);

    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [education, isThisCourseActive]);

  if (isCompleted) {
    return (
      <div className="edu-action-area">
        <span className="edu-action-badge edu-action-badge--completed">
          Completed ✓
        </span>
      </div>
    );
  }

  if (isThisCourseActive) {
    return (
      <div className="edu-action-area">
        <div className="edu-action-countdown">
          Learning… {formatCountdown(remainingMs)} remaining
        </div>
        <button
          type="button"
          className="edu-action-button edu-action-button--cancel"
          onClick={() => education.cancelCourse()}
        >
          Cancel
        </button>
      </div>
    );
  }

  if (isAnotherCourseActive) {
    const activeName = educationCourseMap[education.activeCourse!.courseId]?.name ?? "another course";
    return (
      <div className="edu-action-area">
        <button
          type="button"
          className="edu-action-button edu-action-button--primary"
          disabled
          title={`Already studying "${activeName}"`}
        >
          Learn
        </button>
        <span className="edu-action-hint">
          Already studying another course
        </span>
      </div>
    );
  }

  if (isLocked) {
    const prereqNames = (course.prerequisites ?? [])
      .filter((id) => !education.isCourseCompleted(id))
      .map((id) => educationCourseMap[id]?.name ?? id)
      .join(", ");

    return (
      <div className="edu-action-area">
        <button
          type="button"
          className="edu-action-button edu-action-button--primary"
          disabled
          title={`Requires: ${prereqNames}`}
        >
          Learn
        </button>
        <span className="edu-action-hint edu-action-hint--lock">
          Requires: {prereqNames}
        </span>
      </div>
    );
  }

  return (
    <div className="edu-action-area">
      <button
        type="button"
        className="edu-action-button edu-action-button--primary"
        onClick={() => {
          const result = education.startCourse(categoryId, courseId);
          if (!result.ok) {
            console.warn("[Education] startCourse failed:", result.message);
          }
        }}
      >
        Learn
      </button>
    </div>
  );
}

export default function Education() {
  const education = useEducation();
  const [selectedCategoryId, setSelectedCategoryId] = useState(educationCategories[0]?.id ?? "");
  const selectedCategory = educationCategories.find((c) => c.id === selectedCategoryId) ?? educationCategories[0];
  const [selectedCourseId, setSelectedCourseId] = useState(selectedCategory?.courses[0]?.id ?? "");

  const selectedCourse = useMemo(() => {
    return educationCourseMap[selectedCourseId] ?? selectedCategory.courses[0];
  }, [selectedCourseId, selectedCategory]);

  const [bannerRemainingMs, setBannerRemainingMs] = useState(() => education.getRemainingMs());
  useEffect(() => {
    if (!education.activeCourse) {
      setBannerRemainingMs(0);
      return;
    }
    const id = window.setInterval(() => {
      setBannerRemainingMs(education.getRemainingMs());
    }, 1000);
    return () => window.clearInterval(id);
  }, [education]);

  const activeCourseName = education.activeCourse
    ? educationCourseMap[education.activeCourse.courseId]?.name ?? "Current course"
    : null;

  const bannerSubtitle = education.activeCourse ? formatRemaining(bannerRemainingMs) : "No active course";

  return (
    <AppShell>
      <div className="education-page">
        <div className="edu-banner">
          <div className="edu-banner__icon">i</div>
          <div>
            <div className="edu-banner__title">
              EDUCATION <span>{activeCourseName ? `• ${activeCourseName}` : ""}</span>
            </div>
            <div className="edu-banner__subtitle">{bannerSubtitle}</div>
          </div>
          <div className="edu-banner__actions">
            <button
              type="button"
              className="edu-banner__button"
              onClick={() => education.cancelCourse()}
              disabled={!education.activeCourse}
            >
              Leave Course
            </button>
          </div>
        </div>

        <div className="edu-category-grid">
          {educationCategories.map((category) => {
            const progress = getCategoryProgress(category.id, education.completedCourses);
            const percentage = progress.total ? Math.round((progress.completed / progress.total) * 100) : 0;
            const isSelected = category.id === selectedCategory.id;

            return (
              <button
                key={category.id}
                type="button"
                className={`edu-category-card${isSelected ? " edu-category-card--active" : ""}`}
                onClick={() => {
                  setSelectedCategoryId(category.id);
                  setSelectedCourseId(category.courses[0].id);
                }}
              >
                <div className="edu-category-card__title">{category.name}</div>
                <div className="edu-category-card__image" />
                <div className="edu-category-card__footer">
                  <div className="edu-category-card__progress">
                    <div className="edu-category-card__progress-fill" style={{ width: `${percentage}%` }} />
                  </div>
                  <div className="edu-category-card__count">{progress.completed}/{progress.total}</div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="edu-lower-grid">
          <section className="edu-panel">
            <div className="edu-panel__header">
              <span>{selectedCategory.name}</span>
              <span>−</span>
            </div>
            <div className="edu-course-list">
              {selectedCategory.courses.map((course) => {
                const state = getCourseState(course, education);
                return (
                  <button
                    key={course.id}
                    type="button"
                    className={`edu-course-row edu-course-row--${state}${selectedCourse.id === course.id ? " edu-course-row--selected" : ""}`}
                    onClick={() => setSelectedCourseId(course.id)}
                  >
                    <span className="edu-course-row__bullet" />
                    <span className="edu-course-row__code">{course.code}</span>
                    <span className="edu-course-row__name">{course.name}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="edu-panel">
            <div className="edu-panel__header">
              <span>{selectedCourse.name.toUpperCase()}</span>
              <span>−</span>
            </div>
            <div className="edu-detail-card">
              {education.isCourseCompleted(selectedCourse.id) ? (
                <div className="edu-detail-card__completed-banner">
                  You have completed this course!
                </div>
              ) : null}

              <div className="edu-detail-card__body">
                <div className="edu-detail-card__course-title">{selectedCourse.name}</div>
                <div className="edu-detail-card__description">{selectedCourse.description}</div>

                <div className="edu-detail-section">
                  <div className="edu-detail-section__label">Learning outcome:</div>
                  <ul className="edu-detail-list">
                    {selectedCourse.summaryLines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>

                <div className="edu-detail-section">
                  <div className="edu-detail-section__label">Parameters:</div>
                  <ul className="edu-detail-list">
                    <li>Length: {selectedCourse.durationDays} days</li>
                    <li>Cost: {selectedCourse.costGold} gold</li>
                    <li>Reward type: {selectedCourse.rewardKind}</li>
                  </ul>
                </div>

                <div className="edu-detail-section">
                  <div className="edu-detail-section__label">Requirements:</div>
                  {selectedCourse.prerequisites?.length ? (
                    <ul className="edu-detail-list">
                      {selectedCourse.prerequisites.map((item) => (
                        <li
                          key={item}
                          className={education.isCourseCompleted(item) ? "edu-prereq--met" : "edu-prereq--unmet"}
                        >
                          {educationCourseMap[item]?.name ?? item}
                          {education.isCourseCompleted(item) ? " ✓" : ""}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="edu-detail-card__plain">No prerequisites.</div>
                  )}
                </div>

                <div className="edu-detail-section">
                  <div className="edu-detail-section__label">Actions:</div>
                  <div className="edu-detail-card__actions">
                    <CourseLearnArea courseId={selectedCourse.id} categoryId={selectedCategory.id} />
                  </div>
                </div>
              </div>

              <div className="edu-passive-strip">
                <div className="edu-passive-strip__block">
                  <div className="edu-passive-strip__label">Passive bonuses</div>
                  <div className="edu-passive-strip__value">
                    {Object.keys(education.passiveBonuses).length
                      ? Object.entries(education.passiveBonuses).map(([key, value]) => `${key} +${value}%`).join(" • ")
                      : "None yet"}
                  </div>
                </div>
                <div className="edu-passive-strip__block">
                  <div className="edu-passive-strip__label">Active unlocks</div>
                  <div className="edu-passive-strip__value">
                    {education.activeUnlocks.length ? education.activeUnlocks.join(" • ") : "None yet"}
                  </div>
                </div>
                <div className="edu-passive-strip__block">
                  <div className="edu-passive-strip__label">System unlocks</div>
                  <div className="edu-passive-strip__value">
                    {education.systemUnlocks.length ? education.systemUnlocks.join(" • ") : "None yet"}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
