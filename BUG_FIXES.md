# Bug Fixes Documentation

---

## Backend Bugs

### 1. Intermittent Login Failure

**Location:**  
`backend/routes/auth.js` – Login route

**Line Number:**  
27-30

**Problem:**  
User login would sometimes fail even with correct credentials, creating an inconsistent and unpredictable authentication experience.

**Fix:**  
Added `await` to properly resolve the Promise returned by `bcrypt.compare()`.

**Why This Fix Is Correct:**  
Authentication logic now waits for the password comparison to complete before deciding access, making login behavior deterministic and correct.

---

### 2. Sensitive Data Stored in JWT Token

**Location:**  
`backend/routes/auth.js` – JWT generation logic

**Line Number:**  
33-39

**Problem:**  
The JWT payload included the user's password hash, exposing sensitive cryptographic material.

**Fix:**  
Removed the `password` field from the JWT payload.

**Why This Fix Is Correct:**  
JWTs should only contain minimal, non-sensitive claims. This reduces security risk and follows best practices for token-based authentication.

---

### 3. Inconsistent JWT Secret Usage Causing Token Validation Errors

**Location:**
- `backend/routes/auth.js` (token signing)
- `backend/middleware/auth.js` (token verification)

**Line Number:**  
3

**Problem:**  
Valid tokens were sometimes rejected as invalid, causing authenticated users to be logged out or denied access.

**Fix:**  
Removed the fallback secret and enforced a single source of truth using `process.env.JWT_SECRET`. The application will now fail fast if the environment variable is not set.

**Why This Fix Is Correct:**  
Ensures tokens are always signed and verified with the same secret. Failing fast on missing configuration is safer than silently using a fallback.

---

## Check-in API Issues

### 4. Incorrect HTTP Status Code on Validation Failure

**Location:**  
`backend/routes/checkin.js` – POST `/api/checkin`

**Line Number:**  
~30

**Problem:**  
When `client_id` was missing, the API returned HTTP 200 instead of a client error.

**Fix:**  
Changed response status to `400 Bad Request`.

**Why This Fix Is Correct:**  
Invalid input should return a 4xx status so the frontend can handle errors correctly.

---

### 5. Missing Location Validation Causing Incorrect Data Storage

**Location:**  
`backend/routes/checkin.js` – POST `/api/checkin`

**Line Number:**  
26–36

**Problem:**  
Latitude and longitude were not validated before insertion, allowing `NULL` values in the database.

**Fix:**  
Added validation to ensure `latitude` and `longitude` are provided.

**Why This Fix Is Correct:**  
Check-ins require location data; validating early prevents corrupt records.

---

### 6. Checkout Allowed Without Active Check-in

**Location:**  
`backend/routes/checkin.js` – PUT `/api/checkin/checkout`

**Line Number:**  
84–87

**Problem:**  
The API allowed checkout even if the latest check-in was already checked out.

**Fix:**  
Restricted checkout to records with `status = 'checked_in'`.

**Why This Fix Is Correct:**  
Prevents duplicate checkouts and maintains accurate attendance data.

---

### 7. SQL Injection Risk in Attendance History Filters

**Location:**  
`backend/routes/checkin.js` – GET `/api/checkin/history`

**Line Number:**  
118–125

**Problem:**  
Date filters were concatenated directly into the SQL query string.

**Fix:**  
Converted filters to parameterized query placeholders.

**Why This Fix Is Correct:**  
Prevents SQL injection and follows secure query practices.

---

### 8. API Contract Violation for Active Check-in Endpoint

**Location:**  
`backend/routes/checkin.js` – GET `/api/checkin/active`

**Line Number:**  
~145–160

**Problem:**  
The API temporarily returned `404 Not Found` when no active check-in existed. The frontend expected a successful response with `data: null`, causing Promise-based requests to fail and the UI to show a generic error state.

**Fix:**  
Restored the API to always return `200 OK` with `data: null` when no active check-in exists.

```javascript
res.json({
  success: true,
  data: checkins.length > 0 ? checkins[0] : null
});
```

