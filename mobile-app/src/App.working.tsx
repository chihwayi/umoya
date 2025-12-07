import React from 'react';
import { Provider } from 'react-redux';
import { store } from './store/index.simple';
import AppNavigator from './navigation/AppNavigator';
import ErrorBoundary from './components/ErrorBoundary';

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <Provider store={store}>
        <AppNavigator />
      </Provider>
    </ErrorBoundary>
  );
};

export default App;
