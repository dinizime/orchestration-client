(function() {
    'use strict';

    // Manages the SVG of the flowchart
    // This controller is used in the Flowchart directive
    // It is called in app/view/index.html as <flowchart data="flowData"></flowchart>
    var flowchartCtrl = function($scope, flowchartFactory, flowDataFactory, validationFactory) {

        //default config of flowchart
        $scope.taskRx = flowchartFactory.taskRx;
        $scope.taskRy = flowchartFactory.taskRy;
        $scope.taskWidth = flowchartFactory.taskWidth;
        $scope.taskHeight = flowchartFactory.taskHeight;
        $scope.circleR = flowchartFactory.circleR;
        $scope.textDistance = flowchartFactory.textDistance;

        //data comes from the directive


//-------------------------STYLES -------------------------------------------------
        //render the options and trash can
        //called in app/views/flowchartTemplate
        $scope.selected = null;
        $scope.isSelected = function(element) {
            if ($scope.selected && element["@id"] === $scope.selected["@id"]) {
                return true;
            }
            return false;
        };

        //render error sign
        //called in app/views/flowchartTemplate
        $scope.hasError = function(element, type) {
            if (flowDataFactory.errors[type][element["@id"]]) {
                return true;
            }
            return false;
        };

        //position of the text for the input/output nodes
        $scope.setAnchor = function(index, total) {
            if (total === 1) {
                return 'middle';
            } else if (index === 0) {
                return 'end';
            } else if (index === total - 1) {
                return 'start';
            } else {
                return 'middle';
            }
        };

        //set color of the task
        $scope.setTaskClass = function(task) {
            var style = "";

            if(task.type === 'Input Parameter' || task.type === 'Output Parameter'){
                style = "task-parameter";
            } else if(task.type === 'Subgraph'){
                style = "task-subgraph";
            } else {
                style = "task";
            }

            if (task.style.status) {
                if (task.style.status === "Running"){
                    style += " task-running";
                }
                if (task.style.status === "Failed"){
                    style += " task-failed";
                }
                if (task.style.status === "Succeeded"){
                    style += " task-succeeded";
                }
            } else {
                if ($scope.selected && task["@id"] === $scope.selected["@id"]){
                    style += " task-selected";
                }

                if (task.style.hover && task.style.hover === true) {
                    style+= " task-hover";
                }
            }
            return style;
        };

        //set color of the input/output node
        $scope.hoverConnection = {};
        $scope.setConnectionClass = function(task, index, port) {
            //default
            //creating
            if (startTask && $scope.isCreating && task["@id"] === startTask["@id"] && index === startPort && port === typePort) return "connection-creating";

            if ($scope.hoverConnection && $scope.hoverConnection.id === task["@id"] && $scope.hoverConnection.index === index && $scope.hoverConnection.port === port) {
                return "connection-hover";
            }

            return "connection";
        };
        //set color of the line
        $scope.setFlowlineClass = function(flowline) {
            if (flowline.style.status) {
                if (flowline.style.status === "Failed") return "lineConnection-failed";
            } else {
                //default
                //hover
                //selected
                if ($scope.selected && flowline["@id"] === $scope.selected["@id"]) {
                    return "lineConnection-selected";
                }

                if (flowline.style.hover && flowline.style.hover === true) {
                    return "lineConnection-hover";
                }
            }
            return "lineConnection";
        };

//----------------------CREATION, DELETE, DRAG -------------------------------------------------

        //delete with delete key
        $scope.keySelected = function(event) {
            if (event.keyCode === 46) {
                $scope.deleteSelected(null);
            }
        };

        //delete selected node or line
        //when node is deleted delete all connecting lines also
        //event is in the case of node deleted with a click on the trash button
        $scope.deleteSelected = function(event) {
            if (event) {
                event.stopPropagation();
            }
            var i;
            if ($scope.selected && $scope.selected["@type"] === "task") {
                for (i = 0; i < $scope.data.tasks.length; i++) {
                    if ($scope.data.tasks[i]["@id"] === $scope.selected["@id"]) {
                        $scope.data.tasks.splice(i, 1);
                    }
                }
                //propagate removing sequenceFlows
                for (i = 0; i < $scope.data.sequenceFlows.length; i++) {
                    if ($scope.data.sequenceFlows[i].to === $scope.selected["@id"] || $scope.data.sequenceFlows[i].from === $scope.selected["@id"]) {
                        $scope.data.sequenceFlows.splice(i, 1);
                        i--;
                    }
                }
            } else if ($scope.selected) {
                for (i = 0; i < $scope.data.sequenceFlows.length; i++) {
                    if ($scope.data.sequenceFlows[i]["@id"] === $scope.selected["@id"]) {
                        $scope.data.sequenceFlows.splice(i, 1);
                    }
                }
            }
            //Validate subtype and propagate output
            validationFactory.validateFlow($scope.data,true);
        };


        var isDragging = false,
            x, y;
        var startTask, startPort, typePort;
        $scope.isCreating = false;
        $scope.auxLine = {
            start: {
                x: 0,
                y: 0
            },
            end: {
                x: 0,
                y: 0
            }
        };
        //creates auxiliary line while a connection is being created
        var auxiliaryLine = function(event) {
            if (event) {
                $scope.isCreating = true;

                $scope.auxLine.start.x = event.offsetX;
                $scope.auxLine.start.y = event.offsetY;
                $scope.auxLine.end.x = event.offsetX;
                $scope.auxLine.end.y = event.offsetY;

            } else {
                $scope.isCreating = false;
            }
        };
        //click on the node
        $scope.elementMouseDown = function(eventArgs, element) {
            eventArgs.stopPropagation();
            if ($scope.isCreating) auxiliaryLine(null);
            if (element) {
                $scope.data.tasks.forEach(function(item) {
                    item.style.zIndex = 1;
                });

                $scope.selected = element;
                $scope.selected.style.zIndex = 2;

                isDragging = true;
                x = eventArgs.offsetX;
                y = eventArgs.offsetY;
            } else {
                $scope.selected = null;
            }
        };
        //drag the node
        $scope.mouseMove = function(eventArgs) {
            if ($scope.selected && isDragging && $scope.selected["@type"] === 'task') {
                $scope.selected.style.x += eventArgs.offsetX - x;
                $scope.selected.style.y += eventArgs.offsetY - y;

                $scope.data.sequenceFlows.forEach(function(flow) {
                    if (flow.to === $scope.selected["@id"] || flow.from === $scope.selected["@id"]) {
                        if(flow.style.status === "Failed"){
                            flowDataFactory.prepareFlow(flow);
                            flow.style.status = "Failed";  
                        } else{
                            flowDataFactory.prepareFlow(flow);
                        }
                    }
                });
                x = eventArgs.offsetX;
                y = eventArgs.offsetY;

                $scope.changeSvgSize();
            } else {
                isDragging = false;

                if ($scope.isCreating) {
                    $scope.auxLine.end.x = eventArgs.offsetX;
                    $scope.auxLine.end.y = eventArgs.offsetY;
                }

            }
        };
        //stop dragging
        $scope.mouseUp = function(eventArgs) {
            isDragging = false;
        };

        //creation of the line
        $scope.createFlow = function(eventArgs, task, index, port) {
            eventArgs.stopPropagation();
            //verify if is creating of is finishing the creation
            if (!$scope.isCreating) {
                auxiliaryLine(eventArgs);
                startTask = task;
                startPort = index;
                //set if is a output port that started or a input
                typePort = port;

            } else {
                // have to end in the oposit port, if started in the input should end in a output
                if (port != typePort && task["@id"] != startTask["@id"]) {
                    var newFlow = {};

                    //need to decide which is the from and which is the to
                    var fromTask;
                    var toTask;
                    var fromPort;
                    var toPort;

                    if (port === "Output") {
                        fromTask = task;
                        toTask = startTask;
                        fromPort = index;
                        toPort = startPort;
                    } else {
                        fromTask = startTask;
                        toTask = task;
                        fromPort = startPort;
                        toPort = index;
                    }

                    newFlow.from = fromTask["@id"];
                    newFlow.fromPort = fromTask.outputs[fromPort];

                    newFlow.to = toTask["@id"];
                    newFlow.toPort = toTask.inputs[toPort];

                    newFlow["@type"] = "flow";
                    flowDataFactory.maxFlowId++;
                    newFlow["@id"] = "flow:" + flowDataFactory.maxFlowId.toString();

                    //verify if already exists
                    var exists = false;
                    $scope.data.sequenceFlows.forEach(function(item) {
                        //verify duplicate lines
                        if (item.to === newFlow.to && item.from === newFlow.from && item.fromPort === newFlow.fromPort && item.toPort === newFlow.toPort) {
                            exists = true;
                        }
                        //verify if accept more than one
                        if (item.to === newFlow.to && item.toPort === newFlow.toPort && toTask.metadata.inputTypes[newFlow.toPort].unique) {
                            exists = true;
                        }
                    });

                    //verify if is a outputParameter connecting to a inputParameter (invalid case)
                    if(fromTask.type === 'Input Parameter' && toTask.type === 'Output Parameter'){
                        exists = true;
                    }

                    //in case of input parameter infer input parameter type
                    // and verify if the connections are in subtype relation
                    if(fromTask.type === 'Input Parameter'){
                        exists = !validationFactory.inferInputParam(fromTask,toTask.metadata.inputTypes[newFlow.toPort].type);
                    }

                    if (!exists) {
                        //create coordinates for flow
                        var inputIndex = fromTask.outputs.indexOf(newFlow.fromPort) + 1;
                        var outputIndex = toTask.inputs.indexOf(newFlow.toPort) + 1;

                        newFlow.style = {};
                        newFlow.style.source = {};
                        newFlow.style.dest = {};

                        newFlow.style.source.x = fromTask.style.x + inputIndex * $scope.taskWidth / (1 + fromTask.outputs.length);

                        newFlow.style.source.y = fromTask.style.y + $scope.taskHeight;

                        newFlow.style.dest.x = toTask.style.x + outputIndex * $scope.taskWidth / (1 + toTask.inputs.length);

                        newFlow.style.dest.y = toTask.style.y;

                        //insert new flow
                        $scope.data.sequenceFlows.push(newFlow);
                        //remove auxiliary line
                        auxiliaryLine(null);

                        //Validate subtype and propagate output
                         validationFactory.validateFlow($scope.data,false);
                    }

                }
            }
        };

        //change line connetions
        $scope.changeConnection = function(eventArgs, flow, port) {
            eventArgs.stopPropagation();
            //delete
            for (var i = 0; i < $scope.data.sequenceFlows.length; i++) {
                if ($scope.data.sequenceFlows[i]["@id"] === flow["@id"]) {
                    $scope.data.sequenceFlows.splice(i, 1);
                }
            }

            //simulate a new draw
            var coords = {};
            var task;
            if (port === 'source') {
                //start is dest
                coords.offsetX = flow.style.dest.x;
                coords.offsetY = flow.style.dest.y;

                //find task by @id
                task = $scope.data.tasks.filter(function(item) {
                    return item["@id"] === flow.to;
                })[0];
                startTask = task;

                //find index of the input
                startPort = task.inputs.indexOf(flow.toPort);
                typePort = 'Input';
            } else {
                //start is source
                coords.offsetX = flow.style.source.x;
                coords.offsetY = flow.style.source.y;

                //find task by @id
                task = $scope.data.tasks.filter(function(item) {
                    return item["@id"] === flow.from;
                })[0];
                startTask = task;

                //find index of the output
                startPort = task.outputs.indexOf(flow.fromPort);
                typePort = 'Output';
            }
            auxiliaryLine(coords);

        };

//-----------------------------Emit---------------------------------------------------

        $scope.editLiteral = function(literal) {
            $scope.$emit("editLiteral", {
                literal: literal
            });
        };

        $scope.editTask = function(task) {
            $scope.$emit("editTask", {
                task: task
            });
        };

        $scope.showErrorInfo = function(element, type) {
            $scope.$emit("errorInfo", {
                element: element,
                type: type
            });
        };

        $scope.changeSvgSize = function() {
            $scope.$emit("changeSvgSize");
        };

        //emit mouseover event to render latex
        $scope.ioMouseover = function(task,index,name,type){
            $scope.hoverConnection.id = task['@id'];
            $scope.hoverConnection.index = index;
            $scope.hoverConnection.port = type;

            if(type === "Input"){
                $scope.$emit("tooltip", {
                    type: task.metadata.inputTypes[name].type,
                    required: task.metadata.inputTypes[name].required,
                    default: task.metadata.inputTypes[name].default
                });
            } else {
                $scope.$emit("tooltip", {
                    type: task.metadata.outputTypes[name].type,
                    typePropagation: task.metadata.outputTypes[name].typePropagation
                });
            }
        };
        //remove latex
        $scope.ioMouseleave = function(){
            $scope.hoverConnection.id = '';
            $scope.hoverConnection.index = '';
            $scope.hoverConnection.port = '';
            $scope.$emit("clearTooltip", {});
        };
//-------------------------Receive---------------------------------------------------
        $scope.$on("clearData", function(e, opt) {
            $scope.selected = null;
        });
    };

    flowchartCtrl.$inject = ['$scope', 'flowchartFactory', 'flowDataFactory', 'validationFactory'];

    angular.module('orchestrationApp')
        .controller('flowchartCtrl', flowchartCtrl);

})();
