var Constructor = {
    Machine: function(id) {
        this.id = id;
        this.nodes = {};
        this.links = {};
        this.alphabet = [];
        this.currentState = [];
        this.linksUsed = [];

        this.addNode = function(x, y, name, isInitial, isAccepting){
            //Adds a node to the machine. Returns the id assigned to the node.
            isInitial = isInitial === undefined? false : isInitial;
            isAccepting = isAccepting === undefined? false : isAccepting;
            name = name === undefined? "" : name;
            var nodeID = this.getNextNodeID();
            this.nodes[nodeID] = new Constructor.Node(this, nodeID, x, y, name, isInitial, isAccepting);
            return nodeID;

        };
        this.addLink = function(sourceNode, targetNode, input, output, hasEpsilon){
            //Adds a link to the machine. Returns the id assigned to the link.
            //Accepts either nodeIDs or node references for source and target
            if (sourceNode instanceof Constructor.Node === false){
                sourceNode = this.nodes[sourceNode];
            }
            if (targetNode instanceof Constructor.Node === false){
                targetNode = this.nodes[targetNode];
            }
            input = input === undefined? [] : input;
            output = output === undefined? {} : output;
            hasEpsilon = hasEpsilon === undefined? false : hasEpsilon;
            var linkID = this.getNextLinkID();
            this.links[linkID] = new Constructor.Link(this, linkID, sourceNode, targetNode, input, output, hasEpsilon);
            sourceNode.outgoingLinks[linkID] = this.links[linkID];
            return linkID;
        };
        this.deleteLink = function(link){
            // Accepts either a Link object or a linkID
            if (link instanceof Constructor.Link === false){
                link = this.links[link];
            }
            delete this.links[link.id];
            delete link.source.outgoingLinks[link.id];
        };
        this.deleteNode = function(node){
            // Removes a node from the machine, deleting all links to or from it.
            // Accepts either a Node object or a nodeID
            if (node instanceof Constructor.Node === false){
                node = this.nodes[node];
            }
            delete this.nodes[node.id];
            var context = this;
            Object.keys(node.outgoingLinks).map(function(linkID){
                context.deleteLink(linkID);
            });
            Object.keys(this.links).map(function(linkID){
                if (context.links[linkID].target.id === node.id){
                    context.deleteLink(linkID);
                }
            });
        };
        this.build = function(spec){
            //Sets up the machine based on a specification object passed in
            this.nodes = {};
            this.links = {};
            var nodes = spec.nodes;
            var nodeIDDict = {}; //Used to map IDs in the spec to machine IDs
            for (var i = 0; i < nodes.length; i++){
                var n = nodes[i];
                var specID = n.id;
                nodeIDDict[specID] = this.addNode(n.x, n.y, n.name, n.isInit, n.isAcc);
            }
            var links = spec.links;
            for (i = 0; i < links.length; i++){
                var l = links[i];
                this.addLink(nodeIDDict[l.from], nodeIDDict[l.to], l.input, l.output, l.hasEps);
            }
        };
        this.getNextNodeID = function(){
            // Returns a sequential node id that incorporates the machine id
            if (this.lastNodeID === undefined){
                this.lastNodeID = -1;
            }
            this.lastNodeID += 1;
            return this.id + "-N" + String(this.lastNodeID);
        };
        this.getNextLinkID = function(){
            // Returns a sequential node id that incorporates the machine id
            if (this.lastLinkID === undefined){
                this.lastLinkID = -1;
            }
            this.lastLinkID += 1;
            return this.id + "-L" + String(this.lastLinkID);
        };
        this.getSpec = function(){
            //Returns an object that describes the current machine in the form accepted by Machine.build
            var spec = {"nodes": [], "links": []};
            var nodeKeys = Object.keys(this.nodes);
            var nodeIDDict = {}; //Used to map from the internal IDs to the externalIDs
            var nextNodeID = 65; // 65 -> "A"
            for (var i = 0; i < nodeKeys.length; i++){
                var nodeIDinternal = nodeKeys[i];
                var nodeIDexternal = String.fromCharCode(nextNodeID);
                nextNodeID += 1;
                nodeIDDict[nodeIDinternal] = nodeIDexternal;
                var intNode = this.nodes[nodeIDinternal];
                // There is an argument for generating the mininal description in the Node object,
                // but decided against it as defaults are imposed by Machine. In any case, tight coupling between
                // Machine and Node is probably harmless.
                var extNode = {"id": nodeIDexternal, "x":Math.round(intNode.x), "y":Math.round(intNode.y)};
                // Only include non-default properties for brevity:
                if (intNode.isAccepting === true){
                    extNode.isAcc = true;
                }
                if (intNode.isInitial === true){
                    extNode.isInit = true;
                }
                if (intNode.name !== ""){
                    extNode.name = intNode.name;
                }
                spec.nodes.push(extNode);
            }
            var linkKeys = Object.keys(this.links);
            for(i = 0; i < linkKeys.length; i++){
                var intLink = this.links[linkKeys[i]];
                var extLink = {"to": nodeIDDict[intLink.target.id], "from": nodeIDDict[intLink.source.id]};
                // Only include non-default properties for brevity:
                if(intLink.input.length > 0){ // Because JS comparisons are strange: [] === [] -> false
                    extLink.input = intLink.input;
                }
                if(Object.keys(intLink.output).length > 0){ // intLink.output != {}
                    extLink.output = intLink.output;
                }
                if(intLink.hasEpsilon === true){
                    extLink.hasEps = true;
                }
                spec.links.push(extLink);
            }
            return spec;
        };
        this.setToInitialState = function(){
            //Set the list of current states to be all initial states
            var context = this;
            this.currentState = Object.keys(this.nodes).filter(function(nodeID){
                return context.nodes[nodeID].isInitial;
            });
            this.followEpsilonTransitions();
        };
        this.followEpsilonTransitions = function(){
            var linksUsed = [];
            var visitedStates = [];
            var frontier = this.currentState;
            do {
                var newFrontier = [];
                for(var i = 0; i < frontier.length; i++){
                    var thisNode = this.nodes[frontier[i]];
                    var epsilonLinksFromThisNode = thisNode.getEpsilonLinks();
                    for(var j = 0; j < epsilonLinksFromThisNode.length; j++){
                        var linkID = epsilonLinksFromThisNode[j];
                        var thisLink = this.links[linkID];
                        if (linksUsed.indexOf(linkID) === -1){
                            linksUsed.push(linkID);
                        }
                        var targetNodeID = thisLink.target.id;
                        // Add targetNodeID to newFrontier if it isn't already there and isn't in visitedStates or current frontier
                        if (frontier.indexOf(targetNodeID) === -1 && visitedStates.indexOf(targetNodeID) === -1 && newFrontier.indexOf(targetNodeID) === -1){
                            newFrontier.push(targetNodeID);
                            this.currentState.push(targetNodeID);
                        }
                    }
                    visitedStates.push(frontier[i]);
                }
                frontier = newFrontier;
            }
            while (frontier.length > 0);
            this.linksUsed = this.linksUsed.concat(linksUsed);
        };
        this.step = function(symbol){
            // The machine changes its state based on an input symbol
            var nodes = this.currentState.map(function(nodeID){
                return this.nodes[nodeID];
            });
            var newNodes = [];
            var linksUsed = [];
            for (var i = 0; i < nodes.length; i++){
                var thisNode = nodes[i];
                var reachableNodeObj = thisNode.getReachableNodes(symbol);
                // Get nodeIDs of nodes reachable from current node for input = symbol, where the nodeID is not in newNodes
                var newReachableNodeIDs = reachableNodeObj.nodeIDs.filter(function(nodeID){
                    return newNodes.indexOf(nodeID) == -1;
                });
                newNodes = newNodes.concat(newReachableNodeIDs);
                linksUsed = linksUsed.concat(reachableNodeObj.linkIDs);
            }
            this.currentState = newNodes;
            this.linksUsed = linksUsed;
            this.followEpsilonTransitions();
        };
    },
    Node: function(machine, nodeID, x, y, name, isInitial, isAccepting){
        this.name = name;
        this.machine = machine;
        this.id = nodeID;
        this.isAccepting = isAccepting;
        this.isInitial = isInitial;
        this.outgoingLinks = {};
        this.x = x;
        this.y = y;

        this.toggleAccepting = function(){
            this.isAccepting = ! this.isAccepting;
        };
        this.toggleInitial = function(){
            this.isInitial = ! this.isInitial;
        };
        this.getEpsilonLinks = function(){
            //Return a list of the linkIDs of all outgoing links which take an epsilon transition
            var context = this,
                keys = Object.keys(this.outgoingLinks);
            return keys.filter(function(linkID){
                return context.outgoingLinks[linkID].hasEpsilon;
            });
        };
        this.getReachableNodes = function(symbol){
            //Return an object containing nodeIDs of nodes reachable from this node for the given input symbol
            //and the linkIDs of links used
            var keys = Object.keys(this.outgoingLinks);
            var nodeIDs = [];
            var linkIDs = [];
            for(var i = 0; i < keys; i++){
                var linkID = keys[i];
                var link = this.outgoingLinks[linkID];
                if(link.input.indexOf(symbol) != -1){
                    nodeIDs.push(link.target.id);
                    linkIDs.push(linkID);
                }
            }
            return {"nodeIDS": nodeIDs, "linkIDs": linkIDs};
        };
        this.hasLinkTo = function(node){
            // Function that returns true iff this node has a direct link to the input node
            for (var linkID in this.outgoingLinks){
                if (this.outgoingLinks[linkID].target.id == node.id){
                    return true;
                }
            }
            return false;
        };
        this.getLinkTo = function(node){
            // Function that returns a link from this node to the input node if one exists, or null otherwise
            for (var linkID in this.outgoingLinks){
                if (this.outgoingLinks[linkID].target.id == node.id){
                    return this.outgoingLinks[linkID];
                }
            }
            return null;
        };
    },
    Link: function(machine, linkID, sourceNode, targetNode, input, output, hasEpsilon){
        this.machine = machine;
        this.id = linkID;
        this.input = input;
        this.output = output;
        this.source = sourceNode;
        this.target = targetNode;
        this.hasEpsilon = hasEpsilon;

        this.reverse = function(){
            // Test if the link is from a node to itself
            if(this.source.id === this.target.id){
                return;
            }
            // Test if a link exists in the opposite direction:
            var reverseLink = this.target.getLinkTo(this.source);
            if (reverseLink !== null){
                // If the reverse link already exists then combine this link into that
                var newInput = this.input.concat(reverseLink.input);
                var newHasEpsilon = this.hasEpsilon || reverseLink.hasEpsilon;
                reverseLink.setInput(newInput, newHasEpsilon);
                this.machine.deleteLink(this);
            } else {
                //If the reverse link does not exist, delete this link and create a new one with source and target reversed
                this.machine.addLink(this.target, this.source, this.input, this.output, this.hasEpsilon);
                this.machine.deleteLink(this);
            }
        };

        this.setInput = function(inputList, hasEpsilon){
            // First, strip out duplicates in inputlist
            if (inputList.length > 1){
                inputList = inputList.sort(); // Sort list, then record all items that are not the same as the previous item.
                var newList = [inputList[0]];
                for (var i = 1; i < inputList.length; i++){
                    if (inputList[i] !== inputList[i-1]){
                        newList.push(inputList[i]);
                    }
                }
                inputList = newList;
            }

            this.input = inputList;
            this.hasEpsilon = hasEpsilon;
        };
    }
};

