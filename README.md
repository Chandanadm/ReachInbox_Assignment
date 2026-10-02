# ReachInbox – Email Scheduling & Delivery System

A production-oriented email scheduling and delivery platform built with **React, TypeScript, Express.js, PostgreSQL, Redis, BullMQ, Elasticsearch, Google OAuth, Slack OAuth, and SMTP**.

ReachInbox allows users to create email campaigns, upload recipients, schedule emails, process deliveries asynchronously, search email activity, and receive Slack notifications when sending limits are reached.

---

## 🚀 Key Features

- Google OAuth authentication
- Email campaign creation and scheduling
- CSV recipient upload
- Persistent delayed email jobs
- BullMQ background workers
- Configurable worker concurrency
- Minimum delay between emails
- Redis-backed hourly rate limiting
- Automatic retry for failed jobs
- PostgreSQL persistence with Prisma ORM
- Elasticsearch email search
- Slack OAuth integration and notifications
- Bull Board queue monitoring
- Scheduled and sent email tracking
- Responsive React dashboard

---

## 🏗️ Architecture

```text
                         ┌─────────────────────┐
                         │        User         │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │   React Dashboard   │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │   Express.js API    │
                         └──────┬──────┬───────┘
                                │      │
                ┌───────────────┘      └────────────────┐
                ▼                                        ▼
       ┌─────────────────┐                      ┌─────────────────┐
       │   PostgreSQL    │                      │      Redis      │
       │     + Prisma    │                      │ Rate Limiting   │
       └─────────────────┘                      └────────┬────────┘
                                                         │
                                                         ▼
                                                ┌─────────────────┐
                                                │     BullMQ      │
                                                │      Queue      │
                                                └────────┬────────┘
                                                         │
                                                         ▼
                                                ┌─────────────────┐
                                                │  Email Worker   │
                                                └────┬────┬────┬───┘
                                                     │    │    │
                                  ┌──────────────────┘    │    └──────────────────┐
                                  ▼                       ▼                       ▼
                         ┌─────────────────┐      ┌───────────────┐      ┌───────────────┐
                         │ SMTP / Ethereal │      │ Elasticsearch │      │   Slack API   │
                         └─────────────────┘      └───────────────┘      └───────────────┘
```

### Main Components

| Component | Responsibility |
|---|---|
| React | User interface and dashboard |
| Express.js | REST API and business logic |
| PostgreSQL | Persistent application data |
| Prisma | Database access and ORM |
| Redis | Shared state and rate limiting |
| BullMQ | Background email job processing |
| Worker | Asynchronous email delivery |
| SMTP / Ethereal | Email sending |
| Elasticsearch | Email search |
| Slack API | Rate-limit notifications |
| Google OAuth | User authentication |
| Bull Board | Queue monitoring |

---

## 📧 How Email Scheduling Works

The email delivery flow is asynchronous.

```text
User creates campaign
        ↓
React sends campaign to API
        ↓
Express validates request
        ↓
Campaign and recipients stored in PostgreSQL
        ↓
Email jobs added to BullMQ
        ↓
BullMQ keeps delayed jobs persistent
        ↓
Worker picks up available job
        ↓
Rate-limit checks are performed
        ↓
Email sent through SMTP
        ↓
Email status updated in PostgreSQL
        ↓
Email indexed in Elasticsearch
```

This keeps email delivery separate from the API request and prevents long-running email operations from blocking the application.

---

## ⏰ Scheduling

Users can configure:

- Campaign start time
- Delay between emails
- Hourly sending limit
- Multiple recipients
- CSV recipient uploads

Scheduled emails are stored in the database and represented as BullMQ jobs.

BullMQ delayed jobs allow emails to remain scheduled even if the worker process is temporarily restarted.

---

## ⚡ BullMQ Background Processing

BullMQ is used to process email delivery asynchronously.

### Why BullMQ?

- Supports delayed jobs
- Supports retries
- Supports background processing
- Supports worker concurrency
- Works with Redis
- Keeps scheduled jobs outside the web server lifecycle

### Worker Flow

```text
BullMQ Queue
     ↓
Worker
     ↓
Check rate limit
     ↓
Check minimum delay
     ↓
Send SMTP email
     ↓
Update database
     ↓
Index email in Elasticsearch
```

The worker concurrency can be configured using an environment variable.

Example:

