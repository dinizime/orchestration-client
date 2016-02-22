(function() {
    "use strict";
    //basic configuration of the flowchart
    var flowchartFactory = function() {
        var factory = {};

        factory.taskRx = 10;
        factory.taskRy = 10;
        factory.taskWidth = 180;
        factory.taskHeight = 96;
        factory.circleR = 10;
        factory.textDistance = 8;

        return factory;
    };

    //flowDataFactory.$inject = [];

    angular.module('orchestrationApp')
        .factory('flowchartFactory', flowchartFactory);

})();
