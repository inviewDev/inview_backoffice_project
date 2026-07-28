<?php
declare(strict_types=1);

const AUTHORIZATION_URL = 'https://inview-backoffice-project.vercel.app/api/me';
const PUBLIC_FILE_BASE_URL = 'https://inview01.cafe24.com/inview_backoffice_community/files';
const MAX_IMAGE_SIZE = 4718592;
const MAX_REQUEST_SIZE = 6291456;

function json_response(int $status, array $payload): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function is_allowed_origin(string $origin): bool
{
    $host = strtolower((string) parse_url($origin, PHP_URL_HOST));
    if ($host === 'localhost' || $host === '127.0.0.1') {
        return true;
    }

    return $host === 'inview-backoffice-project.vercel.app'
        || (bool) preg_match('/^[a-z0-9-]+\.vercel\.app$/', $host);
}

function request_authorization_header(): string
{
    if (!empty($_SERVER['HTTP_AUTHORIZATION'])) {
        return trim((string) $_SERVER['HTTP_AUTHORIZATION']);
    }

    if (function_exists('getallheaders')) {
        $headers = getallheaders();
        foreach ($headers as $name => $value) {
            if (strtolower((string) $name) === 'authorization') {
                return trim((string) $value);
            }
        }
    }

    return '';
}

function authorize_upload(string $authorization): array
{
    if (strpos($authorization, 'Bearer ') !== 0) {
        return ['ok' => false, 'status' => 401, 'error' => '로그인이 필요합니다.'];
    }

    if (!function_exists('curl_init')) {
        return ['ok' => false, 'status' => 500, 'error' => '호스팅 서버의 cURL 확장이 필요합니다.'];
    }

    $request = curl_init(AUTHORIZATION_URL);
    curl_setopt_array($request, [
        CURLOPT_HTTPHEADER => [
            'Authorization: ' . $authorization,
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ]);

    $body = curl_exec($request);
    $status = (int) curl_getinfo($request, CURLINFO_HTTP_CODE);
    $curlError = curl_error($request);
    curl_close($request);

    if ($body === false || $curlError !== '') {
        return ['ok' => false, 'status' => 502, 'error' => '관리자 서버에서 업로드 권한을 확인하지 못했습니다.'];
    }

    $decoded = json_decode((string) $body, true);
    if ($status !== 200 || !is_array($decoded) || !isset($decoded['user'])) {
        return [
            'ok' => false,
            'status' => in_array($status, [401, 403], true) ? $status : 502,
            'error' => is_array($decoded) && !empty($decoded['error'])
                ? (string) $decoded['error']
                : '관리자 서버의 사용자 권한 정보를 불러오지 못했습니다.',
        ];
    }

    $user = is_array($decoded['user']) ? $decoded['user'] : [];
    if (empty($user['canWritePosts'])) {
        return ['ok' => false, 'status' => 403, 'error' => '게시글 작성 권한이 없습니다.'];
    }

    return ['ok' => true, 'userId' => $user['id'] ?? null];
}

$origin = trim((string) ($_SERVER['HTTP_ORIGIN'] ?? ''));
if ($origin !== '') {
    if (!is_allowed_origin($origin)) {
        json_response(403, ['error' => '허용되지 않은 요청 도메인입니다.']);
    }
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
}

header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Max-Age: 600');
header('X-Content-Type-Options: nosniff');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    json_response(405, ['error' => 'POST 요청만 허용됩니다.']);
}

$contentLength = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
if ($contentLength > MAX_REQUEST_SIZE) {
    json_response(413, ['error' => '요청 용량이 너무 큽니다. 이미지는 4.5MB 이하로 등록해주세요.']);
}

$authorization = authorize_upload(request_authorization_header());
if (empty($authorization['ok'])) {
    json_response((int) $authorization['status'], ['error' => $authorization['error']]);
}

if (!isset($_FILES['image']) || !is_array($_FILES['image'])) {
    json_response(400, ['error' => '업로드할 이미지가 없습니다.']);
}

$image = $_FILES['image'];
$uploadError = (int) ($image['error'] ?? UPLOAD_ERR_NO_FILE);
if ($uploadError !== UPLOAD_ERR_OK) {
    $message = $uploadError === UPLOAD_ERR_INI_SIZE || $uploadError === UPLOAD_ERR_FORM_SIZE
        ? '이미지는 4.5MB 이하로 등록해주세요.'
        : '이미지 파일을 전달받지 못했습니다.';
    json_response(400, ['error' => $message]);
}

$temporaryPath = (string) ($image['tmp_name'] ?? '');
$fileSize = (int) ($image['size'] ?? 0);
if ($fileSize <= 0 || $fileSize > MAX_IMAGE_SIZE || !is_uploaded_file($temporaryPath)) {
    json_response(400, ['error' => '이미지는 파일당 4.5MB 이하로 등록해주세요.']);
}

$finfo = new finfo(FILEINFO_MIME_TYPE);
$mimeType = (string) $finfo->file($temporaryPath);
$extensions = [
    'image/jpeg' => 'jpg',
    'image/png' => 'png',
    'image/webp' => 'webp',
    'image/gif' => 'gif',
];

if (!isset($extensions[$mimeType]) || @getimagesize($temporaryPath) === false) {
    json_response(415, ['error' => 'JPG, PNG, WEBP, GIF 이미지 파일만 등록할 수 있습니다.']);
}

date_default_timezone_set('Asia/Seoul');
$datePath = date('Y/m');
$storageDirectory = __DIR__ . '/files/' . $datePath;
if (!is_dir($storageDirectory) && !mkdir($storageDirectory, 0755, true) && !is_dir($storageDirectory)) {
    json_response(500, ['error' => '이미지 저장 폴더를 생성하지 못했습니다.']);
}

$fileName = date('YmdHis') . '-' . bin2hex(random_bytes(12)) . '.' . $extensions[$mimeType];
$destination = $storageDirectory . '/' . $fileName;
if (!move_uploaded_file($temporaryPath, $destination)) {
    json_response(500, ['error' => '이미지를 저장하지 못했습니다.']);
}

@chmod($destination, 0644);
$publicUrl = PUBLIC_FILE_BASE_URL . '/' . $datePath . '/' . $fileName;

json_response(201, [
    'url' => $publicUrl,
    'size' => $fileSize,
    'contentType' => $mimeType,
]);
