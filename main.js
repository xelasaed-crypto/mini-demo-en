// ==================== SERVER STORAGE (PHP API) ====================
// Using PHP backend for server-side file storage
// Works locally with php -S and on Aruba hosting

const API_URL = 'api.php';

// Initialize storage
async function initStorage() {
    console.log('PHP API storage initialized');
    return Promise.resolve();
}

// Save query to server
async function saveQuery(countryCode, countryName, query, response, mode) {
    try {
        const payload = {
            countryCode,
            countryName,
            query,
            response,
            mode,
            timestamp: Date.now()
        };

        // For reports, use the save_report endpoint
        if (mode === 'report' && query === 'OSINT Intelligence Brief') {
            const res = await fetch(`${API_URL}?action=save_report`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await res.json();
            console.log('Report saved to server:', result);
            return 1;
        }

        // For chat queries, we'll store them separately
        const key = `osint_${countryCode}_queries`;
        let records = JSON.parse(localStorage.getItem(key) || '[]');
        records.push(payload);
        localStorage.setItem(key, JSON.stringify(records));
        console.log('Query saved to localStorage:', key);
        return records.length;
    } catch (error) {
        console.error('Error saving query:', error);
        return 0;
    }
}

// Get queries by country
async function getQueriesByCountry(countryCode) {
    try {
        // First try to get the cached report from server
        const res = await fetch(`${API_URL}?action=get_report&country=${countryCode}`);
        const result = await res.json();

        if (result.success && result.cached && result.data) {
            console.log('Found cached report on server for', countryCode, '(age:', result.age_minutes, 'min)');
            return [{
                countryCode: result.data.countryCode,
                countryName: result.data.countryName,
                query: result.data.query,
                response: result.data.response,
                mode: 'report',
                timestamp: result.data.timestamp,
                threatLevel: result.data.threatLevel
            }];
        }

        console.log('No cached report found on server for', countryCode);
        return [];
    } catch (error) {
        console.error('Error getting queries:', error);
        return [];
    }
}

// Get all queries (for export)
async function getAllQueries() {
    try {
        const res = await fetch(`${API_URL}?action=get_all_reports`);
        const result = await res.json();

        if (result.success) {
            return result.reports.map(r => ({
                countryCode: r.countryCode,
                countryName: r.countryName,
                query: 'OSINT Intelligence Brief',
                response: '',
                mode: 'report',
                timestamp: r.timestamp
            }));
        }

        return [];
    } catch (error) {
        console.error('Error getting all queries:', error);
        return [];
    }
}

// Clear queries by country
async function clearQueriesByCountry(countryCode) {
    try {
        await fetch(`${API_URL}?action=delete_report&country=${countryCode}`, {
            method: 'DELETE'
        });
        localStorage.removeItem(`osint_${countryCode}_queries`);
        console.log('Cleared queries for:', countryCode);
    } catch (error) {
        console.error('Error clearing queries:', error);
    }
}

// Clear all queries
async function clearAllQueries() {
    try {
        await fetch(`${API_URL}?action=delete_all`, {
            method: 'DELETE'
        });
        // Also clear localStorage chat histories
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('osint_chat_')) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
        console.log('All data cleared');
    } catch (error) {
        console.error('Error clearing all queries:', error);
    }
}

// Import queries from file
async function importQueries(queries) {
    try {
        // Group by country
        const byCountry = {};
        queries.forEach(query => {
            const code = query.countryCode;
            if (!byCountry[code]) byCountry[code] = [];
            byCountry[code].push({
                countryCode: query.countryCode,
                countryName: query.countryName,
                query: query.query,
                response: query.response,
                mode: query.mode,
                timestamp: query.timestamp || Date.now()
            });
        });

        // Save each country's report data
        let imported = 0;
        for (const [countryCode, records] of Object.entries(byCountry)) {
            const report = records.find(r => r.mode === 'report' && r.query === 'OSINT Intelligence Brief');
            if (report) {
                const res = await fetch(`${API_URL}?action=save_report`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(report)
                });
                const result = await res.json();
                if (result.success) imported++;
            }
        }

        console.log(`Imported ${imported} queries`);
        return imported;
    } catch (error) {
        console.error('Error importing queries:', error);
        return 0;
    }
}

