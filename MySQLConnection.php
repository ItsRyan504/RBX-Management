<?php

class MySQLConnection
{
    public string $host = 'localhost';
    public string $username = 'root';
    public string $password = '';
    public string $database = 'roblox_tracker';
    public mysqli $conn;

    public function __construct()
    {
        mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

        $this->conn = new mysqli(
            $this->host,
            $this->username,
            $this->password,
            $this->database
        );

        $this->conn->set_charset('utf8mb4');
    }

    public function getConnection(): mysqli
    {
        return $this->conn;
    }
}
