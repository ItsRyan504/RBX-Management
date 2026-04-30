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

function public_account(array $account): array
{
    $username = (string) ($account['username'] ?? '');
    $role     = (string) ($account['role'] ?? 'user');

    return [
        'uid'      => (int) $account['uid'],
        'username' => $username,
        'role'     => $role,
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

    $stmt = $conn->prepare('UPDATE accounts SET role = "user" WHERE username <> ? AND role <> "user"');
    $stmt->bind_param('s', $adminUsername);
    $stmt->execute();
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
        'role' => in_array($role, ['admin', 'user'], true) ? $role : 'user',
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
    $fullName     = null_or_string($data['full_name']);
    $email        = null_or_string($data['email']);
    $birthday     = null_or_string($data['birthday']);
    $gender       = null_or_string($data['gender']);
    $role         = $data['role'];
    $status       = $data['status'];

    $stmt = $conn->prepare(
        'INSERT INTO accounts (username, password_hash, full_name, email, birthday, gender, role, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
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
            $stmt = $conn->prepare('SELECT uid, username, role, status FROM accounts WHERE uid = ? LIMIT 1');
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
        $data = account_from_post(true);
        validate_account($data, true);
        $account = create_account($conn, $data);
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
        $fullName = null_or_string($data['full_name']);
        $email    = null_or_string($data['email']);
        $birthday = null_or_string($data['birthday']);
        $gender   = null_or_string($data['gender']);
        $role     = $data['role'];
        $status   = $data['status'];

        if ($data['password'] !== '') {
            $passwordHash = password_hash($data['password'], PASSWORD_DEFAULT);
            $stmt = $conn->prepare(
                'UPDATE accounts
                 SET username = ?, password_hash = ?, full_name = ?, email = ?, birthday = ?, gender = ?, role = ?, status = ?
                 WHERE uid = ?'
            );
            $stmt->bind_param('ssssssssi', $username, $passwordHash, $fullName, $email, $birthday, $gender, $role, $status, $uid);
        } else {
            $stmt = $conn->prepare(
                'UPDATE accounts
                 SET username = ?, full_name = ?, email = ?, birthday = ?, gender = ?, role = ?, status = ?
                 WHERE uid = ?'
            );
            $stmt->bind_param('sssssssi', $username, $fullName, $email, $birthday, $gender, $role, $status, $uid);
        }

        $stmt->execute();
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

        $stmt = $conn->prepare('DELETE FROM accounts WHERE uid = ?');
        $stmt->bind_param('i', $uid);
        $stmt->execute();

        if ($stmt->affected_rows < 1) {
            respond(false, 'Account not found.');
        }

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
        require_admin();
        $pid    = (int) ($_POST['pid']    ?? 0);
        $status = value('stat', 'active') === 'active' ? 'active' : 'banned';
        $stmt   = $conn->prepare('UPDATE players SET stat = ? WHERE pid = ?');
        $stmt->bind_param('si', $status, $pid);
        $stmt->execute();
        respond(true, 'Player status updated.');
    }

    if ($action === 'add_player') {
        require_admin();
        $uname = value('uname', '') ?? '';
        $jdate = value('jdate', date('Y-m-d')) ?? date('Y-m-d');
        $stat  = value('stat',  'active') === 'banned' ? 'banned' : 'active';
        if ($uname === '') respond(false, 'Username is required.');
        $stmt = $conn->prepare('INSERT INTO players (uname, jdate, stat) VALUES (?, ?, ?)');
        $stmt->bind_param('sss', $uname, $jdate, $stat);
        $stmt->execute();
        respond(true, 'Player added successfully.');
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
        $rows = $conn->query(
            'SELECT p.uname, g.gname, pg.src, pg.act
             FROM player_gamepasses pg
             JOIN players   p ON p.pid  = pg.pid
             JOIN gamepasses g ON g.gpid = pg.gpid
             ORDER BY pg.atime DESC'
        )->fetch_all(MYSQLI_ASSOC);
        respond(true, '', ['transactions' => $rows]);
    }

    if ($action === 'audit') {
        $rows = $conn->query(
            'SELECT a.audit_id AS id, a.action_type AS action,
                    p.uname, g.gname,
                    a.old_src, a.new_src, a.old_act, a.new_act,
                    a.action_time AS ts
             FROM player_gamepasses_audit a
             JOIN players    p ON p.pid  = a.pid
             JOIN gamepasses g ON g.gpid = a.gpid
             ORDER BY a.audit_id DESC'
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

    respond(false, 'Unknown request.');
} catch (mysqli_sql_exception $e) {
    if ((int) $e->getCode() === 1062) {
        respond(false, 'Username or email already exists.');
    }

    respond(false, 'Database error: ' . $e->getMessage());
} catch (Throwable $e) {
    respond(false, $e->getMessage());
}