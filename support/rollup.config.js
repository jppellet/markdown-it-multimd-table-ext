import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import nodeResolve from '@rollup/plugin-node-resolve';
import nodePolyfills from 'rollup-plugin-node-polyfills';
import { terser } from 'rollup-plugin-terser';
import pkg from '../package.json';

export default {
  input: 'index.js',
  output: [
    {
      file: 'dist/markdown-it-multimd-table-ext.js',
      format: 'umd',
      name: 'markdownitMultimdTableExt',
      plugins: [
        // Here terser is used only to force ascii output
        terser({
          mangle: false,
          compress: false,
          format: {
            comments: 'all',
            beautify: true,
            ascii_only: true,
            indent_level: 2
          }
        })
      ]
    },
    {
      file: 'dist/markdown-it-multimd-table-ext.min.js',
      format: 'umd',
      name: 'markdownitMultimdTableExt',
      plugins: [
        terser({
          format: {
            ascii_only: true,
          }
        })
      ]
    }
  ],
  plugins: [
    nodeResolve({ preferBuiltins: true }),
    commonjs(),
    json({ namedExports: false }),
    nodePolyfills(),
    {
      banner() {
        return `/*! ${pkg.name} ${pkg.version} https://github.com/${pkg.repository} @license ${pkg.license} */`;
      }
    }
  ]
};
