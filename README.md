# Certiora - Multi-Tenant EdTech Assessment Platform

A complete vertical slice implementation: Admin signup → Taxonomy → Question Bank → Student Management → Short Quiz flow.

## Features Implemented

### Admin Portal
- **Self-signup with generated credentials** - Review centers create accounts and get auto-generated passwords
- **Taxonomy Management** - Create subjects, topics, and subtopics
- **Question Bank** - Create and manage MCQ questions with difficulty levels and explanations
- **Student Bulk Creation** - Upload CSV to generate student credentials in bulk

### Student Portal
- **Login with generated credentials** - Students use username/password with expiration dates
- **Short Quiz (10-15 questions)** - Take randomized quizzes from approved question pool
- **Answer submission** - Submit answers question-by-question
- **Review mode** - See correct/incorrect answers with explanations and score

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- PostgreSQL + Prisma ORM
- NextAuth.js (JWT sessions with credentials provider)
- Tailwind CSS
- bcryptjs (password hashing)
- papaparse (CSV parsing)

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` and set:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/certiora"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
```

Generate `NEXTAUTH_SECRET`:
```bash
openssl rand -base64 32
```

### 3. Database Setup

Generate Prisma client and push schema:

```bash
npx prisma generate
npx prisma db push
```

Or use migrations (recommended for production):
```bash
npx prisma migrate dev --name init
```

### 4. Run the App

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## User Flows

### Admin Flow

1. **Signup** - Go to `/signup`
   - Fill: Review center name, slug, admin name, admin email
   - **Save the generated password!** (shown once)
   
2. **Login** - Go to `/admin/login`
   - Use the email and generated password

3. **Create Taxonomy** - Go to `/{tenantSlug}/admin/taxonomy`
   - Add subjects (e.g. "Mathematics", "Science")
   - Add topics under subjects (e.g. "Algebra", "Geometry")
   - Add subtopics under topics (optional)

4. **Create Questions** - Go to `/{tenantSlug}/admin/questions`
   - Select subject, topic, difficulty
   - Enter question stem
   - Add 4 options (check correct ones)
   - Add explanation (optional)
   - Click "Save Question"

5. **Upload Students** - Go to `/{tenantSlug}/admin/students`
   - Prepare CSV with columns: `studentId,name,email,credentialsExpiresAt`
   - Example:
     ```csv
     studentId,name,email,credentialsExpiresAt
     2024001,John Doe,john@example.com,2024-12-31
     2024002,Jane Smith,,2025-06-30
     ```
   - Upload CSV
   - **Download the generated credentials** and distribute to students

### Student Flow

1. **Login** - Go to `/login`
   - Use username (email or studentID@student.local) and password from admin

2. **Take Short Quiz** - Go to `/{tenantSlug}/exams`
   - Click "Start Short Quiz"
   - Answer questions one by one
   - Click "Next" after each answer
   - Click "Submit Exam" on the last question

3. **Review Results** - After submission
   - See final score (percentage)
   - Review each question with:
     - Your selected answer
     - Correct answer
     - Explanation

## Project Structure

```
src/
├── app/
│   ├── (auth)/          # Signup, admin login, student login
│   ├── (dashboard)/     # Protected routes
│   │   └── [tenantSlug]/
│   │       ├── admin/   # Taxonomy, questions, students
│   │       └── exams/   # Take quiz, review
│   └── api/
│       ├── auth/        # Signup, NextAuth
│       ├── admin/       # Taxonomy, questions, students APIs
│       └── exams/       # Start, answer, submit, list
├── services/            # Business logic
│   ├── tenant/
│   ├── question-bank/
│   ├── exam-engine/
│   └── ...
├── lib/
│   ├── db/             # Prisma client
│   ├── auth/           # NextAuth config
│   └── queue/          # (for future PDF ingestion)
└── types/              # TypeScript types and Zod schemas
```

## Database Schema Highlights

- **Tenant** - Multi-tenant isolation (all data scoped by `tenantId`)
- **User** - Admins and students with `passwordHash` and `credentialsExpiresAt`
- **Subject/Topic/Subtopic** - Question taxonomy
- **Question** - MCQ questions with options, difficulty, status (DRAFT/PENDING_APPROVAL/APPROVED)
- **ExamAttempt** - Tracks quiz attempts with score and status
- **ExamAttemptAnswer** - Individual answers per question

## Next Steps (Not Implemented Yet)

- **PDF Ingestion Pipeline** - Upload PDFs → chunk → AI generates questions → admin approval
- **Quick Exam (30-40 questions)** and **Mock Exam (70-100 questions)**
- **SRS Flashcards** - Spaced repetition using SM-2 algorithm
- **Analytics Dashboard** - Topic performance, weakness heatmaps, batch tracking
- **Custom branding** - Logo, primary color per tenant

## Troubleshooting

### "Unauthorized" errors
- Make sure you're logged in (check `/admin/login` or `/login`)
- Session uses JWT; if you change `NEXTAUTH_SECRET`, you need to login again

### "No questions in bank" when starting quiz
- Go to `/[tenantSlug]/admin/questions` and create at least 10-15 approved questions

### Student credentials CSV upload fails
- Check CSV format (headers: `studentId,name,email,credentialsExpiresAt`)
- Date format should be `YYYY-MM-DD`

### Database connection issues
- Verify `DATABASE_URL` in `.env`
- Run `npx prisma db push` or `npx prisma migrate dev`

## License

Private - All rights reserved
