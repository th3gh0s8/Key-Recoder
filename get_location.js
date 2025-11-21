const fs = require('fs');
const https = require('https');

// Function to get location based on IP address
function getLocationByIP() {
    return new Promise((resolve, reject) => {
        // Using ipapi.com with a demo key (has limitations but doesn't require signup for basic use)
        const url = 'https://ipapi.localhost.rest/json';

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
                        region: locationData.region_name,
                        country: locationData.country_name,
                        ip: locationData.ip,
                        timestamp: new Date().toISOString()
                    });
                } catch (error) {
                    // If the localhost.rest service fails, try a different approach
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
                    latitude: parseFloat(locationData.latitude),
                    longitude: parseFloat(locationData.longitude),
                    city: locationData.city,
                    region: locationData.region,
                    country: locationData.country_name,
                    ip: locationData.ip,
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

// Function to save location data to JSON file
async function saveLocationToFile() {
    try {
        console.log('Getting your location based on IP address...');
        const locationData = await getLocationByIP();
        
        // Add Google Maps URL
        locationData.googleMapsUrl = `https://www.google.com/maps?q=${locationData.latitude},${locationData.longitude}`;
        
        const jsonString = JSON.stringify(locationData, null, 2);
        const fileName = `location_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
        
        fs.writeFileSync(fileName, jsonString);
        console.log(`Location data saved to ${fileName}`);
        console.log('Location details:');
        console.log(`- Latitude: ${locationData.latitude}`);
        console.log(`- Longitude: ${locationData.longitude}`);
        console.log(`- City: ${locationData.city}`);
        console.log(`- Region: ${locationData.region}`);
        console.log(`- Country: ${locationData.country}`);
        console.log(`- Google Maps URL: ${locationData.googleMapsUrl}`);
        
    } catch (error) {
        console.error('Error getting location:', error.message);
    }
}

// Run the function
saveLocationToFile();