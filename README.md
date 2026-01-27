# Unolo Field Force Tracker

A web application for tracking field employee check-ins at client locations with real-time distance validation and comprehensive reporting.

## Tech Stack

- **Frontend:** React 18, Vite, Tailwind CSS, React Router
- **Backend:** Node.js, Express.js, SQLite
- **Authentication:** JWT
- **Geolocation:** HTML5 Geolocation API

## Quick Start

### 1. Backend Setup

```bash
cd backend
npm run setup    # Installs dependencies and initializes database
cp .env.example .env
npm run dev
```

Backend runs on: `http://localhost:3001`

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on: `http://localhost:5173`

### Test Credentials

| Role     | Email              | Password    |
|----------|-------------------|-------------|
| Manager  | manager@unolo.com | password123 |
| Employee | rahul@unolo.com   | password123 |
| Employee | priya@unolo.com   | password123 |

## Environment Variables

Create a `.env` file in the `backend` directory:

```env
PORT=3001
JWT_SECRET=your-secure-secret-key-here
NODE_ENV=development
```

## Features

### Core Functionality
- Role-based authentication (Manager/Employee)
- Real-time GPS-based check-in/checkout
- Client assignment and management
- Attendance history tracking
- Dashboard analytics for both roles

### Feature A: Distance-Based Check-in Validation
- **Real-time distance calculation** between employee's current GPS location and assigned client location during check-in
- Distance is calculated using geographic coordinates and stored with each check-in record
- **Visual indicators:**
  - Distance displayed in active check-in view
  - Distance shown in attendance history table
- **Validation warning:** If distance exceeds 500 meters, a warning message is shown to the employee
- Distance values are rounded to two decimal places and stored as `distance_from_client` (in kilometers)

### Feature B: Daily Summary Report API (Manager Only)
- Comprehensive daily activity reporting for team management
- **Endpoint:** `GET /api/reports/daily-summary`
- **Filtering options:**
  - Date (required)
  - Specific employee (optional)
- **Report includes:**
  - Per-employee check-in count
  - Working hours calculation
  - Unique clients visited
  - Team-level aggregate statistics
- Optimized with grouped SQL queries to prevent N+1 query issues
- Fully compatible with SQLite date and time functions

## Project Structure

```
├── backend/
│   ├── config/          # Database configuration
│   ├── middleware/      # Auth middleware
│   ├── routes/          # API routes 
│   ├── scripts/         # Database init scripts
│   └── server.js        # Express app entry
├── frontend/
│   ├── src/
│   │   ├── components/  # Reusable components
│   │   ├── pages/       # Page components
│   │   └── utils/       # API helpers
│   └── index.html
└── database/            # SQL schemas (reference only)
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user profile

### Check-ins
- `GET /api/checkin/clients` - Get assigned clients (employee-specific)
- `POST /api/checkin` - Create check-in with GPS coordinates
- `PUT /api/checkin/checkout` - Checkout from active check-in
- `GET /api/checkin/history` - Get check-in history with filters
- `GET /api/checkin/active` - Get currently active check-in

### Dashboard
- `GET /api/dashboard/stats` - Manager dashboard statistics
- `GET /api/dashboard/employee` - Employee dashboard statistics

### Reports (Manager Only)
- `GET /api/reports/daily-summary` - Daily team activity summary
  - Query params: `date` (required, YYYY-MM-DD), `employee_id` (optional)


## Development Notes

- The database uses SQLite - no external database setup required
- Run `npm run init-db` to reset the database to initial state
- Distance validation threshold: 500 meters
- All timestamps are stored in UTC
- Frontend requires browser geolocation permissions for check-in functionality