```env
WORKER_CONCURRENCY=5
```

This allows multiple email jobs to be processed concurrently while keeping the concurrency configurable.

---

## 🚦 Rate Limiting

The application uses Redis-backed rate limiting to coordinate email sending across workers.

The system considers:

- Hourly sending limits
- Minimum delay between emails
- Shared Redis state
- Delayed job scheduling

When the hourly limit is reached, email jobs are **delayed instead of discarded**.

```text
Email Job
    ↓
Rate Limit Check
    ↓
 ┌───────────────┐
 │ Limit reached?│
 └───────┬───────┘
         │
    ┌────┴────┐
    │         │
   No        Yes
    │         │
    ▼         ▼
  Send      Delay Job
    │         │
    │         ▼
    │    Next Available
    │       Window
    │         │
    └────┬────┘
         ▼
      Continue
```

Redis provides shared coordination so multiple workers can use the same rate-limit state.

---

## 🔁 Retry Handling

Temporary email delivery failures are handled using BullMQ retry mechanisms.

A failed job can be retried automatically according to the configured retry policy.

This helps prevent temporary failures from immediately becoming permanent delivery failures.

---

## 🔍 Elasticsearch Search

Email activity is indexed in Elasticsearch.

The search functionality allows users to search email information such as:

- Recipient
- Recipient name
- Subject
- Email body

### Search Flow

```text
User enters search query
        ↓
React Dashboard
        ↓
Search API
        ↓
Elasticsearch
        ↓
Matching email records
        ↓
Dashboard displays results
```

Elasticsearch is used for fast text-based email searching instead of performing every search directly against PostgreSQL.

---

## 💬 Slack Integration

Slack OAuth is used to connect a user's Slack workspace.

Slack integration is used for operational notifications related to email sending limits.

When the configured sending limit is reached:

```text
Hourly Limit Reached
        ↓
Email jobs are delayed
        ↓
Slack notification
        ↓
User is informed
```

The Slack connection is stored for the authenticated user so notifications can be associated with the correct account.

---

## 🔐 Authentication

Google OAuth is used for user authentication.

### Login Flow

```text
User
 ↓
React Login
 ↓
Google OAuth
 ↓
Backend OAuth Callback
 ↓
User Authentication
 ↓
Application Session
 ↓
Dashboard
```

Protected API routes use the authenticated user's identity to access their application data.

---

## 🗄️ Database Design

PostgreSQL stores persistent application data.

Prisma ORM is used for database access.

The main data entities include:

```text
User
 │
 ├── EmailBatch
 │       │
 │       └── Email
 │              │
 │              └── EmailRecipient
 │
 └── SlackConnection
```

### PostgreSQL Responsibilities

- User information
- Campaign information
- Email information
- Recipient information
- Email status
- Slack connection information

PostgreSQL provides durable storage independent of the worker process.

---

## 📦 Queue and Database Responsibilities

The system separates persistent data from background job processing.

| System | Responsibility |
|---|---|
| PostgreSQL | Permanent application data |
| Redis | Queue state and shared rate-limit coordination |
| BullMQ | Background and delayed jobs |
| Elasticsearch | Search index |
| SMTP | Email delivery |

This separation allows the API, queue, worker, and search components to operate independently.

---

## 🖥️ Dashboard

The React dashboard provides:

- Overview
- Scheduled emails
- Sent emails
- Compose email
- CSV recipient upload
- Search
- Slack connection
- Account information
- Logout

The dashboard is designed to provide visibility into email campaigns and delivery activity.

---

## 📊 Bull Board

Bull Board provides a monitoring interface for BullMQ queues.

It can be used to inspect:

- Waiting jobs
- Active jobs
- Completed jobs
- Failed jobs
- Delayed jobs

The Bull Board interface is available at:

```text
http://localhost:5000/admin/queues
```

---

## 🛠️ Technology Stack

### Frontend

- React
- TypeScript
- Vite
- Axios
- CSS

### Backend

- Node.js
- TypeScript
- Express.js

### Database

- PostgreSQL
- Prisma ORM

### Background Processing

- Redis
- BullMQ

### Search

- Elasticsearch

### Authentication

- Google OAuth

### Notifications

- Slack OAuth
- Slack API

### Email

- SMTP
- Ethereal Email

---

## 📁 Project Structure

