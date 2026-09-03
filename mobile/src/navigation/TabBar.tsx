import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform,
} from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Polygon } from 'react-native-svg';
import { C, FONT } from '../design/tokens';
import { Icon } from '../components/ui/Icon';
import { IconName } from '../design/icons';

// Flat-top/flat-bottom hexagon points (pointed left/right), matching the
// brand mark's silhouette (assets/umoya-icon-square.png) — used as the
// active-tab badge so tab icons read as "molded from" the logo rather than
// a generic rounded-rect pill.
const hexPoints = (cx: number, cy: number, r: number) =>
  [0, 60, 120, 180, 240, 300]
    .map((deg) => {
      const rad = (deg * Math.PI) / 180;
      return `${cx + r * Math.cos(rad)},${cy + r * Math.sin(rad)}`;
    })
    .join(' ');

const HexBadge: React.FC<{ accent: string; size: number }> = ({ accent, size }) => {
  const r = size / 2;
  const gradId = `hexGrad-${accent.replace('#', '')}`;
  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFillObject}>
      <Defs>
        <SvgLinearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={accent} stopOpacity={0.32} />
          <Stop offset="100%" stopColor={accent} stopOpacity={0.12} />
        </SvgLinearGradient>
      </Defs>
      <Polygon points={hexPoints(r, r, r)} fill={`url(#${gradId})`} />
    </Svg>
  );
};

interface TabConfig {
  icon: IconName;
  label: string;
  badge?: number;
}

interface CustomTabBarProps extends BottomTabBarProps {
  accent: string;
  tabs: TabConfig[];
}

export const CustomTabBar: React.FC<CustomTabBarProps> = ({
  state, navigation, accent, tabs,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrapper, { paddingBottom: insets.bottom }]}>
      {/* Blur-like dark glass bar */}
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const tab = tabs[index];
          if (!tab) return null;

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              testID={`tab-${route.name}`}
              onPress={onPress}
              activeOpacity={0.7}
              style={styles.tabBtn}
            >
              {/* Active badge — hexagon, matching the brand mark's silhouette */}
              {isFocused && (
                <View style={styles.activePill}>
                  <HexBadge accent={accent} size={40} />
                </View>
              )}

              {/* Icon */}
              <View style={styles.iconWrapper}>
                <Icon
                  name={tab.icon}
                  size={22}
                  color={isFocused ? accent : C.textMuted}
                  strokeWidth={isFocused ? 2.2 : 1.5}
                />
                {/* Badge dot */}
                {tab.badge != null && tab.badge > 0 && (
                  <View style={[styles.badge, { backgroundColor: C.red }]}>
                    <Text style={styles.badgeText}>
                      {tab.badge > 9 ? '9+' : tab.badge}
                    </Text>
                  </View>
                )}
              </View>

              <Text style={[styles.label, isFocused && { color: accent, fontFamily: FONT.uiBd }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: C.surface,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  bar: {
    flexDirection: 'row',
    height: 62,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 6,
    position: 'relative',
  },
  activePill: {
    position: 'absolute',
    top: 2,
    alignSelf: 'center',
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapper: {
    position: 'relative',
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: C.surface,
  },
  badgeText: { fontFamily: FONT.uiBk, fontSize: 8, color: '#fff' },
  label: { fontFamily: FONT.ui, fontSize: 9.5, color: C.textMuted, letterSpacing: 0.2 },
});
