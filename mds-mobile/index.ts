import 'react-native-gesture-handler';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { registerRootComponent } from 'expo';

const fallbackStyles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#111827',
		paddingHorizontal: 16,
		paddingTop: 56,
		paddingBottom: 24,
	},
	title: {
		color: '#F9FAFB',
		fontSize: 20,
		fontWeight: '700',
		marginBottom: 10,
	},
	subtitle: {
		color: '#D1D5DB',
		fontSize: 14,
		marginBottom: 10,
	},
	hint: {
		color: '#9CA3AF',
		fontSize: 12,
		marginBottom: 16,
	},
	errorBox: {
		borderRadius: 10,
		backgroundColor: '#1F2937',
		borderWidth: 1,
		borderColor: '#374151',
		padding: 12,
	},
	errorText: {
		color: '#FCA5A5',
		fontSize: 12,
		lineHeight: 18,
	},
});

let startupErrorMessage: string | null = null;
let RootApp: React.ComponentType<any> | null = null;

try {
	require('./global.css');
	const appModule = require('./App');
	RootApp = appModule?.default ?? appModule;
	if (typeof RootApp !== 'function') {
		throw new Error('Invalid root export: expected a React component from ./App');
	}
} catch (error: any) {
	startupErrorMessage = error?.stack || error?.message || String(error);
	console.error('[Entry] Failed to initialize application root:', error);
}

const StartupErrorScreen: React.FC = () =>
	React.createElement(
		ScrollView,
		{ contentContainerStyle: { flexGrow: 1 }, style: fallbackStyles.container },
		React.createElement(
			View,
			null,
			React.createElement(Text, { style: fallbackStyles.title }, 'MDSystem failed to start'),
			React.createElement(
				Text,
				{ style: fallbackStyles.subtitle },
				'An exception occurred while loading the root module.'
			),
			React.createElement(
				Text,
				{ style: fallbackStyles.hint },
				'Check Metro logs for [Entry] Failed to initialize application root.'
			),
			React.createElement(
				View,
				{ style: fallbackStyles.errorBox },
				React.createElement(
					Text,
					{ selectable: true, style: fallbackStyles.errorText },
					startupErrorMessage || 'Unknown startup error'
				)
			)
		)
	);

const EntryComponent = RootApp ?? StartupErrorScreen;

// registerRootComponent calls AppRegistry.registerComponent('main', () => EntryComponent)
// and ensures environment setup for Expo Go and native builds.
registerRootComponent(EntryComponent);
