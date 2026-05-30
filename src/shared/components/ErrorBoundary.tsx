import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  children: React.ReactNode;
};

type State = {
  error: Error | null;
};

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('App crashed:', error, info);
  }

  handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <View style={styles.root}>
          <View style={styles.iconWrap}>
            <Ionicons name="warning" size={40} color="#fff" />
          </View>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.subtitle}>
            Mutual hit an unexpected error. Tap below to try again, or
            force-close the app if it keeps happening.
          </Text>

          <ScrollView style={styles.errorBox} contentContainerStyle={{ padding: 12 }}>
            <Text style={styles.errorLabel}>Error</Text>
            <Text style={styles.errorText} selectable>
              {this.state.error.message}
            </Text>
            {this.state.error.stack && (
              <>
                <Text style={[styles.errorLabel, { marginTop: 12 }]}>Stack</Text>
                <Text style={styles.errorStack} selectable>
                  {this.state.error.stack}
                </Text>
              </>
            )}
          </ScrollView>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={this.handleReset}
            style={styles.button}
          >
            <Ionicons name="refresh" size={18} color="#E1306C" />
            <Text style={styles.buttonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#E1306C',
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 32,
    alignItems: 'center',
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
    lineHeight: 20,
  },
  errorBox: {
    width: '100%',
    maxHeight: 280,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    marginBottom: 20,
  },
  errorLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  errorText: {
    color: '#fff',
    fontSize: 13,
    fontFamily: 'Menlo',
  },
  errorStack: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontFamily: 'Menlo',
    lineHeight: 16,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 24,
  },
  buttonText: {
    color: '#E1306C',
    fontWeight: '700',
    fontSize: 15,
  },
});
