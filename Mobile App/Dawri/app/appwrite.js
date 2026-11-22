import { Client, Databases } from 'react-native-appwrite';

export const client = new Client();
client
  .setEndpoint('https://cloud.appwrite.io/v1')
  .setProject('6ae78225000d5cc79e95'); 

export const databases = new Databases(client);

export const DATABASE_ID = '6ae7882e0033596a5567';
export const TABLE_ID = '6ae789d600027ac4bc85'; 
export const ROW_ID = '6ae78b38001e4596c2b6';