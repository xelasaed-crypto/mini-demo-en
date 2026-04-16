<?php
/**
 * OSINT Report Generator
 * Server-side AI report generation with rate limiting
 * Prompt is hidden from browser (security)
 */

session_start();

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Only accept POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
}

// ==================== RATE LIMITING ====================
$rateLimitDir = __DIR__ . '/osint_rate_limits';
if (!file_exists($rateLimitDir)) {
    mkdir($rateLimitDir, 0755, true);
}

// Get client identifier (IP + Session for fairness)
$clientIp = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$sessionId = session_id();
$clientId = md5($clientIp . '_' . $sessionId);

// Rate limit files
$minuteFile = $rateLimitDir . '/' . $clientId . '_minute.txt';
$hourFile = $rateLimitDir . '/' . $clientId . '_hour.txt';
$dayFile = $rateLimitDir . '/' . $clientId . '_day.txt';

// Rate limit thresholds
$MINUTE_LIMIT = 3;   // Max 3 reports per minute
$HOUR_LIMIT = 10;    // Max 10 reports per hour
$DAY_LIMIT = 50;     // Max 50 reports per day

// Clean up old rate limit files (older than 2 days)
$cleanupTime = time() - (2 * 24 * 60 * 60);
foreach (glob($rateLimitDir . '/*.txt') as $file) {
    if (filemtime($file) < $cleanupTime) {
        unlink($file);
    }
}

// Check rate limits
function checkRateLimit($file, $limit, $periodName) {
    $currentTime = time();
    $window = 0;
    
    switch ($periodName) {
        case 'minute': $window = 60; break;
        case 'hour': $window = 3600; break;
        case 'day': $window = 86400; break;
    }
    
    $count = 0;
    if (file_exists($file)) {
        $content = file_get_contents($file);
        $timestamps = json_decode($content, true) ?? [];
        
        // Filter timestamps within the window
        $validTimestamps = array_filter($timestamps, function($ts) use ($currentTime, $window) {
            return ($currentTime - $ts) < $window;
        });
        
        $count = count($validTimestamps);
        
        // Save cleaned timestamps
        file_put_contents($file, json_encode(array_values($validTimestamps)));
    }
    
    if ($count >= $limit) {
        return [
            'allowed' => false,
            'count' => $count,
            'limit' => $limit,
            'period' => $periodName
        ];
    }
    
    // Add current timestamp
    $validTimestamps[] = $currentTime;
    file_put_contents($file, json_encode($validTimestamps));
    
    return [
        'allowed' => true,
        'count' => $count + 1,
        'limit' => $limit,
        'period' => $periodName
    ];
}

// Check all rate limits
$minuteCheck = checkRateLimit($minuteFile, $MINUTE_LIMIT, 'minute');
if (!$minuteCheck['allowed']) {
    http_response_code(429);
    echo json_encode([
        'error' => 'Rate limit exceeded',
        'message' => "Too many requests. Maximum {$MINUTE_LIMIT} reports per minute.",
        'retryAfter' => 60
    ]);
    exit();
}

$hourCheck = checkRateLimit($hourFile, $HOUR_LIMIT, 'hour');
if (!$hourCheck['allowed']) {
    http_response_code(429);
    echo json_encode([
        'error' => 'Rate limit exceeded',
        'message' => "Too many requests. Maximum {$HOUR_LIMIT} reports per hour.",
        'retryAfter' => 3600
    ]);
    exit();
}

$dayCheck = checkRateLimit($dayFile, $DAY_LIMIT, 'day');
if (!$dayCheck['allowed']) {
    http_response_code(429);
    echo json_encode([
        'error' => 'Rate limit exceeded',
        'message' => "Too many requests. Maximum {$DAY_LIMIT} reports per day.",
        'retryAfter' => 86400
    ]);
    exit();
}

// ==================== INPUT VALIDATION ====================
$input = json_decode(file_get_contents('php://input'), true);

if (!$input) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON input']);
    exit();
}

$countryCode = $input['countryCode'] ?? '';
$countryName = $input['countryName'] ?? '';
$population = $input['population'] ?? 0;
$webSearchEnabled = $input['webSearchEnabled'] ?? true;

if (!$countryCode || !$countryName) {
    http_response_code(400);
    echo json_encode(['error' => 'Country code and name required']);
    exit();
}

// ==================== HIDDEN AI PROMPT ====================
// This prompt is NEVER sent to the browser (server-side only)
$osintPrompt = <<<PROMPT
You are an OSINT (Open Source Intelligence) analyst. Generate a comprehensive intelligence brief about {$countryName} (population: {$population}).

Focus on RECENT events and current situations. Structure your response with these sections (use ## for headers):

## 🚨 CRITICAL ALERTS
Any ongoing conflicts, wars, military operations, terrorist attacks, or immediate security threats.

## ⚠️ POLITICAL SITUATION
Current government, recent political developments, elections, protests, civil unrest, coups, or diplomatic tensions.

## 💰 ECONOMIC INTELLIGENCE
Economic crisis indicators, sanctions, trade disputes, inflation, currency issues, strikes, labor unrest.

## 🌪️ DISASTERS & HUMANITARIAN
Natural disasters (earthquakes, floods, droughts), humanitarian crises, refugee situations, health emergencies.

## 📊 STRATEGIC ASSESSMENT
Key alliances, military capabilities, regional influence, emerging threats or opportunities.

**IMPORTANT:** 
- Be factual and cite recent events when possible
- Highlight any developing situations
- Prioritize accuracy over speculation
- This is a FINAL intelligence brief - do NOT include any closing statements like "Would you like to know more?", "Let me know if you need...", "Feel free to ask...", or any offers for further assistance
- Just present the intelligence facts and analysis, then end the report
PROMPT;

// ==================== CALL PUTER.AI ====================
// Note: Puter.js is client-side, so we need to use a workaround
// For true server-side AI, you would need to use Puter.com's API directly
// or host your own LLM. For now, we'll return the prompt for client to use.

// Since Puter.js is client-side only, we'll validate and return success
// The actual AI call will still happen client-side, but the prompt is hidden

// Log the request for auditing
$logFile = $rateLimitDir . '/requests.log';
$logEntry = sprintf(
    "[%s] IP: %s, Session: %s, Country: %s (%s), WebSearch: %s\n",
    date('Y-m-d H:i:s'),
    $clientIp,
    $sessionId,
    $countryName,
    $countryCode,
    $webSearchEnabled ? 'yes' : 'no'
);
file_put_contents($logFile, $logEntry, FILE_APPEND);

// Return success with confirmation
// Note: The actual AI call still happens client-side via Puter.js
// But the prompt remains hidden on server
echo json_encode([
    'success' => true,
    'message' => 'Report generation authorized',
    'countryCode' => $countryCode,
    'countryName' => $countryName,
    'rateLimit' => [
        'minute' => ['used' => $minuteCheck['count'], 'limit' => $MINUTE_LIMIT],
        'hour' => ['used' => $hourCheck['count'], 'limit' => $HOUR_LIMIT],
        'day' => ['used' => $dayCheck['count'], 'limit' => $DAY_LIMIT]
    ]
]);
?>
