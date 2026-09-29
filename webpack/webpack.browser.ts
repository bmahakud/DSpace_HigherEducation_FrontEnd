import { join } from 'path';

import { buildAppConfig } from '../src/config/config.server';
import { commonExports } from './webpack.common';

const CompressionPlugin = require('compression-webpack-plugin');
const zlib = require('zlib');
const webpack = require('webpack');

module.exports = Object.assign({}, commonExports, {
  target: 'web',
  resolve: {
    fallback: {
      canvas: false,
      'worker-loader': false,
    },
  },
  plugins: [
    ...commonExports.plugins,
    new webpack.IgnorePlugin({
      resourceRegExp: /^canvas$/, // 🚀 ignore 'canvas'
    }),
    new CompressionPlugin({
      filename: '[path][base].gz',
      algorithm: 'gzip',
      test: /\.(js|css|html|svg|json)$/,
      threshold: 10240,
      minRatio: 0.8,
    }),
    new CompressionPlugin({
      filename: '[path][base].br',
      algorithm: 'brotliCompress',
      test: /\.(js|css|html|svg|json)$/,
      compressionOptions: {
        params: {
          [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
        },
      },
      threshold: 10240,
      minRatio: 0.8,
    }),
  ],
  devServer: {
    setupMiddlewares(middlewares, server) {
      buildAppConfig(join(process.cwd(), 'src/assets/config.json'));
      return middlewares;
    }
  },
  watchOptions: {
    ignored: [
      '**/node_modules', '**/_build', '**/.git', '**/docker',
      '**/.angular', '**/.idea', '**/.vscode', '**/.history', '**/.vsix'
    ]
  },
});
