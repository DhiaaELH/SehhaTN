// components/DestinationSelector.jsx
import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';

const DestinationSelector = ({ onConfirmDestination, onCancel }) => {
  const [initialRegion, setInitialRegion] = useState(null);
  const [selectedCoordinate, setSelectedCoordinate] = useState(null);

  // Center the map on the user's current location when they open this screen
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setInitialRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });
    })();
  }, []);

  if (!initialRegion) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#e74c3c" />
        <Text style={styles.loadingText}>Locating you...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={initialRegion}
        onPress={(e) => setSelectedCoordinate(e.nativeEvent.coordinate)}
      >
        {selectedCoordinate && (
          <Marker 
            coordinate={selectedCoordinate} 
            pinColor="green" 
            title="Destination" 
          />
        )}
      </MapView>

      <View style={styles.bottomCard}>
        <Text style={styles.instructionText}>
          {selectedCoordinate ? "Destination selected!" : "Tap on the map to place your destination pin."}
        </Text>

        {selectedCoordinate && (
          <TouchableOpacity 
            style={styles.btnConfirm} 
            onPress={() => onConfirmDestination(selectedCoordinate)}
          >
            <Text style={styles.btnText}>Confirm & Start Trip</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.btnCancel} onPress={onCancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default DestinationSelector;

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: '#7f8c8d' },
  map: { flex: 1 },
  bottomCard: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  instructionText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 15,
    color: '#2c3e50',
    textAlign: 'center',
  },
  btnConfirm: {
    backgroundColor: '#2ecc71',
    padding: 15,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  btnCancel: { padding: 10 },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  cancelText: { color: '#e74c3c', fontWeight: 'bold' },
});