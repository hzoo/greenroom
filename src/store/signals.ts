import { signal, type Signal } from "@preact/signals-react";

export function createPersistedSignal<T>(
	key: string,
	defaultValue: T,
): Signal<T> {
	// Try to get initial value from localStorage
	const stored = localStorage.getItem(key);
	const initial = stored ? JSON.parse(stored) : defaultValue;

	// Create signal with initial value
	const sig = signal<T>(initial);

	// Set up persistence
	const persist = () => {
		localStorage.setItem(key, JSON.stringify(sig.value));
	};

	// Create a proxy to intercept value changes
	return new Proxy(sig, {
		get(target, prop) {
			return target[prop as keyof typeof target];
		},
		set(target, prop, value) {
			const result = Reflect.set(target, prop, value);
			if (prop === "value") {
				persist();
			}
			return result;
		},
	});
}
