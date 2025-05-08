import resolve from '@rollup/plugin-node-resolve';
import esbuild from 'rollup-plugin-esbuild';
import dts from 'rollup-plugin-dts';

const dirName = 'dist';
const fileName = 'index';
const packageName = 'HolyheldSDK';

const common = {
  input: 'src/index.ts',
  external: (id) =>
    !/^[./]/.test(id) && !id.includes('@holyheld') && !id.includes('@solana-developers/helpers'),
  plugins: [resolve({ browser: true })],
  output: {
    name: packageName,
    exports: 'named',
    sourcemap: true,
  },
};

const esbuildPlugin = esbuild({
  minify: true,
  tsconfig: 'tsconfig.json',
  platform: 'browser',
  treeShaking: true,
});

export default [
  {
    ...common,
    output: {
      file: `${dirName}/${fileName}.es.js`,
      format: 'es',
      ...common.output,
    },
    plugins: [...common.plugins, esbuildPlugin],
  },
  {
    ...common,
    output: {
      ...common.output,
      file: `${dirName}/${fileName}.cjs.js`,
      format: 'cjs',
    },
    plugins: [...common.plugins, esbuildPlugin],
  },
  {
    ...common,
    output: {
      ...common.output,
      file: `${dirName}/${fileName}.d.ts`,
      format: 'es',
    },
    plugins: [...common.plugins, dts({ respectExternal: true })],
  },
];
