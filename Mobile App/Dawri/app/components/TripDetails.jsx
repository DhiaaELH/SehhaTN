// components/TripDetails.jsx
import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';

const TripDetails = ({ tripData, onBack }) => {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Live Trip Tracking</Text>
      
      {tripData ? (
        <View style={styles.metricsContainer}>
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>Distance</Text>
            <Text style={styles.metricValue}>{tripData.distance} km</Text>
          </View>

          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>Duration</Text>
            <Text style={styles.metricValue}>{tripData.duration} min</Text>
          </View>

          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>ETA</Text>
            <Text style={styles.metricValue}>{tripData.eta}</Text>
          </View>
        </View>
      ) : (
        <Text style={styles.loadingText}>Calculating route and trip status...</Text>
      )}

      <TouchableOpacity style={styles.backButton} onPress={onBack}>
        <Text style={styles.backButtonText}>Stop Tracking</Text>
      </TouchableOpacity>
    </View>
  );
};

export default TripDetails;

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
    color: '#2c3e50',
  },
  metricsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  metricBox: {
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginTop: 4,
  },
  loadingText: {
    textAlign: 'center',
    marginVertical: 10,
    color: '#7f8c8d',
  },
  backButton: {
    backgroundColor: '#e74c3c',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  backButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});