// Save chat history for a country
async function saveChatHistory(countryCode, messages) {
    try {
        await fetch(`${API_URL}?action=save_chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ countryCode, messages }),
            credentials: 'include' // Include session cookie
        });
        console.log('Chat history saved on server:', countryCode);
    } catch (error) {
        console.error('Error saving chat history:', error);
        // Fallback to localStorage
        const key = `osint_chat_${countryCode}`;
        localStorage.setItem(key, JSON.stringify(messages));
    }
}

// Load chat history for a country
async function loadChatHistory(countryCode) {
    try {
        const res = await fetch(`${API_URL}?action=get_chat&country=${countryCode}`, {
            credentials: 'include' // Include session cookie
        });
        const result = await res.json();

        if (result.success && result.messages) {
            console.log('Loaded chat history from server:', countryCode, '(session:', result.sessionId + ')');
            return result.messages;
        }

        // Fallback to localStorage
        const key = `osint_chat_${countryCode}`;
        const existing = localStorage.getItem(key);
        if (existing) {
            console.log('Loaded chat history from localStorage:', countryCode);
            return JSON.parse(existing);
        }

        return [];
    } catch (error) {
        console.error('Error loading chat history:', error);
        return [];
    }
}

// ==================== MARKED.JS CONFIGURATION ====================
marked.setOptions({
    breaks: true,
    gfm: true,
    headerIds: false,
    mangle: false
});

// ==================== COUNTRY DATA ====================
const countryData = {
    'AFG': { name: 'Afghanistan', population: 41128771, bps: 0.43, dps: 0.15 },
    'ALB': { name: 'Albania', population: 2832439, bps: 0.03, dps: 0.03 },
    'DZA': { name: 'Algeria', population: 44903225, bps: 0.23, dps: 0.05 },
    'AGO': { name: 'Angola', population: 35588987, bps: 0.43, dps: 0.10 },
    'ARG': { name: 'Argentina', population: 45773884, bps: 0.16, dps: 0.09 },
    'ARM': { name: 'Armenia', population: 2777970, bps: 0.01, dps: 0.01 },
    'AUS': { name: 'Australia', population: 26439111, bps: 0.09, dps: 0.06 },
    'AUT': { name: 'Austria', population: 9043070, bps: 0.03, dps: 0.03 },
    'AZE': { name: 'Azerbaijan', population: 10400529, bps: 0.05, dps: 0.03 },
    'BGD': { name: 'Bangladesh', population: 172954319, bps: 0.61, dps: 0.17 },
    'BLR': { name: 'Belarus', population: 9498238, bps: 0.03, dps: 0.04 },
    'BEL': { name: 'Belgium', population: 11686140, bps: 0.04, dps: 0.04 },
    'BLZ': { name: 'Belize', population: 430074, bps: 0.003, dps: 0.001 },
    'BEN': { name: 'Benin', population: 13352864, bps: 0.14, dps: 0.03 },
    'BTN': { name: 'Bhutan', population: 782455, bps: 0.004, dps: 0.002 },
    'BOL': { name: 'Bolivia', population: 12224110, bps: 0.06, dps: 0.02 },
    'BIH': { name: 'Bosnia and Herzegovina', population: 3210847, bps: 0.01, dps: 0.01 },
    'BWA': { name: 'Botswana', population: 2675352, bps: 0.02, dps: 0.01 },
    'BRA': { name: 'Brazil', population: 216422446, bps: 0.44, dps: 0.20 },
    'BRN': { name: 'Brunei', population: 452524, bps: 0.002, dps: 0.001 },
    'BGR': { name: 'Bulgaria', population: 6687717, bps: 0.02, dps: 0.03 },
    'BFA': { name: 'Burkina Faso', population: 22673762, bps: 0.27, dps: 0.06 },
    'BDI': { name: 'Burundi', population: 12878172, bps: 0.17, dps: 0.03 },
    'KHM': { name: 'Cambodia', population: 16767842, bps: 0.08, dps: 0.03 },
    'CMR': { name: 'Cameroon', population: 28647293, bps: 0.33, dps: 0.08 },
    'CAN': { name: 'Canada', population: 38781291, bps: 0.11, dps: 0.09 },
    'CAF': { name: 'Central African Republic', population: 5579144, bps: 0.07, dps: 0.02 },
    'TCD': { name: 'Chad', population: 17723315, bps: 0.24, dps: 0.05 },
    'CHL': { name: 'Chile', population: 19629590, bps: 0.07, dps: 0.05 },
    'CHN': { name: 'China', population: 1425671352, bps: 0.32, dps: 0.33 },
    'COL': { name: 'Colombia', population: 52085168, bps: 0.18, dps: 0.07 },
    'COM': { name: 'Comoros', population: 852075, bps: 0.005, dps: 0.002 },
    'COG': { name: 'Congo', population: 5970424, bps: 0.07, dps: 0.02 },
    'COD': { name: 'DR Congo', population: 102262808, bps: 1.24, dps: 0.27 },
    'CRI': { name: 'Costa Rica', population: 5180829, bps: 0.02, dps: 0.01 },
    'HRV': { name: 'Croatia', population: 4008617, bps: 0.01, dps: 0.02 },
    'CUB': { name: 'Cuba', population: 11212191, bps: 0.03, dps: 0.03 },
    'CYP': { name: 'Cyprus', population: 1251488, bps: 0.004, dps: 0.003 },
    'CZE': { name: 'Czech Republic', population: 10495295, bps: 0.03, dps: 0.04 },
    'DNK': { name: 'Denmark', population: 5910913, bps: 0.04, dps: 0.04 },
    'DJI': { name: 'Djibouti', population: 1120849, bps: 0.01, dps: 0.003 },
    'DOM': { name: 'Dominican Republic', population: 11332972, bps: 0.05, dps: 0.02 },
    'ECU': { name: 'Ecuador', population: 18001531, bps: 0.08, dps: 0.03 },
    'EGY': { name: 'Egypt', population: 112716598, bps: 0.56, dps: 0.15 },
    'SLV': { name: 'El Salvador', population: 6336392, bps: 0.03, dps: 0.02 },
    'GNQ': { name: 'Equatorial Guinea', population: 1674908, bps: 0.02, dps: 0.005 },
    'ERI': { name: 'Eritrea', population: 3684032, bps: 0.04, dps: 0.01 },
    'EST': { name: 'Estonia', population: 1322765, bps: 0.004, dps: 0.005 },
    'SWZ': { name: 'Eswatini', population: 1201670, bps: 0.01, dps: 0.004 },
    'ETH': { name: 'Ethiopia', population: 126527060, bps: 1.00, dps: 0.20 },
    'FJI': { name: 'Fiji', population: 936375, bps: 0.005, dps: 0.002 },
    'FIN': { name: 'Finland', population: 5545475, bps: 0.02, dps: 0.02 },
    'FRA': { name: 'France', population: 64756584, bps: 0.21, dps: 0.20 },
    'GAB': { name: 'Gabon', population: 2388992, bps: 0.02, dps: 0.01 },
    'GMB': { name: 'Gambia', population: 2705992, bps: 0.03, dps: 0.01 },
    'GEO': { name: 'Georgia', population: 3728282, bps: 0.01, dps: 0.02 },
    'DEU': { name: 'Germany', population: 83294633, bps: 0.24, dps: 0.32 },
    'GHA': { name: 'Ghana', population: 34121985, bps: 0.35, dps: 0.08 },
    'GRC': { name: 'Greece', population: 10445365, bps: 0.03, dps: 0.04 },
    'GTM': { name: 'Guatemala', population: 18092026, bps: 0.14, dps: 0.04 },
    'GIN': { name: 'Guinea', population: 14190612, bps: 0.15, dps: 0.03 },
    'GNB': { name: 'Guinea-Bissau', population: 2105566, bps: 0.02, dps: 0.01 },
    'GUY': { name: 'Guyana', population: 813841, bps: 0.004, dps: 0.002 },
    'HTI': { name: 'Haiti', population: 11724763, bps: 0.09, dps: 0.03 },
    'HND': { name: 'Honduras', population: 10593798, bps: 0.07, dps: 0.02 },
    'HUN': { name: 'Hungary', population: 9603633, bps: 0.03, dps: 0.04 },
    'ISL': { name: 'Iceland', population: 375318, bps: 0.002, dps: 0.001 },
    'IND': { name: 'India', population: 1428627663, bps: 1.48, dps: 0.58 },
    'IDN': { name: 'Indonesia', population: 277534122, bps: 0.88, dps: 0.30 },
    'IRN': { name: 'Iran', population: 89172767, bps: 0.30, dps: 0.15 },
    'IRQ': { name: 'Iraq', population: 45504560, bps: 0.35, dps: 0.08 },
    'IRL': { name: 'Ireland', population: 5056935, bps: 0.02, dps: 0.01 },
    'ISR': { name: 'Israel', population: 9557500, bps: 0.06, dps: 0.02 },
    'ITA': { name: 'Italy', population: 58870762, bps: 0.12, dps: 0.22 },
    'CIV': { name: 'Ivory Coast', population: 28948894, bps: 0.32, dps: 0.07 },
    'JAM': { name: 'Jamaica', population: 2825544, bps: 0.02, dps: 0.01 },
    'JPN': { name: 'Japan', population: 123294513, bps: 0.21, dps: 0.43 },
    'JOR': { name: 'Jordan', population: 11337052, bps: 0.06, dps: 0.02 },
    'KAZ': { name: 'Kazakhstan', population: 19606699, bps: 0.09, dps: 0.05 },
    'KEN': { name: 'Kenya', population: 55183195, bps: 0.58, dps: 0.12 },
    'KIR': { name: 'Kiribati', population: 133515, bps: 0.001, dps: 0.0003 },
    'KWT': { name: 'Kuwait', population: 4268873, bps: 0.02, dps: 0.01 },
    'KGZ': { name: 'Kyrgyzstan', population: 7000602, bps: 0.04, dps: 0.02 },
    'LAO': { name: 'Laos', population: 7529475, bps: 0.04, dps: 0.02 },
    'LVA': { name: 'Latvia', population: 1830211, bps: 0.005, dps: 0.008 },
    'LBN': { name: 'Lebanon', population: 5489739, bps: 0.02, dps: 0.02 },
    'LSO': { name: 'Lesotho', population: 2305825, bps: 0.02, dps: 0.01 },
    'LBR': { name: 'Liberia', population: 5418377, bps: 0.06, dps: 0.02 },
    'LBY': { name: 'Libya', population: 6888388, bps: 0.04, dps: 0.01 },
    'LTU': { name: 'Lithuania', population: 2718352, bps: 0.008, dps: 0.01 },
    'LUX': { name: 'Luxembourg', population: 660809, bps: 0.003, dps: 0.002 },
    'MDG': { name: 'Madagascar', population: 30325732, bps: 0.32, dps: 0.07 },
    'MWI': { name: 'Malawi', population: 20931751, bps: 0.25, dps: 0.05 },
    'MYS': { name: 'Malaysia', population: 34308525, bps: 0.14, dps: 0.05 },
    'MDV': { name: 'Maldives', population: 521021, bps: 0.003, dps: 0.001 },
    'MLI': { name: 'Mali', population: 22593590, bps: 0.29, dps: 0.06 },
    'MLT': { name: 'Malta', population: 542051, bps: 0.002, dps: 0.002 },
    'MRT': { name: 'Mauritania', population: 4736139, bps: 0.05, dps: 0.01 },
    'MUS': { name: 'Mauritius', population: 1261043, bps: 0.004, dps: 0.003 },
    'MEX': { name: 'Mexico', population: 128455567, bps: 0.47, dps: 0.19 },
    'MDA': { name: 'Moldova', population: 2512759, bps: 0.008, dps: 0.01 },
    'MCO': { name: 'Monaco', population: 36297, bps: 0.0001, dps: 0.0001 },
    'MNG': { name: 'Mongolia', population: 3447157, bps: 0.02, dps: 0.01 },
    'MNE': { name: 'Montenegro', population: 626485, bps: 0.002, dps: 0.002 },
    'MAR': { name: 'Morocco', population: 37840044, bps: 0.18, dps: 0.07 },
    'MOZ': { name: 'Mozambique', population: 33897354, bps: 0.39, dps: 0.09 },
    'MMR': { name: 'Myanmar', population: 54577997, bps: 0.26, dps: 0.11 },
    'NAM': { name: 'Namibia', population: 2567012, bps: 0.02, dps: 0.01 },
    'NPL': { name: 'Nepal', population: 30896590, bps: 0.14, dps: 0.05 },
    'NLD': { name: 'Netherlands', population: 17618299, bps: 0.06, dps: 0.05 },
    'NZL': { name: 'New Zealand', population: 5228100, bps: 0.02, dps: 0.01 },
    'NIC': { name: 'Nicaragua', population: 7046310, bps: 0.04, dps: 0.02 },
    'NER': { name: 'Niger', population: 27202822, bps: 0.39, dps: 0.07 },
    'NGA': { name: 'Nigeria', population: 223804632, bps: 2.18, dps: 0.48 },
    'PRK': { name: 'North Korea', population: 26160821, bps: 0.08, dps: 0.07 },
    'MKD': { name: 'North Macedonia', population: 2085679, bps: 0.006, dps: 0.007 },
    'NOR': { name: 'Norway', population: 5474360, bps: 0.02, dps: 0.02 },
    'OMN': { name: 'Oman', population: 4644384, bps: 0.02, dps: 0.01 },
    'PAK': { name: 'Pakistan', population: 240485658, bps: 1.52, dps: 0.38 },
    'PAN': { name: 'Panama', population: 4468087, bps: 0.02, dps: 0.01 },
    'PNG': { name: 'Papua New Guinea', population: 10142739, bps: 0.08, dps: 0.02 },
    'PRY': { name: 'Paraguay', population: 6861524, bps: 0.04, dps: 0.02 },
    'PER': { name: 'Peru', population: 34352719, bps: 0.15, dps: 0.07 },
    'PHL': { name: 'Philippines', population: 117337368, bps: 0.62, dps: 0.18 },
    'POL': { name: 'Poland', population: 38336000, bps: 0.10, dps: 0.14 },
    'PRT': { name: 'Portugal', population: 10247605, bps: 0.03, dps: 0.04 },
    'QAT': { name: 'Qatar', population: 2716391, bps: 0.01, dps: 0.004 },
    'ROU': { name: 'Romania', population: 19051562, bps: 0.05, dps: 0.08 },
    'RUS': { name: 'Russia', population: 144444359, bps: 0.38, dps: 0.58 },
    'RWA': { name: 'Rwanda', population: 14094683, bps: 0.15, dps: 0.03 },
    'SAU': { name: 'Saudi Arabia', population: 36918469, bps: 0.16, dps: 0.05 },
    'SEN': { name: 'Senegal', population: 17763163, bps: 0.22, dps: 0.04 },
    'SRB': { name: 'Serbia', population: 6664449, bps: 0.02, dps: 0.03 },
    'SYC': { name: 'Seychelles', population: 107118, bps: 0.0004, dps: 0.0003 },
    'SLE': { name: 'Sierra Leone', population: 8605739, bps: 0.09, dps: 0.02 },
    'SGP': { name: 'Singapore', population: 5917600, bps: 0.02, dps: 0.02 },
    'SVK': { name: 'Slovakia', population: 5431194, bps: 0.02, dps: 0.02 },
    'SVN': { name: 'Slovenia', population: 2108977, bps: 0.006, dps: 0.007 },
    'SLB': { name: 'Solomon Islands', population: 740424, bps: 0.004, dps: 0.001 },
    'SOM': { name: 'Somalia', population: 18143378, bps: 0.24, dps: 0.05 },
    'ZAF': { name: 'South Africa', population: 60414495, bps: 0.30, dps: 0.19 },
    'KOR': { name: 'South Korea', population: 51784059, bps: 0.07, dps: 0.12 },
    'SSD': { name: 'South Sudan', population: 11062113, bps: 0.14, dps: 0.03 },
    'ESP': { name: 'Spain', population: 47519628, bps: 0.11, dps: 0.15 },
    'LKA': { name: 'Sri Lanka', population: 21893579, bps: 0.07, dps: 0.06 },
    'SDN': { name: 'Sudan', population: 48109006, bps: 0.52, dps: 0.12 },
    'SUR': { name: 'Suriname', population: 623236, bps: 0.003, dps: 0.002 },
    'SWE': { name: 'Sweden', population: 10612086, bps: 0.03, dps: 0.03 },
    'CHE': { name: 'Switzerland', population: 8796669, bps: 0.03, dps: 0.03 },
    'SYR': { name: 'Syria', population: 23227014, bps: 0.15, dps: 0.05 },
    'TWN': { name: 'Taiwan', population: 23923276, bps: 0.05, dps: 0.06 },
    'TJK': { name: 'Tajikistan', population: 10143543, bps: 0.08, dps: 0.02 },
    'TZA': { name: 'Tanzania', population: 67438106, bps: 0.78, dps: 0.15 },
    'THA': { name: 'Thailand', population: 71801279, bps: 0.20, dps: 0.20 },
    'TGO': { name: 'Togo', population: 9053799, bps: 0.10, dps: 0.02 },
    'TTO': { name: 'Trinidad and Tobago', population: 1534937, bps: 0.006, dps: 0.004 },
    'TUN': { name: 'Tunisia', population: 12458223, bps: 0.05, dps: 0.03 },
    'TUR': { name: 'Turkey', population: 85816199, bps: 0.33, dps: 0.18 },
    'TKM': { name: 'Turkmenistan', population: 6516100, bps: 0.04, dps: 0.02 },
    'UGA': { name: 'Uganda', population: 48582334, bps: 0.59, dps: 0.12 },
    'UKR': { name: 'Ukraine', population: 36744634, bps: 0.08, dps: 0.17 },
    'ARE': { name: 'UAE', population: 9516871, bps: 0.04, dps: 0.01 },
    'GBR': { name: 'United Kingdom', population: 67736802, bps: 0.20, dps: 0.20 },
    'USA': { name: 'United States', population: 339996563, bps: 1.16, dps: 0.99 },
    'URY': { name: 'Uruguay', population: 3423108, bps: 0.01, dps: 0.01 },
    'UZB': { name: 'Uzbekistan', population: 35163944, bps: 0.22, dps: 0.07 },
    'VUT': { name: 'Vanuatu', population: 334506, bps: 0.002, dps: 0.001 },
    'VEN': { name: 'Venezuela', population: 28301696, bps: 0.14, dps: 0.08 },
    'VNM': { name: 'Vietnam', population: 98858950, bps: 0.35, dps: 0.20 },
    'YEM': { name: 'Yemen', population: 34449825, bps: 0.36, dps: 0.09 },
    'ZMB': { name: 'Zambia', population: 20569737, bps: 0.24, dps: 0.05 },
    'ZWE': { name: 'Zimbabwe', population: 16665409, bps: 0.18, dps: 0.04 }
};

// ==================== STATE MANAGEMENT ====================
let selectedCountry = null;
let countryStates = {};
let geojsonLayer = null;
let animationFrame = null;
let currentCountryName = '';
let currentCountryCode = '';
let currentMode = 'report';
let reportGenerated = false;
let currentReportContent = '';
let currentThreatLevel = null;
let forceRefreshReport = false;

// Per-country chat histories stored in memory (cached from DB)
let countryChatHistories = {};

// Initialize country states
Object.keys(countryData).forEach(code => {
    const data = countryData[code];
    countryStates[code] = {
        births: Math.floor(data.population * 0.3),
        deaths: Math.floor(data.population * 0.15),
        birthsToday: Math.floor(data.bps * 86400 * Math.random()),
        deathsToday: Math.floor(data.dps * 86400 * Math.random()),
        lastUpdate: Date.now()
    };
});

// Initialize Map
const map = L.map('map', {
    zoomControl: true,
    attributionControl: true,
    zoomAnimation: true,
    fadeAnimation: true,
    minZoom: 2,
    maxZoom: 6
}).setView([20, 0], 2);

// Add CartoDB Dark Matter tiles
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    subdomains: 'abcd',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
}).addTo(map);

// Style for countries
function style(feature) {
    return {
        fillColor: 'rgba(0, 243, 255, 0.1)',
        weight: 1,
        opacity: 1,
        color: 'rgba(0, 243, 255, 0.5)',
        fillOpacity: 0.1
    };
}

// Highlight on hover
function highlightFeature(e) {
    const layer = e.target;
    if (selectedCountry !== layer.feature.id) {
        layer.setStyle({
            weight: 2,
            color: '#fff',
            fillOpacity: 0.3
        });
    }
}

// Reset highlight
function resetHighlight(e) {
    const layer = e.target;
    if (selectedCountry !== layer.feature.id) {
        geojsonLayer.resetStyle(layer);
    }
}

// Country click handler
function onCountryClick(e) {
    const layer = e.target;
    const countryCode = layer.feature.id;

    // If clicking on the same country, do nothing
    if (selectedCountry === countryCode) {
        return;
    }

    // Reset the previously selected country
    if (selectedCountry) {
        geojsonLayer.eachLayer(prevLayer => {
            if (prevLayer.feature.id === selectedCountry) {
                geojsonLayer.resetStyle(prevLayer);
            }
        });
    }

    selectedCountry = countryCode;
    layer.setStyle({
        weight: 3,
        color: '#fff',
        fillColor: 'rgba(0, 243, 255, 0.4)',
        fillOpacity: 0.4
    });

    showCountryData(countryCode);
}

// On each feature
function onEachFeature(feature, layer) {
    layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight,
        click: onCountryClick
    });
}

// Load GeoJSON
fetch('https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json')
    .then(response => response.json())
    .then(data => {
        geojsonLayer = L.geoJson(data, {
            style: style,
            onEachFeature: onEachFeature
        }).addTo(map);

        setTimeout(() => {
            const loader = document.getElementById('loader');
            loader.style.opacity = '0';
            setTimeout(() => loader.remove(), 1000);
            startAnimation();
        }, 1500);
    })
    .catch(err => {
        console.error('Error loading GeoJSON:', err);
        document.getElementById('loader').innerHTML = '<div class="loader-text" style="color: var(--neon-red);">ERROR LOADING MAP DATA</div>';
    });

// Show country data
async function showCountryData(code) {
    const data = countryData[code];
    if (!data) return;

    currentCountryName = data.name;
    currentCountryCode = code;
    currentMode = 'report';

    document.getElementById('countryName').textContent = data.name;
    document.getElementById('isoCode').textContent = code;
    document.getElementById('population').textContent = data.population.toLocaleString();

    updateModeButtons();
    
    // Open panel
    openSidePanel();

    // Load chat history from DB for this country
    await loadChatHistoryForCountry(code);

    // Check for existing queries in DB and load history panel
    await loadHistoryPanel();

    // Generate or show cached report
    generateOSINTReport();
}

// Load chat history for a specific country from file storage
async function loadChatHistoryForCountry(countryCode) {
    try {
        // Load chat history from dedicated chat file
        const chatHistory = await loadChatHistory(countryCode);
        countryChatHistories[countryCode] = chatHistory;
        console.log(`Loaded ${countryChatHistories[countryCode].length} chat messages for ${countryCode}`);
    } catch (error) {
        console.error('Error loading chat history:', error);
        countryChatHistories[countryCode] = [];
    }
}

// Get current chat messages for the selected country
function getCurrentChatMessages() {
    return countryChatHistories[currentCountryCode] || [];
}

// Set chat messages for the current country
function setCurrentChatMessages(messages) {
    countryChatHistories[currentCountryCode] = messages;
}

// Update mode buttons
function updateModeButtons() {
    const reportBtn = document.getElementById('reportModeBtn');
    const chatBtn = document.getElementById('chatModeBtn');
    const chatInputContainer = document.getElementById('chatInputContainer');

    if (currentMode === 'report') {
        reportBtn.classList.add('active');
        chatBtn.classList.remove('active');
        chatInputContainer.style.display = 'none';
    } else {
        reportBtn.classList.remove('active');
        chatBtn.classList.add('active');
        chatInputContainer.style.display = 'flex';
    }
}

// Load history panel
async function loadHistoryPanel() {
    const historyPanel = document.getElementById('historyPanel');
    const historyList = document.getElementById('historyList');

    try {
        const queries = await getQueriesByCountry(currentCountryCode);

        if (queries.length > 0) {
            historyPanel.style.display = 'block';
            historyList.innerHTML = queries.map(q => `
                <div class="history-item" data-mode="${q.mode}" data-query="${escapeHtml(q.query)}">
                    <div class="history-item-date">${new Date(q.timestamp).toLocaleString()}</div>
                    <div class="history-item-query">${escapeHtml(q.query.substring(0, 80))}${q.query.length > 80 ? '...' : ''}</div>
                    <div class="history-item-country">${q.countryName}</div>
                </div>
            `).join('');

            document.querySelectorAll('.history-item').forEach(item => {
                item.addEventListener('click', () => {
                    const mode = item.getAttribute('data-mode');
                    const query = item.getAttribute('data-query');
                    if (mode === 'chat') {
                        switchToChat(query);
                    } else {
                        currentMode = 'report';
                        updateModeButtons();
                        generateOSINTReport();
                    }
                });
            });
        } else {
            historyPanel.style.display = 'none';
        }
    } catch (error) {
        console.error('Error loading history:', error);
        historyPanel.style.display = 'none';
    }
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/"/g, '&quot;');
}

// ==================== THREAT LEVEL ANALYSIS ====================
// Analyze report content and calculate threat level
function analyzeThreatLevel(reportText) {
    if (!reportText) return { level: 0, label: 'UNKNOWN', color: '#888' };

    const text = reportText.toLowerCase();

    // Threat keywords with weights
    const threatKeywords = {
        // Critical threats (weight: 5)
        'war': 5, 'nuclear': 5, 'missile': 5, 'invasion': 5, 'genocide': 5,
        'chemical weapon': 5, 'biological weapon': 5, 'terrorism': 5,

        // High threats (weight: 4)
        'conflict': 4, 'military operation': 4, 'attack': 4, 'bombing': 4,
        'civil war': 4, 'rebellion': 4, 'insurgency': 4,

        // Elevated threats (weight: 3)
        'protest': 3, 'unrest': 3, 'coup': 3, 'sanctions': 3,
        'crisis': 3, 'emergency': 3, 'evacuation': 3, 'disaster': 3,

        // Moderate threats (weight: 2)
        'tension': 2, 'dispute': 2, 'strike': 2, 'inflation': 2,
        'unemployment': 2, 'flood': 2, 'earthquake': 2,

        // Low threats (weight: 1)
        'concern': 1, 'warning': 1, 'risk': 1, 'challenge': 1
    };

    let threatScore = 0;
    let maxPossibleScore = 0;

    for (const [keyword, weight] of Object.entries(threatKeywords)) {
        const regex = new RegExp(keyword, 'g');
        const matches = text.match(regex);
        if (matches) {
            threatScore += matches.length * weight;
        }
        maxPossibleScore += weight * 3; // Assume max 3 occurrences per keyword
    }

    // Normalize to 0-100 scale
    const normalizedScore = Math.min(100, (threatScore / maxPossibleScore) * 100);

    // Determine threat level
    let level, label, color;
    if (normalizedScore < 20) {
        level = 10;
        label = 'LOW';
        color = 'var(--neon-green)';
    } else if (normalizedScore < 40) {
        level = 30;
        label = 'MODERATE';
        color = '#88cc00';
    } else if (normalizedScore < 60) {
        level = 50;
        label = 'ELEVATED';
        color = 'var(--neon-orange)';
    } else if (normalizedScore < 80) {
        level = 75;
        label = 'HIGH';
        color = 'var(--neon-red)';
    } else {
        level = 95;
        label = 'CRITICAL';
        color = 'var(--neon-pink)';
    }

    return { level, label, color, score: normalizedScore };
}

// Update threat level display
function updateThreatLevelDisplay(threatLevel) {
    const container = document.getElementById('threatLevelContainer');
    const indicator = document.getElementById('threatLevelIndicator');
    const valueEl = document.getElementById('threatLevelValue');

    if (!threatLevel || threatLevel.label === 'UNKNOWN') {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';
    indicator.style.left = `${threatLevel.level}%`;
    indicator.style.backgroundColor = threatLevel.color;
    indicator.style.boxShadow = `0 0 10px ${threatLevel.color}, 0 0 20px ${threatLevel.color}`;

    valueEl.textContent = threatLevel.label;
    valueEl.className = 'threat-level-value ' + threatLevel.label.toLowerCase();
    valueEl.style.color = threatLevel.color;
}

// Generate OSINT report
async function generateOSINTReport(forceRefresh = false) {
    const messagesDiv = document.getElementById('chatMessages');

    // Check for existing cached report in DB first (within 24 hours)
    // Skip this check if forceRefresh is true
    if (!forceRefresh) {
        try {
            const queries = await getQueriesByCountry(currentCountryCode);
            const cachedReport = queries.find(q => q.mode === 'report' && q.query === 'OSINT Intelligence Brief');

            // Check if report exists and is within 24 hours
            if (cachedReport && cachedReport.response && cachedReport.timestamp) {
                const reportAge = Date.now() - cachedReport.timestamp;
                const twentyFourHours = 24 * 60 * 60 * 1000;

                if (reportAge < twentyFourHours) {
                    console.log('Using cached report for', currentCountryCode, '(age:', Math.round(reportAge / 1000 / 60), 'min)');
                    currentReportContent = cachedReport.response;
                    reportGenerated = true;

                    // Analyze threat level from cached report
                    currentThreatLevel = analyzeThreatLevel(cachedReport.response);
                    updateThreatLevelDisplay(currentThreatLevel);

                    displayReport(cachedReport.response);

                    // Auto-download the cached report
                    autoDownloadReport();

                    return;
                } else {
                    console.log('Cached report expired (age:', Math.round(reportAge / 1000 / 60 / 60), 'h), generating new one');
                }
            }
        } catch (error) {
            console.error('Error checking cached report:', error);
        }
    } else {
        console.log('Force refresh requested, generating new report');
    }

    messagesDiv.innerHTML = '<div class="message ai">Gathering intelligence from open sources...</div>';

    const webSearchEnabled = document.getElementById('webSearchToggle').checked;

    try {
        const data = countryData[currentCountryCode];

        // First, authorize report generation (rate limiting + hidden prompt)
        let authResponse = null;
        try {
            const authRes = await fetch('generate_report.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    countryCode: currentCountryCode,
                    countryName: currentCountryName,
                    population: data.population,
                    webSearchEnabled: webSearchEnabled
                })
            });
            authResponse = await authRes.json();
            
            if (!authResponse.success) {
                throw new Error(authResponse.message || 'Authorization failed');
            }
            
            console.log('Report generation authorized:', authResponse.rateLimit);
        } catch (authError) {
            console.error('Authorization error:', authError);
            // If authorization fails, show rate limit message
            if (authResponse && authResponse.error) {
                messagesDiv.innerHTML = `
                    <div class="message error">
                        ⚠️ ${authResponse.message}<br><br>
                        Please wait before generating another report.
                    </div>
                `;
                return;
            }
            // Continue with client-side generation if authorization fails silently
        }

        // AI prompt is now hidden on server (generate_report.php)
        // Client-side prompt is minimal
        const osintPrompt = `Generate a comprehensive OSINT intelligence brief about ${data.name} (population: ${data.population.toLocaleString()}). Focus on recent events, current situations, and security implications. Structure with clear sections using ## headers. This is a final brief - no closing questions or offers for assistance.`;

        let response;
        if (webSearchEnabled) {
            response = await puter.ai.chat([
                { role: 'user', content: osintPrompt }
            ], {
                model: 'openai/gpt-5.2-chat',
                tools: [{ type: 'web_search' }]
            });
        } else {
            response = await puter.ai.chat([
                { role: 'user', content: osintPrompt }
            ]);
        }

        const reportText = response.message?.content || response.toString() || 'Unable to generate intelligence brief.';
        currentReportContent = reportText;
        reportGenerated = true;
        console.log('Report generated, length:', reportText.length);

        // Analyze and update threat level
        currentThreatLevel = analyzeThreatLevel(reportText);
        updateThreatLevelDisplay(currentThreatLevel);

        // Save to file storage
        await saveQuery(currentCountryCode, currentCountryName, 'OSINT Intelligence Brief', reportText, 'report');

        displayReport(reportText);

        // Auto-download the newly generated report
        autoDownloadReport();

    } catch (error) {
        console.error('OSINT report error:', error);
        const data = countryData[currentCountryCode];
        messagesDiv.innerHTML = `
            <div class="message error">
                Unable to gather intelligence: ${error.message || error}. Check connection and try again.
            </div>
            <div class="osint-quick-actions">
                <div class="report-title" style="grid-column: 1/-1; margin-bottom: 8px;">Manual Queries</div>
                <div class="osint-action critical" data-query="Current security threats in ${data.name}">⚔️ Security Threats</div>
                <div class="osint-action warning" data-query="Political situation in ${data.name}">🏛️ Politics</div>
                <div class="osint-action" data-query="Economic crisis in ${data.name}">💰 Economy</div>
            </div>
        `;

        document.querySelectorAll('.osint-action').forEach(btn => {
            btn.addEventListener('click', () => {
                const query = btn.getAttribute('data-query');
                switchToChat(query);
            });
        });
    }
}

// Display report from cached content
function displayReport(reportText) {
    const messagesDiv = document.getElementById('chatMessages');
    const data = countryData[currentCountryCode];

    // Parse sections
    const sections = reportText.split(/##\s+/).filter(s => s.trim());
    console.log('Parsed sections:', sections.length);

    let html = '';
    sections.forEach(section => {
        const lines = section.trim().split('\n');
        let title = lines[0].trim();
        const content = lines.slice(1).join('\n').trim();

        // Determine section type for styling
        let sectionClass = 'info';
        let titleClass = 'info';

        if (title.includes('🚨') || title.includes('CRITICAL') || title.includes('ALERT')) {
            sectionClass = 'critical';
            titleClass = 'critical';
        } else if (title.includes('⚠️') || title.includes('POLITICAL') || title.includes('WARNING')) {
            sectionClass = 'warning';
            titleClass = 'warning';
        }

        // Clean title
        title = title.replace(/^[🚨⚠️💰🌪️📊]\s*/, '');

        if (title && content) {
            // Use marked.js to render markdown content
            const renderedContent = marked.parse(content);
            html += `
                <div class="report-section ${sectionClass}">
                    <div class="report-title ${titleClass}">${title}</div>
                    <div class="report-content">${renderedContent}</div>
                </div>
            `;
        }
    });

    // OSINT Quick Actions
    html += `
        <div class="osint-quick-actions">
            <div class="report-title" style="grid-column: 1/-1; margin-bottom: 8px;">Quick Intelligence Queries</div>
            <div class="osint-action critical" data-query="What are the current military conflicts or security threats in ${data.name}?">⚔️ Military & Security</div>
            <div class="osint-action warning" data-query="What is the current political stability situation in ${data.name}? Any protests or unrest?">🏛️ Political Stability</div>
            <div class="osint-action" data-query="What is the economic situation in ${data.name}? Any crisis, sanctions, or strikes?">💰 Economic Intel</div>
            <div class="osint-action" data-query="Are there any natural disasters, humanitarian crises, or health emergencies in ${data.name}?">🌪️ Disasters & Crisis</div>
            <div class="osint-action" data-query="What are the recent diplomatic relations and international alliances of ${data.name}?">🤝 Diplomatic Relations</div>
            <div class="osint-action" data-query="What is the human rights situation in ${data.name}? Any concerns or violations reported?">⚖️ Human Rights</div>
        </div>
    `;

    console.log('Setting HTML content, length:', html.length);
    messagesDiv.innerHTML = html;

    // Reload history and attach handlers
    loadHistoryPanel().then(() => {
        // Add click handlers for quick actions
        document.querySelectorAll('.osint-action').forEach(btn => {
            btn.addEventListener('click', () => {
                const query = btn.getAttribute('data-query');
                switchToChat(query);
            });
        });
    });
}

// Switch to chat mode
function switchToChat(initialQuery = '') {
    currentMode = 'chat';
    updateModeButtons();

    const messagesDiv = document.getElementById('chatMessages');
    messagesDiv.innerHTML = '';

    // Get chat history for current country
    const chatMessages = getCurrentChatMessages();

    // If no chat history, add initial message
    if (!chatMessages.length) {
        const initialMessage = {
            role: 'assistant',
            content: `**Intelligence Brief Summary:** I've prepared an OSINT report on ${currentCountryName}. Switch to **Intel Brief** mode to review, or continue querying here.`
        };
        setCurrentChatMessages([initialMessage]);
        renderChatMessages([initialMessage]);
    } else {
        renderChatMessages(chatMessages);
    }

    if (initialQuery) {
        setTimeout(() => {
            document.getElementById('chatInput').value = initialQuery;
            sendMessage();
        }, 300);
    }
}

// Render chat messages
function renderChatMessages(messages = null) {
    const messagesDiv = document.getElementById('chatMessages');
    const chatMessages = messages || getCurrentChatMessages();

    messagesDiv.innerHTML = '';

    chatMessages.forEach(msg => {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message');
        messageDiv.classList.add(msg.role === 'user' ? 'user' : 'ai');

        // Use marked.js for proper markdown rendering
        let content = marked.parse(msg.content);
        messageDiv.innerHTML = content;
        messagesDiv.appendChild(messageDiv);
    });

    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Add message to chat
function addMessage(content, isUser) {
    const messagesDiv = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message');
    messageDiv.classList.add(isUser ? 'user' : 'ai');

    // Use marked.js for AI messages
    if (!isUser) {
        messageDiv.innerHTML = marked.parse(content);
    } else {
        messageDiv.textContent = content;
    }

    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    // Update in-memory chat history
    const chatMessages = getCurrentChatMessages();
    chatMessages.push({
        role: isUser ? 'user' : 'assistant',
        content: content
    });
    setCurrentChatMessages(chatMessages);
}

// Show typing indicator
function showTypingIndicator() {
    const messagesDiv = document.getElementById('chatMessages');
    const typingDiv = document.createElement('div');
    typingDiv.classList.add('message', 'ai', 'typing-indicator');
    typingDiv.id = 'typingIndicator';
    typingDiv.innerHTML = '<span></span><span></span><span></span>';
    messagesDiv.appendChild(typingDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Remove typing indicator
function removeTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) {
        indicator.remove();
    }
}

// Send message
async function sendMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    const sendBtn = document.getElementById('sendBtn');
    const webSearchEnabled = document.getElementById('webSearchToggle').checked;

    if (!message) return;

    input.disabled = true;
    sendBtn.disabled = true;

    addMessage(message, true);
    input.value = '';

    showTypingIndicator();

    try {
        const contextMessage = `You are an OSINT (Open Source Intelligence) analyst assistant. The user is asking about ${currentCountryName} (ISO: ${currentCountryCode}, Population: ${countryData[currentCountryCode]?.population.toLocaleString()}).

Provide factual, intelligence-focused responses based on open sources. Prioritize:
1. Recent events and developing situations
2. Security implications
3. Verified information from multiple sources
4. Context about ongoing situations

Use markdown formatting (**bold** for emphasis). Be concise but thorough (2-4 paragraphs). If information is uncertain, clearly state this.`;

        const chatMessages = getCurrentChatMessages();
        const messagesWithContext = [
            { role: 'system', content: contextMessage },
            ...chatMessages.filter(m => m.role !== 'system')
        ];

        let response;
        if (webSearchEnabled) {
            response = await puter.ai.chat(messagesWithContext, {
                model: 'openai/gpt-5.2-chat',
                tools: [{ type: 'web_search' }]
            });
        } else {
            response = await puter.ai.chat(messagesWithContext);
        }

        removeTypingIndicator();

        const responseText = response.message?.content || response.toString() || 'Intelligence query failed. Please try again.';
        addMessage(responseText, false);

        // Save to file storage (don't block)
        Promise.all([
            saveQuery(currentCountryCode, currentCountryName, message, responseText, 'chat'),
            saveChatHistory(currentCountryCode, getCurrentChatMessages())
        ])
            .then(() => loadHistoryPanel())
            .catch(err => console.error('Error saving chat:', err));

    } catch (error) {
        console.error('OSINT query error:', error);
        removeTypingIndicator();
        addMessage('Intelligence gathering failed: ' + (error.message || error) + '. Check connection and retry.', false);
    } finally {
        input.disabled = false;
        sendBtn.disabled = false;
        input.focus();
    }
}

// Download report
function downloadReport() {
    if (!currentReportContent) {
        showToast('No report available to download.', 'warning');
        return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `OSINT_Report_${currentCountryName.replace(/\s+/g, '_')}_${timestamp}.md`;

    const content = `# OSINT Intelligence Brief: ${currentCountryName}\n\n**Generated:** ${new Date().toLocaleString()}\n**ISO Code:** ${currentCountryCode}\n**Population:** ${countryData[currentCountryCode]?.population.toLocaleString()}\n${currentThreatLevel ? `\n**Threat Level:** ${currentThreatLevel.label}\n` : ''}\n---\n\n${currentReportContent}`;

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('Report downloaded successfully!', 'success');
}

// Auto-download report (silent, no toast notification)
function autoDownloadReport() {
    if (!currentReportContent) {
        return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `OSINT_Report_${currentCountryName.replace(/\s+/g, '_')}_${timestamp}.md`;

    const content = `# OSINT Intelligence Brief: ${currentCountryName}\n\n**Generated:** ${new Date().toLocaleString()}\n**ISO Code:** ${currentCountryCode}\n**Population:** ${countryData[currentCountryCode]?.population.toLocaleString()}\n${currentThreatLevel ? `\n**Threat Level:** ${currentThreatLevel.label}\n` : ''}\n---\n\n${currentReportContent}`;

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log('Report auto-downloaded:', filename);
}

// Download chat
function downloadChat() {
    const chatMessages = getCurrentChatMessages();
    if (chatMessages.length === 0) {
        showToast('No chat history available to download.', 'warning');
        return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `OSINT_Chat_${currentCountryName.replace(/\s+/g, '_')}_${timestamp}.md`;

    let content = `# OSINT Chat: ${currentCountryName}\n\n`;
    content += `**ISO Code:** ${currentCountryCode}\n\n---\n\n`;

    chatMessages.forEach(msg => {
        const role = msg.role === 'user' ? '👤 You' : '🤖 AI';
        content += `### ${role}\n\n${msg.content}\n\n`;
    });

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('Chat history downloaded!', 'success');
}

// Clear history
async function clearHistory() {
    if (!confirm(`Clear all query history for ${currentCountryName}?`)) return;

    try {
        await clearQueriesByCountry(currentCountryCode);
        // Clear from server
        await fetch(`${API_URL}?action=delete_report&country=${currentCountryCode}`, {
            method: 'DELETE'
        });
        // Clear chat from server and localStorage
        await fetch(`${API_URL}?action=delete_report&country=${currentCountryCode}`, {
            method: 'DELETE'
        }).catch(() => {});
        localStorage.removeItem(`osint_chat_${currentCountryCode}`);
        countryChatHistories[currentCountryCode] = [];
        document.getElementById('historyPanel').style.display = 'none';
        document.getElementById('chatMessages').innerHTML = '<div class="message ai">History cleared. Start a new conversation.</div>';
        showToast('History cleared successfully.', 'success');
    } catch (error) {
        console.error('Error clearing history:', error);
        showToast('Failed to clear history.', 'error');
    }
}

// ==================== DATA MANAGEMENT FUNCTIONS ====================
// Export all data
async function exportAllData() {
    try {
        const queries = await getAllQueries();

        const exportData = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            totalQueries: queries.length,
            countries: [...new Set(queries.map(q => q.countryCode))],
            queries: queries
        };

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `OSINT_Data_Export_${timestamp}.json`;

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast(`Exported ${queries.length} queries successfully!`, 'success');
    } catch (error) {
        console.error('Export error:', error);
        showToast('Failed to export data.', 'error');
    }
}

// Import data
function importData() {
    document.getElementById('importFileInput').click();
}

// Handle file import
async function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (!data.queries || !Array.isArray(data.queries)) {
            throw new Error('Invalid file format: missing queries array');
        }

        const count = await importQueries(data.queries);

        if (count > 0) {
            showToast(`Imported ${count} queries successfully!`, 'success');
            // Reload history if current country has new data
            await loadHistoryPanel();
        } else {
            showToast('No queries were imported.', 'warning');
        }
    } catch (error) {
        console.error('Import error:', error);
        showToast('Failed to import: Invalid file format.', 'error');
    }

    // Reset file input
    event.target.value = '';
}

// Wipe all data
async function wipeAllData() {
    if (!confirm('⚠️ WARNING: This will delete ALL query history for ALL countries. This action cannot be undone!\n\nAre you absolutely sure?')) return;
    if (!confirm('Final confirmation: Delete all data?')) return;

    try {
        await clearAllQueries();
        // Clear chat history from localStorage
        try {
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('osint_chat_')) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));
        } catch (e) {}
        countryChatHistories = {};
        document.getElementById('historyPanel').style.display = 'none';
        document.getElementById('chatMessages').innerHTML = '<div class="message ai">All data wiped. Select a country to start fresh.</div>';
        showToast('All data has been wiped.', 'success');
    } catch (error) {
        console.error('Wipe error:', error);
        showToast('Failed to wipe data.', 'error');
    }
}

