(function() {
    "use strict";

//https://gist.github.com/shinout/1232505 - Apache License
function tsort(edges) {
  var nodes   = {}, // hash: stringified id of the node => { id: id, afters: lisf of ids }
      sorted  = [], // sorted list of IDs ( returned value )
      visited = {}; // hash: id of already visited node => true

  var Node = function(id) {
    this.id = id;
    this.afters = [];
  };

  // 1. build data structures
  edges.forEach(function(v) {
    var from = v[0], to = v[1];
    if (!nodes[from]) nodes[from] = new Node(from);
    if (!nodes[to]) nodes[to]     = new Node(to);
    nodes[from].afters.push(to);
  });

  // 2. topological sort
  Object.keys(nodes).forEach(function visit(idstr, ancestors) {
    var node = nodes[idstr],
        id   = node.id;

    // if already exists, do nothing
    if (visited[idstr]) return;

    if (!Array.isArray(ancestors)) ancestors = [];

    ancestors.push(id);

    visited[idstr] = true;

    node.afters.forEach(function(afterID) {
      if (ancestors.indexOf(afterID) >= 0)  // if already in ancestors, a closed chain exists.
        throw new Error('closed chain : ' +  afterID + ' is in ' + id);

      visit(afterID.toString(), ancestors.map(function(v) { return v; })); // recursive call
    });

    sorted.unshift(id);
  });

  return sorted;
}

    var validationFactory = function(flowDataFactory) {
        var factory = {};

        factory.validateFlow = function(data,inferParam){
            //topologic sort the graph
            //for each task validate incoming flows and propagate type
            var graph = [];
            //infer input parameter type
            if(inferParam){
                factory.inferAllInputParam(data);
            }

            //clear previous errrors
            flowDataFactory.data.sequenceFlows.forEach(function(item) {
                delete item.style.status;
            });
            flowDataFactory.errors.sequenceFlows = {};


            data.sequenceFlows.forEach(function(flow){
                graph.push([flow.from,flow.to]);
            });
            var sortedNodes = tsort(graph);
            data.tasks.forEach(function(task){
                if(sortedNodes.indexOf(task["@id"]) === -1){
                    sortedNodes.push(task["@id"]);
                }
            });
            sortedNodes.forEach(function(id){
                //verify incoming nodes
                var incoming = [];
                data.sequenceFlows.forEach(function(flow){
                    if(flow.to === id){
                        incoming.push(flow);
                    }
                });
                //gets current task based on the id
                var currentTask;
               data.tasks.forEach(function(task){
                    if(task["@id"] === id){
                        currentTask = task;
                    }
               }); 
               if(currentTask.inputs.length > 0){
                   //auxiliary variable in the propagation
                    var connectedInputs = {};
                   //perform validation for each incoming flow
                    incoming.forEach(function(flow){
                        var outputDoc;
                        data.tasks.forEach(function(task){
                            if(task["@id"] === flow.from){
                                outputDoc = task.metadata.outputTypes[flow.fromPort].type;
                            }
                       }); 

                        //propagate output parameter type
                        if(currentTask.type === 'Output Parameter'){
                            currentTask.metadata.inputTypes.outputParam.type = outputDoc;
                        }
                        var inputDoc = currentTask.metadata.inputTypes[flow.toPort].type;
                        //failed style in the application
                       if(!factory.verifyType(inputDoc,outputDoc)){
                            if(!flowDataFactory.errors.sequenceFlows[flow["@id"]]){
                                flowDataFactory.errors.sequenceFlows[flow["@id"]] = [];
                            }
                            flowDataFactory.errors.sequenceFlows[flow["@id"]].push({error: "Invalid input", inputType: inputDoc, outputType: outputDoc});
                            flow.style.status = "Failed";
                       }
                       //auxilary variable to propagate
                         data.tasks.forEach(function(task){                        
                            //only propagates in case the input is valid
                            if(task["@id"] === flow.from && flow.style.status != "Failed"){
                                connectedInputs[flow.toPort] = task.metadata.outputTypes[flow.fromPort].type;
                            }
                         });
                    });
                    //propagate
                    var inputs  = {};
                    for(var key in currentTask.metadata.inputTypes){
                        if(connectedInputs[key]){
                            inputs[key] = connectedInputs[key];
                        } else {
                            inputs[key] = currentTask.metadata.inputTypes[key].type;
                        }
                    }
                    if(currentTask.type === "Subgraph"){
                        var aux = currentTask.workflow.tasks.map(function(task){
                            if(task.type === "Input Parameter"){
                                var copy = JSON.parse(JSON.stringify(task));
                                copy.metadata.outputTypes.inputParam.type = inputs[task.name];
                                return copy;
                            }
                            return JSON.parse(JSON.stringify(task));
                        });
                        for(key in currentTask.workflow){
                            if(key === 'tasks'){
                                delete currentTask.workflow[key];
                                currentTask.workflow[key] = aux;
                            }
                        }
                        factory.validateFlow(currentTask.workflow,false);

                        currentTask.workflow.tasks.forEach(function(task){
                            if(task.type === "Output Parameter"){
                                currentTask.metadata.outputTypes[task.name].type = task.metadata.inputTypes.outputParam.type;
                            }                           
                        });

                    } else {
                        for(key in currentTask.metadata.outputTypes){
                            currentTask.metadata.outputTypes[key].type = factory.propagateType(currentTask.metadata.outputTypes[key].typePropagation,inputs);
                        }
                    }
               }
            });
        };

        //verify subtype relation between two types
        factory.verifyType = function(input, output){
            //verifiy if output is subtype of input
            //returns boolean

            //Integer <: Real
            //Point,LineString,Polygon,GeometryCollection <:Geometry
            //MultiPolygon,MultiPoint,MultiLineString <: GeometryCollection

            if(input === "String" || input === "Boolean" || input ==="Integer" || input ==="BBOX"){
                if(output === input){
                    return true;
                } else {
                    //Union collapse rules - page 43 (57 in the pdf)
                    if(output['#union']){
                        return output['#union'].every(function(out){
                             return factory.verifyType(input, out);                  
                        });
                    } else {
                        return false;
                    }
                }
            } else if(input === "Point" || input === "LineString"||input === "Polygon"||input === "MultiPolygon"||input === "MultiPoint"||input === "MultiLineString"){
                if(output === input){
                    return true;
                } else {
                    //Union collapse rules - page 43 (57 in the pdf)
                    if(output['#union']){
                        return output['#union'].every(function(out){
                             return factory.verifyType(input, out);                  
                        });
                    } else {
                        return false;
                    }
                }
            } else if(input ==="GeometryCollection"){
                if(output === "MultiPolygon"||output === "MultiPoint"||output === "MultiLineString" || output === "GeometryCollection"){
                    return true;
                } else {
                    //Union collapse rules - page 43 (57 in the pdf)
                    if(output['#union']){
                        return output['#union'].every(function(out){
                             return factory.verifyType(input, out);                  
                        });
                    } else {
                        return false;
                    }
                }
            } else if(input ==="Geometry"){
                if(output === "Point" || output === "LineString"||output === "Polygon"||output === "MultiPolygon"||output === "MultiPoint"||output === "MultiLineString"|| output === "GeometryCollection" || output === "Geometry"){
                    return true;
                } else {
                     //Union collapse rules - page 43 (57 in the pdf)
                    if(output['#union']){
                        return output['#union'].every(function(out){
                             return factory.verifyType(input, out);                  
                        });
                    } else {
                        return false;
                    }
                }
            } else if(input === "Real"){
                //this system assumes integer as a subtype of real
                if(output === "Integer" || output === "Real"){
                    return true;
                } else {
                     //Union collapse rules - page 43 (57 in the pdf)
                    if(output['#union']){
                        return output['#union'].every(function(out){
                             return factory.verifyType(input, out);                  
                        });
                    } else {
                        return false;
                    }
                }
            } else if(input['#set']){
                if(output['#set']){
                    return factory.verifyType(input['#set'],output['#set']);
                } else {
                    //union collapse rule
                    if(output['#union']){
                        return output['#union'].every(function(out){
                             return factory.verifyType(input, out);                  
                        });
                    } else {
                        return false;
                    }
                }
            } else if(input['#union']){
                if(output['#union']){
                    //Union subtype rule 
                    return output['#union'].every(function(out){
                         return input['#union'].some(function(item){
                            return factory.verifyType(item, out);
                        });                       
                    });
                } else {
                    //Union unpack rule
                    return input['#union'].some(function(item){
                        return factory.verifyType(item, output);
                    });
                }
            } else if(input['#record']){
                if(output['#record']){
                    var isSubtype = true;
                    for(var key in input['#record']){
                        //verify width and deph subtype
                        if(!output['#record'][key] || !factory.verifyType(input['#record'][key],output['#record'][key])){
                            isSubtype = false;
                        }
                    }
                    return isSubtype;
                } else {
                    //union colapse
                    if(output['#union']){
                        return output['#union'].every(function(out){
                             return factory.verifyType(input, out);                  
                        });
                    } else {
                        return false;
                    }
                }
            } else {
                console.log('unsuported type');
                return false;
            }

        };

        //output Type object, inputs object
        factory.propagateType = function(outputs,inputs){
            //auxilary function to perform deep copy
            function copy(obj){
                if(obj === undefined){
                    return undefined;
                }
                if(typeof obj === "string"){
                    return obj;
                } else {
                    return JSON.parse(JSON.stringify(obj));
                }
            }

            var operations = {};
            operations['#typeof'] = function (obj){
                var result = copy(inputs[buildOutput(obj)]);
                if(result){
                    return result;
                } else {
                    return {"#typeof": obj};
                }
            };

            //obj need to be a set
            operations['#unset'] = function(obj){
                var result = copy(buildOutput(obj)["#set"]);
                if(result){
                    return result;
                } else {
                    return {"#unset": obj};
                }
            };

            //obj can be a record or a set of records
            operations['#addattrs'] = function (obj){
                //record, attributeName, type
                var set1 = false;
                var set2 = false;

                var addObj1 = copy(buildOutput(obj[0]));
                var addObj2 = copy(buildOutput(obj[1]));

                if(addObj1["#set"]){
                    set1 = true;
                    addObj1 = addObj1["#set"];
                } 
                if(addObj2["#set"]){
                    set2 = true;
                    addObj2 = addObj2["#set"];
                }

                if(addObj1["#record"] && addObj2["#record"]){
                    for(var key in addObj2["#record"]){
                        addObj1["#record"][key] = addObj2["#record"][key];
                    }
                    if(set1){
                        return {"#set": addObj1};
                    } else {
                        return addObj1;
                    }                    
                } else {
                    if(set1 && set2){
                        return {"#addattrs": [{"#set": addObj1},{"#set": addObj2}]};
                    } else if(set1){
                        return {"#addattrs": [{"#set": addObj1},addObj2]};
                    } else if(set2){
                        return {"#addattrs": [addObj1,{"#set": addObj2}]};
                    } else {
                        return {"#addattrs": [addObj1,addObj2]};
                    }
                }

            };

            operations['#remattrs'] = function (obj){
                 //record, attributeName, type
                var set1 = false;
                var set2 = false;

                var addObj1 = copy(buildOutput(obj[0]));
                var addObj2 = copy(buildOutput(obj[1]));

                if(addObj1["#set"]){
                    set1 = true;
                    addObj1 = addObj1["#set"];
                } 
                if(addObj2["#set"]){
                    set2 = true;
                    addObj2 = addObj2["#set"];
                }

                if(addObj1["#record"] && addObj2["#record"]){
                    for(var key in addObj2["#record"]){
                        delete addObj1["#record"][key];
                    }
                }

                if(set1 && set2){
                    return {"#remattrs": [{"#set": addObj1},{"#set": addObj2}]};
                } else if(set1){
                    return {"#remattrs": [{"#set": addObj1},addObj2]};
                } else if(set2){
                    return {"#remattrs": [addObj1,{"#set": addObj2}]};
                } else {
                    return {"#remattrs": [addObj1,addObj2]};
                }

            };

            //apply the operations when needed
            function buildOutput(obj){
                if(typeof obj === "string"){
                    return obj;
                }
                //when its a operation only have 1 key, so it can be returned
                for(var key in obj){
                    if(isOperation(key)){
                        return operations[key](obj[key]);
                    } else {
                        obj[key] = buildOutput(obj[key]);
                    }
                }
                return obj;
            }

            //verify if is a type propagation operation
            function isOperation(key){
                if(Object.keys(operations).indexOf(key) !== -1){
                     return true;
                } else {
                    return false;
                }
            }
            //initial call of the function
            return buildOutput(outputs);
        };

        factory.inferInputParam = function(input, outputMetadata){
            if(input.metadata.outputTypes.inputParam.type !== null){
                var type = input.metadata.outputTypes.inputParam.type;
                if(factory.verifyType(type,outputMetadata)){
                    input.metadata.outputTypes.inputParam.type = outputMetadata;
                    return true;
                } else if(factory.verifyType(outputMetadata,type)){
                    return true;
                } else {
                    return false;
                }
            } else {
                input.metadata.outputTypes.inputParam.type = outputMetadata;
                return true;
            }
        };

        factory.inferAllInputParam = function(data){
            data.tasks.forEach(function(task){
                if(task.type === 'Input Parameter'){
                    task.metadata.outputTypes.inputParam.type = null;
                    var connections = [];
                    data.sequenceFlows.forEach(function(flow){
                        if(flow.from === task["@id"]){
                            data.tasks.forEach(function(task2){
                                if(task2["@id"] === flow.to){
                                    connections.push(task2.metadata.inputTypes[flow.toPort].type);
                                }
                            });
                        }
                    });
                    var currentType = connections[0];
                    connections.forEach(function(type){
                        if(factory.verifyType(currentType,type)){
                            currentType = type;
                        }
                    });
                    task.metadata.outputTypes.inputParam.type = currentType;
                }
            });
        };
        return factory;
    };

    validationFactory.$inject = ['flowDataFactory'];
    angular.module('orchestrationApp')
        .factory('validationFactory', validationFactory);

})();
