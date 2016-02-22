(function() {
    'use strict';

    //Receives the URL from the client and verify if it have a valid documentation header
    //If it has it will request the documentation
    var orchestrationCtrl = function($scope, flowDataFactory, documentationFactory, $uibModal) {

        $scope.flowData = flowDataFactory.data;
        $scope.resultsAvailable = flowDataFactory.resultsAvailable;
        $scope.isExecuting = flowDataFactory.isExecuting;
        //messages from the orchestration
        $scope.info = flowDataFactory.info;
        $scope.availableLayers = documentationFactory.layers;

        //initial size of the work area (area of flow design)
        $scope.svgHeight = '90%';

        //used to manage the ids of the tasks and sequenceflows
        var maxId = -1;

        //create the service nodes
        $scope.addLayer = function(layer) {
            //convert layer to data model and add flowData
            if (layer.name === "Literal") {
                $scope.addLiteral(layer);
            } else if(layer.name === "Input Parameter" || layer.name === 'Output Parameter'){
                $scope.addParameter(layer);
            } else {//FIXME Add other node types
                var newTask = JSON.parse(JSON.stringify(layer));
                maxId = maxId + 1;
                //@id is the node ID and its maintained by the application
                newTask["@id"] = "task:" + maxId;
                newTask["@type"] = "task";
                //positioning of the node
                //style attribute is used for position and color
                newTask.style = {};
                newTask.style.x = 200 + 500 * Math.random();
                newTask.style.y = 200;

                $scope.flowData.tasks.push(newTask);
                //update the work are size
                $scope.changeSvgSize();
            }
        };

        //creates a literal node
        //it opens a modal so the user can insert the value
        $scope.addLiteral = function(layer) {

            var modalInstance = $uibModal.open({
                animation: true,
                templateUrl: 'app/views/addLiteral.html',
                controller: 'addLiteralCtrl',
                size: 'sm',
                resolve: {
                    literal: function() {
                        return null;
                    }
                }
           });

            modalInstance.result
                .then(function(result) {
                    //Possible types: Real, Integer, String, BBOX, Boolean    
                    console.log(layer)      
                    var newTask = JSON.parse(JSON.stringify(layer));
                    maxId = maxId + 1;
                    newTask["@id"] = "task:" + maxId;
                    newTask["@type"] = "task";

                    newTask.style = {};
                    newTask.style.x = 200 + 500 * Math.random();
                    newTask.style.y = 200;

                    newTask.metadata.outputTypes.literal.type = result.valueType;
                    //parse the inserted value into the correct type
                    if (result.valueType === "String") {
                        newTask.value = result.value;
                    } else if (["Real", "BBOX", "Boolean"].indexOf(result.valueType) != -1) {
                        newTask.value = JSON.parse(result.value);
                    } else if (result.valueType === "Integer") {
                        newTask.value = parseInt(result.value);
                    }
                    $scope.flowData.tasks.push(newTask);
                    $scope.changeSvgSize();
                }, function(exit) {});
        };

        //creates a literal node
        //it opens a modal so the user can insert the value
        $scope.addParameter = function(layer) {

            var modalInstance = $uibModal.open({
                animation: true,
                templateUrl: 'app/views/addParameter.html',
                controller: 'addParameterCtrl',
                size: 'sm',
                resolve: {
                    parameter: function() {
                        return null;
                    }
                }
           });

            modalInstance.result
                .then(function(result) {
                    //returns name of the parameter   
                    //deep copy
                    var newTask = JSON.parse(JSON.stringify(layer));
                    maxId = maxId + 1;
                    newTask["@id"] = "task:" + maxId;
                    newTask["@type"] = "task";

                    newTask.style = {};
                    newTask.style.x = 200 + 500 * Math.random();
                    newTask.style.y = 200;

                    newTask.name = result.name;

                    $scope.flowData.tasks.push(newTask);
                    $scope.changeSvgSize();
                }, function(exit) {});
        };


        //execute button
        //sends the workflow to the Orchestration WPS
        $scope.execute = function() {
            flowDataFactory.execute();
        };

        //verify workflow button
        //sends the workflow to the Verification WPS
        $scope.verify = function() {
            flowDataFactory.verify();
        };

        //manage the tabs of the application (Workflow / JSON-W)
        $scope.activetab = 'workflow';
        $scope.flowTab = function(name){
            if(name === $scope.activetab){
                return true;
            } else {
                return false;
            }
        }
        $scope.changeFlowTab = function(name) {
            $scope.activetab = name;
        };

//-------------------------Manage Modals-----------------------------------------------
        $scope.openConfiguration = function() {
            var modulealInstance = $uibModal.open({
                animation: true,
                templateUrl: 'app/views/configuration.html',
                controller: 'configurationCtrl',
                size: 'lg',
            });
        };

        $scope.saveFlows = function() {
            var modalInstance = $uibModal.open({
                animation: true,
                templateUrl: 'app/views/saveFlows.html',
                controller: 'saveFlowsCtrl',
                size: 'lg',
            });

            modalInstance.result
                .then(function(result){
                    //save workflow
                    documentationFactory.saveWorkflow(result.newflow.workflow,result.newflow.parametric,result.newflow.url);
            });
        };

        $scope.openFlows = function() {
            var modalInstance = $uibModal.open({
                animation: true,
                templateUrl: 'app/views/openFlows.html',
                controller: 'openFlowsCtrl',
                size: 'lg',
            });

            modalInstance.result
                .then(function(result){
                    //deep copy of the workflow
                    flowDataFactory.data = JSON.parse(JSON.stringify(documentationFactory.flows[result.index]));
                    //manage the ids of tasks and sequenceflows
                    flowDataFactory.prepareFlows();
                    maxId = flowDataFactory.maxTaskId;

                    $scope.flowData = flowDataFactory.data;
                    //remove previous error messages
                    flowDataFactory.reset();
                    //remove bottom messages
                    $scope.info.message = "";
                    $scope.info.class = "";
                    //broadcast to flowchartController that the previous graph was removed
                    $scope.$broadcast("clearData");
                    //FIXME if dont use timeout will try to change the svg size before Angular is able to build
                    setTimeout(function() {
                        //change the size of the work are based on the size of the graph
                        $scope.changeSvgSize();
                    }, 50);

            });
        };

        //delete the components in the screen
        $scope.cleanFlows = function() {
            var modalInstance = $uibModal.open({
                animation: true,
                templateUrl: 'app/views/cleanFlows.html',
                controller: 'cleanFlowsCtrl',
                size: 'sm',
            });

            modalInstance.result
                .then(function(result) {
                    //remove the workflow data
                    flowDataFactory.data = {};
                    flowDataFactory.data.tasks = [];
                    flowDataFactory.data.sequenceFlows = [];  
                    $scope.flowData = flowDataFactory.data; 
                    //remove error message (that came from validation)
                    flowDataFactory.reset();
                    //broadcast to flowchartController that all the data was deleted
                    $scope.$broadcast("clearData");
            });
        };

        //modal with the results of the orchestration
        $scope.getResults = function() {
            flowDataFactory.reset();

            var modalInstance = $uibModal.open({
                animation: true,
                templateUrl: 'app/views/viewResults.html',
                controller: 'viewResultsCtrl',
                size: 'lg',
                resolve: {
                    results: function() {
                        return flowDataFactory.results;
                    }
                }
            });
        };

        //show all errors found (button in the bottom right of the screen)
        //uses the same structure from $scope.$on("errorInfo") - that shows a specifc error
        $scope.showErrors = function() {
            var modalInstance = $uibModal.open({
                animation: true,
                templateUrl: 'app/views/errorInfo.html',
                controller: 'errorInfoCtrl',
                size: 'lg',
                resolve: {
                    element: function() {
                        return undefined;
                    },
                    type: function() {
                        return undefined;
                    },
                }
            });
        };
//------------------------------------------------------------------------


//----------------------Open modal based on $emit events---------------
        //all events comes from app/controllers/flowchartcontroller

        //message for editing Literal (button in the literal svg)
        $scope.$on("editLiteral", function(e, opt) {
            var modalInstance = $uibModal.open({
                animation: true,
                templateUrl: 'app/views/addLiteral.html',
                controller: 'addLiteralCtrl',
                size: 'sm',
                resolve: {
                    literal: function() {
                        return opt.literal;
                    }
                }
            });

            modalInstance.result
                .then(function(result) {
                    //Possible types: Real, Integer, String, BBOX, Boolean  
                    opt.literal.metadata.outputTypes.literal.type = result.valueType;
                    if (result.valueType === "String") {
                        opt.literal.value = result.value;
                    } else if (["Real", "BBOX", "Boolean"].indexOf(result.valueType) != -1) {
                        opt.literal.value = JSON.parse(result.value);
                    } else if (result.valueType === "Integer") {
                        opt.literal.value = parseInt(result.value);
                    }

                }, function(exit) {});

        });

        //message for Task options
        $scope.$on("editTask", function(e, opt) {
            console.log("edit task");
        });


        //message for error information
        $scope.$on("errorInfo", function(e, opt) {
            var modalInstance = $uibModal.open({
                animation: true,
                templateUrl: 'app/views/errorInfo.html',
                controller: 'errorInfoCtrl',
                size: 'lg',
                resolve: {
                    element: function() {
                        return opt.element;
                    },
                    type: function() {
                        return opt.type;
                    },
                }
            });
        });

        //message to verify height and width
        $scope.$on("changeSvgSize", function(e, opt) {
            $scope.changeSvgSize();
        });
        //resize the work are based on the size of the workflow
        $scope.changeSvgSize = function() {
            $scope.svgHeight = Math.max(sideMenu.getBoundingClientRect().height - topMenu.getBoundingClientRect().height - bottomMenu.getBoundingClientRect().height, svgArea.getBoundingClientRect().bottom - topMenu.getBoundingClientRect().bottom + 100) + 'px';
        };

//-------------------------Show type latex ---------------------------------

        //Uses Katex to parse the JSON representation of type into latex
        $scope.tooltip = "";
        $scope.tooltipProp = "";
        //message for update tooltips
        var buildLatex = function(obj) {
            if (typeof obj === 'string') {
                //scape the underlines
                if (obj.indexOf('_') > 0) {
                    obj.replace('_', '\\_');
                }
                return '\\mathtt{'+obj.toLowerCase()+'}';
            }
            if (Array.isArray(obj)) {
                var fixed = [];
                obj.forEach(function(item){
                    fixed.push(buildLatex(item));
                });

                return fixed.join(', \\ ');
            }

            var latex = [];
            for (var key in obj) {
                if (key.substring(0, 1) === '#') {
                    if (key.substring(1) === 'set') {
                        latex.push('\\mathbb{P} \\ ' + buildLatex(obj[key]));
                    } else if (key.substring(1) === 'record') {
                        latex.push('\\langle ' + buildLatex(obj[key]) + ' \\rangle');
                    } else if (key.substring(1) === 'union') {
                        latex.push('\\mathrm{union}( \\ ' + buildLatex(obj[key]) + ' \\ )');
                    } else if (key.substring(1) === 'addattrs') {
                        latex.push(buildLatex(obj[key][0])+' \\oplus '+buildLatex(obj[key][1]));
                    } else if (key.substring(1) === 'remattrs') {
                        latex.push(buildLatex(obj[key][0])+' \\circleddash '+buildLatex(obj[key][1]));
                    } else {
                        latex.push('\\mathbf{' + key.substring(1) + '}( \\ ' + buildLatex(obj[key]) + ' \\ )');
                    }
                } else {
                    var keyFixed;
                    if (key.indexOf('_') > 0) {
                        keyFixed = key.replace('_', '\\_');
                    } else {
                        keyFixed = key;
                    }
                    latex.push('\\mathrm{' + keyFixed + '}: ' + buildLatex(obj[key]));
                }
            }
            return latex.join(', \\ ');
        };

        $scope.$on("tooltip", function(e, opt) {
            if(opt.default!== undefined && !opt.required){
                if(opt.default !== undefined){
                    $scope.tooltip = '{}^* \\mathrm{Type}: ' + buildLatex(opt.type) + ' \\rightarrow \\ ' + opt.default;
                } else {
                    $scope.tooltip = '{}^* \\mathrm{Type}: ' + buildLatex(opt.type);
                }
            } else {
                $scope.tooltip = '\\mathrm{Type}: ' + buildLatex(opt.type);
            }
            if (opt.typePropagation) {
                $scope.tooltipProp = '\\mathrm{Type Propagation}: ' + buildLatex(opt.typePropagation);
            }
        });
        $scope.$on("clearTooltip", function(e, opt) {
            $scope.tooltip = '';
            $scope.tooltipProp = '';
        });

//-------------------------Manage buttons in the screen ---------------------------------
        $scope.canVerify = function() {
            if ($scope.isExecuting.value || flowDataFactory.configuration.verificationUrl === null || flowDataFactory.configuration.verificationUrl === "") {
                return true;
            }
            return false;
        };

        $scope.canExecute = function() {
            if ($scope.isExecuting.value || flowDataFactory.configuration.orchestrationUrl === null || flowDataFactory.configuration.orchestrationUrl === "" || flowDataFactory.configuration.timeRequest === null) {
                return true;
            }
            return false;
        };

        $scope.canManage = function() {
            if ($scope.isExecuting.value || documentationFactory.services.flowLibrary.length === 0) {
                return true;
            }
            return false;
        };

        $scope.hasErrors = function() {
            if (Object.keys(flowDataFactory.errors.tasks).length > 0 || Object.keys(flowDataFactory.errors.sequenceFlows).length > 0) {
                return true;
            }
            return false;
        };

        //buttom Clear errors in the bottom right of the screen
        $scope.clearErrors = function() {
            flowDataFactory.reset();
            $scope.info.message = "";
            $scope.info.class= "";
        };
    };

    orchestrationCtrl.$inject = ['$scope', 'flowDataFactory', 'documentationFactory', '$uibModal'];

    angular.module('orchestrationApp')
        .controller('orchestrationCtrl', orchestrationCtrl);


    //ADD LITERAL CONTROLLER ----------------------------------------------------------------------
    var addLiteralCtrl = function($scope, $uibModalInstance, literal) {

        $scope.value = "";
        $scope.valueType = "";

        //the case that the form is used to modify an existing Literal node
        if (literal) {
            $scope.value = String(literal.value);
            $scope.valueType = String(literal.valueType);
        }

        //types available for the literal node
        $scope.availableTypes = ["String", "Integer", "Real", "BBOX", "Boolean"];

        $scope.add = function() {
            $uibModalInstance.close({
                value: $scope.value,
                valueType: $scope.valueType
            });
        };

        $scope.cancel = function() {
            $uibModalInstance.dismiss('cancel');
        };
    };

    addLiteralCtrl.$inject = ['$scope', '$uibModalInstance', 'literal'];

    angular.module('orchestrationApp')
        .controller('addLiteralCtrl', addLiteralCtrl);


    //VIEW RESULTS CONTROLLER ----------------------------------------------------------------------
    var viewResultsCtrl = function($scope, $uibModalInstance, results, flowDataFactory, documentationFactory) {

        //simple controller, just pass the data into the modal view
        $scope.results = results;

        $scope.isWPS = function(key){
            var wps = false;
            if(key.indexOf("_")>-1){
                var key1 = key.split("_")[0];
                var key2 = key.split("_")[1];
                flowDataFactory.data.tasks.forEach(function(task){
                    if(task["@id"] === key2 && task.type === 'Subgraph' && task.workflow){
                        task.workflow.tasks.forEach(function(t){
                            if(t["@id"] === key1 && t.type === 'WPS'){
                                wps = true;
                            }
                        });
                    }
                });                
            } else {
                flowDataFactory.data.tasks.forEach(function(task){
                    if(task["@id"] === key && task.type === 'WPS'){
                        wps = true;
                    }
                });
            }
            return wps;
        };

        $scope.addResult = function(key,value){
            for(var i in value){
                //only one i in value
                documentationFactory.loadResults(key,i,value[i]);
                //documentationFactory.loadResultsFromServer(key,i,value[i]);
            }
            $uibModalInstance.dismiss('cancel');
        };

        $scope.cancel = function() {
            $uibModalInstance.dismiss('cancel');
        };
    };

    viewResultsCtrl.$inject = ['$scope', '$uibModalInstance', 'results', 'flowDataFactory', 'documentationFactory'];

    angular.module('orchestrationApp')
        .controller('viewResultsCtrl', viewResultsCtrl);


    //ADD PARAMETER CONTROLLER ----------------------------------------------------------------------
    var addParameterCtrl = function($scope, $uibModalInstance, parameter) {

        $scope.name = "";
        //the case that the form is used to modify an existing Parameter node
        if (parameter) {
            $scope.name = String(parameter.name);
        }

        $scope.add = function() {
            $uibModalInstance.close({name: $scope.name});
        };

        $scope.cancel = function() {
            $uibModalInstance.dismiss('cancel');
        };
    };

    addParameterCtrl.$inject = ['$scope', '$uibModalInstance', 'parameter'];

    angular.module('orchestrationApp')
        .controller('addParameterCtrl', addParameterCtrl);


    //CONFIGURATION CONTROLLER ----------------------------------------------------------------------
    var configurationCtrl = function($scope, $uibModalInstance, flowDataFactory, documentationFactory) {

        $scope.configuration = JSON.parse(JSON.stringify(flowDataFactory.configuration));

        $scope.services = JSON.parse(JSON.stringify(documentationFactory.services));

        // if the services are null add an empty field
        var init = function() {
            if ($scope.services.csw.length === 0) {
                $scope.services.csw.push("");
            }
            if ($scope.services.flowLibrary.length === 0) {
                $scope.services.flowLibrary.push("");
            }
            if ($scope.services.paramflowLibrary.length === 0) {
                $scope.services.paramflowLibrary.push("");
            }
        };
        init();

        //called when pressed OK
        //it remove the null/empty items
        $scope.changeConfig = function() {
            flowDataFactory.configuration = $scope.configuration;

            //if the fields are null dont add them
            var cswFiltered = $scope.services.csw.filter(function(item) {
                return item !== "" && item !== null;
            });
            var flowFiltered = $scope.services.flowLibrary.filter(function(item) {
                return item !== "" && item !== null;
            });
            var paramflowFiltered = $scope.services.paramflowLibrary.filter(function(item) {
                return item !== "" && item !== null;
            });

            documentationFactory.services.csw = cswFiltered;
            documentationFactory.services.flowLibrary = flowFiltered;
            documentationFactory.services.paramflowLibrary = paramflowFiltered;

            $uibModalInstance.close();
        };

        //buttons to add and remove
        $scope.addCsw = function() {
            $scope.services.csw.push("");
        };
        $scope.removeCsw = function(index) {
            $scope.services.csw.splice(index, 1);
        };
        $scope.addFlowLibrary = function() {
            $scope.services.flowLibrary.push("");
        };
        $scope.removeFlowLibrary = function(index) {
            $scope.services.flowLibrary.splice(index, 1);
        };
        $scope.addParamFlowLibrary = function() {
            $scope.services.paramflowLibrary.push("");
        };
        $scope.removeParamFlowLibrary = function(index) {
            $scope.services.paramflowLibrary.splice(index, 1);
        };

        $scope.cancel = function() {
            $uibModalInstance.dismiss('cancel');
        };
    };

    configurationCtrl.$inject = ['$scope', '$uibModalInstance', 'flowDataFactory', 'documentationFactory'];

    angular.module('orchestrationApp')
        .controller('configurationCtrl', configurationCtrl);


    //OPEN FLOWS CONTROLLER ----------------------------------------------------------------------
    var openFlowsCtrl = function($scope, $uibModalInstance, documentationFactory, $q) {

        //load the data in the menu
        var promises = [];
        //FIXME it loads the data everytime the modal opens (so it is reseting what it had before)
        //FIXME only show results if all Workflow services could connect
        documentationFactory.flows = [];
        documentationFactory.services.flowLibrary.forEach(function(url){
            promises.push(documentationFactory.loadWorkflow(url,false));
        });
        documentationFactory.services.paramflowLibrary.forEach(function(url){
            promises.push(documentationFactory.loadWorkflow(url,true));
        });
        $q.all(promises) 
            .then(function success(response) {
                //when everything resolves simple use the data from documentationFactory;
                $scope.flows = documentationFactory.flows;

            }, function error(response){
                //response returns URL of service that could not be checked
                //FIXME
            });

        //return the index of the choosen workflow (index of array storing the workflows in the application)
        $scope.load = function(index){
            $uibModalInstance.close({index: index});
        };

        $scope.cancel = function() {
            $uibModalInstance.dismiss('cancel');
        };
    };

    openFlowsCtrl.$inject = ['$scope', '$uibModalInstance', 'documentationFactory', '$q'];

    angular.module('orchestrationApp')
        .controller('openFlowsCtrl', openFlowsCtrl);

    //CLEAN FLOWS CONTROLLER ----------------------------------------------------------------------
    var cleanFlowsCtrl = function($scope, $uibModalInstance) {

        // just to catch if the user pressed OK or Cancel
        $scope.clean = function(){    
            $uibModalInstance.close();    
        };

        $scope.cancel = function() {
            $uibModalInstance.dismiss('cancel');
        };
    };

    cleanFlowsCtrl.$inject = ['$scope', '$uibModalInstance'];

    angular.module('orchestrationApp')
        .controller('cleanFlowsCtrl', cleanFlowsCtrl);

    //SAVE FLOWS CONTROLLER ----------------------------------------------------------------------
    var saveFlowsCtrl = function($scope, $uibModalInstance, flowDataFactory, documentationFactory) {

        //name and description are added in the attribute metadata of the workflow
        $scope.name = "";
        $scope.description = "";
        $scope.url = "";
        $scope.newflow = {};
        $scope.newflow.parametric = "false";
        $scope.availableURL = documentationFactory.services.flowLibrary;

        $scope.changeParametric = function(){
            if($scope.newflow.parametric === "true"){
                $scope.availableURL = documentationFactory.services.paramflowLibrary;
            } else {
                $scope.availableURL = documentationFactory.services.flowLibrary;
            }
        };

        //gets current workflow
        $scope.newflow.workflow = flowDataFactory.data;

        $scope.save = function(index){
            if(!$scope.newflow.workflow.metadata){
                //creates a metadata attribute in case it doesnt exists
                $scope.newflow.workflow.metadata = {};
            }
            $scope.newflow.workflow.metadata.name = $scope.name;
            $scope.newflow.workflow.metadata.description = $scope.description;
            $scope.newflow.url = $scope.url;
            //returns newflow = {workflow, parametric, url}
            $uibModalInstance.close({newflow: $scope.newflow});
        };

        $scope.cancel = function() {
            $uibModalInstance.dismiss('cancel');
        };
    };

    saveFlowsCtrl.$inject = ['$scope', '$uibModalInstance', 'flowDataFactory', 'documentationFactory'];

    angular.module('orchestrationApp')
        .controller('saveFlowsCtrl', saveFlowsCtrl);


    //ERROR INFO CONTROLLER ----------------------------------------------------------------------
    var errorInfoCtrl = function($scope, $uibModalInstance, element, type, flowDataFactory) {

        if(element !== undefined){
            $scope.results = JSON.parse(JSON.stringify(flowDataFactory.errors[type][element["@id"]]));
            $scope.results.forEach(function(item) {
                delete item.invalidValues;
                delete item.valueType;
            });
        } else {
            //deep copy
            $scope.results = JSON.parse(JSON.stringify(flowDataFactory.errors));
        }

        $scope.cancel = function() {
            $uibModalInstance.dismiss('cancel');
        };
    };

    errorInfoCtrl.$inject = ['$scope', '$uibModalInstance', 'element', 'type', 'flowDataFactory'];

    angular.module('orchestrationApp')
        .controller('errorInfoCtrl', errorInfoCtrl);

})();
