---
name: new-mobile-screen
description: Scaffold a new screen for the Martly mobile app using Expo Router and React Native
argument-hint: <screen-name>
---

Create a new screen for the Martly mobile app.

**Screen name:** $ARGUMENTS

## Steps

1. **Read existing screens for reference** — Read files like `apps/mobile/app/store/[id].tsx` or `apps/mobile/app/checkout.tsx` to understand the established patterns.

2. **Determine the route type:**
   - **Tab screen** → `apps/mobile/app/(tabs)/<name>.tsx` (add to tab bar)
   - **Stack screen** → `apps/mobile/app/<name>.tsx` (push navigation)
   - **Dynamic screen** → `apps/mobile/app/<name>/[id].tsx` (with route params)

3. **Create the screen file** following these conventions:
   - Use `expo-router` for navigation (`useRouter`, `useLocalSearchParams`, `Stack`)
   - Set screen options via `<Stack.Screen options={{ title: '...' }} />`
   - Use `fetch` with the auth token from `expo-secure-store` for API calls
   - Use React Native core components (`View`, `Text`, `ScrollView`, `FlatList`, `TouchableOpacity`, `Image`)
   - Follow the existing styling patterns (inline styles or StyleSheet.create)
   - Use the store context from `lib/store-context.tsx` for store-scoped data
   - Handle loading states and errors

4. **If it's a tab screen**, update `apps/mobile/app/(tabs)/_layout.tsx`:
   - Add a new `<Tabs.Screen>` entry with name, title, and icon

5. **If it's a stack screen**, ensure it's accessible via `router.push('/<name>')` from other screens.

6. **Add types** if needed in `apps/mobile/lib/types.ts`.

## Pattern Reference

```tsx
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:7001';

export default function NewScreen() {
  const router = useRouter();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const token = await SecureStore.getItemAsync('accessToken');
    const res = await fetch(`${API_URL}/api/v1/endpoint`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    setData(json);
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Screen Title' }} />
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <Text>{item.name}</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
});
```
