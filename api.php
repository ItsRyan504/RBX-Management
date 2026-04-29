<?php
session_start();
header('Content-Type: application/json');

require_once 'MySQLConnection.php';

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

    $adminPassword = password_hash('admin123', PASSWORD_DEFAULT);
    $rootPassword = password_hash('root', PASSWORD_DEFAULT);

    $stmt = $conn->prepare(
        'INSERT IGNORE INTO accounts (uid, username, password_hash, full_name, email, role, status)
         VALUES
         (1, "admin", ?, "System Administrator", "admin@rbxgpm.local", "admin", "active"),
         (2, "root", ?, "Root Account", "root@rbxgpm.local", "admin", "active")'
    );
    $stmt->bind_param('ss', $adminPassword, $rootPassword);
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

    if ($passwordRequired || $data['password'] !== '' || $data['confirm_password'] !== '') {
        if (strlen($data['password']) < 8) {
            respond(false, 'Password must be at least 8 characters.');
        }

        if ($data['password'] !== $data['confirm_password']) {
            respond(false, 'Passwords do not match.');
        }
    }
}

function account_from_post(bool $signup = false): array
{
    $role = $signup ? 'user' : (value('role', 'user') ?? 'user');
    $status = $signup ? 'active' : (value('status', 'active') ?? 'active');

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

function create_account(mysqli $conn, array $data): void
{
    $username = $data['username'];
    $passwordHash = password_hash($data['password'], PASSWORD_DEFAULT);
    $fullName = $data['full_name'];
    $email = $data['email'];
    $birthday = $data['birthday'];
    $gender = $data['gender'];
    $role = $data['role'];
    $status = $data['status'];

    $stmt = $conn->prepare(
        'INSERT INTO accounts (username, password_hash, full_name, email, birthday, gender, role, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->bind_param('ssssssss', $username, $passwordHash, $fullName, $email, $birthday, $gender, $role, $status);
    $stmt->execute();
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
        respond(true, '', [
            'logged_in' => !empty($_SESSION['uid']),
            'user' => [
                'uid' => $_SESSION['uid'] ?? null,
                'username' => $_SESSION['username'] ?? null,
            ],
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

        $_SESSION['uid'] = (int) $account['uid'];
        $_SESSION['username'] = $account['username'];

        respond(true, 'Login successful.', [
            'user' => [
                'uid' => (int) $account['uid'],
                'username' => $account['username'],
                'role' => $account['role'],
            ],
        ]);
    }

    if ($action === 'logout') {
        $_SESSION = [];
        session_destroy();
        respond(true, 'Logged out.');
    }

    if ($action === 'signup') {
        $data = account_from_post(true);
        validate_account($data, true);
        create_account($conn, $data);
        respond(true, 'Account created. You can now log in.');
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
        $data = account_from_post();
        validate_account($data, true);
        create_account($conn, $data);
        respond(true, 'Account added successfully.');
    }

    if ($action === 'update_account') {
        $uid = (int) ($_POST['uid'] ?? 0);
        $data = account_from_post();
        validate_account($data, false);

        if ($uid === (int) $_SESSION['uid'] && $data['status'] === 'inactive') {
            respond(false, 'You cannot make your own account inactive.');
        }

        $username = $data['username'];
        $fullName = $data['full_name'];
        $email = $data['email'];
        $birthday = $data['birthday'];
        $gender = $data['gender'];
        $role = $data['role'];
        $status = $data['status'];

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
        $uid = (int) ($_POST['uid'] ?? 0);
        $status = value('status', 'inactive') === 'active' ? 'active' : 'inactive';

        if ($uid === (int) $_SESSION['uid'] && $status === 'inactive') {
            respond(false, 'You cannot make your own account inactive.');
        }

        $stmt = $conn->prepare('UPDATE accounts SET status = ? WHERE uid = ?');
        $stmt->bind_param('si', $status, $uid);
        $stmt->execute();
        respond(true, 'Account status updated.');
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
