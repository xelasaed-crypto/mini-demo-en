# OSINT Global Monitor | Intelligence Dashboard

A real-time OSINT intelligence platform that generates comprehensive country reports using AI.

## Features

- 🗺️ **Interactive Map** - Click any country to generate intelligence brief
- 📊 **Threat Assessment** - Automated threat level analysis
- 💾 **Server-Side Storage** - Reports saved to server filesystem (24h cache)
- 🔄 **Smart Caching** - No regeneration within 24 hours
- 📥 **Auto-Download** - Reports automatically downloaded as Markdown
- 💬 **Interactive Chat** - Query specific intelligence questions
- 👥 **Multi-User Support** - Session-based isolation for chat history
- 📱 **Mobile Optimized** - Fully responsive design
- 🔒 **Rate Limiting** - Prevents abuse (3/min, 10/hour, 50/day)
- 🛡️ **Protected Prompts** - AI prompts hidden on server

## Running Locally with PHP

### Requirements
- PHP 7.4 or higher
- Write permissions in the project directory

### Start PHP Built-in Server

```bash
cd /path/to/DevIntelDigest.io
php -S localhost:8000
```

### Access the Application

Open your browser to: `http://localhost:8000`

## Server Storage Structure

Reports are saved in the following directories (created automatically):

```
osint_reports/
├── IRN_latest.json          # Iran report (JSON format)
├── IRN_latest.md            # Iran report (Markdown format)
├── USA_latest.json          # USA report
└── USA_latest.md            # USA report

osint_chat_history/
├── {sessionID}_IRN.json     # User session's Iran chat
├── {sessionID}_USA.json     # User session's USA chat
└── {sessionID}_IRQ.json     # User session's Iraq chat

osint_rate_limits/
├── {clientID}_minute.txt    # Per-minute rate limit tracking
├── {clientID}_hour.txt      # Per-hour rate limit tracking
├── {clientID}_day.txt       # Per-day rate limit tracking
└── requests.log             # Audit log of all requests
```

**Note:** Chat history is session-specific. Each user gets isolated chat storage via PHP sessions. Sessions expire after 24 hours.

## API Endpoints

### api.php (Data Storage)

| Action | Method | Parameters | Description |
|--------|--------|------------|-------------|
| `get_report` | GET | `country=XXX` | Get cached report for country |
| `save_report` | POST | JSON body | Save new report |
| `get_all_reports` | GET | - | List all stored reports |
| `delete_report` | DELETE | `country=XXX` | Delete specific report |
| `delete_all` | DELETE | - | Delete all reports |
| `get_chat` | GET | `country=XXX` | Get session-specific chat history |
| `save_chat` | POST | JSON body | Save session-specific chat history |
| `cleanup_sessions` | GET | - | Clean up old session files (>24h) |

### generate_report.php (AI Generation + Rate Limiting)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `generate_report.php` | POST | Authorize report generation with rate limiting |

**Rate Limits:**
- 3 reports per minute
- 10 reports per hour
- 50 reports per day

**Hidden Prompt:** The full AI prompt is stored server-side in `generate_report.php` and never sent to the browser.

## Deployment on Aruba Hosting

### 1. Upload Files
Upload all files to your Aruba hosting via FTP/SFTP:
- `index.html`
- `main.js`
- `style.css`
- `manifest.json`
- `api.php`
- All asset files (icons, etc.)

### 2. Set Permissions
Ensure PHP has write permissions:
```bash
chmod 755 osint_reports/
chmod 755 osint_chat_history/
chmod 755 osint_rate_limits/
```

Or via FTP client, set folder permissions to `755`.

### 3. Set File Permissions

```bash
# All PHP and HTML files
chmod 644 index.html main.js style.css api.php generate_report.php manifest.json *.md
```

### 4. Configure PHP
Aruba hosting supports PHP by default. No additional configuration needed.

### 5. Access Your App
Navigate to your domain: `https://yourdomain.com`

## AI Integration

The app uses Puter.js AI for report generation:
- Reports require Puter.com authentication
- Web search enabled for real-time intelligence
- Falls back to standard AI if web search unavailable
- **Report Format:** Final intelligence brief (no follow-up questions)

## Multi-User Support

**Session-Based Isolation:**
- Reports are shared (same country = same report)
- Chat history is **per user session** (isolated)
- PHP sessions via cookies
- Sessions expire after 24 hours
- Automatic cleanup of old session files

## Browser Support

- Chrome/Edge (recommended)
- Firefox
- Safari
- Mobile browsers (iOS Safari, Chrome Mobile)

## Data Privacy

- Reports stored on server filesystem
- Chat history stored on server
- No third-party analytics
- Data persists across sessions

## Troubleshooting

### Reports not saving
- Check PHP has write permissions in project directory
- Verify `osint_reports/` folder exists and is writable

### API errors
- Check browser console for error messages
- Verify `api.php` is accessible: `http://localhost:8000/api.php`

### AI not working
- Ensure Puter.js is loaded (check browser console)
- Puter.com authentication required for AI features

## License

OSINT Intelligence Platform - 2026
