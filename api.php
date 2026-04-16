<?php
/**
 * OSINT Intelligence Brief - Report Storage API
 * Saves and retrieves reports from server filesystem
 * Uses PHP sessions for per-user chat history
 */

// Start session for user-specific chat storage
session_start();

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Credentials: true');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Configuration
$BASE_DIR = __DIR__ . '/osint_reports';
$CHAT_DIR = __DIR__ . '/osint_chat_history';

// Ensure directories exist
if (!file_exists($BASE_DIR)) {
    mkdir($BASE_DIR, 0755, true);
}
if (!file_exists($CHAT_DIR)) {
    mkdir($CHAT_DIR, 0755, true);
}

// Get session ID for user-specific storage
$sessionId = session_id();

// Get request method and parameters
$method = $_SERVER['REQUEST_METHOD'];
$action = isset($_GET['action']) ? $_GET['action'] : '';
$countryCode = isset($_GET['country']) ? $_GET['country'] : '';

// Validate country code
if ($countryCode && !preg_match('/^[A-Z]{3}$/', $countryCode)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid country code']);
    exit();
}

try {
    // Handle different actions
    switch ($action) {
        case 'get_report':
            // Get latest report for a country
            if (!$countryCode) {
                http_response_code(400);
                echo json_encode(['error' => 'Country code required']);
                exit();
            }
            
            $reportFile = $BASE_DIR . '/' . $countryCode . '_latest.json';
            
            if (file_exists($reportFile)) {
                $content = file_get_contents($reportFile);
                $data = json_decode($content, true);
                
                // Check if report is within 24 hours
                $twentyFourHours = 24 * 60 * 60 * 1000;
                $reportAge = time() * 1000 - $data['timestamp'];
                
                if ($reportAge < $twentyFourHours) {
                    echo json_encode([
                        'success' => true,
                        'cached' => true,
                        'data' => $data,
                        'age_minutes' => round($reportAge / 1000 / 60)
                    ]);
                } else {
                    echo json_encode([
                        'success' => true,
                        'cached' => false,
                        'message' => 'Report expired',
                        'age_hours' => round($reportAge / 1000 / 60 / 60)
                    ]);
                }
            } else {
                echo json_encode([
                    'success' => true,
                    'cached' => false,
                    'message' => 'No report found'
                ]);
            }
            break;
            
        case 'save_report':
            // Save a new report
            if ($method !== 'POST') {
                http_response_code(405);
                echo json_encode(['error' => 'Method not allowed']);
                exit();
            }
            
            $input = json_decode(file_get_contents('php://input'), true);
            
            if (!$input || !isset($input['countryCode']) || !isset($input['response'])) {
                http_response_code(400);
                echo json_encode(['error' => 'Missing required fields']);
                exit();
            }
            
            $countryCode = $input['countryCode'];
            $countryName = $input['countryName'] ?? $countryCode;
            $response = $input['response'];
            $threatLevel = $input['threatLevel'] ?? null;
            
            // Save as JSON for easy retrieval
            $reportData = [
                'countryCode' => $countryCode,
                'countryName' => $countryName,
                'query' => 'OSINT Intelligence Brief',
                'response' => $response,
                'threatLevel' => $threatLevel,
                'timestamp' => time() * 1000,
                'mode' => 'report'
            ];
            
            $reportFile = $BASE_DIR . '/' . $countryCode . '_latest.json';
            $reportMdFile = $BASE_DIR . '/' . $countryCode . '_latest.md';
            
            // Save JSON data
            file_put_contents($reportFile, json_encode($reportData, JSON_PRETTY_PRINT));
            
            // Also save as Markdown file
            $mdContent = "# OSINT Intelligence Brief: {$countryName}\n\n";
            $mdContent .= "**Generated:** " . date('Y-m-d H:i:s') . "\n";
            $mdContent .= "**ISO Code:** {$countryCode}\n";
            if ($threatLevel) {
                $mdContent .= "**Threat Level:** {$threatLevel['label']}\n";
            }
            $mdContent .= "\n---\n\n{$response}";
            
            file_put_contents($reportMdFile, $mdContent);
            
            echo json_encode([
                'success' => true,
                'message' => 'Report saved successfully',
                'file' => $reportFile
            ]);
            break;
            
        case 'get_all_reports':
            // Get list of all available reports
            $reports = [];
            $files = glob($BASE_DIR . '/*_latest.json');
            
            foreach ($files as $file) {
                $content = file_get_contents($file);
                $data = json_decode($content, true);
                if ($data) {
                    $reports[] = [
                        'countryCode' => $data['countryCode'],
                        'countryName' => $data['countryName'],
                        'timestamp' => $data['timestamp'],
                        'age_hours' => round((time() * 1000 - $data['timestamp']) / 1000 / 60 / 60, 1)
                    ];
                }
            }
            
            // Sort by timestamp (newest first)
            usort($reports, function($a, $b) {
                return $b['timestamp'] - $a['timestamp'];
            });
            
            echo json_encode([
                'success' => true,
                'count' => count($reports),
                'reports' => $reports
            ]);
            break;
            
        case 'delete_report':
            // Delete a specific report
            if ($method !== 'DELETE' && $method !== 'POST') {
                http_response_code(405);
                echo json_encode(['error' => 'Method not allowed']);
                exit();
            }
            
            if (!$countryCode) {
                http_response_code(400);
                echo json_encode(['error' => 'Country code required']);
                exit();
            }
            
            $jsonFile = $BASE_DIR . '/' . $countryCode . '_latest.json';
            $mdFile = $BASE_DIR . '/' . $countryCode . '_latest.md';
            
            $deleted = false;
            if (file_exists($jsonFile)) {
                unlink($jsonFile);
                $deleted = true;
            }
            if (file_exists($mdFile)) {
                unlink($mdFile);
                $deleted = true;
            }
            
            echo json_encode([
                'success' => true,
                'deleted' => $deleted,
                'country' => $countryCode
            ]);
            break;
            
        case 'delete_all':
            // Delete all reports
            if ($method !== 'DELETE' && $method !== 'POST') {
                http_response_code(405);
                echo json_encode(['error' => 'Method not allowed']);
                exit();
            }
            
            $files = glob($BASE_DIR . '/*');
            $deleted = 0;
            foreach ($files as $file) {
                if (is_file($file)) {
                    unlink($file);
                    $deleted++;
                }
            }
            
            echo json_encode([
                'success' => true,
                'deleted' => $deleted
            ]);
            break;
            
        case 'get_chat':
            // Get chat history for a country (session-specific)
            if (!$countryCode) {
                http_response_code(400);
                echo json_encode(['error' => 'Country code required']);
                exit();
            }

            // Session-specific chat file: {sessionID}_{countryCode}.json
            $chatFile = $CHAT_DIR . '/' . $sessionId . '_' . $countryCode . '.json';

            if (file_exists($chatFile)) {
                $content = file_get_contents($chatFile);
                $messages = json_decode($content, true);
                echo json_encode([
                    'success' => true,
                    'messages' => $messages ?? [],
                    'sessionId' => $sessionId
                ]);
            } else {
                echo json_encode([
                    'success' => true,
                    'messages' => [],
                    'sessionId' => $sessionId
                ]);
            }
            break;

        case 'save_chat':
            // Save chat history for a country (session-specific)
            if ($method !== 'POST') {
                http_response_code(405);
                echo json_encode(['error' => 'Method not allowed']);
                exit();
            }

            $input = json_decode(file_get_contents('php://input'), true);

            if (!$input || !isset($input['countryCode']) || !isset($input['messages'])) {
                http_response_code(400);
                echo json_encode(['error' => 'Missing required fields']);
                exit();
            }

            // Session-specific chat file: {sessionID}_{countryCode}.json
            $chatFile = $CHAT_DIR . '/' . $sessionId . '_' . $input['countryCode'] . '.json';
            file_put_contents($chatFile, json_encode($input['messages'], JSON_PRETTY_PRINT));

            echo json_encode([
                'success' => true,
                'message' => 'Chat saved successfully',
                'sessionId' => $sessionId
            ]);
            break;

        case 'cleanup_sessions':
            // Clean up old session files (older than 24 hours)
            $maxAge = 24 * 60 * 60; // 24 hours in seconds
            $currentTime = time();
            $deleted = 0;

            $files = glob($CHAT_DIR . '/*.json');
            foreach ($files as $file) {
                if (filemtime($file) < ($currentTime - $maxAge)) {
                    unlink($file);
                    $deleted++;
                }
            }

            echo json_encode([
                'success' => true,
                'deleted' => $deleted,
                'message' => 'Cleaned up old session files'
            ]);
            break;

        default:
            http_response_code(400);
            echo json_encode(['error' => 'Invalid action', 'available_actions' => [
                'get_report', 'save_report', 'get_all_reports', 'delete_report', 'delete_all',
                'get_chat', 'save_chat', 'cleanup_sessions'
            ]]);
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Server error',
        'message' => $e->getMessage()
    ]);
}
?>
