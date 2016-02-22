(function() {
    'use strict';

    //ui.bootstrap https://angular-ui.github.io/bootstrap/ - MIT License 
    //ngRoute https://docs.angularjs.org/api/ngRoute - MIT License 
    //ngMessages https://docs.angularjs.org/api/ngMessages/directive/ngMessages - MIT License
    //katex - https://github.com/Khan/KaTeX - MIT License
    var app = angular.module('orchestrationApp', ['ui.bootstrap', 'ngRoute', 'ngMessages', 'katex']);

    app.config(function($routeProvider) {
        $routeProvider
            .when('/', {
                controller: 'orchestrationCtrl',
                templateUrl: '/app/views/index.html'
            })
            .otherwise({
                redirectTo: '/'
            });
    });

    //Filter to prettify JSON
    //Code extracted from: http://jsfiddle.net/KSTe8/
    //It accepts JSON stringfied or the JSON object
    //The JSON must be stringfied with JSON.stringify(json, undefined, 4);
    app.filter('prettify', ['$sce', function($sce) {

        function syntaxHighlight(json, param) {
            if (typeof json === 'object') {
                json = JSON.stringify(json, undefined, 4);
            }

            if (json === null || json === undefined) {
                return "";
            } else {

                json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                return $sce.trustAsHtml(json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function(match) {
                    var cls = 'number';
                    if (/^"/.test(match)) {
                        if (/:$/.test(match)) {
                            cls = 'key';
                        } else {
                            cls = 'string';
                        }
                    } else if (/true|false/.test(match)) {
                        cls = 'boolean';
                    } else if (/null/.test(match)) {
                        cls = 'null';
                    }
                    return '<span class="' + cls + '">' + match + '</span>';
                }));
            }
        }

        return syntaxHighlight;
    }]);

})();
