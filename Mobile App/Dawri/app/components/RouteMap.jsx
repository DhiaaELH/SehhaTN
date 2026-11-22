// components/RouteMap.jsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

const RouteMap = ({ targetLocation, destinationLocation, routeCoordinates }) => {
  return (
    <MapView
      style={styles.map}
      initialRegion={{
        latitude: targetLocation.latitude,
        longitude: targetLocation.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }}
    >
      {/* Target Current Location Marker */}
      <Marker
        coordinate={targetLocation}
        title="Target Location"
        pinColor="red"
      />

      {/* Destination Marker */}
      {destinationLocation && (
        <Marker
          coordinate={destinationLocation}
          title="Destination"
          pinColor="green"
        />
      )}

      {/* Polyline connecting start, route points, and destination */}
      {routeCoordinates && routeCoordinates.length > 0 && (
        <Polyline
          coordinates={routeCoordinates}
          strokeColor="#3498db"
          strokeWidth={4}
        />
      )}
    </MapView>
  );
};

export default RouteMap;

const styles = StyleSheet.create({
  map: {
    width: '100%',
    height: '100%',
  },
});