```text
ReachInbox_Assignment/
│
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── workers/
│   │   ├── middleware/
│   │   └── server.ts
│   │
│   ├── prisma/
│   ├── package.json
│   └── .env
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── App.tsx
│   │
│   ├── package.json
│   └── .env
│
├── README.md
└── .gitignore
```

---

## 🚀 Local Setup

### 1. Clone the Repository

```bash
git clone https://github.com/Chandanadm/ReachInbox_Assignment.git
cd ReachInbox_Assignment
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file with the required configuration.

Then run Prisma setup:

```bash
npx prisma generate
npx prisma migrate dev
```

Start the backend:

```bash
npm run dev
```

Backend:

```text
http://localhost:5000
```

### 3. Frontend Setup

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend:

```text
http://localhost:5173
```

---

## 🔧 Environment Configuration

The application requires configuration for:

```text
PostgreSQL
Redis
Google OAuth
SMTP
Elasticsearch
Slack OAuth
JWT / session configuration
```

Sensitive credentials should be stored only in environment variables and should never be committed to GitHub.

---

## 🧪 Testing

The application was tested across the main user and delivery flows.

### Tested Areas

- Google OAuth login
- Dashboard overview
- Email composition
- Email scheduling
- Scheduled to sent email flow
- Elasticsearch search
- Slack OAuth connection
- CSV recipient upload
- Logout and session protection
- Worker restart behavior
- Background email processing
- Queue monitoring

---

## 🔄 End-to-End Flow

```text
                 USER
                   │
                   ▼
           React Dashboard
                   │
                   ▼
            Express API
                   │
        ┌──────────┼──────────┐
        ▼          ▼          ▼
   PostgreSQL    Redis    Elasticsearch
        │          │          │
        │       BullMQ        │
        │          │          │
        │          ▼          │
        │        Worker       │
        │          │          │
        │     ┌────┴────┐     │
        │     ▼         ▼     │
        │   SMTP       Slack  │
        │     │               │
        └─────┴───────────────┘
                   │
                   ▼
             Email Delivery
```

---

## 🎯 Design Goals

The project was designed around the following goals:

- Reliable asynchronous email processing
- Persistent scheduled jobs
- Controlled email throughput
- Shared rate-limit coordination
- Searchable email activity
- OAuth-based authentication
- Operational Slack notifications
- Clear monitoring of background jobs
- Responsive and user-friendly dashboard

---

## 📌 Important Implementation Decisions

### Why Redis?

Redis provides fast shared state and is used by BullMQ for queue management and by the application for rate-limit coordination.

### Why BullMQ?

BullMQ provides delayed jobs, background processing, retries, and configurable worker concurrency.

### Why PostgreSQL?

PostgreSQL provides durable relational storage for users, campaigns, emails, recipients, and connections.

### Why Elasticsearch?

Elasticsearch provides efficient text-based search over email activity.

### Why Slack?

Slack provides real-time operational notifications when sending limits are reached.

### Why asynchronous processing?

Email sending is an external operation and can take time or fail temporarily. Moving it to background workers keeps the API responsive and allows jobs to be retried or delayed.

---

## 🔐 Security Considerations

The project follows several basic security practices:

- OAuth authentication
- Protected API routes
- Environment-based secrets
- Password/credential separation from source code
- User-scoped data access
- No sensitive credentials committed to the repository

Production deployments should additionally use:

- HTTPS
- Secure cookie configuration
- Secret management services
- Database connection security
- Redis TLS
- Elasticsearch access controls
- Structured logging and monitoring

---

## 📈 Future Improvements

Possible future improvements include:

- Dedicated production email providers
- Advanced campaign analytics
- Email open and click tracking
- Per-sender rate-limit policies
- Multi-tenant administration
- Advanced retry and dead-letter handling
- More detailed delivery analytics
- Production observability and metrics

---

## 👩‍💻 Author

**Chandana D M**

ReachInbox Email Scheduling & Delivery System

GitHub:

https://github.com/Chandanadm/ReachInbox_Assignment

---

## 📄 License

This project was developed as a software engineering assignment and demonstration project.



## 🌐 Live Deployment

- 🚀 [Live Application](https://reach-inbox-assignment-three.vercel.app/)
- ⚙️ [Backend API](https://reachinbox-assignment-t7ms.onrender.com)
- 📦 [GitHub Repository](https://github.com/Chandanadm/ReachInbox_Assignment)