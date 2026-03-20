import { registerRootComponent } from 'expo';
import { LogBox } from 'react-native';

import App from './App';

// Suppress third-party library deprecation warnings not actionable from app code
LogBox.ignoreLogs([
  'InteractionManager has been deprecated',
]);

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
