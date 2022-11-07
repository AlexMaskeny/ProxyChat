import React, { useContext } from 'react';
import { StyleSheet, Image, ActivityIndicator, View } from 'react-native';
import { API, Auth, graphqlOperation } from 'aws-amplify';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

import timeout from '../api/timeout';
import { colors, debug } from '../config';
import Screen from '../comps/Screen';

//Efficent GetData Stack: 
//Given first run of app -> LoadingPage ->
//    Check if authed user. 
//	If not send to login page -> If click signup go to signup[DELAY] -> Once signed up log in and go back to LoadingPage
//	If logged in yet not verified -> go to verification -> When verified -> Go Back to LoadingPAge
//	If logged in and okay -> Go back to LoadingPage
//Get current user info that may have changed. (Location, friends, messages,)
//Preload chat page, get first 10 chats near user, get first 10 user chats + convos, fill user profile screen.
//	Store that gotten data in asyncstorage if reasonable. (avoid outdated data)
//[DELAY]Begin subscriptions if reasonable. 
//navigate to local chats page with some default radius

function LoadingPage({navigation}) {
    //REQUIRES: this page was navigated to by the initial Primary Navigator
    //MODIFIES: none
    //EFFECTS: attains data from database and triggers an inner function
    //         that will redirect user to appropriate page upon profile
    //         data attainment

    React.useEffect(() => {
        //var mounted = true;
        var loc;
        const initialFunction = async () => {
            if (debug) console.log("Initiating...");
            //Get data during this interval
            //setTimeout(async function () {
                try {
                    const currentUser = await Auth.currentAuthenticatedUser();
                    if (currentUser) {
                        const perm = await Location.getForegroundPermissionsAsync();
                        if (perm.granted) {
                            loc = await Location.watchPositionAsync({ accuracy: 6, distanceInterval: 0, timeInterval: 500, }, (location) => {
                                //console.log("Location:");
                                //console.log(location);
                            })
                        }
                        navigation.navigate("SecondaryNav");
                    }
                } catch (error) {
                    if (debug) console.log(error);
                    if (error == "The user is not authenticated") {
                        //Check If Unconfirmed User
                        const result = await AsyncStorage.getItem("unconfirmed");
                        if (result) {
                            const parsed = JSON.parse(result);
                            if (parsed.val) {
                                if (debug) console.log("Unconfirmed User Exists");
                                //navigate to signup with unconfirmed route.
                            }
                        }
                        //else navigate to loginpage, possibly a general page if you want.
                        navigation.navigate("LoginPage");
					}
			    }
            //}, 20);
        }
        initialFunction();
        return () => {
            if (loc) {
                loc.remove();
            }
        //    mounted = false;

        }
    }, []);

    return (
        <Screen innerStyle={styles.page}>
            <Image
                source={require('../../assets/Logo.png')}
                style={styles.logo}
                resizeMode="contain"
            />
            <View height={20}/>
            <ActivityIndicator size='large' color={colors.pBeam} />
        </Screen>
    );
}

const styles = StyleSheet.create({
    logo: {
        height: 60,
        width: "100%"
    },
    page: {
        justifyContent: "center"
	}
})

export default LoadingPage;