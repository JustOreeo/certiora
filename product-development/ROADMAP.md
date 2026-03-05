# Certiora — Feature Roadmap

This roadmap is organized into sequential milestones. Each milestone delivers a self-contained, testable slice of value. Complete all items in a milestone before moving to the next — later milestones depend on earlier ones being stable.

---

## Legend

- ✅ Done
- 🔲 To build

---

## Milestone 1 — Admin-to-Student MVP
> Goal: A review center admin can onboard, build a question bank, provision students, and have students take a short quiz end-to-end.

### Auth & Onboarding
- ✅ Admin self-signup (review center name, slug, admin name, email)
- ✅ Auto-generated admin password shown once on signup
- ✅ Admin login (`/admin/login`)
- ✅ JWT session scoped to tenant
- ✅ Route protection via middleware (unauthenticated → redirect to login)

### Taxonomy Management
- ✅ Create / rename / delete Subjects
- ✅ Create / rename / delete Topics under a Subject
- ✅ Create / rename / delete Subtopics under a Topic
- ✅ Taxonomy UI at `/{tenantSlug}/admin/taxonomy`

### Question Bank
- ✅ Create MCQ question (stem, 4 options, correct answer, difficulty, subject/topic/subtopic, explanation)
- ✅ Question status lifecycle: DRAFT → PENDING_APPROVAL → APPROVED
- ✅ Approve a question
- ✅ Filter questions by subject, topic, difficulty, status
- ✅ Question bank UI at `/{tenantSlug}/admin/questions`

### Student Management
- ✅ Bulk student creation via CSV upload (studentId, name, email, credentialsExpiresAt)
- ✅ Auto-generate username + password per student
- ✅ Download generated credentials CSV
- ✅ Student management UI at `/{tenantSlug}/admin/students`

### Student Auth
- ✅ Student login (`/login`) with generated credentials
- ✅ Expired credentials blocked with clear message
- ✅ Student session scoped to their tenant

### Short Quiz
- ✅ Start a Short Quiz (10–15 random APPROVED questions)
- ✅ Answer questions one at a time
- ✅ Submit exam and compute score
- ✅ Review mode: show each question with student answer, correct answer, explanation
- ✅ Exam UI at `/{tenantSlug}/exams` and `/{tenantSlug}/exams/[id]`
- ✅ Review UI at `/{tenantSlug}/exams/[id]/review`

---

## Milestone 2 — Full Exam Suite
> Goal: Students can take longer, progressively harder exams that simulate the actual board exam format.

### Quick Exam (30–40 questions)
- 🔲 Start Quick Exam from the exams page
- 🔲 Draw 30–40 random APPROVED questions
- 🔲 Reuse same answer-one-at-a-time flow and review mode

### Mock Exam (70–100 questions)
- 🔲 Start Mock Exam from the exams page
- 🔲 Draw 70–100 random APPROVED questions
- 🔲 Reuse same answer-one-at-a-time flow and review mode

### Exam Time Tracking & Limits
- 🔲 Track per-question time spent
- 🔲 Track total exam time spent
- 🔲 Optional configurable time limit per exam type (auto-submit on expiry)

### Exam History
- 🔲 List past attempts on `/{tenantSlug}/exams` (score, type, date)
- 🔲 Navigate to review mode for any past attempt

---

## Milestone 3 — Student Study Loop
> Goal: Students can reinforce weak areas between exams using flashcards, and see where they stand with a personal analytics dashboard.

### SRS Flashcards
- 🔲 Auto-seed flashcard deck from questions answered incorrectly in any exam
- 🔲 Flashcard session UI at `/{tenantSlug}/flashcards`
  - Show question stem and options (or hidden — flip to reveal)
  - Student grades card (quality 0–5)
  - SM-2 computes next review interval and updates card
- 🔲 Show session summary: cards reviewed, due tomorrow, total deck size
- 🔲 Cards due today always surface before future cards

### Student Analytics Dashboard
- 🔲 Analytics page at `/{tenantSlug}/analytics`
- 🔲 Topic performance table: accuracy % per topic across all submitted exams
- 🔲 Weakness heatmap: lowest-accuracy topics (min 3 attempts), ranked worst-first
- 🔲 Exam history table: last 30 attempts with score, type, question count, time spent, date
- 🔲 Empty state: no data → prompt to take first quiz

---

## Milestone 4 — PDF Source Material Library
> Goal: Admins can upload reference PDF documents and instructors can read the extracted text in-platform while writing questions, without switching tools.

### Upload & Ingestion
- 🔲 Admin uploads PDF file from the admin portal
- 🔲 File stored in S3-compatible object storage (S3 or R2)
- 🔲 Background job extracts text content, splits into page-level chunks
- 🔲 Ingestion status tracked per file: UPLOADED → PROCESSING → CHUNKED / FAILED
- 🔲 Failed ingestion surfaces error details to admin

### Source Material Viewer
- 🔲 Source material library page listing all uploaded PDFs (name, page count, status)
- 🔲 View extracted text content page-by-page within the platform
- 🔲 Delete a source material (and its chunks)

---

## Milestone 5 — Admin Analytics
> Goal: Admins can see how their batch is performing overall, identify struggling topics across the cohort, and track individual students.

### Cohort-Level Analytics
- 🔲 Admin analytics page at `/{tenantSlug}/admin/analytics`
- 🔲 Topic accuracy across all students (which topics the batch is weakest on)
- 🔲 Exam activity summary: total exams taken, average score, active students

### Per-Student Progress
- 🔲 Student list links to individual student performance view
- 🔲 Per-student: exam history, topic accuracy, weak areas

---

## Milestone 6 — Polish & Hardening
> Goal: The platform is ready for real review centers — it handles edge cases gracefully, looks professional on mobile, and supports basic white-labeling.

### Custom Branding
- 🔲 Admin can set a logo URL for their workspace
- 🔲 Admin can set a hex primary color applied across the tenant UI
- 🔲 Branding reflected on student-facing pages

### UX & Empty States
- 🔲 All empty states are actionable (e.g., "No approved questions yet → Go to question bank")
- 🔲 All error messages are human-readable (no raw API errors surfaced to users)
- 🔲 Distraction-free exam interface (minimal nav during active attempt)
- 🔲 Mobile-responsive layouts across all student-facing pages

### Security & Correctness
- 🔲 Verify full tenant isolation: no route or API endpoint leaks cross-tenant data
- 🔲 Expired student credentials blocked consistently across all entry points
- 🔲 Concurrent exam attempt guard (same student cannot have two IN_PROGRESS attempts of the same type)
- 🔲 Question deletion blocked if question is part of an IN_PROGRESS exam attempt

---

## Dependency Map

```
Milestone 1 (MVP)
    └── Milestone 2 (Full Exam Suite)
            └── Milestone 3 (Student Study Loop)  ← depends on exam data
    └── Milestone 4 (PDF Library)                 ← independent after M1
    └── Milestone 5 (Admin Analytics)             ← depends on M2 exam data
Milestone 6 (Polish)                              ← runs in parallel, finalized last
```
