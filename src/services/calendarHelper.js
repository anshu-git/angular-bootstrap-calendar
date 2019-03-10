'use strict';

var angular = require('angular');
var calendarUtils = require('calendar-utils');

angular
  .module('mwl.calendar')
  .factory('calendarHelper', function($q, $templateRequest, dateFilter, moment, calendarConfig) {

    function formatDate(date, format) {
      if (calendarConfig.dateFormatter === 'angular') {
        return dateFilter(moment(date).toDate(), format);
      } else if (calendarConfig.dateFormatter === 'moment') {
        return moment(date).format(format);
      } else {
        throw new Error('Unknown date formatter: ' + calendarConfig.dateFormatter);
      }
    }

    function adjustEndDateFromStartDiff(oldStart, newStart, oldEnd) {
      if (!oldEnd) {
        return oldEnd;
      }
      var diffInSeconds = moment(newStart).diff(moment(oldStart));
      return moment(oldEnd).add(diffInSeconds);
    }

    function getRecurringEventPeriod(eventPeriod, recursOn, containerPeriodStart) {

      var eventStart = moment(eventPeriod.start);
      var eventEnd = moment(eventPeriod.end);
      var periodStart = moment(containerPeriodStart);

      if (recursOn) {

        switch (recursOn) {
          case 'year':
            eventStart.set({
              year: periodStart.year()
            });
            break;

          case 'month':
            eventStart.set({
              year: periodStart.year(),
              month: periodStart.month()
            });
            break;

          default:
            throw new Error('Invalid value (' + recursOn + ') given for recurs on. Can only be year or month.');
        }

        eventEnd = adjustEndDateFromStartDiff(eventPeriod.start, eventStart, eventEnd);

      }

      return { start: eventStart, end: eventEnd };

    }

    function eventIsInPeriod(event, periodStart, periodEnd) {

      periodStart = moment(periodStart);
      periodEnd = moment(periodEnd);

      var eventPeriod = getRecurringEventPeriod({ start: event.startsAt, end: event.endsAt || event.startsAt }, event.recursOn, periodStart);
      var eventStart = eventPeriod.start;
      var eventEnd = eventPeriod.end;

      return (eventStart.isAfter(periodStart) && eventStart.isBefore(periodEnd)) ||
        (eventEnd.isAfter(periodStart) && eventEnd.isBefore(periodEnd)) ||
        (eventStart.isBefore(periodStart) && eventEnd.isAfter(periodEnd)) ||
        eventStart.isSame(periodStart) ||
        eventEnd.isSame(periodEnd);

    }

    function filterEventsInPeriod(events, startPeriod, endPeriod) {
      return events.filter(function(event) {
        return eventIsInPeriod(event, startPeriod, endPeriod);
      });
    }

    function getEventsInPeriod(calendarDate, period, allEvents) {
      var startPeriod = moment(calendarDate).startOf(period);
      var endPeriod = moment(calendarDate).endOf(period);
      return filterEventsInPeriod(allEvents, startPeriod, endPeriod);
    }

    function getBadgeTotal(events) {
      return events.filter(function(event) {
        return event.incrementsBadgeTotal !== false;
      }).length;
    }

    function getWeekDayNames(excluded) {
      var weekdays = [0, 1, 2, 3, 4, 5, 6]
        .filter(function(wd) {
          return !(excluded || []).some(function(ex) {
            return ex === wd;
          });
        })
        .map(function(i) {
          return formatDate(moment().weekday(i), calendarConfig.dateFormats.weekDay);
        });

      return weekdays;
    }

    function getYearView(events, viewDate, cellModifier) {

      var view = [];
      var eventsInPeriod = getEventsInPeriod(viewDate, 'year', events);
      var month = moment(viewDate).startOf('year');
      var count = 0;
      while (count < 12) {
        var startPeriod = month.clone();
        var endPeriod = startPeriod.clone().endOf('month');
        var periodEvents = filterEventsInPeriod(eventsInPeriod, startPeriod, endPeriod);
        var cell = {
          label: formatDate(startPeriod, calendarConfig.dateFormats.month),
          isToday: startPeriod.isSame(moment().startOf('month')),
          events: periodEvents,
          date: startPeriod,
          badgeTotal: getBadgeTotal(periodEvents)
        };

        cellModifier({ calendarCell: cell });
        view.push(cell);
        month.add(1, 'month');
        count++;
      }

      return view;

    }

    function updateEventForCalendarUtils(event, eventPeriod) {
      event.start = eventPeriod.start.toDate();
      if (event.endsAt) {
        event.end = eventPeriod.end.toDate();
      }
      return event;
    }

    function getMonthView(events, viewDate, cellModifier, excluded) {

      // hack required to work with the calendar-utils api
      events.forEach(function(event) {
        var eventPeriod = getRecurringEventPeriod({
          start: moment(event.startsAt),
          end: moment(event.endsAt || event.startsAt)
        }, event.recursOn, moment(viewDate).startOf('month'));
        updateEventForCalendarUtils(event, eventPeriod);
      });

      var view = calendarUtils.getMonthView({
        events: events,
        viewDate: viewDate,
        excluded: excluded,
        weekStartsOn: moment().startOf('week').day()
      });

      view.days = view.days.map(function(day) {
        day.date = moment(day.date);
        day.label = day.date.date();
        day.badgeTotal = getBadgeTotal(day.events);
        if (!calendarConfig.displayAllMonthEvents && !day.inMonth) {
          day.events = [];
        }
        cellModifier({ calendarCell: day });
        return day;
      });

      // remove hack
      events.forEach(function(event) {
        delete event.start;
        delete event.end;
      });

      return view;

    }

    function getWeekView(events, viewDate, excluded) {

      var days = calendarUtils.getWeekViewHeader({
        viewDate: viewDate,
        excluded: excluded,
        weekStartsOn: moment().startOf('week').day()
      }).map(function(day) {
        day.date = moment(day.date);
        day.weekDayLabel = formatDate(day.date, calendarConfig.dateFormats.weekDay);
        day.dayLabel = formatDate(day.date, calendarConfig.dateFormats.day);
        return day;
      });

      var startOfWeek = moment(viewDate).startOf('week');
      var endOfWeek = moment(viewDate).endOf('week');

      var eventRows = calendarUtils.getWeekView({
        viewDate: viewDate,
        weekStartsOn: moment().startOf('week').day(),
        excluded: excluded,
        events: filterEventsInPeriod(events, startOfWeek, endOfWeek).map(function(event) {

          var weekViewStart = moment(startOfWeek).startOf('day');

          var eventPeriod = getRecurringEventPeriod({
            start: moment(event.startsAt),
            end: moment(event.endsAt || event.startsAt)
          }, event.recursOn, weekViewStart);

          var calendarUtilsEvent = {
            originalEvent: event,
            start: eventPeriod.start.toDate()
          };

          if (event.endsAt) {
            calendarUtilsEvent.end = eventPeriod.end.toDate();
          }

          return calendarUtilsEvent;
        })
      }).eventRows.map(function(eventRow) {

        eventRow.row = eventRow.row.map(function(rowEvent) {
          rowEvent.event = rowEvent.event.originalEvent;
          return rowEvent;
        });

        return eventRow;

      });

      return { days: days, eventRows: eventRows };

    }

    function getDayView(events, viewDate, dayViewStart, dayViewEnd, dayViewSplit, dayViewEventWidth, dayViewSegmentSize) {
      var dayPadding = 12;
      var dayStart = (dayViewStart || '00:00').split(':');
      var dayEnd = (dayViewEnd || '23:59').split(':');
      dayViewEventWidth = dayViewEventWidth ? dayViewEventWidth : 150;
      var maxEventWidth = parseInt(dayViewEventWidth) - dayPadding;
      var view = calendarUtils.getDayView({
        events: events.map(function(event) { // hack required to work with event API
          var eventPeriod = getRecurringEventPeriod({
            start: moment(event.startsAt),
            end: moment(event.endsAt || event.startsAt)
          }, event.recursOn, moment(viewDate).startOf('day'));
          return updateEventForCalendarUtils(event, eventPeriod);
        }),
        viewDate: viewDate,
        hourSegments: 60 / dayViewSplit,
        dayStart: {
          hour: dayStart[0],
          minute: dayStart[1]
        },
        dayEnd: {
          hour: dayEnd[0],
          minute: dayEnd[1]
        },
        eventWidth: maxEventWidth ? +maxEventWidth : 150,
        segmentHeight: dayViewSegmentSize || 30
      });
      // WIDTHS OF THE CALENDAR PANEL AND THE EVENTS TO BE ADJUSTED HERE
      // var maxEventWidth = parseInt(dayViewEventWidth) - dayPadding;
      var maxEventsInCascadeCount = 0;
      var startingIndex;
      var previousEventTop = -1, previousEventBottom = -1, currentEventTop, currentEventBottom;
      // 1. Update view.width object (This fix is required for overflow of events issue when time is shown on side)
      // 2. Update view.events object (if present)
      switch (view.events.length) {
        case 0:
          break;
        case 1:
          view.width = dayViewEventWidth;
          view.events[0].width = maxEventWidth;
          break;
        default:
          view.width = dayViewEventWidth;
          var previousEventLeft = -1;
          var actualEventsInCascade = 0;
          for (var i = 0; i < view.events.length; i++) {
            var event = view.events[i];
            currentEventTop = event.top;
            currentEventBottom = currentEventTop + event.height;
            //Skipping the first event
            if (previousEventBottom >= 0 && previousEventTop >= 0) {
              // CHECK if current Event lies in the till previous Event Range
              // In this case total size of the events will reduce
              if (currentEventTop >= previousEventTop && currentEventTop < previousEventBottom) {
                maxEventsInCascadeCount = maxEventsInCascadeCount + 1;
                if (previousEventLeft < event.left) {
                  actualEventsInCascade++;
                  previousEventLeft = event.left;
                }

                // Update the cumulative height of the events in cascade
                if (currentEventBottom > previousEventBottom) {
                  previousEventBottom = currentEventBottom;
                }
              } else {
                //Update width of the till previous event
                // var eventWidth = maxEventWidth / maxEventsInCascadeCount;
                // var k = 0;
                for (var j = startingIndex; j < startingIndex + maxEventsInCascadeCount; j++) {
                  // Loop through to find number of cascades
                  var prevLeft = view.events[j].left, startRight = view.events[j].left + view.events[j].width;
                  var prevTop = view.events[j].top, prevBottom = view.events[j].top + view.events[j].height;
                  var cascadeEventsList = [], widthReduceCount = 0;
                  var widthReduceLeftCount = 0;
                  var widthReduceRightCount = 1;
                  var prevRight = view.events[j].left + view.events[j].width;
                  for (var idx = j + 1; idx < startingIndex + maxEventsInCascadeCount; idx++) {
                    var dummyCondition = true;
                    var tempIndex = j + 1;
                    while (dummyCondition) {
                      if (tempIndex >= startingIndex + maxEventsInCascadeCount) {
                        var seedLeft = prevRight;
                        break;
                      } else if (view.events[tempIndex].left > prevLeft) {
                        seedLeft = view.events[tempIndex].left;
                        break;
                      }
                      tempIndex++;
                    }
                    var curLeft = view.events[idx].left, curRight = view.events[idx].left + view.events[idx].width;
                    if (curLeft === seedLeft && curLeft !== prevLeft) {
                      cascadeEventsList.push(idx);
                    }
                    if (curRight > prevRight) {
                      widthReduceRightCount++;
                      prevRight = curRight;
                    }
                  }
                  var alreadyFoundLeftArray = [];
                  for (var index = j - 1; index >= startingIndex; index--) {
                    curLeft = view.events[index].left; curRight = view.events[index].left + view.events[index].width;
                    var curTop = view.events[index].top, curBottom = view.events[index].top + view.events[index].height;
                    if (curLeft < prevLeft && alreadyFoundLeftArray.indexOf(curLeft) === -1) {
                      widthReduceLeftCount++;
                      alreadyFoundLeftArray.push(curLeft);
                    } else if (curLeft > prevLeft && curTop <= prevTop && curBottom >= prevBottom) {
                      view.events[j].width = view.events[index].left;
                    }
                  }
                  widthReduceCount = widthReduceLeftCount + widthReduceRightCount;
                  if (actualEventsInCascade > widthReduceCount) {
                    var effectiveWidth = view.events[j].width - view.events[j].left;
                    view.events[j].width = effectiveWidth / widthReduceRightCount;
                  } else {
                    view.events[j].width = view.events[j].width / widthReduceCount;
                  }
                  var newRight = view.events[j].left + view.events[j].width;
                  for (var l = 0; l < cascadeEventsList.length; l++) {
                    view.events[cascadeEventsList[l]].originalLeft = view.events[cascadeEventsList[l]].left;
                    view.events[cascadeEventsList[l]].left = newRight;
                  }

                }
                //RESET ALL THE COUNTER VARIABLES
                previousEventTop = currentEventTop;
                previousEventBottom = currentEventBottom;
                maxEventsInCascadeCount = 1;
                startingIndex = i;
              }
              //If this is the last event
              if (i === (view.events.length - 1)) {
                for (j = startingIndex; j < startingIndex + maxEventsInCascadeCount; j++) {
                  // Loop through to find number of cascades
                  prevLeft = view.events[j].left;
                  startRight = view.events[j].left + view.events[j].width;
                  prevRight = startRight;
                  prevTop = view.events[j].top;
                  prevBottom = view.events[j].top + view.events[j].height;
                  cascadeEventsList = [];
                  widthReduceLeftCount = 0;
                  widthReduceRightCount = 1;
                  for (idx = j + 1; idx < startingIndex + maxEventsInCascadeCount; idx++) {
                    dummyCondition = true;
                    tempIndex = j + 1;
                    while (dummyCondition) {
                      if (tempIndex >= startingIndex + maxEventsInCascadeCount) {
                        seedLeft = prevRight;
                        break;
                      } else if (view.events[tempIndex].left > prevLeft) {
                        seedLeft = view.events[tempIndex].left;
                        break;
                      }
                      tempIndex++;
                    }
                    curLeft = view.events[idx].left;
                    curRight = view.events[idx].left + view.events[idx].width;
                    if (curLeft === seedLeft && curLeft !== prevLeft) {
                      cascadeEventsList.push(idx);
                    }
                    if (curRight > prevRight) {
                      widthReduceRightCount++;
                      prevRight = curRight;
                    }
                  }
                  alreadyFoundLeftArray = [];
                  for (index = j - 1; index >= startingIndex; index--) {
                    curLeft = view.events[index].left; curRight = view.events[index].left + view.events[index].width;
                    curTop = view.events[index].top;
                    curBottom = view.events[index].top + view.events[index].height;
                    if (curLeft < prevLeft && alreadyFoundLeftArray.indexOf(curLeft) === -1) {
                      widthReduceLeftCount++;
                      alreadyFoundLeftArray.push(curLeft);
                    } else if (curLeft > prevLeft && curTop <= prevTop && curBottom >= prevBottom) {
                      view.events[j].width = view.events[index].left;
                    }
                  }
                  widthReduceCount = widthReduceLeftCount + widthReduceRightCount;
                  if (actualEventsInCascade > widthReduceCount) {
                    effectiveWidth = view.events[j].width - view.events[j].left;
                    view.events[j].width = effectiveWidth / widthReduceRightCount;
                  } else {
                    view.events[j].width = view.events[j].width / widthReduceCount;
                  }
                  newRight = view.events[j].left + view.events[j].width;
                  for (l = 0; l < cascadeEventsList.length; l++) {
                    view.events[cascadeEventsList[l]].left = newRight;
                  }

                }
                maxEventsInCascadeCount = 0;
              }
            } else {
              if (previousEventLeft < event.left) {
                actualEventsInCascade++;
                previousEventLeft = event.left;
              }
              previousEventTop = currentEventTop;
              previousEventBottom = currentEventBottom;
              maxEventsInCascadeCount = maxEventsInCascadeCount + 1;
              startingIndex = i;
            }
          }
      }
      //WIDTH ADJUSTMENT ENDS HERE

      var visitedEventIdsList = [];
      // remove hack to work with new event API
      for (i = 0; i < events.length; i++) {
        event = events[i];
        delete event.start;
        delete event.end;
        if (event.hasOwnProperty('calendarEventId')) {
          if (visitedEventIdsList.indexOf(event.calendarEventId) > -1) {
            events.splice(i, 1);
          } else {
            visitedEventIdsList.push(event.calendarEventId);
          }
        }
      }
      // events.forEach(function(event) {
      //   delete event.start;
      //   delete event.end;
      // });

      return view;

    }

    function getWeekViewWithTimes(events, viewDate, dayViewStart, dayViewEnd, dayViewSplit) {
      var weekView = getWeekView(events, viewDate);
      var newEvents = [];
      var flattenedEvents = [];
      weekView.eventRows.forEach(function(row) {
        row.row.forEach(function(eventRow) {
          flattenedEvents.push(eventRow.event);
        });
      });
      weekView.days.forEach(function(day) {
        var dayEvents = flattenedEvents.filter(function(event) {
          return moment(event.startsAt).startOf('day').isSame(moment(day.date).startOf('day'));
        });
        var newDayEvents = getDayView(
          dayEvents,
          day.date,
          dayViewStart,
          dayViewEnd,
          dayViewSplit
        ).events;
        newEvents = newEvents.concat(newDayEvents);
      });
      weekView.eventRows = [{
        row: newEvents.map(function(dayEvent) {
          var event = dayEvent.event;
          return {
            event: event,
            top: dayEvent.top,
            offset: calendarUtils.getWeekViewEventOffset({
              event: {
                start: event.startsAt,
                end: event.endsAt
              },
              startOfWeek: moment(viewDate).startOf('week').toDate()
            })
          };
        })
      }];
      return weekView;
    }

    function getDayViewHeight(dayViewStart, dayViewEnd, dayViewSplit, dayViewSegmentSize) {
      var dayViewStartM = moment(dayViewStart || '00:00', 'HH:mm');
      var dayViewEndM = moment(dayViewEnd || '23:59', 'HH:mm');
      var hourHeight = (60 / dayViewSplit) * (dayViewSegmentSize || 30);
      return ((dayViewEndM.diff(dayViewStartM, 'minutes') / 60) * hourHeight) + 3;
    }

    function loadTemplates() {

      var templatePromises = Object.keys(calendarConfig.templates).map(function(key) {
        var templateUrl = calendarConfig.templates[key];
        return $templateRequest(templateUrl);
      });

      return $q.all(templatePromises);

    }

    return {
      getWeekDayNames: getWeekDayNames,
      getYearView: getYearView,
      getMonthView: getMonthView,
      getWeekView: getWeekView,
      getDayView: getDayView,
      getWeekViewWithTimes: getWeekViewWithTimes,
      getDayViewHeight: getDayViewHeight,
      adjustEndDateFromStartDiff: adjustEndDateFromStartDiff,
      formatDate: formatDate,
      loadTemplates: loadTemplates,
      eventIsInPeriod: eventIsInPeriod //expose for testing only
    };

  });
