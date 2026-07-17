import { StyleSheet, Text, View } from 'react-native';

export default function ReportsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Reports Screen</Text>
      <Text style={styles.paragraph}>Placeholder for Financial Reports and Analytics</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  title: {
    fontSize: 20,
    lineHeight: 22,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: 'normal',
    color: '#6B7280',
  },
});
