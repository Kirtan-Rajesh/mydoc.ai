import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
} from 'react-native';

const BRAND = '#10B981';
const DANGER = '#EF4444';
const SECONDARY_BG = '#F3F4F6';
const SECONDARY_TEXT = '#374151';

// ─── Button ───────────────────────────────────────────────────────────────────

interface ButtonProps extends PressableProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export function Button({
  title,
  variant = 'primary',
  loading = false,
  disabled,
  style,
  textStyle,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const bgColor =
    variant === 'primary'
      ? BRAND
      : variant === 'danger'
        ? DANGER
        : SECONDARY_BG;

  const txtColor =
    variant === 'secondary' ? SECONDARY_TEXT : '#FFFFFF';

  return (
    <Pressable
      {...props}
      disabled={isDisabled}
      style={({ pressed }) => [
        buttonStyles.base,
        { backgroundColor: bgColor, opacity: pressed || isDisabled ? 0.7 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={txtColor} size="small" />
      ) : (
        <Text style={[buttonStyles.label, { color: txtColor }, textStyle]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const buttonStyles = StyleSheet.create({
  base: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
});

// ─── Card ─────────────────────────────────────────────────────────────────────

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Card({ children, style }: CardProps) {
  return <View style={[cardStyles.card, style]}>{children}</View>;
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
});

// ─── Chip ─────────────────────────────────────────────────────────────────────

interface ChipProps {
  label: string;
  color?: string;
  textColor?: string;
  style?: StyleProp<ViewStyle>;
}

export function Chip({
  label,
  color = '#D1FAE5',
  textColor = '#065F46',
  style,
}: ChipProps) {
  return (
    <View style={[chipStyles.chip, { backgroundColor: color }, style]}>
      <Text style={[chipStyles.label, { color: textColor }]}>{label}</Text>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
});

// ─── LoadingDots ──────────────────────────────────────────────────────────────

export function LoadingDots() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const makeBounce = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: -6,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.delay(600 - delay),
        ]),
      );

    const a1 = makeBounce(dot1, 0);
    const a2 = makeBounce(dot2, 150);
    const a3 = makeBounce(dot3, 300);

    a1.start();
    a2.start();
    a3.start();

    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [dot1, dot2, dot3]);

  return (
    <View style={dotsStyles.container}>
      {[dot1, dot2, dot3].map((dot, i) => (
        <Animated.View
          key={i}
          style={[dotsStyles.dot, { transform: [{ translateY: dot }] }]}
        />
      ))}
    </View>
  );
}

const dotsStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#9CA3AF',
  },
});

// ─── EmptyState ───────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  ctaLabel?: string;
  onCta?: () => void;
}

export function EmptyState({
  icon,
  title,
  description,
  ctaLabel,
  onCta,
}: EmptyStateProps) {
  return (
    <View style={emptyStyles.container}>
      <Text style={emptyStyles.icon}>{icon}</Text>
      <Text style={emptyStyles.title}>{title}</Text>
      <Text style={emptyStyles.description}>{description}</Text>
      {ctaLabel && onCta && (
        <Button title={ctaLabel} onPress={onCta} style={emptyStyles.cta} />
      )}
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  icon: {
    fontSize: 56,
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  cta: {
    marginTop: 8,
    paddingHorizontal: 32,
  },
});
