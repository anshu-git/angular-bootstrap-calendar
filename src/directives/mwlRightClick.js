'use strict';

var angular = require('angular');

angular
  .module('mwl.calendar')
  .directive('mwlRightClick', function($parse) {
    return {
        restrict: 'A',
        link: function(scope, element, attrs) {
            var fn = $parse(attrs.mwlRightClick);
            element.bind('contextmenu', function(event) {
                scope.$apply(function() {
                    event.preventDefault();
                    fn(scope, { $event: event });
                });
            });
        }
    };
  });