var Model = {
    machines: [],
    deleteMachine: function(machineID){
        // Pretty ES6 way of doing things - switch over when more widely supported
        // Model.machines.filter(m => m.id !== machineID);
        Model.machines.filter(function(m){return m.id !== machineID;});
    }
};

var Question = {
    setUpQuestion: function(){
        var body = document.querySelector("body");
        if (body.dataset.question != undefined){
            var questionObj = JSON.parse(body.dataset.question);
        } else{
            Question.type = "none";
            return;
        }
        for(var property in questionObj){
            Question[property] = questionObj[property];
        }

    }
};

// 'UI' or 'Interface' might be a more accurate name?
var Display = {
    acceptingRadius: 14,
    nodeRadius: 20,
    canvasVars: {
        "m1": {
            "force":d3.layout.force().on("tick", function(){Display.forceTick("m1");}),
            "machine": undefined,
            "colours": d3.scale.category10(),
            "toolMode": "none",
            "linkInProgress": false
        }
    },
    newCanvas: function(id, machine){
        Display.canvasVars[id] = {
            "force": d3.layout.force().on("tick", function(){Display.forceTick(id);}),
            "machine": machine,
            "colours": d3.scale.category10(),
            "toolMode": "none",
            "linkInProgress": false
        };
        // Add a new svg element
        var svg = d3.select(".maindiv").append("svg")
                    .attr("id", id)
                    .attr("viewBox", "0 0 500 300")
                    .attr("preserveAspectRatio","xMidYMid meet");
        // resize all canvases
        Display.setSvgSizes();

        // Add <g> elements for nodes and links
        svg.append("g").classed("links", true);
        svg.append("g").classed("nodes", true);
    },
    deleteCanvas: function(machineID){
        d3.select("#" + machineID).remove();
        delete Display.canvasVars[machineID];
        Display.setSvgSizes();
    },
    setSvgSizes: function(){
        var height = "50%";
        var width = (90 / Object.keys(Display.canvasVars).length) + "%";
        d3.selectAll("svg").style("height", height).style("width", width);
    },
    drawControlPalette: function(canvasID){
        var iconAddress = Global.iconAddress;
        var bwidth = 40; //button width
        var strokeWidth = 2;
        var margin = 10;
        var g = d3.select("#" + canvasID).append("g")
                    .classed("controls", true);
        var tools = ["nodetool", "linetool","texttool", "acceptingtool", "deletetool"];
        var tooltips = {
            nodetool:"Create new states",
            linetool:"Link states together",
            texttool:"Change link inputs and rename states",
            acceptingtool:"Toggle whether states are accepting",
            deletetool: "Delete links and states"
        };
        // create a button for each tool in tools
       tools.forEach(function(toolName, i){
            var thisG = g.append("g");
            thisG.append("rect") // White rectangle at the bottom - to prevent the button being transparent
                .attr("width", bwidth)
                .attr("height", bwidth)
                .attr("x", 0)
                .attr("y", i * bwidth)
                .attr("fill", "#FFFFFF")
                .attr("fill-opacity", 1)
            thisG.append("rect") // control rect in the middle - ensures that all of the button is clickable
                .attr("width", bwidth)
                .attr("height", bwidth)
                .attr("x", 0)
                .attr("y", i * bwidth)
                .attr("fill", "#010101")
                .attr("fill-opacity", 0)
                .attr("style", "stroke-width:" + strokeWidth +";stroke:rgb(0,0,0)")
                .classed("control-rect", true)
                .attr("id", canvasID + "-" + toolName)
                .on("click", function(){EventHandler.toolSelect(canvasID, toolName)})
                .append("svg:title").text(tooltips[tools[i]]);
            thisG.append("image") // Button on top
                .attr("x", 0.5 * margin)
                .attr("y", 0.5 * margin + (i * bwidth))
                .attr("width", bwidth - margin)
                .attr("height", bwidth - margin)
                .attr("xlink:href", iconAddress + toolName +".svg")
                .attr("class", "control-img")
                .on("click", function(){EventHandler.toolSelect(canvasID, toolName)});

        });
        // Define a gradient to be applied when a button is selected:
        var grad = d3.select("defs").append("svg:linearGradient")
            .attr("id", "Gradient1")
            .attr("x1", "0")
            .attr("x2", "1")
            .attr("y1", "0")
            .attr("y2", "1");

        grad.append("svg:stop")
            .attr("offset", "0%")
            .attr("stop-color", "black")
            .attr("stop-opacity", 0.7);

        grad.append("svg:stop")
            .attr("offset", "65%")
            .attr("stop-color", "black")
            .attr("stop-opacity", 0.1);
    },
    beginLink: function(node){
        var canvasID = node.machine.id;
        var svg = d3.select("#" + canvasID);
        var halfLink = svg.append("svg:path")
                          .classed("halflink", true)
                          .attr("id", canvasID+"halflink");

        svg.on("mousemove", function(){
            // Update the link whenenver the mouse is moved over the svg
            var mousePos = d3.mouse(svg.node());
            var d = "M" + node.x + "," + node.y;
            d += "L" + mousePos[0] + "," + mousePos[1];
            halfLink.attr("d",d);
        });

    },
    getInitialArrowPath: function(node){
        // Returns the description of a path resembling a '>'
        var arrowHeight = 12;
        var midpointX = node.x - Display.nodeRadius - 0.5;
        var midpointY = node.y;
        var midStr = midpointX + "," + midpointY;

        var startX = midpointX - arrowHeight;
        var startY = midpointY - arrowHeight;
        var startStr = startX + "," + startY;

        var endX = startX;
        var endY = midpointY + arrowHeight;
        var endStr = endX + "," + endY;

        return "M" + startStr + "L" + midStr + "L" + endStr;
    },
    getLinkLabelPosition: function(node1, node2) {
        // Function takes two nodes andr eturns a suitable position
        // for the label of the link between them.

        // Test if the link is from one node to itself
        if (node1.id === node2.id){
            return {
                x: node1.x,
                y: node2.y - 60,
                rotation: 0
            };
        }

        // Find the point between the two nodes
        var cx = 0.5 * (node1.x + node2.x);
        var cy = 0.5 * (node1.y + node2.y);

        //Find vector V from P1 to P2
        var vx = node2.x - node1.x;
        var vy = node2.y - node1.y;

        // Find suitable offset by getting a vector perpendicular to V
        var vpx = -1 * vy;
        var vpy = vx;

        //Normalise this vector:
        var magnitude = Math.sqrt(vpx * vpx + vpy * vpy);
        vpx = vpx / magnitude;
        vpy = vpy /magnitude;

        //find angle of the line relative to x axis. From -180 to 180.
        var angle = (Math.atan2(node2.y - node1.y, node2.x - node1.x) * 180 / Math.PI);
        if (Math.abs(angle) > 90) {
            angle = angle - 180; //don't want text upside down
        }

        // Determine if the links are drawn as bezier curves ie there is a link between the nodes in both directions
        // Test if there is link from node2 to node1
        var isBezier = node2.hasLinkTo(node1);

        var scale;
        if (!isBezier) {
            scale = 10;
            return {
                x: cx + scale * vpx,
                y: cy + scale * vpy,
                rotation: angle
            };
        } else {
            scale = 22;
            return {
                x: cx + scale * vpx,
                y: cy + scale * vpy,
                rotation: angle
            };
        }
    },
    drawLinkContextMenu: function(svg, link, mousePosition){
        var html = "<p class = 'button changeconditions'>Change Conditions</p>";
        html += "<p class = 'button deletelink'>Delete Link</p>";
        html += "<p class = 'button reverselink'>Reverse Link</p>";

        var menuWidth = 100,
            menuHeight = 60;

        var menuCoords = Display.getContextMenuCoords(svg, mousePosition[0], mousePosition[1], menuWidth, menuHeight);

        var menu = svg.append("foreignObject")
            .attr("x", menuCoords[0])
            .attr("y", menuCoords[1])
            .attr("width", menuWidth)
            .attr("height", menuHeight)
            .classed("context-menu-holder", true)
            .append("xhtml:div")
            .attr("class", "contextmenu")
            .html(html);

        d3.select(".changeconditions").on("click", function(){Controller.requestLinkRename(link); Display.dismissContextMenu();});
        d3.select(".deletelink").on("click", function(){Controller.deleteLink(link); Display.dismissContextMenu();});
        d3.select(".reverselink").on("click", function(){Controller.reverseLink(link); Display.dismissContextMenu();});


        // Disable system menu on right-clicking the context menu
        menu.on("contextmenu", function() {
            d3.event.preventDefault();
        });

    },
    drawNodeContextMenu: function(svg, node, mousePosition){
        var html = "<p class = 'button toggleinitial'>Toggle Start</p>";
        html += "<p class = 'button toggleaccepting'>Toggle Accepting</p>";
        html += "<p class = 'button renamestate'>Rename State</p>";
        html += "<p class = 'button deletestate'>Delete State</p>";

        var menuWidth = 100,
            menuHeight = 80;

        var menuCoords = Display.getContextMenuCoords(svg, mousePosition[0], mousePosition[1], menuWidth, menuHeight);

        var menu = svg.append("foreignObject")
            .attr("x", menuCoords[0])
            .attr("y", menuCoords[1])
            .attr("width", menuWidth)
            .attr("height", menuHeight)
            .classed("context-menu-holder", true)
            .append("xhtml:div")
            .attr("class", "contextmenu")
            .html(html);

        svg.select(".toggleinitial").on("click", function(){Controller.toggleInitial(node); Display.dismissContextMenu();});
        svg.select(".toggleaccepting").on("click", function(){Controller.toggleAccepting(node); Display.dismissContextMenu();});
        svg.select(".renamestate").on("click", function(){Controller.requestNodeRename(node); Display.dismissContextMenu();});
        svg.select(".deletestate").on("click", function(){Controller.deleteNode(node); Display.dismissContextMenu();});


        // Disable system menu on right-clicking the context menu
        menu.on("contextmenu", function() {
            d3.event.preventDefault();
        });

    },
    drawNodeRenameForm: function(canvasID, node){
        var currentName = node.name;

        // create a form over the targeted node
        d3.select("#" + canvasID).append("foreignObject")
            .attr("width", 80)
            .attr("height", 50)
            .attr("x", node.x + 20)
            .attr("y", node.y - 6)
            .attr("class", "rename")
            .append("xhtml:body")
                .append("form")
                .on("keypress", function(){EventHandler.nodeRenameFormKeypress(node, this);})
                    .append("input")
                    .classed("renameinput", true)
                    .attr("id", node.id + "-rename")
                    .attr("type", "text")
                    .attr("size", "1")
                    .attr("maxlength", "5")
                    .attr("name", "state name")
                    .attr("value", currentName)
                        .node().select();
    },
    drawUnconstrainedLinkRenameForm: function(canvasID, link){
        // This gives rename form as a textbox where anything can be entered
        var svg = d3.select("#" + canvasID);

        // Derive the position of the form from the location of the link label
        var labelPos = Display.getLinkLabelPosition(link.source, link.target);
        var formX = labelPos.x - 40;
        var formY = labelPos.y + 15;

        // Get the string representing the current link conditions
        var current = Display.linkLabelText(link);

        svg.append("foreignObject")
            .attr("width", 80)
            .attr("height", 50)
            .attr("x", formX)
            .attr("y", formY)
            .attr("class", "rename")
            .append("xhtml:body")
                .append("form")
                .on("keypress", function(){EventHandler.linkRenameFormKeypress(link, this, "unconstrained");})
                    .append("input")
                    .classed("rename", true)
                    .classed("unconstrained", true)
                    .attr("id", link.id + "-rename")
                    .attr("type", "text")
                    .attr("size", "10")
                    .attr("name", "link conditions")
                    .attr("value", current)
                    .node().select();
            // .html("<form onkeypress='javascript:return event.keyCode != 13;'><input onsubmit='javascript:return false;' class='renameinput' id='ltxt" + id + "' text-anchor='middle' type='text' size='2', name='link conditions' value='" + current + "'></form>");

    },
    dismissContextMenu: function() {
        d3.select(".contextmenu").remove();
        d3.select(".context-menu-holder").remove();
        Global.contextMenuShowing = false;
    },
    dismissRenameMenu: function(canvasID){
        d3.select("#" + canvasID).selectAll(".rename").remove();
    },
    forceTick: function(canvasID){
        // Update the display after the force layout acts. Should be called at least once to initialise positions, even if
        // force is not used.
        var svg = d3.select("#"+canvasID);
        svg.selectAll(".node")
            .attr("cx", function(d){return d.x;})
            .attr("cy", function(d){return d.y;});
        svg.selectAll(".accepting-ring")
            .attr("cx", function(d){return d.x;})
            .attr("cy", function(d){return d.y;});
        svg.selectAll(".start")
            .attr("d", function(node){return Display.getInitialArrowPath(node);});
        svg.selectAll(".link")
            .each(function(link){
                var linkID = link.id;
                var paddingID = "linkpad"+linkID;
                var pathD = Display.getLinkPathD(link);
                // Calculate d once, then apply to both the link and the link padding.
                d3.select("#" + linkID).attr("d", pathD);
                d3.select("#" + paddingID).attr("d", pathD);
            });
        svg.selectAll(".linklabel")
            .each(function(link){
                var positionObj = Display.getLinkLabelPosition(link.source, link.target);
                d3.select(this).attr("x", positionObj.x).attr("y", positionObj.y);
            });
        svg.selectAll(".nodename")
            .each(function(node){
                d3.select(this).attr("x", node.x).attr("y", node.y);
            });
    },
    getContextMenuCoords: function(svg, mouseX, mouseY, menuWidth, menuHeight ){
        // Get coordinates for the context menu so that it is not drawn off screen in form [x, y]
        svg = svg.node(); //Switch from a d3 selection to native JS
        var viewboxWidth = svg.viewBox.baseVal.width;
        var viewboxHeight = svg.viewBox.baseVal.height;
        if(svg.getBoundingClientRect().width > svg.getBoundingClientRect().height){
            var userCoordtoScreenCoord = svg.getBoundingClientRect().height/viewboxHeight;
            var maxX = viewboxWidth + ((svg.clientWidth/(2 * userCoordtoScreenCoord)) - ( viewboxWidth/2));
            var maxY = viewboxHeight;
        } else {
            userCoordtoScreenCoord = svg.getBoundingClientRect().width/viewboxWidth;
            maxX = viewboxWidth;
            maxY = viewboxHeight + ((svg.clientHeight/(2 * userCoordtoScreenCoord)) - (viewboxHeight/2));
        }

        if (mouseX + menuWidth < maxX){
            var menuX = mouseX;
        } else{
            menuX = maxX - menuWidth;
        }

        if (mouseY + menuHeight < maxY -6){
            var menuY = mouseY;
        } else {
            menuY = maxY - menuHeight - 6;
        }
        return [menuX, menuY];
    },
    getLinkPathD: function(link){
        // Test if the link is from a node to itself:
        if (link.source.id === link.target.id){
            // Create two segments, meeting at the top, to allow placement of arrowheads
            // Note this is not needed for arrowheads to display in Chrome, but based on the specification this may be a bug in Chrome.
            var x = link.source.x;
            var y = link.source.y;

            var rad = 22;
            var xoffset = 5;
            var yoffset = 7;


            var x1 = x - xoffset;
            var y1 = y - yoffset;

            var P1 = x1 + "," + y1;

            var x2 = x;
            var y2 = y1 - (Math.sqrt(rad*rad - (xoffset*xoffset)) + rad);
            var x3 = x + xoffset;
            var y3 = y1;

            var P2 = x2 + "," + y2;
            var P3 = x3 + "," + y3;



            var str = "M" + P1 + " A" + rad + " " + rad + " 0 0 1 " + P2;
            str += "  A" + rad + " " + rad + " 0 0 1 " + P3;
            return str;

        }
        // Test if there is a link in the opposite direction:
        var hasOpposite = false;
        for (var i = 0; !hasOpposite && i < Object.keys(link.target.outgoingLinks).length; i++){
            var linkID = Object.keys(link.target.outgoingLinks)[i];
            var outgoingLink = link.target.outgoingLinks[linkID];
            if (outgoingLink.target.id === link.source.id){
                hasOpposite = true;
            }
        }

        var deltaX = link.target.x - link.source.x,
            deltaY = link.target.y - link.source.y,
            dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        // Define unit vector from source to target:
        var unitX = deltaX / dist,
            unitY = deltaY / dist;


        x1 = link.source.x + (unitX * 0.8 * Display.nodeRadius);
        x2 = link.target.x - (unitX * 0.8 * Display.nodeRadius);
        y1 = link.source.y + (unitY * 0.4 * Display.nodeRadius);
        y2 = link.target.y - (unitY * 0.4 * Display.nodeRadius);

        if (hasOpposite){
            //Use a bezier curve
            // Calculate vector from P1 to P2
            var vx = x2 - x1;
            var vy = y2 - y1;

            // Find suitable control points by rotating v left 90deg, normalising and scaling
            var vlx = -1 * vy;
            var vly = 1 * vx;

            var normal_vlx = vlx/Math.sqrt(vlx*vlx + vly*vly);
            var normal_vly = vly/Math.sqrt(vlx*vlx + vly*vly);

            var scaled_vlx = 10 * normal_vlx;
            var scaled_vly = 10 * normal_vly;

            //offset the start and end points along vl
            x1 += 3 * normal_vlx;
            y1 += 3 * normal_vly;
            x2 += 3 * normal_vlx;
            y2 += 3 * normal_vly;


            // Can now define the control points by adding vl to P1 and P2
            var c1x = x1 + scaled_vlx;
            var c1y = y1 + scaled_vly;

            var c2x = x2 + scaled_vlx;
            var c2y = y2 + scaled_vly;

            // We need an explicit midpoint to allow a direction arrow to be placed
            var m1x = c1x + 0.5 * vx;
            var m1y = c1y + 0.5 * vy;

            // Define strings to use to define the path
            P1 = x1 + "," + y1;
            var M1 = m1x + "," + m1y;
            P2 = x2 + "," + y2;
            var C1 = c1x + "," + c1y;
            var C2 = c2x + "," + c2y;

            return ("M" + P1 + " Q" + C1 + " " + M1 + " Q" + C2 + " " + P2);
        } else {
            // define vector v from P1 to halfway to P2
            vx = 0.5 * (x2 - x1);
            vy = 0.5 * (y2 - y1);

            // midpoint is then:
            var midx = x1 + vx;
            var midy = y1 + vy;

            P1 = x1 + "," + y1;
            var M = midx + "," + midy;
            P2 = x2 + "," + y2;

            return ("M" + P1 + " L" + M + " L" + P2);
        }
    },
    linkLabelText:function(link){
        //Create the label string for a link
        var labelString;
        if (link.input.length == 0) {
            return link.hasEpsilon? "ε" : "";
        } else {
            labelString = "";
            for (var i = 0; i < link.input.length; i++) {
                var inchar = link.input[i];
                if (link.machine.isTransducer){
                    var outchar = "";
                    for (var j = 0; j < link.output.length; j++){
                        if (link.output[j][0] == inchar){
                            outchar = ":" + link.output[j][1];
                            break;
                        }
                    }
                    labelString += inchar + outchar + ", ";
                } else {
                    labelString += inchar + ", ";
                }
            }
            labelString =  labelString.slice(0,-2);
            // Append an epsilon symbol if needed.
            return link.hasEpsilon? labelString + ", ε" : labelString;
        }
    },
    toolSelect: function(canvasID, newMode){
        var svg = d3.select("#" + canvasID);
        // Deselect all rectangles
        svg.selectAll(".control-rect").classed("selected", false);
        if(newMode !== "none"){
            svg.select("#" + canvasID + "-" + newMode)
                .classed("selected", true)
                .attr("fill", "url(#Gradient1)");
        }
        Display.canvasVars[canvasID].toolMode = newMode;
    },
    update: function(canvasID){
        var colours = Display.canvasVars[canvasID].colours;
        var machine = this.canvasVars[canvasID].machine;

        var svg = d3.select("#"+canvasID);

        // Draw new nodes
        var nodeg = svg.select(".nodes"); // Select the g element used for nodes
        var nodeList = Object.keys(machine.nodes).map(function(nodeID){return machine.nodes[nodeID];});
        var nodeGs = nodeg.selectAll("g")
            .data(nodeList, function(d){return d.id;});
        var newNodes = nodeGs.enter().append("svg:g").classed("nodeg", true);
        newNodes.append("circle")
                .attr("cx", function(d){return d.x;})
                .attr("cy", function(d){return d.y;})
                .attr("id", function(d){return d.id;})
                .classed("node", true)
                .attr("r", Display.nodeRadius)
                .style("fill", function(d){return colours(d.id);})
                .on("contextmenu", function(node){EventHandler.nodeContextClick(node);})
                .on("click", function(node){EventHandler.nodeClick(node)});

        // Add a name label:
        newNodes.append("svg:text")
            .classed("nodename", true)
            .attr("id", function(node){return node.id + "-label";})
            .text(function(node){return node.name;});


        nodeGs.exit().remove(); //Remove nodes whose data has been deleted

        // Update nodes
        // Set classes
        var circles = nodeGs.selectAll("circle")
            .classed("accepting", function(node){return node.isAccepting;})
            .classed("initial", function(node){return node.isInitial;});
        // Add concentric circle to accepting nodes
        circles.each(function(node){
            var shouldHaveRing = node.isAccepting;
            var hasRing = document.querySelector("#ar"+node.id);
            if(shouldHaveRing && !hasRing){
                d3.select(this.parentNode).append("svg:circle")
                .attr("cx", node.x)
                .attr("cy", node.y)
                .attr("r", Display.acceptingRadius)
                .attr("class", "accepting-ring")
                .attr("id", "ar" + node.id);
                return;
            }
            if(!shouldHaveRing && hasRing){
                hasRing.remove();
            }
        });
        // Add arrows to initial nodes
        circles.each(function(node){
            var shouldHaveArrow = node.isInitial;
            var hasArrow = document.querySelector("#"+node.id + "-in");
            if(shouldHaveArrow && !hasArrow){
                d3.select(this.parentNode).append("svg:path")
                    .classed("start", true)
                    .attr("d", function(node){return Display.getInitialArrowPath(node);})
                    .attr("id", node.id + "-in");
                return;
            }
            if(!shouldHaveArrow && hasArrow){
                hasArrow.remove();
            }
        });


        // Draw new links
        var linkg = svg.select(".links");
        var linkList = Object.keys(machine.links).map(function(linkID){return machine.links[linkID];});
        var linkGs = linkg.selectAll("g")
            .data(linkList, function(d){return d.id;});
        var newLinks = linkGs.enter().append("svg:g");

        newLinks.append("path")
               .attr("d", function(d){return Display.getLinkPathD(d);})
               .classed("link", true)
               .style("marker-mid", "url(#end-arrow)")
               .attr("id", function(d){return d.id;})
               .on("contextmenu", function(link){EventHandler.linkContextClick(link);});

        //Add link padding to make links easier to click. Link padding handles click events as if it were a link.
        newLinks.append("svg:path")
               .on("contextmenu", function(link){EventHandler.linkContextClick(link);})
               .attr("class", "link-padding")
               .attr("id", function(d){return "linkpad" + d.id;});

        // Add link labels
        newLinks.append("svg:text")
            .on("contextmenu", function(link){EventHandler.linkContextClick(link);})
            .attr("class", "linklabel")
            .attr("text-anchor", "middle") // This causes text to be centred on the position of the label.
            .attr("id", function(link){return link.id + "-label";})
            .text(function(link){return Display.linkLabelText(link);});

        linkGs.exit().remove(); //Remove links whose data has been deleted


        var force = this.canvasVars[canvasID].force;
        force.nodes(nodeList)
            .links(linkList)
            .size([1000,600])
            .linkDistance(150)
            .chargeDistance(160)
            .charge(-30)
            .gravity(0.00); //gravity is attraction to the centre, not downwards.
        force.start();
        newNodes.call(force.drag);

    },
    updateAllLinkLabels: function(canvasID){
        var linkList = Object.keys(Display.canvasVars[canvasID].machine.links);
        linkList.forEach(function(id){
            Display.updateLinkLabel(Display.canvasVars[canvasID].machine.links[id]);
        });
    },
    updateLinkLabel: function(link){
        var svg = d3.select("#" + link.machine.id);
        svg.select("#" + link.id + "-label").text(Display.linkLabelText(link));

    },
    updateNodeName: function(node){
        var svg = d3.select("#" + node.machine.id);
        svg.select("#" + node.id + "-label").text(node.name);
    }
};

