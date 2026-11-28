<?php
/**
 * Momevia — tạm chuyển tiếp /api/* từ Hostinger Premium sang Railway.
 * LƯU Ý: Hạ tầng PHP relay không nên xem là giải pháp production lâu dài:
 * mọi request có thể cùng IP egress của Hostinger => giới hạn đăng nhập theo IP.
 * Không nhúng API key/secret bên frontend hoặc file này.
 */
declare(strict_types=1);

const MOMEVIA_UPSTREAM = 'https://momevia-production.up.railway.app';
const MOMEVIA_MAX_BODY = 5 * 1024 * 1024;

$uri = $_SERVER['REQUEST_URI'] ?? '';
$path = parse_url($uri, PHP_URL_PATH);
$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

if (!is_string($path) || !preg_match('~^/api/(auth|catalog|checkout|gifts|support|designs)(?:/|$)~D', $path)) {
    http_response_code(404);
    exit;
}
if (!in_array($method, ['GET', 'HEAD', 'POST'], true)) {
    header('Allow: GET, HEAD, POST');
    http_response_code(405);
    exit;
}
if (!function_exists('curl_init')) {
    header('Content-Type: application/json; charset=utf-8');
    http_response_code(503);
    echo '{"error":"Hostinger PHP cURL extension is unavailable"}';
    exit;
}

$upstream = MOMEVIA_UPSTREAM . $uri;
$headers = [];
foreach ([
    'HTTP_ACCEPT' => 'Accept',
    'HTTP_ACCEPT_LANGUAGE' => 'Accept-Language',
    'HTTP_ORIGIN' => 'Origin',
    'HTTP_SEC_FETCH_SITE' => 'Sec-Fetch-Site',
    'HTTP_COOKIE' => 'Cookie',
    'HTTP_AUTHORIZATION' => 'Authorization',
    'HTTP_RANGE' => 'Range',
    'HTTP_IF_NONE_MATCH' => 'If-None-Match',
    'HTTP_IF_MODIFIED_SINCE' => 'If-Modified-Since',
    'HTTP_X_MOMEVIA_LOCALE' => 'X-Momevia-Locale',
    'HTTP_X_MUTATION_ID' => 'X-Mutation-Id',
    'HTTP_X_REQUEST_ID' => 'X-Request-Id',
    'CONTENT_TYPE' => 'Content-Type',
] as $serverKey => $httpName) {
    $value = $_SERVER[$serverKey] ?? '';
    if (is_string($value) && $value !== '' && !str_contains($value, "\r") && !str_contains($value, "\n")) {
        $headers[] = $httpName . ': ' . $value;
    }
}

$requestBody = '';
if ($method === 'POST') {
    $length = filter_var($_SERVER['CONTENT_LENGTH'] ?? '0', FILTER_VALIDATE_INT);
    if ($length === false || $length > MOMEVIA_MAX_BODY) {
        http_response_code(413);
        header('Content-Type: application/json; charset=utf-8');
        echo '{"error":"Payload exceeds relay limit"}';
        exit;
    }
    $requestBody = file_get_contents('php://input', false, null, 0, MOMEVIA_MAX_BODY + 1);
    if ($requestBody === false || strlen($requestBody) > MOMEVIA_MAX_BODY) {
        http_response_code(413);
        exit;
    }
}

header('Cache-Control: private, no-store');
header('X-Content-Type-Options: nosniff');
$client = curl_init($upstream);
curl_setopt_array($client, [
    CURLOPT_CUSTOMREQUEST => $method,
    CURLOPT_FOLLOWLOCATION => false, // OAuth redirect stays with browser, not relay.
    CURLOPT_HTTPHEADER => $headers,
    CURLOPT_CONNECTTIMEOUT => 8,
    CURLOPT_TIMEOUT => 45,
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_SSL_VERIFYHOST => 2,
    CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
    CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTPS,
    CURLOPT_HEADERFUNCTION => static function ($handle, string $line): int {
        $size = strlen($line);
        if (preg_match('~^HTTP/\S+\s+(\d{3})~', $line, $match)) {
            http_response_code((int) $match[1]);
            return $size;
        }
        if (!str_contains($line, ':')) return $size;
        [$name, $value] = array_map('trim', explode(':', $line, 2));
        $allowed = ['content-type','cache-control','set-cookie','location','retry-after',
            'content-disposition','content-range','accept-ranges','etag','last-modified'];
        if (in_array(strtolower($name), $allowed, true)) {
            // Multiple Set-Cookie headers are required for session + OAuth state.
            header($name . ': ' . $value, strtolower($name) !== 'set-cookie');
        }
        return $size;
    },
    CURLOPT_WRITEFUNCTION => static function ($handle, string $chunk): int {
        echo $chunk;
        return strlen($chunk);
    },
]);
if ($method === 'POST') {
    curl_setopt($client, CURLOPT_POSTFIELDS, $requestBody);
}
if ($method === 'HEAD') {
    curl_setopt($client, CURLOPT_NOBODY, true);
}
$success = curl_exec($client);
$error = curl_error($client);
curl_close($client);
if ($success === false && !headers_sent()) {
    header('Content-Type: application/json; charset=utf-8');
    http_response_code(502);
    echo '{"error":"Backend connection failed"}';
    error_log('Momevia relay connection failed: ' . $error);
}
