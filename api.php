<?php
header('Content-Type: application/json');

$sessionPath = __DIR__ . DIRECTORY_SEPARATOR . 'sessions';
if (!is_dir($sessionPath)) {
    @mkdir($sessionPath, 0775, true);
}
if (is_dir($sessionPath) && is_writable($sessionPath)) {
    session_save_path($sessionPath);
}

$cookiePath = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/');
session_set_cookie_params([
    'lifetime' => 0,
    'path' => $cookiePath === '' ? '/' : $cookiePath . '/',
    'httponly' => true,
    'samesite' => 'Lax',
]);

if (session_status() !== PHP_SESSION_ACTIVE && !@session_start()) {
    echo json_encode([
        'ok' => false,
        'message' => 'Session could not start. Please check that the project folder is writable.',
    ]);
    exit;
}

require_once 'MySQLConnection.php';

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin123';

function respond(bool $ok, string $message = '', array $data = []): void
{
    echo json_encode(array_merge([
        'ok' => $ok,
        'message' => $message,
    ], $data));
    exit;
}

function value(string $key, ?string $default = ''): ?string
{
    if (!isset($_POST[$key])) {
        return $default;
    }

    $value = trim((string) $_POST[$key]);
    return $value === '' ? $default : $value;
}

function require_login(): void
{
    if (empty($_SESSION['uid'])) {
        respond(false, 'Please log in first.');
    }
}

function require_admin(): void
{
    require_login();

    if (($_SESSION['role'] ?? '') !== 'admin') {
        respond(false, 'Only admin accounts can manage accounts.');
    }
}

function require_staff_or_admin(): void
{
    require_login();
    $role = (string) ($_SESSION['role'] ?? '');
    if (!in_array($role, ['admin', 'staff'], true)) {
        respond(false, 'Only staff or admin accounts can manage this section.');
    }
}

function public_account(array $account): array
{
    $username = (string) ($account['username'] ?? '');
    $role     = (string) ($account['role'] ?? 'user');
    $fullName = isset($account['full_name']) && $account['full_name'] !== null
        ? (string) $account['full_name']
        : '';

    return [
        'uid'       => (int) $account['uid'],
        'username'  => $username,
        'role'      => $role,
        'full_name' => $fullName,
    ];
}

function remember_account(array $account): array
{
    $user = public_account($account);

    if (session_status() === PHP_SESSION_ACTIVE) {
        session_regenerate_id(true);
    }

    $_SESSION['uid']      = $user['uid'];
    $_SESSION['username'] = $user['username'];
    $_SESSION['role']     = $user['role'];

    return $user;
}

function valid_username(string $username): bool
{
    return (bool) preg_match('/^[A-Za-z0-9_]{3,50}$/', $username);
}