**Why This Fix Is Correct:**  
"No active check-in" is a valid application state, not an error. Frontend logic depends on successful resolution of requests. Fixing the API contract prevents unnecessary UI failures.

---

## Dashboard API Issues

### 9. Incorrect Dashboard Data Due to Timezone Mismatch

**Location:**  
`backend/routes/dashboard.js` – Manager stats route

**Line Number:**  
14–43

**Problem:**  
The dashboard used JavaScript UTC dates (`toISOString`) while SQLite date comparisons used local time, causing mismatched results near day boundaries.

**Fix:**  
Moved date calculation to the database using `DATE('now')`.

**Why This Fix Is Correct:**  
Ensures consistent date comparison regardless of server timezone.

---

### 10. Employee Dashboard Accessible by Managers

**Location:**  
`backend/routes/dashboard.js` – GET `/api/dashboard/employee`

**Line Number:**  
71–77

**Problem:**  
The employee dashboard endpoint lacked role-based authorization, allowing managers to access employee-specific data.

**Fix:**  
Added role validation to restrict access to users with role `employee`.

**Why This Fix Is Correct:**  
Prevents unauthorized access and avoids frontend data shape mismatches.

---

### 11. Weekly Stats Query Incompatible with SQLite

**Location:**  
`backend/routes/dashboard.js` – Employee dashboard weekly stats query

**Line Number:**  
100–105

**Problem:**  
Used MySQL-specific `DATE_SUB` and `NOW()` functions in a SQLite database.

**Fix:**  
Replaced with SQLite-compatible date expression `DATE('now', '-7 days')`.

**Why This Fix Is Correct:**  
Ensures weekly statistics work correctly in SQLite.

---

### 12. Missing Handling for Managers Without Team Members

**Location:**  
`backend/routes/dashboard.js` – Manager stats route

**Line Number:**  
20–35

**Problem:**  
The API assumed every manager has team members, which could lead to empty or inconsistent dashboard data.

**Fix:**  
Added safe handling for empty team scenarios.

**Why This Fix Is Correct:**  
Prevents frontend crashes and improves robustness.

---

## Frontend/UI Bug Fixes Documentation

### 1. History Page Crash on Load

**Location:**  
`frontend/src/pages/History.jsx`

**Line Number:**  


**Problem:**  
The History page crashed on initial load due to calling `.reduce()` on a `null` value. `checkins` state was initialized as `null`, but aggregation logic assumed an array.

**Fix:**  
Initialized `checkins` as an empty array (`useState([])`) and added defensive fallback logic where necessary.

```javascript
const [checkins, setCheckins] = useState([]);
```

**Why This Fix Is Correct:**  
History data is asynchronous. Initializing state with the correct data type prevents runtime errors and ensures predictable rendering.

---

### 2. Checkout Button Appeared Non-functional

**Location:**  
`frontend/src/pages/CheckIn.jsx`

**Line Number:**  
86-99

**Problem:**  
Clicking the "Check Out" button appeared to fail silently. The UI did not update even though the backend logic was triggered.

**Fix:**  
Once the backend checkout bug was resolved (SQLite string literal issue), the frontend logic worked as intended. No UI changes were required.

**Why This Fix Is Correct:**  
The frontend correctly handled API responses. The issue originated entirely from backend SQL errors, and fixing the source resolved the UI symptom.

---

### 3. Distance Not Displayed After Check-in

**Location:**  
`frontend/src/pages/CheckIn.jsx`

**Line Number:**  
154-164

**Problem:**  
Distance from client location was calculated and stored in the backend but not visible in the UI.

**Fix:**  
Added conditional rendering to display `distance_from_client` when present in both:
- Active Check-in card
- History table

```javascript
{activeCheckin.distance_from_client != null && (
  <p>Distance: {activeCheckin.distance_from_client} km</p>
)}
```

**Why This Fix Is Correct:**  
Frontend must explicitly render new backend fields. This ensures the feature is visible end-to-end.