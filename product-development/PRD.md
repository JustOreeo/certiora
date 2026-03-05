# Product Requirements Document
# Certiora — Multi-Tenant EdTech Assessment Platform

**Version:** 1.0
**Date:** 2026-03-05
**Status:** Draft

---

## 1. Executive Summary

Certiora is a multi-tenant SaaS platform purpose-built for review centers that prepare students for licensure and certification exams. It gives each review center a fully isolated, white-labeled workspace where administrators can build a structured question bank, manage student cohorts, and deploy adaptive assessments — while students get a focused study environment with quizzes, spaced-repetition flashcards, and performance analytics.

---

## 2. Problem Statement

### 2.1 The Core Problem

Licensure exam review centers currently operate with a fragmented toolkit: questions stored in PDFs or spreadsheets, manual exam printing or one-off quiz apps, and no systematic way to track which topics each student struggles with. This creates three compounding failures:

1. **Reference materials are disconnected from the question bank.** Instructors write questions while switching between PDF reviewers and separate tools, with no single place to do both.
2. **Assessment is generic, not adaptive.** All students get the same set of questions regardless of their individual weak areas.
3. **Analytics are absent.** Review centers have no data on which topics their students are failing, so they cannot improve their instruction or identify at-risk students.

### 2.2 Who Is Affected

| Persona | Pain Today |
|---|---|
| **Review Center Admin** | Managing student credentials, distributing exam materials, and tracking overall batch performance is manual and error-prone |
| **Instructor / Question Author** | Writing questions while constantly switching between PDF reviewers and a question editor is slow and error-prone |
| **Student** | Studying from static PDFs gives no feedback loop; they don't know their weak topics until the actual board exam |

---

## 3. Goals & Non-Goals

### Goals
- Enable review centers to self-onboard and be operational within minutes
- Centralize reference PDFs alongside the question bank so instructors can write questions without switching tools
- Give students an adaptive, self-paced study loop: quiz → identify weaknesses → flashcard review → re-quiz
- Provide admins and instructors with per-student and cohort-level performance visibility
- Support complete multi-tenancy so each review center's data is fully isolated

### Non-Goals (v1)
- Third-party SSO / OAuth for students (credentials-only for now)
- In-platform video or lecture content
- Payment/subscription billing (assumed to be handled externally)
- Native mobile apps (web-responsive only)
- Open registration for students (admin-provisioned only)

---

## 4. User Personas & Jobs To Be Done

### Persona 1 — Review Center Admin

**Profile:** Owns or manages a review center. Responsible for onboarding students, curating exam content, and ensuring batch pass rates.

**Jobs To Be Done:**
- When I launch a new review batch, I need to provision student accounts quickly so students can start studying immediately.
- When my instructors create questions, I need an approval workflow so only quality-vetted content reaches students.
- When I have a reference textbook or reviewer PDF, I need to upload it to the platform so its content is available as a reference for creating questions.
- When an exam cycle ends, I need to see which topics my batch struggled with so I can adjust the curriculum.

### Persona 2 — Instructor / Question Author

**Profile:** Subject matter expert employed by the review center. Responsible for creating and maintaining the question bank.

**Jobs To Be Done:**
- When I write a new question, I need to tag it by subject, topic, and difficulty so it surfaces in the right assessments.
- When I need to write new questions, I need the uploaded PDF content available as an in-platform reference so I don't have to switch between tools.
- When I want to see how students are performing on my questions, I need topic-level accuracy data.

### Persona 3 — Student

**Profile:** Enrolled in a review center batch. Studying for a national licensure or professional certification exam.

**Jobs To Be Done:**
- When I sit down to study, I need a short quiz I can complete in 10–15 minutes to keep my momentum.
- When I finish an exam, I need to immediately see which questions I got wrong and why, so I can learn from mistakes.
- When I have idle time, I need to review flashcards on topics I'm weak in so I don't forget them.
- When I want to gauge my readiness, I need a full mock exam that simulates the actual board exam format.

---

## 5. Feature Specifications

### 5.1 Multi-Tenant Onboarding

**Description:** Any review center can self-sign up and receive an isolated tenant workspace scoped by a unique slug (e.g., `acereview`). All data — users, questions, exams, analytics — is hard-isolated per tenant.

**Requirements:**
- Admin provides: review center name, slug, admin name, admin email
- System auto-generates a secure initial password (shown once on screen)
- Tenant receives a unique slug used for all routes: `/{tenantSlug}/...`
- Tenant settings support custom logo URL, primary brand color, and custom domain (future)

**Acceptance Criteria:**
- A new admin can complete signup, log in, and reach their dashboard in under 2 minutes
- Two tenants with the same student email are fully isolated (no data bleed)
- Slug must be globally unique; duplicate slug rejected with clear error

---

### 5.2 Taxonomy Management

