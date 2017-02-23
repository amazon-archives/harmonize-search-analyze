'use strict';
const path = require('path');
const express = require('express');

const winston = require('winston');
const expressWinston = require('express-winston');

const PORT = 8888;
const distDir = 'dist';
const publicPath = '/webapp';

const requestLogger = expressWinston.logger({
  transports: [
    new winston.transports.Console({
      json: false,
      colorize: false,
    }),
  ],
  expressFormat: true,
  meta: false,
});
const errorLogger = expressWinston.logger({
  transports: [
    new winston.transports.Console({
      json: false,
      colorize: true,
    }),
  ],
});


const app = express();
app.use(publicPath, express.static(path.join(__dirname, distDir)));
app.use(requestLogger);
app.use(errorLogger);
app.listen(PORT);
