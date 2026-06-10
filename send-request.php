<?php

declare(strict_types=1);

function redirect_with_status(string $url, string $message = '')
{
    if ($message !== '') {
        $separator = strpos($url, '?') !== false ? '&' : '?';
        $url .= $separator . 'message=' . rawurlencode($message);
    }

    header('Location: ' . $url, true, 303);
    exit;
}

function mail_header_encode(string $value): string
{
    if (function_exists('mb_encode_mimeheader')) {
        return mb_encode_mimeheader($value);
    }

    return '=?UTF-8?B?' . base64_encode($value) . '?=';
}

function clean_header_value(string $value): string
{
    return trim(str_replace(["\r", "\n"], '', $value));
}

function smtp_read($socket): array
{
    $response = '';

    while (($line = fgets($socket, 515)) !== false) {
        $response .= $line;

        if (strlen($line) >= 4 && $line[3] === ' ') {
            break;
        }
    }

    $code = (int) substr($response, 0, 3);
    return [$code, $response];
}

function smtp_expect($socket, array $expected, string $context): string
{
    [$code, $response] = smtp_read($socket);

    if (!in_array($code, $expected, true)) {
        throw new RuntimeException($context . ' failed with SMTP response: ' . trim($response));
    }

    return $response;
}

function smtp_command($socket, string $command, array $expected, string $context): string
{
    fwrite($socket, $command . "\r\n");
    return smtp_expect($socket, $expected, $context);
}

function smtp_send(array $config, string $subject, string $textBody, string $replyTo): void
{
    $smtp = $config['smtp'];
    $mail = $config['mail'];
    $host = (string) $smtp['host'];
    $port = (int) $smtp['port'];
    $encryption = strtolower((string) $smtp['encryption']);
    $timeout = (int) ($smtp['timeout_seconds'] ?? 30);
    $username = (string) $smtp['username'];
    $password = (string) $smtp['password'];
    $fromEmail = clean_header_value((string) $mail['from_email']);
    $fromName = clean_header_value((string) $mail['from_name']);
    $toEmail = clean_header_value((string) $mail['to_email']);

    if ($password === '' || $password === 'PASTE_EMAIL_PASSWORD_HERE') {
        throw new RuntimeException('SMTP password is missing in config/email.config.php.');
    }

    $target = ($encryption === 'ssl' ? 'ssl://' : '') . $host;
    $socket = @stream_socket_client(
        $target . ':' . $port,
        $errno,
        $errstr,
        $timeout,
        STREAM_CLIENT_CONNECT
    );

    if (!$socket) {
        throw new RuntimeException("Could not connect to SMTP server {$host}:{$port}. {$errstr} ({$errno})");
    }

    stream_set_timeout($socket, $timeout);

    try {
        smtp_expect($socket, [220], 'SMTP greeting');
        smtp_command($socket, 'EHLO ' . ($_SERVER['SERVER_NAME'] ?? 'localhost'), [250], 'SMTP EHLO');

        if ($encryption === 'starttls') {
            smtp_command($socket, 'STARTTLS', [220], 'SMTP STARTTLS');

            if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                throw new RuntimeException('Could not enable TLS encryption for SMTP connection.');
            }

            smtp_command($socket, 'EHLO ' . ($_SERVER['SERVER_NAME'] ?? 'localhost'), [250], 'SMTP EHLO after STARTTLS');
        }

        smtp_command($socket, 'AUTH LOGIN', [334], 'SMTP AUTH LOGIN');
        smtp_command($socket, base64_encode($username), [334], 'SMTP username');
        smtp_command($socket, base64_encode($password), [235], 'SMTP password');
        smtp_command($socket, 'MAIL FROM:<' . $fromEmail . '>', [250], 'SMTP MAIL FROM');
        smtp_command($socket, 'RCPT TO:<' . $toEmail . '>', [250, 251], 'SMTP RCPT TO');
        smtp_command($socket, 'DATA', [354], 'SMTP DATA');

        $headers = [
            'From: ' . mail_header_encode($fromName) . ' <' . $fromEmail . '>',
            'To: <' . $toEmail . '>',
            'Reply-To: <' . clean_header_value($replyTo) . '>',
            'Subject: ' . mail_header_encode($subject),
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=UTF-8',
            'Content-Transfer-Encoding: 8bit',
            'Message-ID: <' . bin2hex(random_bytes(16)) . '@' . ($_SERVER['SERVER_NAME'] ?? 'localhost') . '>',
            'Date: ' . date(DATE_RFC2822),
        ];

        $message = implode("\r\n", $headers) . "\r\n\r\n" . $textBody;
        $message = preg_replace('/^\./m', '..', $message);
        fwrite($socket, $message . "\r\n.\r\n");
        smtp_expect($socket, [250], 'SMTP message send');
        smtp_command($socket, 'QUIT', [221], 'SMTP QUIT');
    } finally {
        fclose($socket);
    }
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo 'Method Not Allowed';
    exit;
}

$configPath = __DIR__ . '/config/email.config.php';
$examplePath = __DIR__ . '/config/email.config.example.php';

if (!is_file($configPath)) {
    copy($examplePath, $configPath);
}

$config = require $configPath;
$successRedirect = (string) $config['site']['success_redirect'];
$errorRedirect = (string) $config['site']['error_redirect'];

if (!empty($_POST['website'] ?? '')) {
    redirect_with_status($successRedirect);
}

$contactEmail = trim((string) ($_POST['contact-email'] ?? ''));
$comments = trim((string) ($_POST['tai-chi-comments'] ?? ''));

if (!filter_var($contactEmail, FILTER_VALIDATE_EMAIL)) {
    redirect_with_status($errorRedirect, 'Please enter a valid contact email.');
}

if ($comments === '') {
    redirect_with_status($errorRedirect, 'Please add Tai Chi set comments.');
}

$subjectPrefix = clean_header_value((string) $config['mail']['subject_prefix']);
$subject = $subjectPrefix . ' New Tai Chi set request';
$body = implode("\n", [
    'New Tai Chi Guru set request',
    '',
    'Contact email: ' . $contactEmail,
    '',
    'Tai Chi set comments:',
    $comments,
    '',
    'Sent from: ' . ($_SERVER['HTTP_HOST'] ?? 'unknown host'),
    'Date: ' . date(DATE_RFC2822),
]);

try {
    smtp_send($config, $subject, $body, $contactEmail);
    redirect_with_status($successRedirect);
} catch (Throwable $error) {
    error_log('[Tai Chi Guru mail] ' . $error->getMessage());
    redirect_with_status($errorRedirect, $error->getMessage());
}
