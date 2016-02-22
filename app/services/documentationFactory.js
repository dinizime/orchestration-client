(function() {
    "use strict";
    var documentationFactory = function($http, $q, flowDataFactory) {
        var factory = {};

        factory.services = {};
        factory.services.flowLibrary = ["http://localhost:3002/csw/workflows"];
        factory.services.paramflowLibrary = ["http://localhost:3002/csw/paramworkflows"];
        factory.services.csw = ["http://localhost:3002/csw/records"];

        factory.layers = {};
        factory.layers.data = [];
        factory.layers.processes = [];
        factory.layers.aux = [];

        //Saves a workflow, is executed from app/controllers/orchestrationController
        //The save comes from the app/views/saveFlows.html
        factory.saveWorkflow = function(workflow,parametric,url){
            //parametric flows can be used as a component in a composition
            //workflows can only be loaded, executed and modified (the interface currently does not allow the workflow to be updated, but the service allows)
            var data;
            console.log(workflow);
            if(parametric === "true"){
                data = {
                    name: workflow.metadata.name,
                    type: "Subgraph",
                    inputs: [],
                    outputs: [],
                    workflow: workflow,
                    metadata: {
                        preCondition: null,
                        postCondition: null,
                        inputTypes: {},
                        outputTypes: {}
                    }
                };
                workflow.tasks.forEach(function(task){
                    if(task.type === "Input Parameter"){
                        data.inputs.push(task.name);
                        data.metadata.inputTypes[task.name] = task.metadata.outputTypes.inputParam;
                    }
                    if(task.type === "Output Parameter"){
                        data.outputs.push(task.name);
                        data.metadata.outputTypes[task.name] = task.metadata.inputTypes.outputParam;
                    }
                });
                data = JSON.stringify(data);
            } else {
                data = JSON.stringify(workflow);
            }

            var q = $q.defer();
            $http({
                method: 'POST',
                url: url,
                headers: {
                    'Content-Type': 'application/ld+json'
                },
                data: data
            }).then(function successCallback(response) {
                //FIXME show message workflow saved with success
                q.resolve('success');
                if(parametric === "true"){
                    factory.layers.processes.push(JSON.parse(data));
                }
                
            }, function errorCallback(response) {
                //FIXME show message could not save the workflow
                q.reject('URL not available');
            });  
            return q.promise;
        };

        //Load the workflows data in the Workflow load menu
        //It is called from app/controllers/orchestrationController.js
        //The load comes from app/view/openFlows.htm
        factory.loadWorkflow = function(url,parametric){
            //promise that the workflow will load
            var q = $q.defer();
 
            $http({
                method: 'GET',
                url: url,
                headers: {
                    'Accept': 'application/ld+json'
                },
            }).then(function successCallback(response) {
                //merge arrays
                if(parametric){
                    response.data.records.forEach(function(flow){
                        factory.flows.push(flow.workflow);
                    });
                } else {
                    factory.flows = factory.flows.concat(response.data.records);
                }
                q.resolve('success');
                
            }, function errorCallback(response) {
                //FIXME show message Layer not available
                 q.reject(url);
            });

            return q.promise;
        };

        factory.loadParamWorkflow = function(){
            factory.services.paramflowLibrary.forEach(function(url){
                $http({
                    method: 'GET',
                    url: url,
                    headers: {
                        'Accept': 'application/ld+json'
                    },
                }).then(function successCallback(response) {
                    //merge arrays
                    if(response.data.records){
                        factory.layers.processes = factory.layers.processes.concat(response.data.records);
                    }
                    
                }, function errorCallback(response) {
                    //FIXME show message Layer not available
                });
            });
        };

        factory.loadDataProcess = function(){
            factory.services.csw.forEach(function(url){
                $http({
                    method: 'GET',
                    url: url,
                    headers: {
                        'Accept': 'application/ld+json'
                    },
                }).then(function successCallback(response) {
                    //merge arrays
                    if(response.data.records){
                        //verify if data or process
                        //build correct format
                        response.data.records.forEach(function(record){
                            var aux = {};
                            if(record["@type"].indexOf("featureType")>-1){
                                aux = {
                                    name: record["ows:name"],
                                    url: record["@id"],
                                    type: "WFS",
                                    inputs: [],
                                    outputs: [],
                                    metadata: {
                                        inputTypes: record.inputTypes,
                                        outputTypes: record.outputTypes
                                    }
                                };
                                for(var key in record.inputTypes){
                                    aux.inputs.push(key);
                                }                                
                                for(key in record.outputTypes){
                                    aux.outputs.push(key);
                                }
                                record.supportedOperation.forEach(function(op){
                                    if(op.method === 'GET'){
                                        aux.metadata.preCondition  = op.preCondition;
                                        aux.metadata.postCondition  = op.postCondition;
                                    }
                                });
                                factory.layers.data.push(aux);
                            } else if(record["@type"].indexOf("process")>-1){
                                aux = {
                                    name: record["ows:name"],
                                    url: record["@id"],
                                    type: "WPS",
                                    inputs: [],
                                    outputs: [],
                                    metadata: {
                                        propagatedPostCondition: null,
                                        inputTypes: record.inputTypes,
                                        outputTypes: record.outputTypes
                                    }
                                }; 
                                record.supportedOperation.forEach(function(op){
                                    if(op.method === 'POST'){
                                        aux.metadata.preCondition  = op.preCondition;
                                        aux.metadata.postCondition  = op.postCondition;
                                        op.inputs.forEach(function(inp){
                                            aux.inputs.push(inp["ows:title"]);
                                        });
                                        op.outputs.forEach(function(out){
                                            aux.outputs.push(out["ows:title"]);
                                        });
                                    }
                                });
                                factory.layers.processes.push(aux);
                            } else {
                                console.log('error loading layer')
                            }

                        });
                    }
                    
                }, function errorCallback(response) {
                    //FIXME show message Layer not available
                });
            });
        };

        factory.loadResults = function(key,i,url){
            var outputTypes;
            var preCondition;
            var postCondition;
            if(key.indexOf("_")>-1){
                var key1 = key.split("_")[0];
                var key2 = key.split("_")[1];
                flowDataFactory.data.tasks.forEach(function(task){
                    if(task["@id"] === key2 && task.type === 'Subgraph' && task.workflow){
                        task.workflow.tasks.forEach(function(t){
                            if(t["@id"] === key1){
                                outputTypes = task.metadata.outputTypes[i].type;
                                preCondition = task.metadata.preCondition;
                                postCondition = task.metadata.postCondition;
                            }
                        });
                    }
                });                
            } else {
                flowDataFactory.data.tasks.forEach(function(task){
                    if(task["@id"] === key){
                        outputTypes = task.metadata.outputTypes[i].type;
                        preCondition = task.metadata.preCondition;
                        postCondition = task.metadata.postCondition;
                    }
                });
            }
            var name = key+"_"+i;
            var aux = {
                name: name,
                url: url,
                type: "WFS",
                inputs: [],
                outputs: [i],
                metadata: {
                    inputTypes: null,
                    outputTypes: {}
                }
            };                           
            aux.metadata.outputTypes[i]  = {};
            aux.metadata.outputTypes[i].type  = outputTypes;
            aux.metadata.preCondition  = preCondition;
            aux.metadata.postCondition  = postCondition;

            factory.layers.data.push(aux);
        };

        factory.loadResultsFromServer = function(key,i,url){
            var name = key+"_"+i;
            $http({
                method: 'HEAD',
                url: url
            }).then(function successCallback(response) {
                var links = response.headers('Link') || "";
                var doc = links.split(',').filter(function (link) {
                    if (link.split(';')[1] && link.split(';')[1].replace(/rel="(.*)"/, '$1').trim() === "http://www.opengis.net/rest-ows/resourceMetadata") {
                        return true;
                    }
                    return false;
                });
                if (doc.length === 1) {
                    //Documentation found - Try to get document
                    var metadataUrl = doc[0].split(';')[0].replace(/<(.*)>/, '$1').trim();
                    $http({
                        method: 'GET',
                        url: metadataUrl,
                        headers: {
                            'Accept': 'application/ld+json'
                        },
                    }).then(function successCallback(response) {
                         if(response.data){
                            var record = response.data;
                            //verify if data or process
                            //build correct format
                            var aux = {};
                            if(record["@type"].indexOf("featureType")>-1){
                                aux = {
                                    name: name,
                                    url: record["@id"],
                                    type: "WFS",
                                    inputs: [],
                                    outputs: [],
                                    metadata: {
                                        inputTypes: record.inputTypes,
                                        outputTypes: record.outputTypes
                                    }
                                };
                                for(var k in record.inputTypes){
                                    aux.inputs.push(k);
                                }                                
                                for(k in record.outputTypes){
                                    aux.outputs.push(k);
                                }
                                record.supportedOperation.forEach(function(op){
                                    if(op.method === 'GET'){
                                        aux.metadata.preCondition  = op.preCondition;
                                        aux.metadata.postCondition  = op.postCondition;
                                    }
                                });
                                factory.layers.data.push(aux);
                            } else {
                                console.log('error loading layer');
                            }
                        }
                    }, function errorCallback(response) {
                        //FIXME show message Layer not available
                    });
                } else {
                    //FIXME not found
                }
            }, function errorCallback(response) {
                //FIXME show message Layer not available
            });
        };


        //FIXME change to read CSW
        var init = function() {
            //load paramflows
            factory.loadParamWorkflow();
            factory.loadDataProcess();

            //loadflows

            factory.layers.aux.push({
                name: "Literal",
                type: "Literal",
                inputs: [],
                outputs: ['literal'],
                metadata: {
                    preCondition: null,
                    postCondition: null,
                    inputTypes: null,
                    outputTypes: {
                        literal: {
                            type: null
                        }
                    }
                }
            });
            factory.layers.aux.push({
                name: "Input Parameter",
                type: "Input Parameter",
                inputs: [],
                outputs: ['inputParam'],
                metadata: {
                    preCondition: null,
                    postCondition: null,
                    inputTypes: null,
                    outputTypes: {
                        inputParam: {
                            type: null
                        }
                    }
                }
            });
            factory.layers.aux.push({
                name: "Output Parameter",
                type: "Output Parameter",
                inputs: ['outputParam'],
                outputs: [],
                metadata: {
                    preCondition: null,
                    postCondition: null,
                    inputTypes: {
                        outputParam: {
                            type: null,
                            required: true,
                            unique: true
                        }
                    },
                    outputTypes: null
                }
            });
            // factory.layers.aux.push({
            //     name: "Conditional",
            //     type: "Conditional",
            //     inputs: ['input'],
            //     outputs: ['true','false'],
            //     condition: null,
            //     metadata: {
            //         preCondition: null,
            //         postCondition: null,
            //         inputTypes: {
            //             input: {
            //                 type: null,
            //                 required: true,
            //                 unique: true
            //             }
            //         },
            //         outputTypes: {
            //             true: {
            //                 type: null
            //             },
            //             false: {
            //                 type: null
            //             }
            //         }
            //     }
            // });
            // factory.layers.aux.push({
            //     name: "Iterate Inputs",
            //     type: "Iterate Inputs",
            //     inputs: ['inputs'],
            //     outputs: [], //dynamically generated
            //     metadata: {
            //         preCondition: null,
            //         postCondition: null,
            //         inputTypes: {
            //             inputs: {
            //                 type: null,
            //                 required: true,
            //                 unique: false
            //             }
            //         },
            //         outputTypes: null //inferred
            //     }
            // });
            // factory.layers.aux.push({
            //     name: "Iterate Set",
            //     type: "Iterate Set",
            //     inputs: ['set'],
            //     outputs: ['result'],
            //     metadata: {
            //         preCondition: null,
            //         postCondition: null,
            //         inputTypes: {
            //             set: {
            //                 type: null,
            //                 required: true,
            //                 unique: true
            //             }
            //         },
            //         outputTypes: {
            //             result: {
            //                 type: null
            //             }
            //         }
            //     }
            // });
            // factory.layers.aux.push({
            //     name: "Iterate Multivalue",
            //     type: "Iterate Multivalue",
            //     inputs: ['input', 'multivalue'],
            //     outputs: ['result'],
            //     metadata: {
            //         preCondition: null,
            //         postCondition: null,
            //         inputTypes: {
            //             input: {
            //                 type: null,
            //                 required: true,
            //                 unique: true
            //             },
            //             multivalue: {
            //                 type: null,
            //                 required: true,
            //                 unique: true
            //             }
            //         },
            //         outputTypes: {
            //             result: {
            //                 type: null
            //             }
            //         }
            //     }
            // });

        };
        init();


        return factory;
    };

    documentationFactory.$inject = ['$http', '$q', 'flowDataFactory'];

    angular.module('orchestrationApp')
        .factory('documentationFactory', documentationFactory);

})();
