import React from 'react';
import { View, StyleSheet } from 'react-native';

import { colors, css } from '../config';
import Image from './ImageLoader';

function ProfileCircle({
    ppic,
    style,
    innerStyle,
    disabled = false,
    
}) {
    return (
        <View style={[styles.container, style]}>
            <Image
                source={ppic ? ppic.full : " "}
                defaultSource={ppic ? ppic.loadFull : " "}
                cacheKey={ppic ? ppic.fullKey : "ErrorKey"}
                disabled={disabled}
                style={[styles.image, innerStyle]}
                resizeMode="cover"
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: 50,
        height: 50,
        borderRadius: 30,
        borderWidth: 2,
        borderColor: colors.pBeam,
        backgroundColor: colors.background,
        ...css.beamShadow,
    },
    image: {
        flex: 1,
        borderRadius: 30,
        overflow: 'hidden',
    },
});

export default ProfileCircle;