const express = require('express');
const fs = require('fs');
const path = require('path');
const https = require('https');
const app = express();
const PORT = 3000;

// Middleware to serve static files
app.use(express.static('.'));
app.use(express.json());

// Path to store locations
const LOCATIONS_FILE = 'locations.json';

// Initialize locations file if it doesn't exist
if (!fs.existsSync(LOCATIONS_FILE)) {
    fs.writeFileSync(LOCATIONS_FILE, JSON.stringify([]));
}

// Function to get location based on IP address
function getLocationByIP() {
    return new Promise((resolve, reject) => {
        // Using ipapi.co - a reliable IP geolocation service
        const url = 'https://ipapi.co/json/';

        https.get(url, (response) => {
            let data = '';

            response.on('data', (chunk) => {
                data += chunk;
            });

            response.on('end', () => {
                try {
                    const locationData = JSON.parse(data);

                    if (locationData.error) {
                        reject(new Error(locationData.reason || 'Unknown error occurred'));
                        return;
                    }

                    resolve({
                        latitude: locationData.latitude,
                        longitude: locationData.longitude,
                        city: locationData.city,
                        region: locationData.region,
                        country: locationData.country_name,
                        ip: locationData.ip,
                        timezone: locationData.timezone,
                        timestamp: new Date().toISOString()
                    });
                } catch (error) {
                    // If the main service fails, try a fallback
                    tryFallbackLocation(resolve, reject);
                }
            });
        }).on('error', (error) => {
            // If the main service fails, try the fallback
            tryFallbackLocation(resolve, reject);
        });
    });
}

