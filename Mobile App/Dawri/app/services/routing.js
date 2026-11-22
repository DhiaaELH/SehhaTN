// services/routing.js

/**
 * Fetches routing geometry and ETA from OSRM (OpenStreetMap data)
 * @param {Object} start - { latitude, longitude }
 * @param {Object} destination - { latitude, longitude }
 */
export const fetchRouteAndETA = async (start, destination) => {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${start.longitude},${start.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=geojson`;

    const response = await fetch(url);
    const data = await response.json();

    if (!data.routes || data.routes.length === 0) {
      throw new Error('No route found');
    }

    const route = data.routes[0];
    
    // Convert OSRM GeoJSON format [longitude, latitude] to MapView format { latitude, longitude }
    const polylineCoordinates = route.geometry.coordinates.map(coord => ({
      latitude: coord[1],
      longitude: coord[0],
    }));

    // Distance in Kilometers
    const distanceKm = (route.distance / 1000).toFixed(2);
    
    // Duration in Minutes
    const durationMin = Math.round(route.duration / 60);

    // Calculate Estimated Time of Arrival (ETA)
    const etaDate = new Date(Date.now() + route.duration * 1000);
    const etaString = etaDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return {
      coordinates: polylineCoordinates,
      distance: distanceKm,
      duration: durationMin,
      eta: etaString,
    };
  } catch (error) {
    console.error("Routing error:", error);
    return null;
  }
};

// Add this to services/routing.js

/**
 * Searches location coordinates by name using OpenStreetMap Nominatim
 * @param {string} query - The search query (e.g., "Avenue Habib Bourguiba")
 */
export const searchPlace = async (query) => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`,
      {
        headers: {
          'User-Agent': 'BraquageApp/1.0',
        },
      }
    );
    const data = await response.json();
    if (data && data.length > 0) {
      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
        displayName: data[0].display_name,
      };
    }
    return null;
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
};