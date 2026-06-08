/**
 * Global polyfills for browser runtime.
 *
 * `sockjs-client` depends on `global` being defined.
 * This file is loaded by Angular before the application.
 */

(window as any)['global'] = window;