var EventHandler = {
    backgroundClick: function(machine){
        // Check that the target is the background - this handler will recieve all clicks on the svg
        var canvasID = machine.id;
        if(d3.event.target.id === canvasID){
            Display.dismissContextMenu();
            var toolMode = Display.canvasVars[canvasID].toolMode;
            if (toolMode === "none" || toolMode === "linetool" || toolMode === "texttool" || toolMode === "deletetool"){
                return;
            }
            if (toolMode === "nodetool" || toolMode === "acceptingtool"|| toolMode === "initialtool"){
                //Get coordinates where node should be created:
                var point = d3.mouse(d3.select("#" + canvasID)[0][0]);
                Controller.createNode(machine, point[0], point[1], toolMode === "initialtool", toolMode === "acceptingtool");
            }
        }

    },
    linkContextClick: function(link){
        d3.event.preventDefault();
        if(Global.contextMenuShowing){
            Display.dismissContextMenu();
        }
        var svg = d3.select("#" + link.machine.id);
        Global.contextMenuShowing = true;
        var mousePosition = d3.mouse(svg.node());
        Display.drawLinkContextMenu(svg, link, mousePosition);

    },
    nodeClick: function(node){
        var canvasID = node.machine.id;
        var toolMode = Display.canvasVars[canvasID].toolMode;
        if(toolMode === "none" || toolMode === "nodetool"){
            return;
        }
        if(toolMode === "linetool"){
            var linkInProgress = Display.canvasVars[canvasID].linkInProgress; // true if there is link awaiting and endpoint
            if(!linkInProgress){
                Display.beginLink(node);
            }
        }
    },
    nodeContextClick: function(node){
        d3.event.preventDefault();
        if(Global.contextMenuShowing){
            Display.dismissContextMenu();
        }
        var svg = d3.select("#" + node.machine.id);
        Global.contextMenuShowing = true;
        var mousePosition = d3.mouse(svg.node());
        Display.drawNodeContextMenu(svg, node, mousePosition);
    },
    linkRenameFormKeypress:function(link, context, formType){
        // Event handler to prevent submission of page on return key
        // and to notify Controller instead
        if (event.keyCode != 13){
            return true;
        }
        event.preventDefault();
        // Need to process input differently based on the form type
        if(formType === "unconstrained"){
            var string = d3.select(context).select("input").node().value;
            // strip out whitespace:
            string = string.replace(/ /g, "");
            // Split on commas:
            var strings = string.split(",").filter(function(s){return s.length > 0;});
            // For each entry, add it to the link's input list
            // If it is epsilon or a synonym, set hasEpsilon to true
            var hasEpsilon  = false;
            var input = [];
            strings.forEach(function(s){
                if(["epsilon", "epssilon", "espilon", "epsillon", "eps", "ε", "ϵ", "Ε"].indexOf(s.toLowerCase()) !== -1){
                    hasEpsilon = true;
                } else {
                    input.push(s);
                }
            });
            Controller.submitLinkRename(link, input, hasEpsilon);
        }


    },
    nodeRenameFormKeypress: function(node, context){
        // Event handler to prevent submission of page on return key
        // and to notify Controller instead
        if(event.keyCode == 13){
            event.preventDefault();
            Controller.submitNodeRename(node, d3.select(context).select("input").node().value);
        }
    },
    toolSelect: function(canvasID, newMode){
        var oldMode = Display.canvasVars[canvasID].toolMode;

        if (oldMode == newMode){
            newMode = "none";
        }
        Display.toolSelect(canvasID, newMode);
    }
};

