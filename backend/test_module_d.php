<?php
$_SERVER['REQUEST_METHOD'] = 'GET';
$_SERVER['HTTP_X_CSRF_TOKEN'] = 'dummy';
$_GET['action'] = 'dummy';

// We intercept exit to prevent send_error from stopping the script
// but since we can't redefine exit, we'll just require api.php but bypass the router.
// Wait, api.php executes the router immediately.
// We can just include api.php, it will exit on `dummy` action. So we can't easily include it.

// Let's just use cURL via PowerShell to the running PHP server!
