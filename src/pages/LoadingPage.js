import React, { useCallback, useRef, useEffect } from 'react';
import { StyleSheet, Image, ActivityIndicator, View } from 'react-native';
import { API, Auth, graphqlOperation } from 'aws-amplify';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useFocusEffect } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { CommonActions } from '@react-navigation/native';

import { createChatMembers, deleteChatMembers, getChat, getChatMembersByIds, getSimpleUserChats, getUserByCognito, listChatsByLocation, updateUser } from '../api/calls';
import * as logger from '../functions/logger';
import * as locConversion from '../functions/locConversion';
import Screen from '../comps/Screen';
import { storage, colors, rules } from '../config';
import Chat from '../comps/Chat';

const NO_USER = "The user is not authenticated";

export default function LoadingPage({navigation}) {
    const loc = useRef();
    const not = useRef();
    const lc = useRef();
    const currentUser = useRef();


    const unsubscribe = () => {
        currentUser.current = null;
        try { loc.current.remove() } catch { }
        try { not.current.remove() } catch { }
        try { clearInteveral(lc.current) } catch { }
        logger.log("Unsubscribed from notification / location updates.");
    };

    useEffect(() => { return () => {unsubscribe()} }, []);

    useFocusEffect(useCallback(() => {
        const initialFunction = async () => {
            unsubscribe();
            logger.log("Initiating...");
            try {
                currentUser.current = await Auth.currentAuthenticatedUser();
                if (currentUser.current) {
                    const perm = await Location.getForegroundPermissionsAsync();
                    const user = await API.graphql(graphqlOperation(getUserByCognito, {
                        id: currentUser.current.attributes.sub
                    }));
                    if (user.data.getUserByCognito.allowNotifications) {
                        const result = await Notifications.getPermissionsAsync();
                        if (result.ios.status == Notifications.IosAuthorizationStatus.NOT_DETERMINED) {
                            const result2 = await Notifications.requestPermissionsAsync();
                            if (result2.granted) {
                                const key = await Notifications.getExpoPushTokenAsync();
                                await API.graphql(graphqlOperation(updateUser, {
                                    input: {
                                        id: user.data.getUserByCognito.id,
                                        allowNotifications: true,
                                        expoToken: key.data
                                    }
                                }))
                            }
                        }
                        const result3 = await Notifications.getPermissionsAsync();
                        if (result3.ios.status == Notifications.IosAuthorizationStatus.AUTHORIZED) {
                            not.current = Notifications.addNotificationResponseReceivedListener(notification => {
                                const iF = async () => {
                                    try {
                                        const chat = await API.graphql(graphqlOperation(getChat, {
                                            id: notification.notification.request.content.data.chatID
                                        }));
                                        const userChatMembersID = chat.data.getChat.members.items[chat.data.getChat.members.items.findIndex((el) => el.user.id == user.data.getUserByCognito.id)].id;
                                        if (notification.notification.request.content.data.privateChat) {
                                            navigation.navigate("PChatNav", {
                                                screen: "ChatPage",
                                                key: chat.data.getChat.id,
                                                params: {
                                                    name: notification.notification.request.content.title,
                                                    created: chat.data.getChat.createdAt,
                                                    id: chat.data.getChat.id,
                                                    userChatMembersID,
                                                    user: user.data.getUserByCognito,
                                                    private: true,
                                                }
                                            });
                                        } else {
                                            navigation.navigate("TChatNav", {
                                                screen: "ChatPage",
                                                key: chat.data.getChat.id,
                                                params: {
                                                    name: notification.notification.request.content.title,
                                                    created: chat.data.getChat.createdAt,
                                                    id: chat.data.getChat.id,
                                                    userChatMembersID,
                                                    user: user.data.getUserByCognito,
                                                }
                                            });
                                        }
                                        await Notifications.dismissAllNotificationsAsync();
                                    } catch (error) {
                                        logger.warn(error);
                                    }
                                }
                                iF();
                            });
                        } else {
                            await API.graphql(graphqlOperation(updateUser, {
                                input: {
                                    id: user.data.getUserByCognito.id,
                                    allowNotifications: false,
                                }
                            }))
                        }
                    }
                    if (perm.granted) {
                        loc.current = await Location.watchPositionAsync({ accuracy: rules.locationAccuracy, distanceInterval: 0, timeInterval: rules.locationUpdateFrequency }, async (location) => {
                            try {
                                currentUser.current = await Auth.currentAuthenticatedUser();
                                if (currentUser.current) {
                                    const convertedLocs = locConversion.toUser(location.coords.latitude, location.coords.longitude);
                                    await API.graphql(graphqlOperation(updateUser, {
                                        input: {
                                            id: user.data.getUserByCognito.id,
                                            ...convertedLocs
                                        }
                                    }));

                                } else throw NO_USER
                            } catch (error) {
                                logger.warn(error);
                                if (error != NO_USER) {
                                    logger.warn(error.errors);
                                } else {
                                    unsubscribe();
                                }
                            }
                        });
                        const updateChatMembership = async () => {
                            try {
                                if (currentUser.current) {
                                    const location = await Location.getLastKnownPositionAsync();
                                    const convertedLocs2 = locConversion.toChat(location.coords.latitude, location.coords.longitude);
                                    const newChats = await API.graphql(graphqlOperation(listChatsByLocation, {
                                        ...convertedLocs2,
                                        radius: rules.nearYouRadius,
                                    }));
                                    const oldChats = await API.graphql(graphqlOperation(getChatMembersByIds, {
                                        userID: user.data.getUserByCognito.id
                                    }));
                                    for (var i = 0; i < oldChats.data.getChatMembersByIds.items.length; i++) {
                                        if (newChats.data.listChatsByLocation.items.findIndex(el => {
                                            if (el.id == oldChats.data.getChatMembersByIds.items[i].chatID) return true;
                                            else return false;
                                        }) == -1) {
                                            if (!oldChats.data.getChatMembersByIds.items[i].chat.private) {
                                                await API.graphql(graphqlOperation(deleteChatMembers, {
                                                    input: {
                                                        id: oldChats.data.getChatMembersByIds.items[i].id
                                                    }
                                                }))
                                            }
                                        }
                                    }
                                    for (var i = 0; i < newChats.data.listChatsByLocation.items.length; i++) {
                                        if (oldChats.data.getChatMembersByIds.items.findIndex(el => {
                                            if (el.chatID == newChats.data.listChatsByLocation.items[i].id) return true;
                                            else return false;
                                        }) == -1) {
                                            if (!newChats.data.listChatsByLocation.items[i].private) {
                                                await API.graphql(graphqlOperation(createChatMembers, {
                                                    input: {
                                                        userID: user.data.getUserByCognito.id,
                                                        chatID: newChats.data.listChatsByLocation.items[i].id
                                                    }
                                                }))
                                            }
                                        }
                                    }
                                }
                            } catch (error) {
                                logger.warn(error);
                                if (error != NO_USER) {
                                    logger.warn(error);
                                } else {
                                    unsubscribe();
                                }
                            }
                        }
                        updateChatMembership();
                        lc.current = setInterval(updateChatMembership, rules.locationUpdateFrequency);
                    }
                } else throw NO_USER;
                navigation.navigate("SecondaryNav");
            } catch (error) {
                logger.log(error);
                if (error == NO_USER) {
                    try {
                        const result = await AsyncStorage.getItem(storage.UNCONFIRMED);
                        if (result) {
                            const parsed = JSON.parse(result);
                            if (parsed.val) {
                                logger.log("Unconfirmed User Exists");
                                //send to signup page;
                                return;
                            }
                        }
                        navigation.navigate("LoginPage");
                    } catch (error) {
                        logger.warn(error);
                    }
                }
            }
        }

        initialFunction();
    }));

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