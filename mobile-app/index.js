/**
 * @format
 */

// CRITICAL: react-native-gesture-handler MUST be imported first
import 'react-native-gesture-handler';

// Ensure React is properly initialized before any other imports
import React from 'react';
import {AppRegistry} from 'react-native';
import App from './src/App';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);


