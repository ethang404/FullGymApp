import { type ReactNode } from "react";
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const SPRING = { damping: 15, stiffness: 400 };

interface PressableScaleProps extends Omit<PressableProps, "style"> {
	style?: StyleProp<ViewStyle>;
	children: ReactNode;
}

// A Pressable that springs down to 0.97 while held. For primary CTAs / cards.
export function PressableScale({ style, onPressIn, onPressOut, children, ...rest }: PressableScaleProps) {
	const scale = useSharedValue(1);
	const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

	// react-hooks/immutability doesn't know a Reanimated SharedValue is meant to be
	// written to — assigning `.value` outside the render is the documented pattern.
	const press = (to: number) => {
		"worklet";
		// eslint-disable-next-line react-hooks/immutability
		scale.value = withSpring(to, SPRING);
	};

	return (
		<AnimatedPressable
			{...rest}
			style={[style, animatedStyle]}
			onPressIn={(e) => {
				press(0.97);
				onPressIn?.(e);
			}}
			onPressOut={(e) => {
				press(1);
				onPressOut?.(e);
			}}
		>
			{children}
		</AnimatedPressable>
	);
}
