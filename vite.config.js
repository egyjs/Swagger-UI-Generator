import { defineConfig } from 'vite';
import path from 'path';
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill'

console.log('vite.config.js');
export default defineConfig({
    server: {
        fs: {
            // Allow serving files from one level up to the project root
            allow: ['/'],
        },
    },
    optimizeDeps: {
        esbuildOptions: {
            // Node.js global to browser globalThis
            define: {
                global: 'globalThis'
            },
            // Enable esbuild polyfill plugins
            plugins: [
                NodeGlobalsPolyfillPlugin({
                    buffer: true
                })
            ]
        }
    },
    build: {
        rollupOptions: {
            plugins: [
                nodePolyfills(),
            ],
        },
    },
    resolve: {
        alias: {
            process: "process/browser",
            stream: "stream-browserify",
            zlib: "browserify-zlib",
            util: "util",
        },
    },
});