function ensure_accounts_table(mysqli $conn): void
{
    $conn->query(
        "CREATE TABLE IF NOT EXISTS accounts (
            uid int(11) NOT NULL AUTO_INCREMENT,
            username varchar(50) NOT NULL,
            password_hash varchar(255) NOT NULL,
            full_name varchar(100) DEFAULT NULL,
            email varchar(120) DEFAULT NULL,
            birthday date DEFAULT NULL,
            gender varchar(20) DEFAULT NULL,
            role varchar(20) NOT NULL DEFAULT 'user',
            status varchar(20) NOT NULL DEFAULT 'active',
            created_at timestamp NOT NULL DEFAULT current_timestamp(),
            updated_at timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
            PRIMARY KEY (uid),
            UNIQUE KEY username (username),
            UNIQUE KEY email (email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci"
    );

    $requiredColumns = [
        'password_hash' => "ALTER TABLE accounts ADD password_hash varchar(255) NOT NULL AFTER username",
        'full_name' => "ALTER TABLE accounts ADD full_name varchar(100) DEFAULT NULL AFTER password_hash",
        'email' => "ALTER TABLE accounts ADD email varchar(120) DEFAULT NULL AFTER full_name",
        'birthday' => "ALTER TABLE accounts ADD birthday date DEFAULT NULL AFTER email",
        'gender' => "ALTER TABLE accounts ADD gender varchar(20) DEFAULT NULL AFTER birthday",
        'role' => "ALTER TABLE accounts ADD role varchar(20) NOT NULL DEFAULT 'user' AFTER gender",
        'status' => "ALTER TABLE accounts ADD status varchar(20) NOT NULL DEFAULT 'active' AFTER role",
        'created_at' => "ALTER TABLE accounts ADD created_at timestamp NOT NULL DEFAULT current_timestamp() AFTER status",
        'updated_at' => "ALTER TABLE accounts ADD updated_at timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp() AFTER created_at",
    ];

    $schema = $conn->query('SELECT DATABASE()')->fetch_row()[0];
    foreach ($requiredColumns as $column => $sql) {
        $stmt = $conn->prepare(
            'SELECT COLUMN_NAME
             FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = "accounts" AND COLUMN_NAME = ?
             LIMIT 1'
        );
        $stmt->bind_param('ss', $schema, $column);
        $stmt->execute();
        if (!$stmt->get_result()->fetch_assoc()) {
            $conn->query($sql);
        }
    }

    /* Fix legacy rows where optional fields were stored as '' (breaks UNIQUE email, mysqli NULL binds). */
    $conn->query("UPDATE accounts SET email = NULL WHERE email = ''");
    $conn->query("UPDATE accounts SET full_name = NULL WHERE full_name = ''");
    $conn->query("UPDATE accounts SET gender = NULL WHERE gender = ''");

    /* Keep exactly one admin role in the activity: admin / admin123. */
    $stmt = $conn->prepare('SELECT uid, password_hash FROM accounts WHERE username = ? LIMIT 1');
    $adminUsername = ADMIN_USERNAME;
    $stmt->bind_param('s', $adminUsername);
    $stmt->execute();
    $admin = $stmt->get_result()->fetch_assoc();

    if (!$admin) {
        $adminPassword = password_hash(ADMIN_PASSWORD, PASSWORD_DEFAULT);
        $stmt = $conn->prepare(
            'INSERT INTO accounts (username, password_hash, full_name, email, role, status)
             VALUES (?, ?, "System Administrator", "admin@rbxgpm.local", "admin", "active")'
        );
        $stmt->bind_param('ss', $adminUsername, $adminPassword);
        $stmt->execute();
    } else {
        $adminUid = (int) $admin['uid'];
        $adminHash = (string) ($admin['password_hash'] ?? '');
        if (!password_verify(ADMIN_PASSWORD, $adminHash)) {
            $adminPassword = password_hash(ADMIN_PASSWORD, PASSWORD_DEFAULT);
            $stmt = $conn->prepare('UPDATE accounts SET username = ?, password_hash = ?, role = "admin", status = "active" WHERE uid = ?');
            $stmt->bind_param('ssi', $adminUsername, $adminPassword, $adminUid);
            $stmt->execute();
        } else {
            $stmt = $conn->prepare('UPDATE accounts SET username = ?, role = "admin", status = "active" WHERE uid = ?');
            $stmt->bind_param('si', $adminUsername, $adminUid);
            $stmt->execute();
        }
    }

    $stmt = $conn->prepare('UPDATE accounts SET role = "user" WHERE username <> ? AND role NOT IN ("user", "staff")');
    $stmt->bind_param('s', $adminUsername);
    $stmt->execute();
}

function ensure_system_audit_table(mysqli $conn): void
{
    $conn->query(
        "CREATE TABLE IF NOT EXISTS system_audit (
            id int(11) NOT NULL AUTO_INCREMENT,
            module varchar(30) NOT NULL,
            action varchar(30) NOT NULL,
            actor varchar(50) DEFAULT NULL,
            target varchar(120) DEFAULT NULL,
            details text DEFAULT NULL,
            created_at timestamp NOT NULL DEFAULT current_timestamp(),
            PRIMARY KEY (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci"
    );
}

function ensure_refund_requests_table(mysqli $conn): void
{
    $conn->query(
        "CREATE TABLE IF NOT EXISTS refund_requests (
            id int(11) NOT NULL AUTO_INCREMENT,
            pid int(11) NOT NULL,
            gpid int(11) NOT NULL,
            pname varchar(50) NOT NULL,
            gname varchar(80) NOT NULL,
            status varchar(20) NOT NULL DEFAULT 'pending',
            created_at timestamp NOT NULL DEFAULT current_timestamp(),
            resolved_at timestamp NULL DEFAULT NULL,
            resolved_by varchar(50) DEFAULT NULL,
            PRIMARY KEY (id),
            KEY pid (pid),
            KEY gpid (gpid),
            KEY status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci"
    );
}

function ensure_transactions_table(mysqli $conn): void
{
    $conn->query(
        "CREATE TABLE IF NOT EXISTS transactions (
            tid int(11) NOT NULL AUTO_INCREMENT,
            ttype varchar(20) NOT NULL,
            actor_uid int(11) NOT NULL,
            actor_username varchar(50) NOT NULL,
            actor_role varchar(20) NOT NULL DEFAULT 'user',
            pid int(11) DEFAULT NULL,
            pname varchar(50) DEFAULT NULL,
            gpid int(11) DEFAULT NULL,
            gname varchar(80) DEFAULT NULL,
            amount int(11) NOT NULL DEFAULT 0,
            notes varchar(255) DEFAULT NULL,
            status varchar(20) NOT NULL DEFAULT 'completed',
            created_at timestamp NOT NULL DEFAULT current_timestamp(),
            PRIMARY KEY (tid),
            KEY ttype (ttype),
            KEY actor_uid (actor_uid),
            KEY created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci"
    );
}

function record_transaction(
    mysqli $conn,
    string $ttype,
    int $pid,
    string $pname,
    int $gpid,
    string $gname,
    int $amount,
    ?string $notes = null,
    string $status = 'completed'
): int {
    $actorUid = (int) ($_SESSION['uid'] ?? 0);
    $actorUsername = (string) ($_SESSION['username'] ?? 'system');
    $actorRole = (string) ($_SESSION['role'] ?? 'user');

    $stmt = $conn->prepare(
        'INSERT INTO transactions
            (ttype, actor_uid, actor_username, actor_role, pid, pname, gpid, gname, amount, notes, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    /* s i s s  i s i s  i s s */
    $stmt->bind_param(
        'sissisisiss',
        $ttype,
        $actorUid,
        $actorUsername,
        $actorRole,
        $pid,
        $pname,
        $gpid,
        $gname,
        $amount,
        $notes,
        $status
    );
    $stmt->execute();
    return (int) $conn->insert_id;
}

function find_or_create_player_for_user(mysqli $conn, string $username): ?array
{
    $stmt = $conn->prepare('SELECT pid, uname, stat FROM players WHERE uname = ? LIMIT 1');
    $stmt->bind_param('s', $username);
    $stmt->execute();
    $player = $stmt->get_result()->fetch_assoc();
    if ($player) {
        return $player;
    }

    $joinDate = date('Y-m-d');
    $active = 'active';
    $nextPid = (int) $conn->query('SELECT COALESCE(MAX(pid), 0) + 1 FROM players')->fetch_row()[0];
    $stmt = $conn->prepare('INSERT INTO players (pid, uname, jdate, stat) VALUES (?, ?, ?, ?)');
    $stmt->bind_param('isss', $nextPid, $username, $joinDate, $active);
    $stmt->execute();

    $stmt = $conn->prepare('SELECT pid, uname, stat FROM players WHERE uname = ? LIMIT 1');
    $stmt->bind_param('s', $username);
    $stmt->execute();
    return $stmt->get_result()->fetch_assoc() ?: null;
}

function write_audit(mysqli $conn, string $module, string $action, ?string $target = null, ?string $details = null): void
{
    $actor = (string) ($_SESSION['username'] ?? 'system');
    $stmt = $conn->prepare(
        'INSERT INTO system_audit (module, action, actor, target, details) VALUES (?, ?, ?, ?, ?)'
    );
    $stmt->bind_param('sssss', $module, $action, $actor, $target, $details);
    $stmt->execute();
}

function find_or_create_benefit(mysqli $conn, string $benefitName): int
{
    $name = trim($benefitName);
    if ($name === '') {
        return 0;
    }

    $stmt = $conn->prepare('SELECT bid FROM benefit_types WHERE bname = ? LIMIT 1');
    $stmt->bind_param('s', $name);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    if ($row) {
        return (int) $row['bid'];
    }

    $code = strtoupper(preg_replace('/[^A-Za-z0-9]+/', '_', $name));
    $code = trim($code, '_');
    if ($code === '') {
        $code = 'BENEFIT_' . substr(md5($name . microtime(true)), 0, 8);
    }

    $baseCode = substr($code, 0, 40);
    $code = $baseCode;
    $i = 1;
    while (true) {
        $stmt = $conn->prepare('SELECT bid FROM benefit_types WHERE bcode = ? LIMIT 1');
        $stmt->bind_param('s', $code);
        $stmt->execute();
        if (!$stmt->get_result()->fetch_assoc()) {
            break;
        }
        $suffix = '_' . $i;
        $code = substr($baseCode, 0, max(1, 40 - strlen($suffix))) . $suffix;
        $i++;
    }

    $stmt = $conn->prepare('INSERT INTO benefit_types (bcode, bname, bdesc) VALUES (?, ?, ?)');
    $desc = $name;
    $stmt->bind_param('sss', $code, $name, $desc);
    $stmt->execute();

    return (int) $conn->insert_id;
}

function validate_account(array $data, bool $passwordRequired): void
{
    if (!valid_username($data['username'])) {
        respond(false, 'Username must be 3-50 characters and use letters, numbers, or underscores only.');
    }

    if ($data['email'] !== null && !filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
        respond(false, 'Please enter a valid email address.');
    }

    if ($data['birthday'] !== null) {
        $birthday = DateTime::createFromFormat('Y-m-d', $data['birthday']);
        $validBirthday = $birthday && $birthday->format('Y-m-d') === $data['birthday'];
        if (!$validBirthday) {
            respond(false, 'Please enter a valid birthday.');
        }
    }

    if ($passwordRequired || $data['password'] !== '' || $data['confirm_password'] !== '') {
        if (strlen($data['password']) < 8) {
            respond(false, 'Password must be at least 8 characters.');
        }

        if ($data['password'] !== $data['confirm_password']) {
            respond(false, 'Passwords do not match.');
        }
    }
}

function account_from_post(bool $forceUserRole = false, bool $forceActiveStatus = false): array
{
    $role = $forceUserRole ? 'user' : (value('role', 'user') ?? 'user');
    $status = $forceActiveStatus ? 'active' : (value('status', 'active') ?? 'active');

    return [
        'username' => value('username', '') ?? '',
        'password' => (string) ($_POST['password'] ?? ''),
        'confirm_password' => (string) ($_POST['confirm_password'] ?? ''),
        'full_name' => value('full_name', null),
        'email' => value('email', null),
        'birthday' => value('birthday', null),
        'gender' => value('gender', null),
        'role' => in_array($role, ['admin', 'staff', 'user'], true) ? $role : 'user',
        'status' => in_array($status, ['active', 'inactive'], true) ? $status : 'active',
    ];
}

function null_or_string(?string $v): ?string
{
    if ($v === null || $v === '') return null;
    return $v;
}

function find_account_by_username(mysqli $conn, string $username): ?array
{
    $stmt = $conn->prepare(
        'SELECT uid, username, full_name, email, birthday, gender, role, status, created_at
         FROM accounts
         WHERE username = ?
         LIMIT 1'
    );
    $stmt->bind_param('s', $username);
    $stmt->execute();
    $account = $stmt->get_result()->fetch_assoc();

    return $account ?: null;
}

function create_account(mysqli $conn, array $data): array
{
    $username     = $data['username'];
    $passwordHash = password_hash($data['password'], PASSWORD_DEFAULT);
    /* Bind optional columns as empty string + NULLIF so SQL stores real NULL (avoids duplicate '' on UNIQUE email). */
    $fullName = null_or_string($data['full_name']) ?? '';
    $email    = null_or_string($data['email']) ?? '';
    $birthday = null_or_string($data['birthday']) ?? '';
    $gender   = null_or_string($data['gender']) ?? '';
    $role     = $data['role'];
    $status   = $data['status'];

    $stmt = $conn->prepare(
        'INSERT INTO accounts (username, password_hash, full_name, email, birthday, gender, role, status)
         VALUES (?, ?, NULLIF(?, \'\'), NULLIF(?, \'\'), NULLIF(?, \'\'), NULLIF(?, \'\'), ?, ?)'
    );
    $stmt->bind_param('ssssssss', $username, $passwordHash, $fullName, $email, $birthday, $gender, $role, $status);
    $stmt->execute();

    $account = find_account_by_username($conn, $username);
    if (!$account) {
        throw new RuntimeException('Account could not be verified after saving. Please try again.');
    }

    return $account;
}

try {
    $mysql = new MySQLConnection();
    $conn = $mysql->getConnection();
    ensure_accounts_table($conn);
    ensure_system_audit_table($conn);
    ensure_transactions_table($conn);
    ensure_refund_requests_table($conn);
} catch (Throwable $e) {
    respond(false, 'Database error: ' . $e->getMessage());
}

$action = $_POST['action'] ?? $_GET['action'] ?? '';

try {
    if ($action === 'session') {
        $user = null;
        $loggedIn = !empty($_SESSION['uid']);

        if ($loggedIn) {
            $uid = (int) $_SESSION['uid'];
            $stmt = $conn->prepare('SELECT uid, username, full_name, role, status FROM accounts WHERE uid = ? LIMIT 1');
            $stmt->bind_param('i', $uid);
            $stmt->execute();
            $account = $stmt->get_result()->fetch_assoc();

            if (!$account || $account['status'] !== 'active') {
                $_SESSION = [];
                session_destroy();
                $loggedIn = false;
            } else {
                $user = public_account($account);
                $_SESSION['uid'] = $user['uid'];
                $_SESSION['username'] = $user['username'];
                $_SESSION['role'] = $user['role'];
            }
        }

        respond(true, '', [
            'logged_in' => $loggedIn,
            'user' => $user,
        ]);
    }

    if ($action === 'login') {
        $username = value('username', '') ?? '';
        $password = (string) ($_POST['password'] ?? '');

        $stmt = $conn->prepare('SELECT * FROM accounts WHERE username = ? LIMIT 1');
        $stmt->bind_param('s', $username);
        $stmt->execute();
        $account = $stmt->get_result()->fetch_assoc();

        if (!$account || !password_verify($password, $account['password_hash'])) {
            respond(false, 'Invalid username or password.');
        }

        if ($account['status'] !== 'active') {
            respond(false, 'This account is inactive.');
        }

        $user = remember_account($account);

        respond(true, 'Login successful.', [
            'user' => $user,
        ]);
    }

    if ($action === 'logout') {
        $_SESSION = [];
        session_destroy();
        respond(true, 'Logged out.');
    }

    if ($action === 'signup') {
        $data = account_from_post(true, true);
        validate_account($data, true);
        $account = create_account($conn, $data);
        $user = remember_account($account);
        respond(true, 'Account created. You are now logged in.', [
            'account' => $account,
            'user'    => $user,
        ]);
    }

    if ($action === 'recover') {
        $username = value('username', '') ?? '';
        $password = (string) ($_POST['password'] ?? '');
        $confirmPassword = (string) ($_POST['confirm_password'] ?? '');

        if ($username === '') {
            respond(false, 'Please enter your username.');
        }
        if (strlen($password) < 8) {
            respond(false, 'New password must be at least 8 characters.');
        }
        if ($password !== $confirmPassword) {
            respond(false, 'Passwords do not match.');
        }

        $passwordHash = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $conn->prepare('UPDATE accounts SET password_hash = ? WHERE username = ?');
        $stmt->bind_param('ss', $passwordHash, $username);
        $stmt->execute();

        if ($stmt->affected_rows < 1) {
            respond(false, 'No account found with that username.');
        }

        respond(true, 'Password updated. Please log in.');
    }

    require_login();

    if ($action === 'accounts') {
        require_admin();
        $search = value('search', '') ?? '';

        if ($search !== '') {
            $like = '%' . $search . '%';
            $stmt = $conn->prepare(
                'SELECT uid, username, full_name, email, birthday, gender, role, status, created_at
                 FROM accounts
                 WHERE username LIKE ? OR full_name LIKE ? OR email LIKE ? OR role LIKE ? OR status LIKE ?
                 ORDER BY uid DESC'
            );
            $stmt->bind_param('sssss', $like, $like, $like, $like, $like);
            $stmt->execute();
            $accounts = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        } else {
            $accounts = $conn->query(
                'SELECT uid, username, full_name, email, birthday, gender, role, status, created_at
                 FROM accounts
                 ORDER BY uid DESC'
            )->fetch_all(MYSQLI_ASSOC);
        }

        respond(true, '', ['accounts' => $accounts]);
    }

    if ($action === 'add_account') {
        require_admin();
        $data = account_from_post();
        if ($data['role'] === 'admin') {
            $data['role'] = 'user';
        }
        validate_account($data, true);
        $account = create_account($conn, $data);
        write_audit(
            $conn,
            'accounts',
            'ADD',
            $account['username'],
            'Created account with role ' . $account['role'] . '.'
        );
        respond(true, 'Account added and saved to the database.', [
            'account' => $account,
        ]);
    }

    if ($action === 'update_account') {
        require_admin();
        $uid = (int) ($_POST['uid'] ?? 0);
        $data = account_from_post();
        validate_account($data, false);

        if ($uid < 1) {
            respond(false, 'Invalid account selected.');
        }

        $stmt = $conn->prepare('SELECT username FROM accounts WHERE uid = ? LIMIT 1');
        $stmt->bind_param('i', $uid);
        $stmt->execute();
        $existingAccount = $stmt->get_result()->fetch_assoc();

        if (!$existingAccount) {
            respond(false, 'Account not found.');
        }

        $isMainAdmin = $existingAccount['username'] === ADMIN_USERNAME;

        if (!$isMainAdmin && strtolower($data['username']) === ADMIN_USERNAME) {
            respond(false, 'The admin username is reserved.');
        }

        if ($isMainAdmin) {
            $data['username'] = ADMIN_USERNAME;
            $data['role'] = 'admin';
            $data['status'] = 'active';
        } elseif ($data['role'] === 'admin') {
            $data['role'] = 'user';
        }

        if ($uid === (int) $_SESSION['uid'] && $data['status'] === 'inactive') {
            respond(false, 'You cannot make your own account inactive.');
        }

        $username = $data['username'];
        $fullName = null_or_string($data['full_name']) ?? '';
        $email    = null_or_string($data['email']) ?? '';
        $birthday = null_or_string($data['birthday']) ?? '';
        $gender   = null_or_string($data['gender']) ?? '';
        $role     = $data['role'];
        $status   = $data['status'];

        if ($data['password'] !== '') {
            $passwordHash = password_hash($data['password'], PASSWORD_DEFAULT);
            $stmt = $conn->prepare(
                'UPDATE accounts
                 SET username = ?, password_hash = ?, full_name = NULLIF(?, \'\'), email = NULLIF(?, \'\'),
                     birthday = NULLIF(?, \'\'), gender = NULLIF(?, \'\'), role = ?, status = ?
                 WHERE uid = ?'
            );
            $stmt->bind_param('ssssssssi', $username, $passwordHash, $fullName, $email, $birthday, $gender, $role, $status, $uid);
        } else {
            $stmt = $conn->prepare(
                'UPDATE accounts
                 SET username = ?, full_name = NULLIF(?, \'\'), email = NULLIF(?, \'\'),
                     birthday = NULLIF(?, \'\'), gender = NULLIF(?, \'\'), role = ?, status = ?
                 WHERE uid = ?'
            );
            $stmt->bind_param('sssssssi', $username, $fullName, $email, $birthday, $gender, $role, $status, $uid);
        }

        $stmt->execute();
        write_audit(
            $conn,
            'accounts',
            'UPDATE',
            $username,
            'Updated account profile, role, status, or password.'
        );
        respond(true, 'Account updated successfully.');
    }

    if ($action === 'set_status') {
        require_admin();
        $uid = (int) ($_POST['uid'] ?? 0);
        $status = value('status', 'inactive') === 'active' ? 'active' : 'inactive';

        if ($uid === (int) $_SESSION['uid'] && $status === 'inactive') {
            respond(false, 'You cannot make your own account inactive.');
        }

        $stmt = $conn->prepare('SELECT username FROM accounts WHERE uid = ? LIMIT 1');
        $stmt->bind_param('i', $uid);
        $stmt->execute();
        $existingAccount = $stmt->get_result()->fetch_assoc();

        if (!$existingAccount) {
            respond(false, 'Account not found.');
        }

        if ($existingAccount['username'] === ADMIN_USERNAME && $status === 'inactive') {
            respond(false, 'The main admin account must stay active.');
        }

        $stmt = $conn->prepare('UPDATE accounts SET status = ? WHERE uid = ?');
        $stmt->bind_param('si', $status, $uid);
        $stmt->execute();
        write_audit(
            $conn,
            'accounts',
            'STATUS',
            $existingAccount['username'],
            'Set account status to ' . $status . '.'
        );
        respond(true, 'Account status updated.');
    }

    if ($action === 'delete_account') {
        require_admin();
        $uid = (int) ($_POST['uid'] ?? 0);

        if ($uid === (int) $_SESSION['uid']) {
            respond(false, 'You cannot delete your own account.');
        }

        $stmt = $conn->prepare('SELECT username FROM accounts WHERE uid = ? LIMIT 1');
        $stmt->bind_param('i', $uid);
        $stmt->execute();
        $existingAccount = $stmt->get_result()->fetch_assoc();

        if (!$existingAccount) {
            respond(false, 'Account not found.');
        }

        if ($existingAccount['username'] === ADMIN_USERNAME) {
            respond(false, 'The main admin account cannot be deleted.');
        }

        $deletedUsername = (string) $existingAccount['username'];
        $stmt = $conn->prepare('DELETE FROM accounts WHERE uid = ?');
        $stmt->bind_param('i', $uid);
        $stmt->execute();

        if ($stmt->affected_rows < 1) {
            respond(false, 'Account not found.');
        }

        write_audit(
            $conn,
            'accounts',
            'DELETE',
            $deletedUsername,
            'Deleted user account from dashboard.'
        );
        respond(true, 'Account deleted successfully.');
    }

    /* ── DB-backed data endpoints ── */

    if ($action === 'players') {
        $search = value('search', '') ?? '';
        $baseSQL = "SELECT p.pid, p.uname, p.jdate, p.stat,
                           COALESCE(pc.owned_gamepasses, 0) AS pass_count
                    FROM players p
                    LEFT JOIN vw_player_pass_count pc ON pc.pid = p.pid";
        if ($search !== '') {
            $like = '%' . $search . '%';
            $stmt = $conn->prepare($baseSQL . ' WHERE p.uname LIKE ? OR p.stat LIKE ? ORDER BY p.pid ASC');
            $stmt->bind_param('ss', $like, $like);
            $stmt->execute();
            $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        } else {
            $rows = $conn->query($baseSQL . ' ORDER BY p.pid ASC')->fetch_all(MYSQLI_ASSOC);
        }
        respond(true, '', ['players' => $rows]);
    }

    if ($action === 'toggle_player_status') {
        require_staff_or_admin();
        $pid    = (int) ($_POST['pid']    ?? 0);
        $status = value('stat', 'active') === 'active' ? 'active' : 'banned';
        $stmt = $conn->prepare('SELECT uname FROM players WHERE pid = ? LIMIT 1');
        $stmt->bind_param('i', $pid);
        $stmt->execute();
        $player = $stmt->get_result()->fetch_assoc();
        if (!$player) {
            respond(false, 'Player not found.');
        }
        $stmt   = $conn->prepare('UPDATE players SET stat = ? WHERE pid = ?');
        $stmt->bind_param('si', $status, $pid);
        $stmt->execute();
        write_audit(
            $conn,
            'players',
            'STATUS',
            $player['uname'],
            'Set player status to ' . $status . '.'
        );
        respond(true, 'Player status updated.');
    }

    if ($action === 'add_player') {
        require_staff_or_admin();
        $uname = value('uname', '') ?? '';
        $jdate = value('jdate', date('Y-m-d')) ?? date('Y-m-d');
        $stat  = value('stat',  'active') === 'banned' ? 'banned' : 'active';
        if ($uname === '') respond(false, 'Username is required.');
        $nextPid = (int) $conn->query('SELECT COALESCE(MAX(pid), 0) + 1 FROM players')->fetch_row()[0];
        $stmt = $conn->prepare('INSERT INTO players (pid, uname, jdate, stat) VALUES (?, ?, ?, ?)');
        $stmt->bind_param('isss', $nextPid, $uname, $jdate, $stat);
        $stmt->execute();
        write_audit(
            $conn,
            'players',
            'ADD',
            $uname,
            'Added player with status ' . $stat . '.'
        );
        respond(true, 'Player added successfully.');
    }

    if ($action === 'add_gamepass') {
        require_staff_or_admin();
        $name = value('gname', '') ?? '';
        $descr = value('descr', null);
        $price = max(0, (int) ($_POST['price'] ?? 0));
        $sale = (int) ($_POST['sale'] ?? 0) === 1 ? 1 : 0;
        $benefit = value('benefit', null);

        if ($name === '') {
            respond(false, 'Pass name is required.');
        }

        $nextId = (int) $conn->query('SELECT COALESCE(MAX(gpid), 0) + 1 FROM gamepasses')->fetch_row()[0];
        $stmt = $conn->prepare('INSERT INTO gamepasses (gpid, gname, descr, price, sale) VALUES (?, ?, ?, ?, ?)');
        $stmt->bind_param('issii', $nextId, $name, $descr, $price, $sale);
        $stmt->execute();

        $benefitName = trim((string) ($benefit ?? ''));
        if ($benefitName !== '') {
            $bid = find_or_create_benefit($conn, $benefitName);
            if ($bid > 0) {
                $stmt = $conn->prepare('INSERT INTO gamepass_benefits (gpid, bid, val) VALUES (?, ?, ?)');
                $stmt->bind_param('iis', $nextId, $bid, $benefitName);
                $stmt->execute();
            }
        }

        write_audit(
            $conn,
            'gamepasses',
            'ADD',
            $name,
            'Added pass (price=' . $price . ', sale=' . $sale . ').'
        );
        respond(true, 'Game pass added to catalog.');
    }

    if ($action === 'update_gamepass') {
        require_staff_or_admin();
        $gpid = (int) ($_POST['gpid'] ?? 0);
        $name = value('gname', '') ?? '';
        $descr = value('descr', null);
        $price = max(0, (int) ($_POST['price'] ?? 0));
        $sale = (int) ($_POST['sale'] ?? 0) === 1 ? 1 : 0;
        $benefit = value('benefit', null);

        if ($gpid < 1) {
            respond(false, 'Invalid pass selected.');
        }
        if ($name === '') {
            respond(false, 'Pass name is required.');
        }

        $stmt = $conn->prepare('SELECT gname FROM gamepasses WHERE gpid = ? LIMIT 1');
        $stmt->bind_param('i', $gpid);
        $stmt->execute();
        $existingPass = $stmt->get_result()->fetch_assoc();
        if (!$existingPass) {
            respond(false, 'Game pass not found.');
        }

        $stmt = $conn->prepare('UPDATE gamepasses SET gname = ?, descr = ?, price = ?, sale = ? WHERE gpid = ?');
        $stmt->bind_param('ssiii', $name, $descr, $price, $sale, $gpid);
        $stmt->execute();

        $stmt = $conn->prepare('DELETE FROM gamepass_benefits WHERE gpid = ?');
        $stmt->bind_param('i', $gpid);
        $stmt->execute();

        $benefitName = trim((string) ($benefit ?? ''));
        if ($benefitName !== '') {
            $bid = find_or_create_benefit($conn, $benefitName);
            if ($bid > 0) {
                $stmt = $conn->prepare('INSERT INTO gamepass_benefits (gpid, bid, val) VALUES (?, ?, ?)');
                $stmt->bind_param('iis', $gpid, $bid, $benefitName);
                $stmt->execute();
            }
        }

        write_audit(
            $conn,
            'gamepasses',
            'UPDATE',
            $name,
            'Updated pass catalog information.'
        );
        respond(true, 'Game pass updated.');
    }

    if ($action === 'delete_gamepass') {
        require_staff_or_admin();
        $gpid = (int) ($_POST['gpid'] ?? 0);
        if ($gpid < 1) {
            respond(false, 'Invalid pass selected.');
        }

        $stmt = $conn->prepare('SELECT gname FROM gamepasses WHERE gpid = ? LIMIT 1');
        $stmt->bind_param('i', $gpid);
        $stmt->execute();
        $existingPass = $stmt->get_result()->fetch_assoc();
        if (!$existingPass) {
            respond(false, 'Game pass not found.');
        }

        $stmt = $conn->prepare('DELETE FROM gamepass_benefits WHERE gpid = ?');
        $stmt->bind_param('i', $gpid);
        $stmt->execute();

        $stmt = $conn->prepare('DELETE FROM player_gamepasses WHERE gpid = ?');
        $stmt->bind_param('i', $gpid);
        $stmt->execute();

        $stmt = $conn->prepare('DELETE FROM gamepasses WHERE gpid = ?');
        $stmt->bind_param('i', $gpid);
        $stmt->execute();
        if ($stmt->affected_rows < 1) {
            respond(false, 'Game pass not found.');
        }

        write_audit(
            $conn,
            'gamepasses',
            'DELETE',
            $existingPass['gname'],
            'Deleted pass from catalog.'
        );
        respond(true, 'Game pass deleted.');
    }

    if ($action === 'buy_gamepass') {
        require_login();
        $gpid = (int) ($_POST['gpid'] ?? 0);
        if ($gpid < 1) {
            respond(false, 'Invalid game pass selected.');
        }

        $stmt = $conn->prepare('SELECT gpid, gname, price, sale FROM gamepasses WHERE gpid = ? LIMIT 1');
        $stmt->bind_param('i', $gpid);
        $stmt->execute();
        $gamepass = $stmt->get_result()->fetch_assoc();
        if (!$gamepass) {
            respond(false, 'Game pass not found.');
        }
        if ((int) $gamepass['sale'] !== 1) {
            respond(false, 'This game pass is currently off sale.');
        }

        $username = (string) ($_SESSION['username'] ?? '');
        if ($username === '') {
            respond(false, 'Please log in first.');
        }

        $player = find_or_create_player_for_user($conn, $username);
        if (!$player) {
            respond(false, 'Unable to create a player profile for this account.');
        }

        $playerId = (int) $player['pid'];
        if (($player['stat'] ?? 'active') !== 'active') {
            respond(false, 'Your player profile is inactive/banned and cannot buy passes.');
        }

        $stmt = $conn->prepare('SELECT act FROM player_gamepasses WHERE pid = ? AND gpid = ? LIMIT 1');
        $stmt->bind_param('ii', $playerId, $gpid);
        $stmt->execute();
        $owned = $stmt->get_result()->fetch_assoc();

        if ($owned && (int) $owned['act'] === 1) {
            respond(false, 'You already own this game pass.');
        }

        if ($owned) {
            $src = 'purchase';
            $active = 1;
            $stmt = $conn->prepare('UPDATE player_gamepasses SET src = ?, act = ? WHERE pid = ? AND gpid = ?');
            $stmt->bind_param('siii', $src, $active, $playerId, $gpid);
            $stmt->execute();
        } else {
            $src = 'purchase';
            $active = 1;
            $stmt = $conn->prepare('INSERT INTO player_gamepasses (pid, gpid, src, act) VALUES (?, ?, ?, ?)');
            $stmt->bind_param('iisi', $playerId, $gpid, $src, $active);
            $stmt->execute();
        }

        $amount = (int) $gamepass['price'];
        $tid = record_transaction(
            $conn,
            'purchase',
            $playerId,
            (string) $player['uname'],
            $gpid,
            (string) $gamepass['gname'],
            $amount,
            'Self-purchase from catalog.'
        );

        respond(true, 'Purchase successful! You now own "' . $gamepass['gname'] . '".', [
            'tid' => $tid,
        ]);
    }

    /* ── Three primary transactions ── */

    if ($action === 'tx_purchase') {
        require_login();
        $gpid = (int) ($_POST['gpid'] ?? 0);
        $pid = (int) ($_POST['pid'] ?? 0);
        $notes = value('notes', null);
        if ($gpid < 1) {
            respond(false, 'Please choose a game pass to purchase.');
        }

        $stmt = $conn->prepare('SELECT gpid, gname, price, sale FROM gamepasses WHERE gpid = ? LIMIT 1');
        $stmt->bind_param('i', $gpid);
        $stmt->execute();
        $gamepass = $stmt->get_result()->fetch_assoc();
        if (!$gamepass) {
            respond(false, 'Game pass not found.');
        }
        if ((int) $gamepass['sale'] !== 1) {
            respond(false, 'This game pass is currently off sale.');
        }

        $role = (string) ($_SESSION['role'] ?? '');
        $sessionUsername = (string) ($_SESSION['username'] ?? '');

        if (in_array($role, ['admin', 'staff'], true)) {
            if ($pid < 1) {
                respond(false, 'Please pick the player making the purchase.');
            }
            $stmt = $conn->prepare('SELECT pid, uname, stat FROM players WHERE pid = ? LIMIT 1');
            $stmt->bind_param('i', $pid);
            $stmt->execute();
            $player = $stmt->get_result()->fetch_assoc();
        } else {
            $player = find_or_create_player_for_user($conn, $sessionUsername);
        }

        if (!$player) {
            respond(false, 'Player profile not found.');
        }
        if (($player['stat'] ?? 'active') !== 'active') {
            respond(false, 'That player is banned and cannot purchase passes.');
        }

        $playerId = (int) $player['pid'];

        $stmt = $conn->prepare('SELECT act FROM player_gamepasses WHERE pid = ? AND gpid = ? LIMIT 1');
        $stmt->bind_param('ii', $playerId, $gpid);
        $stmt->execute();
        $owned = $stmt->get_result()->fetch_assoc();

        if ($owned && (int) $owned['act'] === 1) {
            respond(false, $player['uname'] . ' already owns "' . $gamepass['gname'] . '".');
        }

        $src = 'purchase';
        $active = 1;
        if ($owned) {
            $stmt = $conn->prepare('UPDATE player_gamepasses SET src = ?, act = ? WHERE pid = ? AND gpid = ?');
            $stmt->bind_param('siii', $src, $active, $playerId, $gpid);
        } else {
            $stmt = $conn->prepare('INSERT INTO player_gamepasses (pid, gpid, src, act) VALUES (?, ?, ?, ?)');
            $stmt->bind_param('iisi', $playerId, $gpid, $src, $active);
        }
        $stmt->execute();

        $tid = record_transaction(
            $conn,
            'purchase',
            $playerId,
            (string) $player['uname'],
            $gpid,
            (string) $gamepass['gname'],
            (int) $gamepass['price'],
            $notes
        );

        respond(true, 'Purchase recorded for "' . $gamepass['gname'] . '".', ['tid' => $tid]);
    }

    if ($action === 'tx_gift') {
        require_staff_or_admin();
        $gpid = (int) ($_POST['gpid'] ?? 0);
        $pid = (int) ($_POST['pid'] ?? 0);
        $notes = value('notes', null);

        if ($gpid < 1) {
            respond(false, 'Please choose a game pass to gift.');
        }
        if ($pid < 1) {
            respond(false, 'Please choose the receiving player.');
        }

        $stmt = $conn->prepare('SELECT gpid, gname, price FROM gamepasses WHERE gpid = ? LIMIT 1');
        $stmt->bind_param('i', $gpid);
        $stmt->execute();
        $gamepass = $stmt->get_result()->fetch_assoc();
        if (!$gamepass) {
            respond(false, 'Game pass not found.');
        }

        $stmt = $conn->prepare('SELECT pid, uname, stat FROM players WHERE pid = ? LIMIT 1');
        $stmt->bind_param('i', $pid);
        $stmt->execute();
        $player = $stmt->get_result()->fetch_assoc();
        if (!$player) {
            respond(false, 'Player not found.');
        }
        if (($player['stat'] ?? 'active') !== 'active') {
            respond(false, 'That player is banned and cannot receive gifts.');
        }

        $stmt = $conn->prepare('SELECT act FROM player_gamepasses WHERE pid = ? AND gpid = ? LIMIT 1');
        $stmt->bind_param('ii', $pid, $gpid);
        $stmt->execute();
        $owned = $stmt->get_result()->fetch_assoc();

        if ($owned && (int) $owned['act'] === 1) {
            respond(false, $player['uname'] . ' already owns "' . $gamepass['gname'] . '".');
        }

        $src = 'gift';
        $active = 1;
        if ($owned) {
            $stmt = $conn->prepare('UPDATE player_gamepasses SET src = ?, act = ? WHERE pid = ? AND gpid = ?');
            $stmt->bind_param('siii', $src, $active, $pid, $gpid);
        } else {
            $stmt = $conn->prepare('INSERT INTO player_gamepasses (pid, gpid, src, act) VALUES (?, ?, ?, ?)');
            $stmt->bind_param('iisi', $pid, $gpid, $src, $active);
        }
        $stmt->execute();

        $tid = record_transaction(
            $conn,
            'gift',
            $pid,
            (string) $player['uname'],
            $gpid,
            (string) $gamepass['gname'],
            0,
            $notes ?: 'Complimentary gift from ' . ($_SESSION['username'] ?? 'staff') . '.'
        );

        respond(true, 'Gifted "' . $gamepass['gname'] . '" to ' . $player['uname'] . '.', ['tid' => $tid]);
    }

    if ($action === 'tx_refund') {
        require_staff_or_admin();
        $gpid = (int) ($_POST['gpid'] ?? 0);
        $pid = (int) ($_POST['pid'] ?? 0);
        $notes = value('notes', null);

        if ($gpid < 1 || $pid < 1) {
            respond(false, 'Please pick both the player and the game pass to refund.');
        }

        $stmt = $conn->prepare(
            'SELECT pg.act, p.uname, g.gname, g.price
             FROM player_gamepasses pg
             JOIN players p ON p.pid = pg.pid
             JOIN gamepasses g ON g.gpid = pg.gpid
             WHERE pg.pid = ? AND pg.gpid = ? LIMIT 1'
        );
        $stmt->bind_param('ii', $pid, $gpid);
        $stmt->execute();
        $owned = $stmt->get_result()->fetch_assoc();

        if (!$owned) {
            respond(false, 'No ownership record found for that player and pass.');
        }
        if ((int) $owned['act'] !== 1) {
            respond(false, 'This pass is already inactive for that player.');
        }

        $active = 0;
        $stmt = $conn->prepare('UPDATE player_gamepasses SET act = ? WHERE pid = ? AND gpid = ?');
        $stmt->bind_param('iii', $active, $pid, $gpid);
        $stmt->execute();

        $tid = record_transaction(
            $conn,
            'refund',
            $pid,
            (string) $owned['uname'],
            $gpid,
            (string) $owned['gname'],
            -1 * (int) $owned['price'],
            $notes ?: 'Refund issued by ' . ($_SESSION['username'] ?? 'staff') . '.'
        );

        respond(true, 'Refund completed for "' . $owned['gname'] . '".', ['tid' => $tid]);
    }

    if ($action === 'tx_list') {
        require_login();
        $type = value('ttype', '') ?? '';
        $from = value('date_from', '') ?? '';
        $to = value('date_to', '') ?? '';

        $sql = 'SELECT tid, ttype, actor_uid, actor_username, actor_role,
                       pid, pname, gpid, gname, amount, notes, status, created_at
                FROM transactions WHERE 1=1';
        $params = [];
        $types = '';

        if ($type !== '' && in_array($type, ['purchase', 'gift', 'refund'], true)) {
            $sql .= ' AND ttype = ?';
            $params[] = $type;
            $types .= 's';
        }
        if ($from !== '') {
            $sql .= ' AND DATE(created_at) >= ?';
            $params[] = $from;
            $types .= 's';
        }
        if ($to !== '') {
            $sql .= ' AND DATE(created_at) <= ?';
            $params[] = $to;
            $types .= 's';
        }

        /* Non-privileged users see their own purchases (actor_uid) and
           transactions targeting their player profile (refunds/gifts by staff). */
        $role = (string) ($_SESSION['role'] ?? '');
        if (!in_array($role, ['admin', 'staff'], true)) {
            $uid      = (int) ($_SESSION['uid'] ?? 0);
            $username = (string) ($_SESSION['username'] ?? '');
            $sql .= ' AND (actor_uid = ? OR pid = (SELECT pid FROM players WHERE uname = ? LIMIT 1))';
            $params[] = $uid;
            $params[] = $username;
            $types .= 'is';
        }

        $sql .= ' ORDER BY created_at DESC, tid DESC';

        $stmt = $conn->prepare($sql);
        if ($types !== '') {
            $stmt->bind_param($types, ...$params);
        }
        $stmt->execute();
        $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

        respond(true, '', ['transactions' => $rows]);
    }

    if ($action === 'gamepasses') {
        $search = value('search', '') ?? '';
        if ($search !== '') {
            $like = '%' . $search . '%';
            $stmt = $conn->prepare(
                "SELECT g.gpid, g.gname, g.descr, g.price, g.sale,
                        COALESCE(bt.bname, '') AS benefit
                 FROM gamepasses g
                 LEFT JOIN gamepass_benefits gb ON gb.gpid = g.gpid
                 LEFT JOIN benefit_types bt      ON bt.bid  = gb.bid
                 WHERE g.gname LIKE ? OR g.descr LIKE ? OR bt.bname LIKE ?
                 ORDER BY g.gpid ASC"
            );
            $stmt->bind_param('sss', $like, $like, $like);
            $stmt->execute();
            $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        } else {
            $rows = $conn->query(
                "SELECT g.gpid, g.gname, g.descr, g.price, g.sale,
                        COALESCE(bt.bname, '') AS benefit
                 FROM gamepasses g
                 LEFT JOIN gamepass_benefits gb ON gb.gpid = g.gpid
                 LEFT JOIN benefit_types bt      ON bt.bid  = gb.bid
                 ORDER BY g.gpid ASC"
            )->fetch_all(MYSQLI_ASSOC);
        }
        respond(true, '', ['gamepasses' => $rows]);
    }

    if ($action === 'transactions') {
        $role = (string) ($_SESSION['role'] ?? '');
        if ($role === 'user') {
            $username = (string) ($_SESSION['username'] ?? '');
            $stmt = $conn->prepare(
                'SELECT p.uname, g.gname, g.gpid, pg.src, pg.act
                 FROM player_gamepasses pg
                 JOIN players   p ON p.pid  = pg.pid
                 JOIN gamepasses g ON g.gpid = pg.gpid
                 WHERE p.uname = ?
                 ORDER BY pg.atime DESC'
            );
            $stmt->bind_param('s', $username);
            $stmt->execute();
            $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        } else {
            $rows = $conn->query(
                'SELECT p.uname, g.gname, g.gpid, pg.src, pg.act
                 FROM player_gamepasses pg
                 JOIN players   p ON p.pid  = pg.pid
                 JOIN gamepasses g ON g.gpid = pg.gpid
                 ORDER BY pg.atime DESC'
            )->fetch_all(MYSQLI_ASSOC);
        }
        respond(true, '', ['transactions' => $rows]);
    }

    if ($action === 'audit') {
        $rows = $conn->query(
            "SELECT CONCAT('PGP-', a.audit_id) AS id,
                    'player_gamepass' AS module,
                    a.action_type AS action,
                    'trigger' AS actor,
                    CONCAT(p.uname, ' / ', g.gname) AS target,
                    CASE
                        WHEN a.action_type = 'INSERT' THEN CONCAT('Purchased game pass via ', COALESCE(a.new_src, 'purchase'), '.')
                        WHEN a.action_type = 'UPDATE' THEN
                            CASE
                                WHEN COALESCE(a.old_act, 0) = 0 AND COALESCE(a.new_act, 0) = 1 THEN 'Re-activated game pass ownership.'
                                WHEN COALESCE(a.old_act, 0) = 1 AND COALESCE(a.new_act, 0) = 0 THEN 'Deactivated game pass ownership.'
                                ELSE CONCAT('Updated game pass ownership (source: ', COALESCE(a.new_src, '-'), ').')
                            END
                        WHEN a.action_type = 'DELETE' THEN 'Removed game pass ownership record.'
                        ELSE 'Updated game pass record.'
                    END AS details,
                    a.action_time AS ts
             FROM player_gamepasses_audit a
             JOIN players p ON p.pid = a.pid
             JOIN gamepasses g ON g.gpid = a.gpid
             UNION ALL
             SELECT CONCAT('SYS-', s.id) AS id,
                    s.module,
                    s.action,
                    COALESCE(s.actor, 'system') AS actor,
                    COALESCE(s.target, '-') AS target,
                    COALESCE(s.details, '-') AS details,
                    s.created_at AS ts
             FROM system_audit s
             ORDER BY ts DESC"
        )->fetch_all(MYSQLI_ASSOC);
        respond(true, '', ['audit' => $rows]);
    }

    if ($action === 'stats') {
        $total   = (int) $conn->query('SELECT COUNT(*) FROM players')->fetch_row()[0];
        $active  = (int) $conn->query("SELECT COUNT(*) FROM players WHERE stat = 'active'")->fetch_row()[0];
        $banned  = (int) $conn->query("SELECT COUNT(*) FROM players WHERE stat = 'banned'")->fetch_row()[0];
        $passes  = (int) $conn->query('SELECT COUNT(*) FROM gamepasses')->fetch_row()[0];
        $onsale  = (int) $conn->query('SELECT COUNT(*) FROM gamepasses WHERE sale = 1')->fetch_row()[0];
        $revenue = (int) $conn->query(
            "SELECT COALESCE(SUM(g.price),0)
             FROM player_gamepasses pg
             JOIN gamepasses g ON g.gpid = pg.gpid
             WHERE pg.src = 'purchase' AND pg.act = 1"
        )->fetch_row()[0];
        respond(true, '', [
            'stats' => compact('total','active','banned','passes','onsale','revenue')
        ]);
    }

    if ($action === 'request_refund') {
        require_login();
        $gpid = (int) ($_POST['gpid'] ?? 0);
        if ($gpid < 1) respond(false, 'Invalid game pass.');

        $username = (string) ($_SESSION['username'] ?? '');
        $stmt = $conn->prepare('SELECT pid, uname FROM players WHERE uname = ? LIMIT 1');
        $stmt->bind_param('s', $username);
        $stmt->execute();
        $player = $stmt->get_result()->fetch_assoc();
        if (!$player) respond(false, 'Player profile not found.');

        $pid = (int) $player['pid'];

        $stmt = $conn->prepare('SELECT act FROM player_gamepasses WHERE pid = ? AND gpid = ? LIMIT 1');
        $stmt->bind_param('ii', $pid, $gpid);
        $stmt->execute();
        $owned = $stmt->get_result()->fetch_assoc();
        if (!$owned || (int) $owned['act'] !== 1) respond(false, 'You do not own this game pass.');

        $stmt = $conn->prepare('SELECT id, status FROM refund_requests WHERE pid = ? AND gpid = ? ORDER BY id DESC LIMIT 1');
        $stmt->bind_param('ii', $pid, $gpid);
        $stmt->execute();
        $existing = $stmt->get_result()->fetch_assoc();
        if ($existing) {
            if ($existing['status'] === 'pending') respond(false, 'You already have a pending refund request for this pass.');
            if ($existing['status'] === 'cancelled') respond(false, 'Your refund request for this pass was already reviewed and cancelled. No further requests can be made.');
        }

        $stmt = $conn->prepare('SELECT gname FROM gamepasses WHERE gpid = ? LIMIT 1');
        $stmt->bind_param('i', $gpid);
        $stmt->execute();
        $gp = $stmt->get_result()->fetch_assoc();
        if (!$gp) respond(false, 'Game pass not found.');

        $pname = (string) $player['uname'];
        $gname = (string) $gp['gname'];
        $stmt = $conn->prepare('INSERT INTO refund_requests (pid, gpid, pname, gname) VALUES (?, ?, ?, ?)');
        $stmt->bind_param('iiss', $pid, $gpid, $pname, $gname);
        $stmt->execute();

        respond(true, 'Refund request submitted. Staff will review it shortly.');
    }

    if ($action === 'refund_requests') {
        require_login();
        $role = (string) ($_SESSION['role'] ?? '');

        if (in_array($role, ['admin', 'staff'], true)) {
            $rows = $conn->query(
                "SELECT id, pid, gpid, pname, gname, status, created_at
                 FROM refund_requests WHERE status = 'pending'
                 ORDER BY created_at ASC"
            )->fetch_all(MYSQLI_ASSOC);
        } else {
            $username = (string) ($_SESSION['username'] ?? '');
            $stmt = $conn->prepare(
                "SELECT rr.id, rr.gpid, rr.status
                 FROM refund_requests rr
                 JOIN players p ON p.pid = rr.pid
                 WHERE p.uname = ?
                   AND rr.id IN (SELECT MAX(id) FROM refund_requests GROUP BY pid, gpid)
                   AND rr.status IN ('pending', 'cancelled')"
            );
            $stmt->bind_param('s', $username);
            $stmt->execute();
            $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        }

        respond(true, '', ['requests' => $rows]);
    }

    if ($action === 'resolve_refund') {
        require_staff_or_admin();
        $id         = (int) ($_POST['id'] ?? 0);
        $resolution = value('resolution', '') ?? '';

        if ($id < 1) respond(false, 'Invalid request.');
        if (!in_array($resolution, ['accept', 'cancel'], true)) respond(false, 'Invalid resolution.');

        $stmt = $conn->prepare('SELECT * FROM refund_requests WHERE id = ? AND status = "pending" LIMIT 1');
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $req = $stmt->get_result()->fetch_assoc();
        if (!$req) respond(false, 'Request not found or already resolved.');

        $resolvedBy = (string) ($_SESSION['username'] ?? 'staff');

        if ($resolution === 'accept') {
            $inactive = 0;
            $stmt = $conn->prepare('UPDATE player_gamepasses SET act = ? WHERE pid = ? AND gpid = ?');
            $stmt->bind_param('iii', $inactive, $req['pid'], $req['gpid']);
            $stmt->execute();

            $stmt = $conn->prepare('SELECT price FROM gamepasses WHERE gpid = ? LIMIT 1');
            $stmt->bind_param('i', $req['gpid']);
            $stmt->execute();
            $gp    = $stmt->get_result()->fetch_assoc();
            $price = $gp ? -1 * (int) $gp['price'] : 0;

            record_transaction(
                $conn, 'refund',
                (int) $req['pid'], (string) $req['pname'],
                (int) $req['gpid'], (string) $req['gname'],
                $price,
                'Refund approved by ' . $resolvedBy . '.'
            );
            write_audit($conn, 'player_gamepass', 'REFUND',
                $req['pname'] . ' / ' . $req['gname'],
                'Refund request accepted by ' . $resolvedBy . '.'
            );
        }

        $status = $resolution === 'accept' ? 'accepted' : 'cancelled';
        $stmt = $conn->prepare('UPDATE refund_requests SET status = ?, resolved_at = NOW(), resolved_by = ? WHERE id = ?');
        $stmt->bind_param('ssi', $status, $resolvedBy, $id);
        $stmt->execute();

        respond(true, $resolution === 'accept' ? 'Refund accepted and processed.' : 'Refund request cancelled.');
    }

    respond(false, 'Unknown request.');
} catch (mysqli_sql_exception $e) {
    if ((int) $e->getCode() === 1062) {
        respond(false, 'Duplicate value detected (username, email, or pass name already exists).');
    }

    respond(false, 'Database error: ' . $e->getMessage());
} catch (Throwable $e) {
    respond(false, $e->getMessage());
}