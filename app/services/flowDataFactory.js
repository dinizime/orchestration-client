(function() {
    "use strict";
    //manages the construction of the flow and send to Verification and Orchestration WPS
    var flowDataFactory = function($http, $interval, flowchartFactory) {
        var factory = {};

        //default config of flowchart
        factory.taskWidth = flowchartFactory.taskWidth;
        factory.taskHeight = flowchartFactory.taskHeight;

        //the current workflow is stored in the data json object
        factory.data = {};
        factory.data.tasks = [];
        factory.data.sequenceFlows = [];

        //info are the messages displayed in the screen (such as 'Orchestration complete')
        factory.info = {};
        factory.info.class = "";
        factory.info.message = "";

        //URL for the verification WPS and orchestration WPS
        factory.configuration = {};
        factory.configuration.orchestrationUrl = "http://localhost:3000/wps/orchestration/jobs";
        factory.configuration.verificationUrl = "http://localhost:3000/wps/verify/jobs";
        //time request for pooling interval
        factory.configuration.timeRequest = 1000;



        //manage the ids of the tasks and sequence flows
        factory.maxFlowId = -1;
        factory.maxTaskId = -1;
        factory.prepareFlows = function() {
            var Ids = factory.data.tasks.map(function(item) {
                return parseInt(item["@id"].split(":")[1]);
            });
            factory.maxTaskId = Math.max.apply(null, Ids);

            factory.data.sequenceFlows.forEach(function(flow) {
                if (parseInt(flow["@id"].split(":")[1]) > factory.maxFlowId) factory.maxFlowId = parseInt(flow["@id"].split(":")[1]);
                factory.prepareFlow(flow);
            });
        };

        //build the lines in the flowchart
        factory.prepareFlow = function(flow) {
            //find Input
            var source;
            var destination;

            factory.data.tasks.forEach(function(item) {
                if (item["@id"] === flow.from) {
                    source = item;
                }
            });

            //find Output
            factory.data.tasks.forEach(function(item) {
                if (item["@id"] === flow.to) {
                    destination = item;
                }
            });


            var inputIndex = source.outputs.indexOf(flow.fromPort) + 1;
            var outputIndex = destination.inputs.indexOf(flow.toPort) + 1;

            flow.style = {};
            flow.style.source = {};
            flow.style.dest = {};

            flow.style.source.x = source.style.x + inputIndex * factory.taskWidth / (1 + source.outputs.length);

            flow.style.source.y = source.style.y + factory.taskHeight;

            flow.style.dest.x = destination.style.x + outputIndex * factory.taskWidth / (1 + destination.inputs.length);

            flow.style.dest.y = destination.style.y;
        };

        //send workflow to the verification WPS
        factory.results = {};
        factory.resultsAvailable = {
            value: false
        };
        factory.isExecuting = {
            value: false
        };
        factory.execute = function() {
            factory.reset();
            factory.info.class = "alert-info";
            factory.info.message = "Sending flow to Orchestration WPS.";


            factory.isExecuting.value = true;
            $http({
                method: 'POST',
                url: factory.configuration.orchestrationUrl,
                headers: {
                    'Content-Type': 'application/ld+json'
                },
                data: {
                    flow: factory.data
                }
            }).then(function successCallback(response) {
                var location = response.headers('Location');

                factory.info.class = "alert-info";
                factory.info.message = "Running orchestration.";

                //auxiliary variable to make sure Succeeded will only run once;
                var first = true;
                var intervalPromise = $interval(function() {
                    $http({
                        method: 'GET',
                        url: location,
                        headers: {
                            'Accept': 'application/ld+json'
                        },
                    }).then(function successCallback(response) {
                        //verify status and update color
                        var job = response.data;

                        if (job.orchestrationStatus) {
                            job.orchestrationStatus.forEach(function(item) {
                                factory.data.tasks.forEach(function(task) {
                                    if (item["@id"] === task["@id"]) {
                                        task.style.status = item.status;
                                    }
                                });
                            });
                        }
                        if (response.status === '500' || job.status === "Failed") {
                            factory.info.class = "alert-danger";
                            factory.info.message = "Orchestration failed.";
                            $interval.cancel(intervalPromise);
                            factory.resultsAvailable.value = false;
                            factory.isExecuting.value = false;

                        } else if (job.status === "Succeeded" && first) {
                            $interval.cancel(intervalPromise);
                            //get result page
                            factory.info.class = "alert-info";
                            factory.info.message = "Requesting results.";

                            $http({
                                    method: 'GET',
                                    url: job.resultsUrl,
                                    headers: {
                                        'Accept': 'application/ld+json'
                                    },
                                })
                                .then(function(response) {
                                    $http({
                                            method: 'GET',
                                            url: response.data.results,
                                            headers: {
                                                'Accept': 'application/ld+json'
                                            },
                                        })
                                        .then(function(response) {
                                            delete response.data["@context"];
                                            factory.results = response.data;
                                            factory.info.class = "alert-success";
                                            factory.info.message = "Orchestration complete";
                                            factory.resultsAvailable.value = true;
                                            factory.isExecuting.value = false;
                                        }, function(error) {
                                            factory.resultsAvailable.value = false;
                                            factory.isExecuting.value = false;
                                            factory.info.class = "alert-danger";
                                            factory.info.message = "Failed. Could not retrieve the results.";
                                        });

                                }, function(error) {
                                    factory.resultsAvailable.value = false;
                                    factory.isExecuting.value = false;
                                    factory.info.class = "alert-danger";
                                    factory.info.message = "Failed. Could not retrieve the result list.";
                                });
                        }
                    }, function errorCallback(response) {
                        factory.resultsAvailable.value = false;
                        factory.isExecuting.value = false;
                        $interval.cancel(intervalPromise);
                        factory.info.class = "alert-danger";
                        factory.info.message = "Failed. Could not retrieve status of the job.";
                    });
                }, factory.configuration.timeRequest);
            }, function errorCallback(response) {
                factory.resultsAvailable.value = false;
                factory.isExecuting.value = false;
                factory.info.class = "alert-danger";
                factory.info.message = "Failed. Could not submit flow to Orchestration WPS.";
            });
        };


        //remove error messages
        factory.reset = function() {
            factory.data.tasks.forEach(function(item) {
                delete item.style.status;
            });
            factory.data.sequenceFlows.forEach(function(item) {
                delete item.style.status;
            });

            factory.errors.tasks = {};
            factory.errors.sequenceFlows = {};
        };

        //send workflow to the verification WPS
        factory.errors = {};
        factory.errors.tasks = {};
        factory.errors.sequenceFlows = {};
        factory.verify = function() {
            factory.reset();

            factory.info.class = "alert-info";
            factory.info.message = "Sending flow to Verification WPS.";

            factory.isExecuting.value = true;
            $http({
                method: 'POST',
                url: factory.configuration.verificationUrl,
                headers: {
                    'Content-Type': 'application/ld+json'
                },
                data: {
                    flow: factory.data
                }
            }).then(function successCallback(response) {
                var location = response.headers('Location');

                factory.info.class = "alert-info";
                factory.info.message = "Running verification.";

                //auxiliary variable to make sure Succeeded will only run once;
                var first = true;
                var intervalPromise = $interval(function() {
                    $http({
                        method: 'GET',
                        url: location,
                        headers: {
                            'Accept': 'application/ld+json'
                        },
                    }).then(function successCallback(response) {
                        //verify status and update color
                        var job = response.data;

                        if (job.verificationStatus) {
                            factory.info.class = "alert-info";
                            factory.info.message = job.verificationStatus;
                        }

                        if (job.status === "Failed") {
                            factory.info.class = "alert-danger";
                            factory.info.message = "Verification failed.";
                            $interval.cancel(intervalPromise);
                            factory.resultsAvailable.value = false;
                            factory.isExecuting.value = false;

                        } else if (job.status === "Succeeded" && first) {
                            first = false;
                            $interval.cancel(intervalPromise);
                            //get result page
                            factory.info.class = "alert-info";
                            factory.info.message = "Requesting results.";

                            $http({
                                    method: 'GET',
                                    url: job.resultsUrl,
                                    headers: {
                                        'Accept': 'application/ld+json'
                                    },
                                })
                                .then(function(response) {
                                    $http({
                                            method: 'GET',
                                            url: response.data.results,
                                            headers: {
                                                'Accept': 'application/ld+json'
                                            },
                                        })
                                        .then(function(response) {
                                            delete response.data["@context"];
                                            //update color based on the errors
                                            console.log(response.data);
                                            response.data.errors.forEach(function(item) {
                                                if (item.valueType === "tasks") {
                                                    factory.data.tasks.forEach(function(task) {
                                                        if (item.invalidValues.indexOf(task["@id"]) !== -1) {
                                                            if (factory.errors.tasks[task["@id"]]) {
                                                                var rep = factory.errors.tasks[task["@id"]].filter(function(val) {
                                                                    return val["@type"] === item["@type"];
                                                                }).length;
                                                                if (rep === 0) {
                                                                    factory.errors.tasks[task["@id"]].push(item);
                                                                }
                                                            } else {
                                                                (factory.errors.tasks[task["@id"]] = []).push(item);
                                                            }
                                                            task.style.status = "Failed";
                                                        }
                                                    });
                                                } else if (item.valueType === "sequenceFlows") {
                                                    factory.data.sequenceFlows.forEach(function(flow) {
                                                        if (item.invalidValues.indexOf(flow["@id"]) != -1) {
                                                            if (factory.errors.sequenceFlows[flow["@id"]]) {
                                                                var rep = factory.errors.sequenceFlows[flow["@id"]].filter(function(val) {
                                                                    return val["@type"] === item["@type"];
                                                                }).length;
                                                                if (rep === 0) {
                                                                    factory.errors.sequenceFlows[flow["@id"]].push(item);
                                                                }
                                                            } else {
                                                                (factory.errors.sequenceFlows[flow["@id"]] = []).push(item);
                                                            }
                                                            flow.style.status = "Failed";
                                                        }
                                                    });
                                                }
                                            });

                                            if(response.data.total > 0){
                                                factory.info.class = "alert-danger";
                                                factory.info.message = "Verification complete. Errors found.";
                                            } else {
                                                factory.info.class = "alert-success";
                                                factory.info.message = "Verification complete. No errors found.";
                                            }

                                            factory.isExecuting.value = false;

                                        }, function(error) {
                                            factory.isExecuting.value = false;
                                            factory.info.class = "alert-danger";
                                            factory.info.message = "Failed. Could not retrieve the results.";
                                        });
                                }, function(error) {
                                    factory.isExecuting.value = false;
                                    factory.info.class = "alert-danger";
                                    factory.info.message = "Failed. Could not retrieve the result list.";
                                });
                        }
                    }, function errorCallback(response) {
                        $interval.cancel(intervalPromise);
                        factory.isExecuting.value = false;
                        factory.info.class = "alert-danger";
                        factory.info.message = "Failed. Could not retrieve status of the job.";
                    });
                }, factory.configuration.timeRequest);
            }, function errorCallback(response) {
                factory.isExecuting.value = false;
                factory.info.class = "alert-danger";
                factory.info.message = "Failed. Could not submit flow to Verification WPS.";
            });
        };
        return factory;
    };

    flowDataFactory.$inject = ['$http', '$interval', 'flowchartFactory'];

    angular.module('orchestrationApp')
        .factory('flowDataFactory', flowDataFactory);

})();
