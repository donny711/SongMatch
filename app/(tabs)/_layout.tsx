import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../src/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<string, [IoniconName, IoniconName]> = {
  home:    ['compass',  'compass-outline'],
  hear:    ['mic',      'mic-outline'],
  liked:   ['heart',    'heart-outline'],
  people:  ['people',   'people-outline'],
  profile: ['person',   'person-outline'],
};

const TAB_CONTENT_HEIGHT = 58;

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = TAB_CONTENT_HEIGHT + insets.bottom;

  return (
    <Tabs
      screenOptions={({ route }) => {
        const [active, inactive] = TAB_ICONS[route.name] ?? ['ellipse', 'ellipse-outline'];
        return {
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? active : inactive} size={23} color={color} />
          ),
          tabBarStyle: {
            backgroundColor: 'rgba(13,13,13,0.97)',
            borderTopWidth: 1,
            borderTopColor: 'rgba(167,139,250,0.18)',
            height: tabBarHeight,
            paddingTop: 8,
            paddingBottom: insets.bottom + 4,
          },
          tabBarActiveTintColor: COLORS.purple,
          tabBarInactiveTintColor: '#6B7280',
          tabBarLabelStyle: { fontSize: 10, fontWeight: '700', marginTop: -2 },
        };
      }}
    >
      <Tabs.Screen name="hear"      options={{ title: 'Hear' }} />
      <Tabs.Screen name="liked"     options={{ title: 'Liked' }} />
      <Tabs.Screen name="home"      options={{ title: 'Discover' }} />
      <Tabs.Screen name="people"    options={{ title: 'People' }} />
      <Tabs.Screen name="profile"   options={{ title: 'Profile' }} />
      <Tabs.Screen name="playlists" options={{ href: null }} />
    </Tabs>
  );
}
