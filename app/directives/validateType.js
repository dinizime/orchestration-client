(function() {
    'use strict';

    //custom directive to validate the Literal types
    //It is used at app/views/addLiteral, with the attribute directive 'validate-type'
    angular.module('orchestrationApp').directive('validateType', [
        function() {
            var link = function($scope, $element, $attrs, ctrl) {

                var validate = function(viewValue) {
                    ctrl.$setValidity('string', null);
                    ctrl.$setValidity('real', null);
                    ctrl.$setValidity('integer', null);
                    ctrl.$setValidity('bbox', null);
                    ctrl.$setValidity('boolean', null);

                    var comparisonModel = $attrs.validateType;
                    // ["String", "Integer", "Real", "BBOX", "Boolean"]

                    switch (comparisonModel) {
                        case "String":
                            //FIXME exists invalid string?
                            ctrl.$setValidity('string', true);
                            break;
                        case "Integer":
                            if (isNaN(viewValue) || !Number.isInteger(parseFloat(viewValue))) {
                                ctrl.$setValidity('integer', false);
                            } else {
                                ctrl.$setValidity('integer', true);
                            }
                            break;
                        case "Real":
                            if (isNaN(viewValue)) {
                                ctrl.$setValidity('real', false);
                            } else {
                                ctrl.$setValidity('real', true);
                            }
                            break;
                        case "BBOX":
                            var patt = /\[-?\d+,-?\d+,-?\d+,-?\d+\]/;
                            if (patt.test(viewValue)) {
                                ctrl.$setValidity('bbox', true);
                            } else {
                                ctrl.$setValidity('bbox', false);
                            }
                            break;
                        case "Boolean":
                            if (viewValue === "true" || viewValue === "false") {
                                ctrl.$setValidity('boolean', true);
                            } else {
                                ctrl.$setValidity('boolean', false);
                            }
                            break;
                    }

                    return viewValue;
                };

                ctrl.$parsers.unshift(validate);
                //ctrl.$formatters.push(validate);

                $attrs.$observe('validateType', function(comparisonModel) {
                    return validate(ctrl.$viewValue);
                });

            };

            return {
                restrict: 'A',
                require: 'ngModel',
                link: link
            };

        }
    ]);
})();