// Show statistics
async function showStatistics() {
    try {
        const queries = await getAllQueries();

        const stats = {
            totalQueries: queries.length,
            byMode: {
                report: queries.filter(q => q.mode === 'report').length,
                chat: queries.filter(q => q.mode === 'chat').length
            },
            byCountry: {},
            dateRange: {
                first: queries.length > 0 ? new Date(queries[queries.length - 1].timestamp).toLocaleDateString() : 'N/A',
                last: queries.length > 0 ? new Date(queries[0].timestamp).toLocaleDateString() : 'N/A'
            }
        };

        queries.forEach(q => {
            stats.byCountry[q.countryName] = (stats.byCountry[q.countryName] || 0) + 1;
        });

        const topCountries = Object.entries(stats.byCountry)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, count]) => `${name}: ${count}`)
            .join('\n');

        const statsMessage = `📊 **Statistics**\n\n` +
            `**Total Queries:** ${stats.totalQueries}\n\n` +
            `**By Mode:**\n` +
            `• Reports: ${stats.byMode.report}\n` +
            `• Chat: ${stats.byMode.chat}\n\n` +
            `**Top 5 Countries:**\n${topCountries || 'None'}\n\n` +
            `**Date Range:**\n${stats.dateRange.first} - ${stats.dateRange.last}`;

        alert(statsMessage);
    } catch (error) {
        console.error('Stats error:', error);
        showToast('Failed to load statistics.', 'error');
    }
}

