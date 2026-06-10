<?php

return [
    /*
     * Copy this file to config/email.config.php and fill in the real values.
     * Do not commit config/email.config.php. It is ignored by Git.
     */
    'smtp' => [
        // GoDaddy Professional Email / Titan common outgoing SMTP settings.
        'host' => 'smtpout.secureserver.net',
        'port' => 465,
        'encryption' => 'ssl', // ssl, starttls, or none
        'username' => 'support@taichiguru.com',
        'password' => 'PASTE_EMAIL_PASSWORD_HERE',
        'timeout_seconds' => 30,
    ],

    'mail' => [
        'from_email' => 'support@taichiguru.com',
        'from_name' => 'Tai Chi Guru',
        'to_email' => 'vnikron@gmail.com',
        'subject_prefix' => '[Tai Chi Guru]',
    ],

    'site' => [
        'success_redirect' => 'request.html?sent=1',
        'error_redirect' => 'request.html?sent=0',
    ],
];
