# RBXGPM — Roblox Game Pass Management System

A web-based information system for administering Roblox game pass data. Built as a full-stack dashboard with role-based access control, transaction tracking, audit logging, and Excel report generation.

---

## Features

- **Authentication** — Login, sign-up, and password recovery with session management
- **Role-Based Access** — Three roles with distinct permissions:
  - `admin` — Full access including account management
  - `staff` — Players, passes, transactions, audit, and reports
  - `user` — View and purchase game passes, submit refund requests
- **Player Registry** — Add players, track join dates, ban/unban
- **Game Pass Catalog** — CRUD operations, pricing, benefits, and sale status
- **Transactions** — Record purchases, gifts (free distribution), and refunds
- **Refund Workflow** — Users request refunds; staff approves or cancels
- **Audit Log** — Trigger-based and manual audit trail for all changes
- **Report Generator** — Filter by type/date, paginated table, multi-column sort
- **Excel Export** — Styled workbooks with data sheet, chart sheet, and summary
- **Dashboard** — Live stats (total players, revenue, pass counts) with charts
- **Dark/Light Mode** — Toggleable theme

---

## Tech Stack

| Layer      | Technology                                   |
|------------|----------------------------------------------|
| Front-End  | HTML5, CSS3, JavaScript (ES6+)               |
| Charts     | Chart.js 4.4.1                               |
| Excel      | ExcelJS 4.4.0                                |
| Icons      | Font Awesome 6                               |
| Font       | Google Fonts — Inter                         |
| Back-End   | PHP 8.2+                                     |
| Database   | MySQL / MariaDB 10.4+                        |

---

## Project Structure

```
EDP/
├── api.php                  # REST API — all business logic and endpoints
├── MySQLConnection.php      # Database connection class
├── lumbis-activity-4.html   # Frontend UI (8 screens, modals)
├── lumbis-activity-4.js     # Frontend logic (auth, data, export)
├── lumbis-activity-4.css    # Styling (dark theme, responsive)
├── lumbis-activity-2.sql    # Database schema and seed data
└── sessions/                # PHP session storage (auto-created)
```

---

## Database Schema

| Table                    | Purpose                                      |
|--------------------------|----------------------------------------------|
| `accounts`               | User accounts, roles, credentials            |
| `players`                | Player registry                              |
| `gamepasses`             | Game pass catalog                            |
| `benefit_types`          | Reusable benefit definitions                 |
| `gamepass_benefits`      | Pass-to-benefit mapping                      |
| `player_gamepasses`      | Pass ownership records                       |
| `player_gamepasses_audit`| Trigger-based ownership audit trail          |
| `system_audit`           | Administrative action log                   |
| `refund_requests`        | Refund request workflow                      |
| `transactions`           | Complete transaction log (purchase/gift/refund) |

Views: `player_names`, `vw_player_gamepasses`, `vw_player_pass_count`

---

## Setup

### Requirements

- Apache / XAMPP with PHP 8.2+
- MySQL or MariaDB 10.4+

### Installation

1. Clone or copy the project into your web root (e.g., `htdocs/EDP/`).
2. Import the database schema:
   ```sql
   mysql -u root -p < lumbis-activity-2.sql
   ```
   Or import `lumbis-activity-2.sql` via phpMyAdmin.
3. Verify the DB credentials in `MySQLConnection.php` match your setup (defaults to `root` with no password on `localhost`).
4. Open your browser and navigate to:
   ```
   http://localhost/EDP/lumbis-activity-4.html
   ```

### Default Login

| Role  | Email / Username | Password  |
|-------|-----------------|-----------|
| Admin | `admin`         | `admin123`|

---

## API Endpoints

All requests are `POST` to `api.php` with an `action` parameter.

| Action              | Description                          |
|---------------------|--------------------------------------|
| `session`           | Check current login session          |
| `login`             | Authenticate user                    |
| `logout`            | End session                          |
| `signup`            | Register new account                 |
| `recover`           | Password recovery                    |
| `accounts`          | List accounts (admin)                |
| `add_account`       | Create account                       |
| `update_account`    | Edit account                         |
| `delete_account`    | Remove account                       |
| `set_status`        | Ban/unban account                    |
| `players`           | List players                         |
| `add_player`        | Register new player                  |
| `toggle_player_status` | Ban/unban player                  |
| `gamepasses`        | List game passes                     |
| `add_gamepass`      | Create game pass                     |
| `update_gamepass`   | Edit game pass                       |
| `delete_gamepass`   | Remove game pass                     |
| `buy_gamepass`      | User purchase                        |
| `tx_purchase`       | Record purchase transaction          |
| `tx_gift`           | Record gift transaction              |
| `tx_refund`         | Record refund transaction            |
| `transactions`      | Query transaction history            |
| `request_refund`    | Submit refund request                |
| `refund_requests`   | List pending refund requests         |
| `resolve_refund`    | Approve or cancel refund request     |
| `audit`             | Retrieve audit log                   |
| `stats`             | Dashboard statistics                 |

---