// ==================== TOAST NOTIFICATIONS ====================
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    // Auto-remove after 4 seconds
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Mode button listeners
document.getElementById('reportModeBtn').addEventListener('click', () => {
    if (currentMode !== 'report') {
        currentMode = 'report';
        updateModeButtons();
        generateOSINTReport();
    }
});

document.getElementById('chatModeBtn').addEventListener('click', () => {
    if (currentMode !== 'chat') {
        switchToChat();
    }
});

document.getElementById('sendBtn').addEventListener('click', sendMessage);
document.getElementById('chatInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// Download buttons
document.getElementById('downloadReportBtn').addEventListener('click', downloadReport);
document.getElementById('downloadChatBtn').addEventListener('click', downloadChat);
document.getElementById('clearHistoryBtn').addEventListener('click', clearHistory);

// Refresh report button
document.getElementById('refreshReportBtn').addEventListener('click', () => {
    if (!currentCountryCode) {
        showToast('No country selected.', 'warning');
        return;
    }
    showToast('Generating fresh intelligence report...', 'info');
    generateOSINTReport(true);
});

// Data management buttons
document.getElementById('exportDataBtn').addEventListener('click', exportAllData);
document.getElementById('importDataBtn').addEventListener('click', importData);
document.getElementById('wipeAllDataBtn').addEventListener('click', wipeAllData);
document.getElementById('statsBtn').addEventListener('click', showStatistics);

// File import handler
document.getElementById('importFileInput').addEventListener('change', handleFileImport);

// Mobile menu button
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const panelOverlay = document.getElementById('panelOverlay');

// Open panel with mobile menu button
if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
        openSidePanel();
    });
}