**Description:** A three-level hierarchy (Subject → Topic → Subtopic) that classifies all questions. Admins build the taxonomy before creating questions.

**Requirements:**
- Create, rename, and reorder Subjects
- Create, rename, and reorder Topics within a Subject
- Create, rename, and reorder Subtopics within a Topic (optional level)
- Taxonomy is tenant-scoped; no cross-tenant visibility

**Acceptance Criteria:**
- Admin can create a full taxonomy hierarchy (e.g., "Mathematics > Algebra > Linear Equations") in a single session
- Deleting a Subject/Topic with associated questions is blocked with an informative error
- Taxonomy changes are reflected immediately in the question creation form

---

### 5.3 Question Bank

**Description:** The core content repository. Questions are MCQ format, tagged to taxonomy nodes, assigned a difficulty, and go through a status lifecycle before reaching students.

**Status Lifecycle:** `DRAFT → PENDING_APPROVAL → APPROVED`

**Requirements:**
- Question fields: stem (rich text), 4 options (text), one or more correct answers, difficulty (Easy/Medium/Hard), subject, topic, subtopic (optional), explanation (optional)
- Questions in DRAFT/PENDING_APPROVAL are never served to students
- Admins/instructors can submit for approval; a separate approver can approve or reject
- Filter and search questions by subject, topic, difficulty, status
- Questions track who created them and who approved them

**Acceptance Criteria:**
- A question cannot be served in any exam until its status is APPROVED
- Approval action is logged with approver ID and timestamp
- At least 1 correct option required per question; saving without one is blocked

---

### 5.4 PDF Ingestion Pipeline (Source Material Library)

**Description:** Admins upload reference PDF documents as study source material. The system extracts and stores the full text content of the PDF, making it available as a searchable reference within the platform. No AI generation is involved — the content is preserved as-is.

**Workflow:**
1. Admin uploads PDF → stored in object storage (S3/R2)
2. System extracts text content, splitting the PDF into page-level chunks
3. Extracted content is stored and accessible for reference within the tenant's workspace

**Requirements:**
- Support PDF file uploads; display page count after processing
- Show ingestion status per uploaded file (UPLOADED → PROCESSING → CHUNKED/FAILED)
- Extracted text content is stored per page chunk and accessible to admins
- Failed ingestion surfaces error details to admin

**Acceptance Criteria:**
- After uploading a PDF, extracted text content is accessible without leaving the platform
- Ingestion status reflects the current processing state accurately
- Failed ingestion does not partially corrupt stored content

---

### 5.5 Student Management

**Description:** Admins provision student accounts in bulk via CSV upload. The system generates secure username/password credentials for each student and provides a downloadable credentials file.

**Requirements:**
- CSV format: `studentId, name, email, credentialsExpiresAt`
- System generates a unique username and secure random password per student
- Credentials have an expiry date; expired accounts cannot log in
- Admin can download the generated credentials CSV for distribution
- Students can also be added individually

**Acceptance Criteria:**
- A CSV of 200 students is processed without errors and credentials are downloadable
- Students with a past `credentialsExpiresAt` are blocked at login with a clear message
- Duplicate studentId within the same tenant is rejected

---

### 5.6 Student Authentication

**Description:** Students log in with credentials provisioned by their review center admin. Sessions are JWT-based. Students only access the tenant workspace they belong to.

**Requirements:**
- Login accepts email or `{studentId}@student.local` as username
- Password is the admin-generated credential
- After credential expiry, login is blocked with an informative message
- Student session is scoped to their tenant; no cross-tenant access

**Acceptance Criteria:**
- Expired credentials return a user-friendly "Your access has expired" message, not a generic error
- A student cannot access another tenant's routes even if they guess the slug

---

### 5.7 Assessments (Exams)

**Description:** Three exam modes with increasing length and rigor, all drawing randomly from the approved question pool.

| Mode | Questions | Intended Use |
|---|---|---|
| Short Quiz | 10–15 | Daily warmup, topic check-in |
| Quick Exam | 30–40 | Mid-study comprehensive check |
| Mock Exam | 70–100 | Full board exam simulation |

**Requirements:**
- Questions served from APPROVED pool only, randomized per attempt
- Questions answered one at a time; no skipping forward without answering (or configurable)
- Optional per-question time tracking
- Optional overall exam time limit (configurable per ExamDefinition)
- Exam attempt is saved progressively; browser refresh does not lose progress
- After submission: score (percentage) displayed immediately
- Review mode: show each question with student's answer, correct answer, and explanation

**Acceptance Criteria:**
- Starting an exam with fewer than the required number of approved questions shows a clear error
- Submitting an exam immediately calculates and persists the score
- Review mode is available immediately after submission and on any past attempt
- Two concurrent attempts by the same student do not interfere

---

### 5.8 SRS Flashcards

**Description:** A spaced-repetition study mode powered by the SM-2 algorithm. Questions the student answered incorrectly (or flagged for review) are added as flashcards. The system schedules review intervals, prioritizing cards due soonest.

