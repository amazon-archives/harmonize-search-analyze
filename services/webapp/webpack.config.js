var webpack = require('webpack');
var ExtractTextPlugin = require("extract-text-webpack-plugin");
var HtmlWebpackPlugin = require('html-webpack-plugin');
var path = require('path')

var entryDir = path.join(__dirname, '/src');
var outputDir = path.join(__dirname, '/dist');
var nodeModulesDir = path.join(__dirname, '/node_modules');

module.exports = {
  entry: {
    app: path.join(entryDir, 'index.js'),
  },
  output: {
    path: outputDir,
    filename: 'js/[name].bundle.js',
    chuckFileName: '[id].js',
    publicPath: '/webapp',
  },
  devtool: '#source-map',
  module: {
    loaders: [
      {
        test: /\.css$/,
        loader: ExtractTextPlugin.extract('style', 'css', {publicPath: '../../'}),
        include: nodeModulesDir,
      },
      {
        test: /\.css$/,
        loaders: ['style', 'css'],
        exclude: nodeModulesDir,
      },
      {
        test: /\.(png|jpe?g|gif|svg)(\?.*)?$/,
        loader: 'url',
        query: {
          limit: 10000,
          name: 'assets/img/[name].[ext]',
        },
      },
      {
        test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/,
        loader: 'url',
        query: {
          limit: 10000,
          name: 'assets/fonts/[name].[ext]',
        },
      },
    ]
  },
  resolve: {
    alias: {
      'jquery': path.join(__dirname, 'node_modules/jquery/src/jquery')
    }
  },
  plugins: [
    new webpack.ProvidePlugin({
      $: 'jquery',
      jQuery: 'jquery',
      'window.jQuery': 'jquery',
    }),
    new webpack.optimize.DedupePlugin(),
    new webpack.optimize.CommonsChunkPlugin({
      name: 'common',
      minChunks: function (module) {
        return (
          module.resource &&
          /\.js$/.test(module.resource) &&
          module.resource.indexOf(nodeModulesDir) === 0
        );
      },
    }),
    new webpack.optimize.CommonsChunkPlugin({
      name: 'vendors',
      chunks: ['common'],
    }),
    new webpack.optimize.UglifyJsPlugin({
      compressor: { warnings: false },
    }),
    new ExtractTextPlugin('assets/css/vendors.bundle.css', {allChunks: true}),
    new HtmlWebpackPlugin({
      filename: 'index.html',
      template: path.join(entryDir, 'index.html'),
      inject: true,
      chunksSortMode: 'dependency'
    }),
  ]
};