// Close panel with overlay
if (panelOverlay) {
    panelOverlay.addEventListener('click', () => {
        closeSidePanel();
    });
}

// Open side panel
function openSidePanel() {
    document.getElementById('sidePanel').classList.add('active');
    if (panelOverlay) {
        panelOverlay.classList.add('active');
    }
    document.body.style.overflow = 'hidden';
}

// Close side panel
function closeSidePanel() {
    document.getElementById('sidePanel').classList.remove('active');
    if (panelOverlay) {
        panelOverlay.classList.remove('active');
    }
    document.body.style.overflow = '';

    if (selectedCountry && geojsonLayer) {
        geojsonLayer.eachLayer(layer => {
            if (layer.feature.id === selectedCountry) {
                geojsonLayer.resetStyle(layer);
            }
        });
    }
    selectedCountry = null;
    currentCountryName = '';
    currentCountryCode = '';
}

// Close panel button
document.getElementById('closeBtn').addEventListener('click', () => {
    closeSidePanel();
});

// Global stats animation
let globalBirths = 0;
let globalDeaths = 0;

function startAnimation() {
    function animate() {
        let totalBps = 0;
        let totalDps = 0;

        Object.keys(countryData).forEach(code => {
            const data = countryData[code];
            const state = countryStates[code];

            const bInc = data.bps / 10;
            const dInc = data.dps / 10;

            state.births += bInc;
            state.deaths += dInc;
            state.birthsToday += bInc;
            state.deathsToday += dInc;

            totalBps += data.bps;
            totalDps += data.dps;
        });

        globalBirths = totalBps;
        globalDeaths = totalDps;
        const globalNet = totalBps - totalDps;

        document.getElementById('globalBirths').textContent = globalBirths.toFixed(1);
        document.getElementById('globalDeaths').textContent = globalDps.toFixed(1);
        document.getElementById('globalNet').textContent = globalNet.toFixed(1);

        animationFrame = requestAnimationFrame(animate);
    }

    animate();
}

