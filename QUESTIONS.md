# Field Force Tracker - Technical Q&A

## 1 Question
**If this app had 10,000 employees checking in simultaneously, what would break first? How would you fix it?**

### Answer

First, "10,000 simultaneous" needs clarification:
- **10k in 10 seconds** = 1,000 req/sec (realistic shift-start scenario)
- **10k in 1 second** = 10,000 req/sec (extreme case)

 assumes **1,000 req/sec burst traffic**.

 #### What Breaks First

**1. SQLite Write Lock** (~400-600 req/sec capacity)

SQLite uses **file-level locking** - only one write at a time. Under load:
- `SQLITE_BUSY` errors
- Request timeouts
- Queue buildup in Node.js

**2. Node.js Connection Pool** (~100-200 concurrent)

The `sqlite3` library serializes operations, creating a bottleneck even before database limits.

#### Solution

Immediate Fix (1 hour)**
```javascript
const Bottleneck = require('bottleneck');
const limiter = new Bottleneck({
  maxConcurrent: 50,
  minTime: 20  // 50/sec = safe rate
});

app.post('/api/checkin', limiter.wrap(checkinHandler));
```
- **Capacity:** ~300 req/sec
- **Cost:** $0, prevents crashes

SQLite Optimization **
```sql
PRAGMA journal_mode=WAL;
PRAGMA cache_size = -64000;  -- 64MB cache
PRAGMA synchronous = NORMAL;
```
- **Capacity:** 800-1,200 req/sec
- **Cost:** $0

## 2. The current JWT implementation has a security issue. What is it and how would you improve it?

### Security Issues Identified

The original JWT implementation had two main security issues:

**Issue 1: Sensitive Data in JWT Payload**

JWTs are not encrypted; they are only signed. This means anyone who has access to the token can decode and read its contents. Including the user's password hash inside the token unnecessarily increases the risk of data exposure if the token is leaked through logs, browser storage, or client-side scripts.

**Issue 2: Fallback JWT Secret**

If the environment variable was missing, the application would silently use a default secret. This can lead to token validation inconsistencies across environments and makes it easier to forge tokens if the fallback secret becomes known.

### How I Fixed It

To fix these issues, I:

1. **Removed all sensitive fields** from the JWT payload and limited it to only essential identity and authorization information such as user ID, email, name, and role
2. **Enforced the use of a single JWT secret** from environment variables and removed the fallback, ensuring the application fails fast if the secret is not configured

### Further Improvements for Production

In a production system, this could be further improved by:
- Using short-lived access tokens (15-30 minutes)
- Implementing refresh tokens for session management
- Adding token revocation mechanisms
- Storing tokens in HTTP-only cookies instead of localStorage

The applied fixes significantly improve security for the current scope.

## 3. How would you implement offline check-in support?

**Decision criteria:**
- **>5% failures** → Build offline support
- **<5% failures** → Better retry logic instead

**Cost comparison:**
- Offline support: **3-4 weeks**, +40% code complexity
- Retry with backoff: **2 days**

**step1:Local Storage**

When an employee checks in without internet access, the frontend would save the check-in data locally using browser storage such as **IndexedDB** (or local SQLite storage in a mobile app). The record would include:
- Client ID
- Location coordinates
- Timestamp
- Notes
- Sync status marked as "pending"

The user would immediately see a successful check-in state without waiting for network availability.

**Step 2: Network Monitoring**

The application would monitor network connectivity using browser `online`/`offline` events. Once the device is back online, the app would automatically attempt to sync all pending check-ins to the backend.

**Step 3: Sync and Cleanup**

After successful sync, the local records would be marked as synced or removed from local storage.

**Step 4: Idempotency**

To prevent duplicate check-ins during retries, each offline check-in would be assigned a **unique client-generated ID**. The backend would store this ID and ignore duplicate submissions, making the sync process idempotent.

### Benefits

This approach ensures:
- No data loss
- Smooth user experience on unreliable networks
- Backend remains the source of truth
- Safe handling of delayed synchronization

## 4. Explain the difference between SQL and NoSQL databases. Which would you recommend for this application and why?

### SQL Databases

SQL databases store data in **structured tables** with fixed schemas and explicit relationships between entities. They support:
- Complex queries and joins
- ACID transactions
- Strong consistency guarantees

