import { Component, type ErrorInfo, type PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '@/lib/theme';

type State = { error: Error | null };

export class AppErrorBoundary extends Component<PropsWithChildren, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // This structured event is captured by native device logs today and is the
    // integration point for Sentry once a production DSN is provisioned.
    console.error('abangbus.render_failure', {
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    });
  }

  private retry = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <View style={styles.page} accessibilityRole="alert">
        <Text style={styles.title}>AbangBus needs to recover</Text>
        <Text style={styles.body}>Something unexpected happened. Your account and saved data are still safe.</Text>
        <Pressable style={styles.button} onPress={this.retry} accessibilityRole="button">
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: colors.background },
  title: { color: colors.ink, fontFamily: fonts.bold, fontSize: 22, textAlign: 'center' },
  body: { maxWidth: 340, marginTop: 10, color: colors.inkMuted, fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  button: { minHeight: 50, marginTop: 22, paddingHorizontal: 24, borderRadius: 25, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#FFFFFF', fontFamily: fonts.semibold, fontSize: 14 },
});
