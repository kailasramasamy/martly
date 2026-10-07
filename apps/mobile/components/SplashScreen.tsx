import { useEffect, useRef } from "react";
import { View, Animated, StyleSheet } from "react-native";
import { colors } from "../constants/theme";

const wordmark = require("../assets/splash-wordmark.png");

interface SplashScreenProps {
  onFinish: () => void;
  onBeforeFadeOut?: () => void;
}

export default function SplashScreen({ onFinish, onBeforeFadeOut }: SplashScreenProps) {
  const iconScale = useRef(new Animated.Value(0)).current;
  const iconOpacity = useRef(new Animated.Value(0)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Entrance animations
    Animated.sequence([
      // Wordmark scales in and fades in
      Animated.parallel([
        Animated.spring(iconScale, {
          toValue: 1,
          tension: 60,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(iconOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
      // Subtitle fades in
      Animated.timing(subtitleOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      // Hold briefly
      Animated.delay(400),
    ]).start(() => {
      // Navigate while splash is still fully opaque
      onBeforeFadeOut?.();
      // Wait for navigation to settle, then fade out to reveal correct screen
      setTimeout(() => {
        Animated.timing(screenOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          onFinish();
        });
      }, 150);
    });
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: screenOpacity }]}>
      <View style={styles.content}>
        <Animated.Image
          source={wordmark}
          style={[styles.wordmark, { opacity: iconOpacity, transform: [{ scale: iconScale }] }]}
          resizeMode="contain"
        />

        <Animated.Text style={[styles.subtitle, { opacity: subtitleOpacity }]}>
          Fresh groceries, delivered
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  },
  content: {
    alignItems: "center",
  },
  wordmark: {
    width: 200,
    height: 71,
  },
  subtitle: {
    fontSize: 17,
    color: "rgba(255, 255, 255, 0.85)",
    position: "absolute",
    top: 79,
    width: 300,
    textAlign: "center",
    fontWeight: "500",
  },
});
