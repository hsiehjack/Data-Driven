var express = require('express');

module.exports.Router = function(SlideShow) {
  return express.Router()    .get('/:username', function(req, res, next) {      SlideShow.find({ author: req.params.username }, function(err, slideShows) {        res.json(slideShows);      });    })    .get('/:username/:slidename', function(req, res, next) {      SlideShow.findOne({        author: req.params.username,        slideName: req.params.slidename      }, function(err, slideShow) {        res.json(slideShow);      });    });};