**Requirements:**
- Cards are seeded from questions the student got wrong in exams, or manually added
- Each session surfaces up to 50 due cards, ordered by due date ascending
- Student grades each card (quality 0–5); SM-2 computes next review interval and ease factor
- Students can see total cards, due today count, and upcoming review schedule

**Acceptance Criteria:**
- A card graded ≥ 3 has its next review interval extended; a card graded < 3 resets to 1 day
- Ease factor never drops below the configured minimum (1.3)
- A card due today always appears before a card due tomorrow

---

### 5.9 Performance Analytics

**Description:** Per-student and cohort-level dashboards showing topic accuracy, weakness heatmaps, and exam history trends.

**Student-Facing Analytics:**
- Topic performance: accuracy % per topic across all submitted exams
- Weakness heatmap: lowest-accuracy topics (min 3 attempts to qualify) ranked worst-first
- Exam history: score, exam type, question count, time spent, submission date for last 30 attempts

**Admin-Facing Analytics (future):**
- Cohort-level topic performance
- Per-student progress tracking
- Batch pass-rate projections

**Requirements:**
- Analytics computed from all SUBMITTED exam attempts
- Weakness heatmap filters to topics with ≥ 3 total question attempts
- Data updates in real time after each exam submission

**Acceptance Criteria:**
- A student who has never taken an exam sees empty state with a prompt to take their first quiz
- A topic with only 2 attempts does not appear in the weakness heatmap
- Accuracy is calculated as (correct answers / total attempts) × 100, rounded to one decimal

---

### 5.10 Custom Branding (White-Label)

**Description:** Each tenant can customize their workspace with their review center's logo and primary brand color.

**Requirements:**
- Admin can upload a logo URL
- Admin can set a hex primary color used across their workspace UI
- Custom domain support (optional, advanced)

---

## 6. User Experience Requirements

### Navigation & Information Architecture

**Admin:**
- `/{tenantSlug}/admin` — Dashboard overview
- `/{tenantSlug}/admin/taxonomy` — Manage Subject/Topic/Subtopic hierarchy
- `/{tenantSlug}/admin/questions` — Question bank with filters and bulk actions
- `/{tenantSlug}/admin/students` — Student list and CSV upload

**Student:**
- `/{tenantSlug}/exams` — Available exam modes, recent attempts
- `/{tenantSlug}/exams/{id}` — Active exam (answer questions)
- `/{tenantSlug}/exams/{id}/review` — Post-submission review
- `/{tenantSlug}/flashcards` — SRS flashcard session
- `/{tenantSlug}/analytics` — Personal performance dashboard

### General UX Principles
- Mobile-responsive layouts (students likely study on phones)
- Exam interface must be distraction-free: no nav clutter during an active attempt
- Credential generation (signup, student CSV) must surface generated passwords exactly once with a clear "save this" warning
- Empty states must be actionable: guide the user to the next required step
- Error messages must be human-readable (not raw API error strings)

---

## 7. Success Metrics

| Metric | Description |
|---|---|
| Time to first approved question | From admin signup to first approved question in bank |
| PDF ingestion success rate | % of uploaded PDFs that complete chunking without failure |
| Student exam completion rate | % of started exams that are submitted |
| SRS engagement | % of students with active due cards who complete a session |
| Weakness heatmap coverage | % of students with ≥ 1 topic qualifying for heatmap |
| Cross-tenant data isolation | 0 incidents of tenant A accessing tenant B data |

---

## 8. Constraints & Assumptions

- All exam content is exclusively MCQ (Multiple Choice Questions); no free-text, essay, or matching questions in v1
- Student accounts are admin-provisioned; self-registration by students is out of scope
- The AI question generator produces drafts only; human approval is always required before student exposure
- File storage (PDFs) uses S3-compatible object storage (AWS S3 or Cloudflare R2)
- The platform is web-only; no native iOS/Android app in v1
- Credentials use bcrypt password hashing; plain-text passwords are never stored

---

## 9. Open Questions

1. **Exam question filtering logic:** Should Mock Exams proportionally sample across subjects, or draw purely at random from the full approved pool?
2. **Student self-service:** Should students be able to reset their own password, or is that always an admin action?
4. **Bulk approval:** Can instructors approve/reject AI-generated questions in batch, or only one at a time?
5. **Admin-level analytics:** At what point should cohort-level analytics be built? Is this a v1 or v2 feature for review center admins?
6. **Exam retakes:** Are there any limits on how many times a student can retake a particular exam type?

---

## 10. Out of Scope (Future Roadmap)

- Subscription billing and payment gateways
- Native mobile applications
- Video/lecture content delivery
- Peer-to-peer discussion or comments on questions
- Student self-registration
- External SSO (Google, Microsoft) for students
- Automated cohort pass-rate projections
- Question version history and rollback
