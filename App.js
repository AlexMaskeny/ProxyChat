import react from 'react';
import { Amplify } from 'aws-amplify';
import awsconfig from './src/aws-exports';
import * as Notifications from 'expo-notifications';
import { MenuProvider } from 'react-native-popup-menu';

import Navigation from './src/navigation';


Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
    }),
});

Amplify.configure(awsconfig);

export default function App() {
    return (
        <MenuProvider customStyles={{ backdrop: { backgroundColor: 'black', opacity: 0.6 } }}>
            <Navigation />
        </MenuProvider>
    );
}
