import { registerRootComponent } from 'expo';

import App from './App';
import { registerWidgetTask } from './src/services/widget';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

// C10: register the headless task that paints the Android home-screen widget.
// Deliberately routed through src/services/widget.ts rather than calling the
// library's registerWidgetTaskHandler directly — that would value-import
// react-native-android-widget here, which is a fatal Expo Go redbox at module
// load. This call no-ops in Expo Go and on iOS.
registerWidgetTask();
