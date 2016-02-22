(function() {
    'use strict';

    //flowchart directive
    // It is called in app/view/index.html as <flowchart data="flowData"></flowchart>
    angular.module('orchestrationApp').directive('flowchart', function() {
        return {
            restrict: 'E',
            templateUrl: "app/views/flowchartTemplate.html",
            replace: true,
            scope: {
                data: "=",
            },
            controller: 'flowchartCtrl',
        };
    });

})();
