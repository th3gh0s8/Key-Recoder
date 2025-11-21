const express = require('express');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
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
        // Using ip-api.com - a free and reliable IP geolocation service with good rate limits
        const url = 'http://ip-api.com/json/';

        // Using http instead of https for this service
        http.get(url, (response) => {
            let data = '';

            response.on('data', (chunk) => {
                data += chunk;
            });

            response.on('end', () => {
                try {
                    // Check if the response is JSON before parsing
                    if (data.trim().startsWith('{')) {
                        const locationData = JSON.parse(data);

                        if (locationData.status === 'fail') {
                            reject(new Error(locationData.message || 'IP geolocation service failed'));
                            return;
                        }

                        resolve({
                            latitude: locationData.lat,
                            longitude: locationData.lon,
                            city: locationData.city,
                            region: locationData.regionName,
                            country: locationData.country,
                            ip: locationData.query,
                            timezone: locationData.timezone,
                            timestamp: new Date().toISOString()
                        });
                    } else {
                        // Response is not JSON, likely an error message
                        console.log('Non-JSON response received:', data.trim());
                        reject(new Error(data.trim() || 'Non-JSON response from geolocation service'));
                    }
                } catch (error) {
                    console.log('JSON parsing error, response:', data.substring(0, 100)); // Log first 100 chars
                    // If the main service fails, try a fallback
                    tryFallbackLocation(resolve, reject);
                }
            });
        }).on('error', (error) => {
            console.log('HTTP request error:', error.message);
            // If the main service fails, try the fallback
            tryFallbackLocation(resolve, reject);
        });
    });
}

// Fallback function to use a different geolocation service
function tryFallbackLocation(resolve, reject) {
    // Try ipapi.co as the first fallback
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
                    // If ipapi.co also fails, try a third service
                    tryThirdService(resolve, reject);
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
                tryThirdService(resolve, reject);
            }
        });
    }).on('error', (error) => {
        tryThirdService(resolve, reject);
    });
}

// Third geolocation service as a last resort
function tryThirdService(resolve, reject) {
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
                    // If all services fail, provide a mock location for testing
                    console.log('All geolocation services failed, providing mock location for testing');
                    resolve({
                        latitude: 37.7749, // San Francisco coordinates as default
                        longitude: -122.4194,
                        city: 'San Francisco',
                        region: 'California',
                        country: 'United States',
                        ip: '127.0.0.1', // Mock IP
                        timezone: 'America/Los_Angeles',
                        timestamp: new Date().toISOString()
                    });
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
                // If all services fail, provide a mock location for testing
                console.log('All geolocation services failed, providing mock location for testing');
                resolve({
                    latitude: 37.7749, // San Francisco coordinates as default
                    longitude: -122.4194,
                    city: 'San Francisco',
                    region: 'California',
                    country: 'United States',
                    ip: '127.0.0.1', // Mock IP
                    timezone: 'America/Los_Angeles',
                    timestamp: new Date().toISOString()
                });
            }
        });
    }).on('error', (error) => {
        // If all services fail, provide a mock location for testing
        console.log('All geolocation services failed, providing mock location for testing');
        resolve({
            latitude: 37.7749, // San Francisco coordinates as default
            longitude: -122.4194,
            city: 'San Francisco',
            region: 'California',
            country: 'United States',
            ip: '127.0.0.1', // Mock IP
            timezone: 'America/Los_Angeles',
            timestamp: new Date().toISOString()
        });
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
            <link rel="stylesheet" href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css" />
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

                .tabs {
                    display: flex;
                    margin-bottom: 20px;
                    border-bottom: 1px solid #ddd;
                }

                .tab {
                    padding: 10px 20px;
                    cursor: pointer;
                    background-color: #f1f1f1;
                    border: 1px solid #ddd;
                    border-bottom: none;
                    border-radius: 5px 5px 0 0;
                    margin-right: 5px;
                }

                .tab.active {
                    background-color: #3498db;
                    color: white;
                }

                .tab-content {
                    display: none;
                }

                .tab-content.active {
                    display: block;
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

                #map {
                    height: 500px;
                    width: 100%;
                    border-radius: 8px;
                    margin-top: 20px;
                    z-index: 1;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>All Saved Locations</h1>

                <div class="tabs">
                    <div class="tab active" onclick="switchTab('list')">List View</div>
                    <div class="tab" onclick="switchTab('map')">Map View</div>
                </div>

                <div id="list-view" class="tab-content active">
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
                </div>

                <div id="map-view" class="tab-content">
                    <div id="map"></div>
                </div>

                <a href="/" class="back-link">← Back to Location Recorder</a>
            </div>

            <script src="https://unpkg.com/leaflet@1.7.1/dist/leaflet.js"></script>
            <script>
                function switchTab(tabName) {
                    // Hide all tab contents
                    document.querySelectorAll('.tab-content').forEach(content => {
                        content.classList.remove('active');
                    });

                    // Remove active class from all tabs
                    document.querySelectorAll('.tab').forEach(tab => {
                        tab.classList.remove('active');
                    });

                    // Show selected tab content and mark tab as active
                    document.getElementById(tabName + '-view').classList.add('active');
                    event.target.classList.add('active');

                    // Initialize map if switching to map view and map hasn't been initialized yet
                    if (tabName === 'map' && typeof map === 'undefined') {
                        initMap();
                    }
                }

                // Available locations from the server
                const locations = ${JSON.stringify(locations.reverse())};

                let map;
                let markers = [];

                function initMap() {
                    // Center map on Sri Lanka as default
                    map = L.map('map').setView([7.8731, 80.7718], 8);

                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    }).addTo(map);

                    // Add markers for each location
                    locations.forEach(location => {
                        if (location.latitude && location.longitude) {
                            const marker = L.marker([location.latitude, location.longitude]).addTo(map);
                            marker.bindPopup('<b>' + (location.city || 'Unknown City') + '</b><br>' +
                                'Coordinates: ' + location.latitude.toFixed(6) + ', ' + location.longitude.toFixed(6) + '<br>' +
                                'Region: ' + (location.region || 'Unknown') + '<br>' +
                                'Country: ' + (location.country || 'Unknown') + '<br>' +
                                'Time: ' + new Date(location.timestamp).toLocaleString());
                            markers.push(marker);
                        }
                    });

                    // Fit map to show all markers if we have locations
                    if (markers.length > 0) {
                        const group = new L.featureGroup(markers);
                        map.fitBounds(group.getBounds().pad(0.1));
                    }
                }

                // Initialize map if we're already on the map tab
                if (document.getElementById('map-view').classList.contains('active')) {
                    initMap();
                }
            </script>
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