var Controller = {
    addMachine: function(specObj){
        // Adds a machine to the model
        var newID = "m" + (Model.machines.length + 1);
        var newMachine = new Constructor.Machine(newID);
        newMachine.build(specObj);
        Display.newCanvas(newID, newMachine);
        Display.update(newID);
    },
    deleteMachine: function(machineID){
        Model.deleteMachine(machineID);
        Display.deleteCanvas(machineID);
    },
    deleteLink: function(link){
        link.machine.deleteLink(link);
        Display.update(link.machine.id);
    },
    createNode: function(machine, x, y, isInitial, isAccepting){
        machine.addNode(x, y, "", isInitial, isAccepting);
        Display.update(machine.id);
    },
    deleteNode: function(node){
        node.machine.deleteNode(node);
        Display.update(node.machine.id);
    },
    reverseLink: function(link){
        link.reverse();
        Display.update(link.machine.id);
        Display.updateAllLinkLabels(link.machine.id);
    },
    requestLinkRename: function(link){
        var canvasID = link.machine.id;
        if (link.machine.alphabet.length === 0){
            Display.drawUnconstrainedLinkRenameForm(canvasID, link);
        } else {
            Display.drawConstrainedLinkRenameForm(canvasID, link);
        }
    },
    requestNodeRename: function(node){
        var canvasID = node.machine.id;
        Display.drawNodeRenameForm(canvasID, node);
    },
    init: function(){
        //Reference: addLink(sourceNode, targetNode, input, output, hasEpsilon)
        m = new Constructor.Machine("m1");
        Model.machines.push(m);
        Controller.setupMachine(m, 0);
        Display.canvasVars["m1"].machine = m;
        Display.update("m1");
        d3.select("#m1").on("click", function(){EventHandler.backgroundClick(m);});
        Question.setUpQuestion();
        if(["give-list", "select-states", "does-accept", "demo"].indexOf(Question.type) == -1){
            Question.editable = true;
            Display.drawControlPalette("m1");
        } else {
            Question.editable = false;
        }
    },
    setupMachine: function(machine, i){
        var body = document.querySelector("body");
        var spec = JSON.parse(body.dataset.machinelist)[i];
        machine.build(spec);

    },
    submitLinkRename: function(link, input, hasEpsilon){
        link.setInput(input, hasEpsilon);
        Display.updateLinkLabel(link);
        Display.dismissRenameMenu(link.machine.id);
    },
    submitNodeRename: function(node, newName){
        node.name = newName;
        Display.updateNodeName(node);
        Display.dismissRenameMenu(node.machine.id);
    },
    toggleAccepting: function(node){
        node.toggleAccepting();
        Display.update(node.machine.id);
    },
    toggleInitial: function(node){
        node.toggleInitial();
        Display.update(node.machine.id);
    }
};

var Global = {
    // Not certain if this is a good idea - object to hold global vars
    // Some globals useful to avoid keeping duplicated code in sync - this seems like
    // a more readable way of doing that than scattering global vars throughout the codebase
    "toolsWithDragAllowed": ["none"],
    "pageLoaded": false,
    "iconAddress": document.querySelector("body").dataset.iconaddress,
    //Track state
    "renameMenuShowing":false,
    "contextMenuShowing":false,
    "traceInProgress": false,
    "hasRated": false
};

//Declare d3 as global readonly for ESLint
/*global d3*/

var m;
Controller.init();