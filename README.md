# PaceTrack — Backend

REST API powering **PaceTrack**, a full-stack running tracker mobile app. Built with Node.js, Express, and MongoDB, featuring secure email OTP authentication and a complete run-tracking data layer.

## Features

- 🔐 **Email OTP Authentication** — signup verification via one-time codes (no plain-text password storage, bcrypt-hashed OTPs and passwords)
- 🎫 **JWT Session Management** — stateless auth with protected routes
- 🏃 **Run Tracking API** — save GPS route data, distance, pace, and calories per run
- 📊 **Aggregated Stats** — MongoDB aggregation pipelines for daily/weekly stats, streaks, and achievement tracking
- 👤 **User Profiles** — extended onboarding data (fitness level, goals, height/weight, emergency contact)

## Tech Stack

- **Runtime:** Node.js + Express
- **Database:** MongoDB Atlas (Mongoose ODM)
- **Auth:** JWT + bcryptjs
- **Email:** Nodemailer (Gmail SMTP)

## API Overview

| Route | Description |
|---|---|
| `POST /api/auth/signup` | Create account, sends OTP via email |
| `POST /api/auth/verify-otp` | Verify OTP, issues JWT |
| `POST /api/auth/login` | Email/password login |
| `GET /api/auth/me` | Get current user profile |
| `PUT /api/auth/profile` | Update onboarding/profile data |
| `POST /api/runs` | Save a completed run |
| `GET /api/runs` | List user's run history |
| `GET /api/runs/stats` | Dashboard stats (today/weekly aggregates) |
| `GET /api/runs/streak` | Current & longest streak |
| `GET /api/runs/achievements` | Unlocked achievement badges |

## Getting Started

```bash
git clone https://github.com/tayabawan19/PaceTrack-backend.git
cd PaceTrack-backend
npm install
```

Create a `.env` file:
