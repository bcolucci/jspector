'use strict';

const R = require('ramda');
const gulp = require('gulp');
const gulpLoad = require('gulp-load-plugins');

const plugins = gulpLoad();

const onError = err => console.error(err) || process.exit(1);

const jsFiles = [ './utils.js', './jspector.js', './jspector-client', './test.js' ];

gulp.task('jshint', () => {
  return gulp.src(jsFiles)
    .pipe(plugins.jshint())
    .pipe(plugins.jshint.reporter('jshint-stylish'))
    .once('error', onError);
});

gulp.task('test', () => {
  return gulp.src(R.tail(jsFiles), { read: false })
  .pipe(plugins.mocha({ reporter: 'spec' }))
  .once('error', onError);
});

gulp.task('default', cbk => gulp.watch(jsFiles, [ 'jshint', 'test' ], cbk));