// Responsive
window.addEventListener('resize', () => {
    const chatContainer = document.querySelector('.chat-container');
    if (chatContainer) {
        // Check if mobile
        if (window.innerWidth <= 768) {
            chatContainer.style.height = `calc(85vh - 280px)`;
        } else {
            chatContainer.style.height = `calc(100vh - 320px)`;
        }
    }
});

// Prevent double-tap zoom on mobile
document.addEventListener('dblclick', (e) => {
    e.preventDefault();
}, { passive: false });

// Handle touch events for better mobile experience
let touchStartY = 0;
let touchEndY = 0;

document.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
}, { passive: true });

document.addEventListener('touchmove', (e) => {
    touchEndY = e.touches[0].clientY;
}, { passive: true });

// Prevent pull-to-refresh when panel is open
document.addEventListener('touchmove', (e) => {
    const panel = document.getElementById('sidePanel');
    if (panel && panel.classList.contains('active')) {
        if (window.innerWidth <= 768) {
            // Allow scroll inside panel but prevent body scroll
            const chatMessages = document.querySelector('.chat-messages');
            const historyList = document.querySelector('.history-list');
            
            if (chatMessages && chatMessages.contains(e.target)) {
                const scrollTop = chatMessages.scrollTop;
                const scrollHeight = chatMessages.scrollHeight;
                const clientHeight = chatMessages.clientHeight;
                
                if ((scrollTop <= 0 && touchEndY > touchStartY) ||
                    (scrollTop + clientHeight >= scrollHeight && touchEndY < touchStartY)) {
                    e.preventDefault();
                }
            }
        }
    }
}, { passive: false });

// Initialize storage on load
window.addEventListener('DOMContentLoaded', () => {
    initStorage().then(() => {
        console.log('OSINT Enhanced Edition v7 ready - File-based storage initialized');
    }).catch(err => {
        console.error('Failed to initialize storage:', err);
    });
});
