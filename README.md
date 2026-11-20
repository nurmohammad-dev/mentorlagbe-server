# MentorLagbe Backend API

RESTful Express.js and MongoDB backend powering the MentorLagbe tuition and mentorship platform.

## Tech Stack
- **Runtime & Framework:** Node.js, Express.js
- **Database:** MongoDB (Native Driver)
- **Authentication:** BetterAuth JWT Verification (`jose`)
- **Payments:** Stripe Checkout API

## Core API Modules
- `/api/users` — User profile sync, updates, and Admin role management
- `/api/tuitions` — Public search/filter/pagination, Tutor CRUD, and Admin moderation
- `/api/applications` — Student applications and Tutor acceptance workflow
- `/api/payments` — Stripe Checkout sessions, verification, and revenue logs
- `/api/dashboard` — Role-based statistics and sample tuition seeding

## Local Setup
1. Run `npm install`
2. Copy `.env.example` to `.env` and fill in your credentials
3. Run `node --watch index.js`