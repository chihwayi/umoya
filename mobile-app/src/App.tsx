import React from 'react';
import { Provider } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { store } from './store';
import AppNavigator from './navigation/AppNavigator';
import ErrorBoundary from './components/ErrorBoundary';

const App: React.FC = () => {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Provider store={store}>
        <ErrorBoundary>
          <NavigationContainer>
            <AppNavigator />
          </NavigationContainer>
        </ErrorBoundary>
      </Provider>
    </GestureHandlerRootView>
  );
};

export default App;


