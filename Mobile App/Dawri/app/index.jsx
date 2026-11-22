// index.jsx
import { LogBox } from 'react-native';
LogBox.ignoreLogs(['{"code": 1003', 'Server Error']);
import 'react-native-url-polyfill/auto';
import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';

import { client, databases, DATABASE_ID, TABLE_ID, ROW_ID } from './appwrite';
import { fetchRouteAndETA } from './services/routing';
import RouteMap from './components/RouteMap';
import TripDetails from './components/TripDetails';
import DestinationSelector from './components/DestinationSelector';

const Home = () => {
  const [mode, setMode] = useState(null); // null | 'selecting_destination' | 'tracker' | 'follower'
  const [targetLocation, setTargetLocation] = useState(null);
  const [destinationLocation, setDestinationLocation] = useState(null);
  const [tripData, setTripData] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const updateRouteInfo = async (currentCoords, destCoords) => {
    if (!currentCoords || !destCoords) return;
    const routeInfo = await fetchRouteAndETA(currentCoords, destCoords);
    if (routeInfo) {
      setTripData(routeInfo);
    }
  };

  useEffect(() => {
    let locationSubscription;

    const startTracking = async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }

      if (mode === 'tracker' && destinationLocation) {
        locationSubscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 4000, distanceInterval: 5 },
          (loc) => {
            const currentCoords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
            setTargetLocation(currentCoords);
            updateRouteInfo(currentCoords, destinationLocation);

            // Push current position and destination to Appwrite so followers see destination too
            databases.updateDocument(DATABASE_ID, TABLE_ID, ROW_ID, {
              latitude: currentCoords.latitude,
              longitude: currentCoords.longitude,
              dest_latitude: destinationLocation.latitude,
              dest_longitude: destinationLocation.longitude,
            }).catch((err) => console.log('Upload error:', err));
          }
        );
      }

      if (mode === 'follower') {
        databases.getDocument(DATABASE_ID, TABLE_ID, ROW_ID).then((doc) => {
          const fetchedCoords = { latitude: doc.latitude, longitude: doc.longitude };
          const fetchedDest = (doc.dest_latitude && doc.dest_longitude) 
            ? { latitude: doc.dest_latitude, longitude: doc.dest_longitude } 
            : null;

          setTargetLocation(fetchedCoords);
          setDestinationLocation(fetchedDest);
          if (fetchedDest) updateRouteInfo(fetchedCoords, fetchedDest);
        });

        client.subscribe(
          `databases.${DATABASE_ID}.collections.${TABLE_ID}.documents.${ROW_ID}`,
          (response) => {
            const updatedCoords = {
              latitude: response.payload.latitude,
              longitude: response.payload.longitude,
            };
            const updatedDest = (response.payload.dest_latitude && response.payload.dest_longitude)
              ? { latitude: response.payload.dest_latitude, longitude: response.payload.dest_longitude }
              : destinationLocation;

            setTargetLocation(updatedCoords);
            setDestinationLocation(updatedDest);
            if (updatedDest) updateRouteInfo(updatedCoords, updatedDest);
          }
        );
      }
    };

    if (mode === 'tracker' || mode === 'follower') startTracking();

    return () => {
      if (locationSubscription) locationSubscription.remove();
    };
  }, [mode, destinationLocation]);

  // Screen 1: Main Selection Menu
  if (!mode) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Braquage System</Text>
        <TouchableOpacity style={styles.btn} onPress={() => setMode('selecting_destination')}>
          <Text style={styles.btnText}>Share My Trip (Target)</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnFollow} onPress={() => setMode('follower')}>
          <Text style={styles.btnText}>Follow Live Trip (Contact)</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Screen 2: Destination Picker (for Target)
  if (mode === 'selecting_destination') {
    return (
      <DestinationSelector
        onConfirmDestination={(dest) => {
          setDestinationLocation(dest);
          setMode('tracker');
        }}
        onCancel={() => setMode(null)}
      />
    );
  }

  if (errorMsg) return <View style={styles.centered}><Text>{errorMsg}</Text></View>;
  if (!targetLocation) return <View style={styles.centered}><ActivityIndicator size="large" /></View>;

  // Screen 3: Live Map & Route Status
  return (
    <View style={styles.container}>
      <RouteMap
        targetLocation={targetLocation}
        destinationLocation={destinationLocation}
        routeCoordinates={tripData?.coordinates}
      />
      <TripDetails
        tripData={tripData}
        onBack={() => {
          setMode(null);
          setTargetLocation(null);
          setDestinationLocation(null);
          setTripData(null);
        }}
      />
    </View>
  );
};

export default Home;

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f4f4f4' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 30 },
  btn: { backgroundColor: '#e74c3c', padding: 15, borderRadius: 8, width: 260, alignItems: 'center', marginBottom: 15 },
  btnFollow: { backgroundColor: '#3498db', padding: 15, borderRadius: 8, width: 260, alignItems: 'center' },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});