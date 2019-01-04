'use strict';

var angular = require('angular');

angular
  .module('mwl.calendar')
  .controller('MwlCalendarDayCtrl', function($scope, moment, calendarHelper, calendarEventTitle) {

    var vm = this;

    vm.calendarEventTitle = calendarEventTitle;

    function refreshView() {
      vm.timeHidden = vm.dayViewTimePosition === 'hidden';
      vm.dayViewTimePositionOffset = vm.dayViewTimePosition !== 'default' ? 0 : 50;

      vm.dayViewSplit = vm.dayViewSplit || 30;
      vm.dayViewHeight = calendarHelper.getDayViewHeight(
        vm.dayViewStart,
        vm.dayViewEnd,
        vm.dayViewSplit,
        vm.dayViewSegmentSize
      );
      var visitedEventIdsList = [];
      for (var i = 0; i < vm.events.length; i++) {
        var event = vm.events[i];
        if (event.hasOwnProperty('calendarEventId')) {
          if (visitedEventIdsList.indexOf(event.calendarEventId) > -1) {
            vm.events.splice(i, 1);
          } else {
            visitedEventIdsList.push(event.calendarEventId);
          }
        }
      }
      var view = calendarHelper.getDayView(
        vm.events,
        vm.viewDate,
        vm.dayViewStart,
        vm.dayViewEnd,
        vm.dayViewSplit,
        vm.dayViewEventWidth,
        vm.dayViewSegmentSize
      );

      vm.allDayEvents = view.allDayEvents;
      vm.nonAllDayEvents = view.events;
      vm.viewWidth = view.width;

    }

    $scope.$on('calendar.refreshView', refreshView);

    $scope.$watchGroup([
      'vm.dayViewStart',
      'vm.dayViewEnd',
      'vm.dayViewSplit'
    ], refreshView);

    vm.eventDragComplete = function(event, minuteChunksMoved) {
      var minutesDiff = minuteChunksMoved * vm.dayViewSplit;
      var newStart = moment(event.startsAt).add(minutesDiff, 'minutes');
      var newEnd = moment(event.endsAt).add(minutesDiff, 'minutes');
      delete event.tempStartsAt;

      vm.onEventTimesChanged({
        calendarEvent: event,
        calendarNewEventStart: newStart.toDate(),
        calendarNewEventEnd: event.endsAt ? newEnd.toDate() : null
      });
    };

    vm.eventDragged = function(event, minuteChunksMoved) {
      var minutesDiff = minuteChunksMoved * vm.dayViewSplit;
      event.tempStartsAt = moment(event.startsAt).add(minutesDiff, 'minutes').toDate();
    };

    vm.eventResizeComplete = function(event, edge, minuteChunksMoved) {
      var minutesDiff = minuteChunksMoved * vm.dayViewSplit;
      var start = moment(event.startsAt);
      var end = moment(event.endsAt);
      if (edge === 'start') {
        start.add(minutesDiff, 'minutes');
      } else {
        end.add(minutesDiff, 'minutes');
      }
      delete event.tempStartsAt;

      vm.onEventTimesChanged({
        calendarEvent: event,
        calendarNewEventStart: start.toDate(),
        calendarNewEventEnd: end.toDate()
      });
    };

    vm.eventResized = function(event, edge, minuteChunksMoved) {
      var minutesDiff = minuteChunksMoved * vm.dayViewSplit;
      if (edge === 'start') {
        event.tempStartsAt = moment(event.startsAt).add(minutesDiff, 'minutes').toDate();
      }
    };

  })
  .directive('mwlCalendarDay', function() {

    return {
      template: '<div mwl-dynamic-directive-template name="calendarDayView" overrides="vm.customTemplateUrls"></div>',
      restrict: 'E',
      require: '^mwlCalendar',
      scope: {
        events: '=',
        viewDate: '=',
        onEventClick: '=',
        onEventTimesChanged: '=',
        onTimespanClick: '=',
        onDateRangeSelect: '=',
        dayViewStart: '=',
        dayViewEnd: '=',
        dayViewSplit: '=',
        dayViewEventChunkSize: '=',
        dayViewSegmentSize: '=',
        dayViewEventWidth: '=',
        customTemplateUrls: '=?',
        cellModifier: '=',
        templateScope: '=',
        dayViewTimePosition: '=',
        draggableAutoScroll: '='
      },
      controller: 'MwlCalendarDayCtrl as vm',
      bindToController: true
    };

  });