This makes them well-suited for applications that require accurate reporting, relational data integrity, and complex aggregations.

### NoSQL Databases

NoSQL databases store data in flexible formats such as documents or key-value pairs. They are designed for:
- Horizontal scalability
- High write throughput

However, they often sacrifice relational querying capabilities and strict consistency. Relationships are typically embedded or handled at the application level.

### Recommendation for This Application

For the Field Force Tracker application, a **SQL database is the better choice**.

**Reasons:**

1. **Data Model:** The data model is highly relational, involving users, managers, clients, assignments, and check-ins
2. **Query Patterns:** The application relies heavily on joins, date-based filtering, reporting, and aggregation queries, all of which are naturally and efficiently handled by SQL databases
3. **Data Structure:** Well-defined entities with strong relationships map naturally to a relational schema
4. **Reporting Needs:** Dashboards and reports require complex aggregations and time-based filtering

### Current vs. Production Database

While **SQLite** is sufficient for development and small-scale use, a production system should use a server-based SQL database such as **PostgreSQL** or **MySQL** to handle higher concurrency and scale.

**Note:** NoSQL could be considered for auxiliary use cases like high-frequency location pings, but not as the primary datastore.

### Scaling Considerations

- **SQL approach:** Vertical scaling and optimized relational queries work well for this application's needs
- **When NoSQL helps:** High-volume simple read/write workloads
- **When to consider horizontal scaling:** Only at much higher load, addressable with read replicas and caching

---

## 5. What is the difference between authentication and authorization? Identify where each is implemented in this codebase.

### Authentication

**Definition:** The process of verifying a user's identity. It answers the question **"Who is this user?"**

**Implementation in this codebase:**
- **Login flow:** User's email and password are validated (`backend/routes/auth.js`)
- **JWT issuance:** A signed JWT is generated and returned to the client
- **Request verification:** The `authenticateToken` middleware verifies the JWT on subsequent requests to ensure the request is coming from a valid, logged-in user

**Location:** `backend/middleware/auth.js` - `authenticateToken` function

### Authorization

**Definition:** The process of determining what an authenticated user is allowed to do. It answers the question **"Is this user allowed to perform this action?"**

**Implementation in this codebase:**

1. **Role-based authorization:**
   - `requireManager` middleware restricts certain endpoints (like manager dashboards and reports) to users with the manager role
   - **Location:** `backend/middleware/auth.js` - `requireManager` function

2. **Resource-level authorization:**
   - Database checks verify whether an employee is assigned to a specific client before allowing a check-in
   - **Location:** `backend/routes/checkin.js` - client assignment validation


## 6. Explain what a race condition is. Can you identify any potential race conditions in this codebase? How would you prevent them?

### What is a Race Condition?

A race condition occurs when multiple operations execute concurrently and the correctness of the system depends on the order in which those operations complete. If that order is not controlled, the system can enter an invalid or inconsistent state.

### Potential Race Conditions in This Codebase

**Race Condition 1: Duplicate Active Check-ins**

The application first checks whether an employee already has an active check-in and then inserts a new check-in record if none is found. If two check-in requests for the same employee arrive at nearly the same time, both could pass the initial check and create multiple active check-ins.

**Race Condition 2: Check-in/Checkout Timing**

Similar timing issues can occur between check-in and checkout requests or when reports are generated while data is actively being updated.

### How to Prevent Race Conditions

**1. Database-Level Constraints**

Enforce rules such as allowing only one active check-in per employee using unique constraints or check constraints.

```sql
CREATE UNIQUE INDEX idx_active_checkin 
ON checkins(employee_id) 
WHERE status = 'checked_in';
```

**2. Database Transactions**

Group related operations so they execute atomically:

```javascript
db.serialize(() => {
  db.run('BEGIN TRANSACTION');
  // Check for active check-in
  // Insert new check-in
  db.run('COMMIT');
});
```

**3. Idempotent Request Handling**

Use unique request IDs to prevent duplicate inserts during retries:

```javascript
// Client sends unique ID with each request
const requestId = generateUniqueId();
// Backend checks if this request was already processed
```

**4. Accept Eventual Consistency for Reports**

For reporting endpoints, accepting slight eventual consistency avoids excessive locking while maintaining system availability. Reports don't need to be perfectly real-time.