// Fallback function to use a different geolocation service
function tryFallbackLocation(resolve, reject) {
    const url = 'https://json.geoiplookup.io/';

    https.get(url, (response) => {
        let data = '';

        response.on('data', (chunk) => {
            data += chunk;
        });

        response.on('end', () => {
            try {
                const locationData = JSON.parse(data);

                if (!locationData.success) {
                    reject(new Error('Failed to get location from fallback service'));
                    return;
                }

                resolve({
                    latitude: parseFloat(locationData.latitude) || null,
                    longitude: parseFloat(locationData.longitude) || null,
                    city: locationData.city || 'Unknown',
                    region: locationData.region || 'Unknown',
                    country: locationData.country_name || 'Unknown',
                    ip: locationData.ip || 'Unknown',
                    timezone: locationData.timezone || 'Unknown',
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                reject(new Error('Both location services failed'));
            }
        });
    }).on('error', (error) => {
        reject(new Error('Both location services failed'));
    });
}

// Endpoint to get user's location and save it
app.get('/get_location', async (req, res) => {
    try {
        console.log('Getting location for IP:', req.ip);
        const locationData = await getLocationByIP();
        
        // Add Google Maps URL
        if (locationData.latitude && locationData.longitude) {
            locationData.googleMapsUrl = `https://www.google.com/maps?q=${locationData.latitude},${locationData.longitude}`;
        }

        // Read existing locations
        let locations = [];
        if (fs.existsSync(LOCATIONS_FILE)) {
            const fileContent = fs.readFileSync(LOCATIONS_FILE, 'utf8');
            locations = JSON.parse(fileContent);
        }

        // Add new location
        locations.push(locationData);

        // Save updated locations
        fs.writeFileSync(LOCATIONS_FILE, JSON.stringify(locations, null, 2));

        // Send back the location data
        res.json(locationData);
    } catch (error) {
        console.error('Error getting location:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint to get all saved locations (root)
app.get('/get_root', (req, res) => {
    try {
        let locations = [];
        if (fs.existsSync(LOCATIONS_FILE)) {
            const fileContent = fs.readFileSync(LOCATIONS_FILE, 'utf8');
            locations = JSON.parse(fileContent);
        }
        
        // Generate HTML page with all locations
        let html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>All Saved Locations</title>
            <style>
                * {
                    box-sizing: border-box;
                    margin: 0;
                    padding: 0;
                }
        
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
                    min-height: 100vh;
                    padding: 40px 20px;
                }
        
                .container {
                    width: 100%;
                    max-width: 1000px;
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
                    padding: 30px;
                    margin: 0 auto;
                }
        
                h1 {
                    text-align: center;
                    color: #2c3e50;
                    margin-bottom: 30px;
                    font-size: 2.2rem;
                    position: relative;
                }
        
                h1:after {
                    content: '';
                    display: block;
                    width: 80px;
                    height: 4px;
                    background: #3498db;
                    margin: 10px auto;
                    border-radius: 2px;
                }
        
                .location-card {
                    background: #f8f9fa;
                    border-radius: 8px;
                    padding: 20px;
                    margin-bottom: 15px;
                    border-left: 4px solid #3498db;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.05);
                }
        
                .location-card h3 {
                    color: #2c3e50;
                    margin-bottom: 10px;
                }
        
                .location-card p {
                    margin: 8px 0;
                    line-height: 1.5;
                }
        
                .coordinates {
                    font-family: 'Courier New', monospace;
                    font-weight: bold;
                    color: #2980b9;
                }
        
                .timestamp {
                    font-style: italic;
                    color: #7f8c8d;
                    font-size: 0.9em;
                }
        
                .map-link {
                    display: inline-block;
                    margin-top: 10px;
                    padding: 8px 15px;
                    background: linear-gradient(to right, #3498db, #2980b9);
                    color: white;
                    text-decoration: none;
                    border-radius: 4px;
                    font-weight: 500;
                }
                
                .map-link:hover {
                    background: linear-gradient(to right, #2980b9, #2573a7);
                }
        
                .empty-state {
                    text-align: center;
                    padding: 40px;
                    color: #7f8c8d;
                }
        
                .back-link {
                    display: block;
                    text-align: center;
                    margin-top: 20px;
                    padding: 10px;
                    color: #3498db;
                    text-decoration: none;
                    font-weight: 500;
                }
        
                .back-link:hover {
                    text-decoration: underline;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>All Saved Locations</h1>
        `;

        if (locations.length === 0) {
            html += `
                <div class="empty-state">
                    <h3>No locations saved yet</h3>
                    <p>Get your location first using the location recorder page</p>
                </div>
            `;
        } else {
            html += `<p>Total locations saved: ${locations.length}</p>`;
            
            // Reverse the array to show newest first
            locations.reverse().forEach((location, index) => {
                html += `
                    <div class="location-card">
                        <h3>Location #${locations.length - index}</h3>
                        <p><strong>IP Address:</strong> <span class="coordinates">${location.ip}</span></p>
                        <p><strong>Coordinates:</strong> 
                            <span class="coordinates">${location.latitude ? location.latitude.toFixed(6) : 'N/A'}, 
                            ${location.longitude ? location.longitude.toFixed(6) : 'N/A'}</span>
                        </p>
                        <p><strong>City:</strong> ${location.city || 'N/A'}</p>
                        <p><strong>Region:</strong> ${location.region || 'N/A'}</p>
                        <p><strong>Country:</strong> ${location.country || 'N/A'}</p>
                        <p><strong>Timezone:</strong> ${location.timezone || 'N/A'}</p>
                        <p class="timestamp"><strong>Saved at:</strong> ${new Date(location.timestamp).toLocaleString()}</p>
                `;
                
                if (location.googleMapsUrl) {
                    html += `<a href="${location.googleMapsUrl}" target="_blank" class="map-link">View on Google Maps</a>`;
                }
                
                html += `</div>`;
            });
        }

        html += `
                    <a href="/" class="back-link">← Back to Location Recorder</a>
                </div>
            </body>
        </html>
        `;

        res.send(html);
    } catch (error) {
        console.error('Error reading locations:', error);
        res.status(500).json({ error: 'Failed to read locations' });
    }
});

// Serve the main location recorder page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'location_recorder.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Get location: http://localhost:${PORT}/get_location`);
    console.log(`View all locations: http://localhost:${PORT}/get_root`);
});