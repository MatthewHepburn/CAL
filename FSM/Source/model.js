"use strict";

// This holds the domain model and the functions needed to interact with it. It should not interact with the DOM and
// it should not recquire d3.
const Model = {
    machines: [], // This may be better as an object, with machine IDs as keys.
    addMachine: function(specificationObj){
        //Creates a new machine as specified by specificationObj, adds it to the machinelist and returns the new machine.
        const newID = "m" + (this.machines.length + 1);
        const newMachine = new Model.Machine(newID);
        newMachine.build(specificationObj);
        this.machines.push(newMachine);
        return newMachine;
    },
    deleteMachine: function(machineID){
        this.machines = this.machines.filter(m => m.id !== machineID);
    },
    getMachineList: function(){
        //Returns a list of specifications for the current machine(s)
        const list = [];
        for(let i = 0; i < Model.machines.length; i++){
            list.push(Model.machines[i].getSpec());
        }
        return list;
    },
    parseInput(inputString, splitSymbol){
        //Takes an input string (e.g. "abbbc") and returns a sequence based on the split symbol (e.g. ["a", "b", "b", "b", "c"])
        if(splitSymbol === undefined){
            splitSymbol = this.question.splitSymbol;
        }
        return inputString.split(splitSymbol).map(y => y.replace(/ /g,"")).filter(z => z.length > 0);
    },
    // Constructor for a machine object
    // TODO consider adding functions via the prototype instead of adding them in the constructor for memory efficiency.
    Machine: function(id) {
        this.id = id;
        this.nodes = {};
        this.links = {};
        this.alphabet = [];
        this.allowEpsilon = true;
        this.isTransducer = false;
        this.currentState = [];

        //Track links used on last step
        this.linksUsed = [];
        this.nonEpsLinksUsed = [];
        this.epsilonLinksUsed = [];

        this.addNode = function(x, y, name, isInitial, isAccepting){
            //Adds a node to the machine. Returns the node.
            isInitial = isInitial === undefined? false : isInitial;
            isAccepting = isAccepting === undefined? false : isAccepting;
            name = name === undefined? "" : name;
            const nodeID = this.getNextNodeID();
            const newNode = new Model.Node(this, nodeID, x, y, name, isInitial, isAccepting);
            this.nodes[nodeID] = newNode;
            return newNode;

        };
        this.addLink = function(sourceNode, targetNode, input, output, hasEpsilon){
            //Adds a link to the machine. Returns the id assigned to the link.
            //Accepts either nodeIDs or node references for source and target
            if (sourceNode instanceof Model.Node === false){
                sourceNode = this.nodes[sourceNode];
            }
            if (targetNode instanceof Model.Node === false){
                targetNode = this.nodes[targetNode];
            }
            input = input === undefined? [] : input;
            output = output === undefined? {} : output;
            hasEpsilon = hasEpsilon === undefined? false : hasEpsilon;
            const linkID = this.getNextLinkID();
            const newLink = new Model.Link(this, linkID, sourceNode, targetNode, input, output, hasEpsilon);
            this.links[linkID] = newLink;
            sourceNode.outgoingLinks[linkID] = newLink;
            return newLink;
        };
        this.deleteLink = function(link){
            // Accepts either a Link object or a linkID
            if (link instanceof Model.Link === false){
                link = this.links[link];
            }
            delete this.links[link.id];
            delete link.source.outgoingLinks[link.id];
        };
        this.deleteNode = function(node){
            // Removes a node from the machine, deleting all links to or from it.
            // Accepts either a Node object or a nodeID
            if (node instanceof Model.Node === false){
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
        this.deleteAllNodes = function(){
            for(var nodeID in this.nodes){
                this.deleteNode(nodeID);
            }
        };
        this.build = function(spec){
            //Sets up the machine based on a specification object passed in
            this.nodes = {};
            this.links = {};
            this.alphabet = spec.attributes.alphabet;
            this.allowEpsilon = spec.attributes.allowEpsilon;
            this.isTransducer = spec.attributes.isTransducer;
            var nodes = spec.nodes;
            var nodeIDDict = {}; //Used to map IDs in the spec to machine IDs
            for (var i = 0; i < nodes.length; i++){
                var n = nodes[i];
                var specID = n.id;
                nodeIDDict[specID] = this.addNode(n.x, n.y, n.name, n.isInit, n.isAcc).id;
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
        this.getAcceptingNodeCount = function(){
            var acceptingNodes = Object.keys(this.nodes).map(nodeID => this.nodes[nodeID]).filter(node => node.isAccepting);
            return acceptingNodes.length;
        };
        this.getInitialNodeCount = function(){
            //Returns the number of nodes where node.isInitial == true;
            var initialNodes = Object.keys(this.nodes).map(nodeID => this.nodes[nodeID]).filter(node => node.isInitial);
            return initialNodes.length;
        };
        this.getNodeCount = function(){
            //returns the number of nodes in the machine
            return Object.keys(this.nodes).length;
        };
        this.getLinkCount = function(){
            //returns the number of links in the machine
            return Object.keys(this.nodes).length;
        };
        this.getTrace = function(sequence){
            //Returns a traceObj that can be used to display a machine's execution for some input
            //Setup object
            var traceObj = {states:[], links:[], doesAccept: undefined, input: undefined};
            traceObj.input = JSON.parse(JSON.stringify(sequence)); //JSON copy
            traceObj.inputSeparator = JSON.parse(JSON.stringify(Model.question.splitSymbol));
            traceObj.machineID = this.id;

            var linksUsedThisStep = [];
            var machine = this;
            var inputSymbol = undefined;

            //Used to create an object for traceObj.links that also includes the transition used;
            var getLinkUsedObj = function(linkID){
                var link = machine.links[linkID];
                return {
                    "link": link,
                    "epsUsed": false,
                    "inputIndex": link.inputIndexOf(inputSymbol)
                };
            };

            //Used for epsilon links
            var getEpsLinkUsedObj = function(linkID){
                var link = machine.links[linkID];
                return {
                    "link": link,
                    "epsUsed": true
                };
            };

            var getNode = function(nodeID){
                return machine.nodes[nodeID];
            };

            this.setToInitialState();
            traceObj.states.push(this.currentState.map(getNode));
            traceObj.links.push(this.epsilonLinksUsed.map(getEpsLinkUsedObj));

            var i = 0;
            while(i < sequence.length && this.currentState.length > 0){
                //Advance machine
                inputSymbol = sequence[i];
                this.step(inputSymbol);

                //Record new state and links used to get there
                traceObj.states.push(this.currentState.map(getNode));
                linksUsedThisStep = [];
                linksUsedThisStep = linksUsedThisStep.concat(this.epsilonLinksUsed.map(getEpsLinkUsedObj));
                linksUsedThisStep = linksUsedThisStep.concat(this.nonEpsLinksUsed.map(getLinkUsedObj));
                traceObj.links.push(linksUsedThisStep);

                i = i + 1;
            }

            traceObj.doesAccept = this.isInAcceptingState();

            return traceObj;


        };
        this.getSpec = function(){
            //Returns an object that describes the current machine in the form accepted by Machine.build
            var spec = {"nodes": [], "links": [], "attributes":{
                "alphabet": this.alphabet,
                "allowEpsilon": this.allowEpsilon,
                "isTransducer": this.isTransducer
            }};
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
                // Machine and Node is probably harmless (and unavoidable).
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
        this.setToState = function(nodeList){
            //Takes an array of nodes and sets them as the currrent state (used in DFA conversion)
            var nodeIDs = nodeList.map(x => x.id);
            this.currentState = nodeIDs;

        };
        this.getNodeList = function(){
            //Returns an array of all nodes in the machine
            return Object.keys(this.nodes).map(nodeID => this.nodes[nodeID]);

        };
        this.getCurrentNodeList = function(){
            //Returns an array of the nodes that the machine is currently in
            return this.currentState.map(id => this.nodes[id]);
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
            this.epsilonLinksUsed = linksUsed;
        };
        this.step = function(symbol){
            // The machine changes its state based on an input symbol
            // Get an array of nodes from the list of nodeIDs
            var nodes = this.currentState.map(nodeID => this.nodes[nodeID]);
            var newNodes = [];
            var linksUsed = [];
            for (var i = 0; i < nodes.length; i++){
                var thisNode = nodes[i];
                var reachableNodeObj = thisNode.getReachableNodes(symbol);
                // Get nodeIDs of nodes reachable from current node for input = symbol, where the nodeID is not in newNodes
                var newReachableNodeIDs = reachableNodeObj.nodeIDs.filter( nodeID => newNodes.indexOf(nodeID) === -1);
                newNodes = newNodes.concat(newReachableNodeIDs);
                linksUsed = linksUsed.concat(reachableNodeObj.linkIDs);
            }
            this.currentState = newNodes;
            this.linksUsed = linksUsed;
            this.nonEpsLinksUsed = linksUsed.map(x => x); //copy
            this.followEpsilonTransitions();
        };

        this.isInAcceptingState = function(){
            // True if any of the current states is an accepting state.
            if (this.currentState.length === 0){
                return false;
            }
            for (var i = 0; i < this.currentState.length; i++){
                if(this.nodes[this.currentState[i]].isAccepting){
                    return true;
                }
            }
            return false;
        };

        this.accepts = function(sequence){
            // Takes an input sequence and tests if the machine accepts it.
            // This alters the current machine state
            sequence = Array.from(sequence); // Avoid changing the passed in arguement by creating a copy
            this.setToInitialState();
            while(sequence.length > 0){
                if(this.currentState.length === 0){
                    return false;
                }
                this.step(sequence.shift());
            }
            return this.isInAcceptingState();
        };

        this.setAlphabet = function(alphabetArray, allowEpsilon){
            if(allowEpsilon !== undefined){
                this.allowEpsilon = allowEpsilon;
            }
            this.alphabet = alphabetArray;
            //Now enforce this alphabet by removing illegal symbols
            this.enforceAlphabet();

        };

        this.enforceAlphabet = function(){
            //Remove any input symbols in the machine that are not in this.alphabet
            for(var linkID in this.links){
                this.links[linkID].enforceAlphabet();
            }
        };

        this.mergeNodes = function(s1, s2){
            //Takes two states in the machine and combines them

            this.enforceAlphabet(); //Overkill?

            const name = `{${s1.name}, ${s2.name}}`;
            const inboundLinks = this.getLinksTo(s1).concat(this.getLinksTo(s2));
            const outgoingLinks = s1.getOutgoingLinks().concat(s2.getOutgoingLinks());
            const isInitial = s1.isInitial && s2.isInitial;
            const isAccepting = s1.isAccepting && s2.isAccepting;

            const x = (s1.x + s2.x)/2;
            const y = (s1.y + s2.y)/2;

            this.deleteNode(s1);
            this.deleteNode(s2);

            const mergedNode = this.addNode(x, y, name, isInitial, isAccepting);

            //Modify the source/target of the old links as appropriate and merge the lists
            inboundLinks.forEach(l => l.target = mergedNode);
            outgoingLinks.forEach(l => l.source = mergedNode);
            var oldLinks = inboundLinks.concat(outgoingLinks);

            //Add back links to the new node
            for(let i in oldLinks){
                var l = oldLinks[i];
                var source = l.source;
                var target = l.target;
                //See if link already exists
                var existingLink = source.getLinkTo(target);
                if(existingLink !== null){
                    //Link present, combine input symbols
                    var newInput = existingLink.input.concat(l.input); //Will contain duplicates, but they are removed in Link.setInput
                    let hasEpsilon = l.hasEpsilon || existingLink.hasEpsilon;
                    existingLink.setInput(newInput, hasEpsilon); //TODO refactor to use Link.addInput()
                } else {
                    //No link present, create it
                    var input = l.input;
                    let hasEpsilon = l.hasEpsilon;
                    var output = {};
                    this.addLink(source, target, input, output, hasEpsilon);
                }
            }
            return mergedNode;
        };

        this.minimize = function(){
            this.reverse();
            this.convertToDFA();
            this.reverse();
            this.convertToDFA();
        };

        this.isEquivalentTo = function(machine){
            //Compares this to machine and returns true if both machines are isomorphic after minimization.
            //Create copies to avoid altering orginal machines:
            var m1 = new Model.Machine("temp1");
            var m2 = new Model.Machine("temp2");
            m1.build(this.getSpec());
            m2.build(machine.getSpec());
            m1.minimize();
            m2.minimize();

            //Perform simple tests to rule out equivilance first:
            if(m1.getNodeCount() !== m2.getNodeCount()){
                return false;
            }
            if(m1.getLinkCount() !== m2.getLinkCount()){
                return false;
            }
            if(m1.getAcceptingNodeCount() !== m2.getAcceptingNodeCount()){
                return false;
            }
            //Must have same alphabet
            if(m1.alphabet.filter(symbol => m2.alphabet.indexOf(symbol) === -1).length !== 0){
                return false;
            }

            var alphabet = m1.alphabet;
            var m1Nodes = Object.keys(m1.nodes).map(nodeID => m1.nodes[nodeID]);
            var m2Nodes = Object.keys(m2.nodes).map(nodeID => m2.nodes[nodeID]);

            var m1InitialNodes = m1Nodes.filter(node => node.isInitial);
            var m2InitialNodes = m2Nodes.filter(node => node.isInitial);

            if(m1InitialNodes.length !== 1 || m2InitialNodes.length !== 1){
                throw new Error("Minimized DFAs should only have one initial state");
            }

            var m1Initial = m1InitialNodes[0];
            var m2Initial = m2InitialNodes[0];

            //Find a mapping from nodes in m1 to m2, starting with the initial states
            //Start by checking that each node has the correct outgoing links
            var mapping = {};
            var frontier = [[m1Initial.id, m2Initial.id]];
            while(frontier.length > 0){
                var nodePair = frontier.pop();

                if(mapping[nodePair[0]]){ //If a mapping exists, it must be the same as the current pair
                    if(mapping[nodePair[0]] !== nodePair[1]){
                        return false;
                    } else {
                        continue; //If the pair is the same, then continue as no need to recheck.
                    }
                }
                var m1Node = m1.nodes[nodePair[0]];
                var m2Node = m2.nodes[nodePair[1]];

                var m1Outgoing = m1Node.getOutgoingLinks();
                var m2Outgoing = m2Node.getOutgoingLinks();

                if(m1Outgoing.length != m2Outgoing.length){ //Nodes must have same number of outgoing links. Only need to  consider outgoing links, as all nodes (and so all links) will be considered.
                    return false;
                }

                for(var i = 0; i < alphabet.length; i++){
                    var symbol = alphabet[i];
                    var m1Link = m1Outgoing.find(link => link.input.indexOf(symbol) !== -1);
                    var m2Link = m2Outgoing.find(link => link.input.indexOf(symbol) !== -1);
                    if(!(m1Link && m2Link)){ //If either node does not have a link for this symbol, then both must not have a link.
                        if(m1Link || m2Link){
                            return false;
                        } else {
                            continue; //both undefined => neither has a link for that symbol. Continue to next symbol.
                        }
                    }
                    //Link exists, so the target nodes must be equivilant.
                    var m1Target = m1Link.target;
                    var m2Target = m2Link.target;
                    //Check for reflexive links
                    if(m1Link.isReflexive() || m2Link.isReflexive()){
                        //if either is reflexive, both must be
                        if(!(m1Link.isReflexive() && m2Link.isReflexive())){
                            return false;
                        }
                    } else{
                        //Only need to add to the frontier if not reflexive
                        frontier.push([m1Target.id, m2Target.id]);
                    }
                }

                //Add node pair to mapping:
                mapping[m1Node.id] = m2Node.id;

            }

            //All checks passed, so equivilant
            return true;

        };

        this.getAcceptedSequence = function(){
            //Returns a sequence that the machine accepts, or null if no strings are accepted.
            //Uses a breadth-first search so should return one of the shortest strings.
            if(this.getAcceptingNodeCount() === 0){
                return null;
            }

            this.setToInitialState();
            if(this.isInAcceptingState()){
                return [];
            }

            var frontierLinks = [];
            var pathToNode = {};

            this.getCurrentNodeList().forEach(function(node){
                pathToNode[node.id] = [];
                var outgoingLinks = node.getOutgoingLinks();
                outgoingLinks.filter(link => !pathToNode[link.target]).filter(link => link.input.length > 0 || link.hasEpsilon).forEach(link => frontierLinks.push(link));
            });

            while(frontierLinks.length > 0){
                var link = frontierLinks.pop();
                var symbol = link.hasEpsilon ? [] : [link.input[0]];
                var sourceNode = link.source;
                var targetNode = link.target;
                if(targetNode.isAccepting){
                    return pathToNode[sourceNode.id].concat(symbol);
                } else{
                    pathToNode[targetNode.id] = pathToNode[sourceNode.id].concat(symbol);
                    var outgoingLinks = targetNode.getOutgoingLinks().filter(link => !pathToNode[link.target.id]).filter(link => link.input.length > 0 || link.hasEpsilon);
                    //We want to the return the shortest string possible, so add link to the front of the queue if it contains an epsilon link (as this does not add length to the sequence)
                    outgoingLinks.filter(l => l.hasEpsilon).forEach(l => frontierLinks.unshift(l));
                    //Add to the back instead
                    outgoingLinks.filter(l => !l.hasEpsilon).forEach(l => frontierLinks.push(l));

                }
            }
            return null;
        };

        this.complement = function(){
            //Changes the machine to accept the complement of its current languge
            //This is done by making the blackhole state explicit and making each accepting state non-accepting and vice versa.
            this.convertToDFA();
            this.completelySpecify("blackhole");
            var nodes = this.getNodeList();
            nodes.forEach(node => node.isAccepting = !node.isAccepting);
        };

        this.getUnionWith = function(machine){
            //Returns a machine that accepts L = L(this) ∩ L(machine)
            //Create copies to avoid altering original machines
            var m1 = new Model.Machine("temp1");
            m1.build(this.getSpec());
            var m2 = new Model.Machine("temp2");
            m2.build(machine.getSpec());

            m1.minimize();
            m1.completelySpecify("blackhole"); //Machines must be fully specified - an implicit sink state for unspecified input is not enough for this process.
            m2.minimize();
            m2.completelySpecify("blackhole");


            var unionMachine = new Model.Machine("u1");

            var alphabet = m1.alphabet.filter(symbol => m2.alphabet.indexOf(symbol) !== -1);
            unionMachine.setAlphabet(alphabet);

            var m1Initial = m1.getNodeList().find(node => node.isInitial);
            var m2Initial = m2.getNodeList().find(node => node.isInitial);

            var getPairID = (pair => pair[0].id + "-" + pair[1].id);

            var nodeFrontier = [[m1Initial, m2Initial]];
            var linksToAdd = [];
            var addedNodes = {}; //Will map a pairID to a Node oject

            while(nodeFrontier.length > 0){
                var pair = nodeFrontier.pop();
                var pairID = getPairID(pair);

                //See if this node pair has already been added.
                if(addedNodes[pairID]){
                    continue;
                }

                var n1 = pair[0];
                var n2 = pair[1];

                var isAccepting = n1.isAccepting && n2.isAccepting;
                var isInitial = n1.isInitial && n2.isInitial;

                addedNodes[pairID] = unionMachine.addNode(0, 0, "", isInitial, isAccepting);

                alphabet.forEach(function(symbol){
                    //For the pair of nodes, get the state that they will move to for this symbol
                    var m1Target = m1.nodes[n1.getReachableNodes(symbol).nodeIDs[0]];
                    var m2Target = m2.nodes[n2.getReachableNodes(symbol).nodeIDs[0]];
                    //And add it to the frontier
                    var newPair = [m1Target, m2Target];
                    nodeFrontier.push(newPair);
                    //Noting the link that must be created
                    var target = getPairID(newPair);
                    linksToAdd.push({source:pairID, target, symbol});
                });

            }

            //All nodes created, now add the links:
            while(linksToAdd.length > 0){
                var link = linksToAdd.pop();
                var sourceNode = addedNodes[link.source];
                var targetNode = addedNodes[link.target];
                var input = [link.symbol];
                //Test if link exists
                //See if link already exists
                var existingLink = sourceNode.getLinkTo(targetNode);
                if(existingLink !== null){
                    //Link present, combine input symbols
                    existingLink.addInput(input, false);
                } else {
                    //No link present, create it
                    var hasEpsilon = false;
                    var output = {};
                    unionMachine.addLink(sourceNode, targetNode, input, output, hasEpsilon);
                }
            }

            return unionMachine;

        };

        this.reverse = function(){
            for(let nodeID in this.nodes){
                const node = this.nodes[nodeID];
                const isAccepting = node.isInitial;
                const isInitial = node.isAccepting;
                node.isAccepting = isAccepting;
                node.isInitial = isInitial;
            }
            // Create a list of reversed links to be created
            const newLinks = [];
            for(let linkID in this.links){
                //Can't use link.reverse() due to the way that that combines links
                const link = this.links[linkID];
                const source = link.target;
                const target = link.source;
                const input = link.input;
                const output = link.output;
                const hasEpsilon = link.hasEpsilon;
                const newLink = {source, target, input, output, hasEpsilon};
                newLinks.push(newLink);
                this.deleteLink(link); //Delete all links
            }
            //Create new links
            for(let i = 0; i < newLinks.length; i++){
                const link = newLinks[i];
                this.addLink(link.source, link.target, link.input, link.output, link.hasEpsilon);
            }
        };

        this.completelySpecify = function(type){
            //Completely specifies the machine by ensuring that every state has a transition for every symbol
            //Can be done in two ways:
            //For type = "blackhole" all unspecified transitions are sent to an explicit blackhole state
            //For type = "ignore" all unspecifed input is ignored using reflexive links (ie unspecified input does not change machine state)

            if(!["blackhole", "ignore"].includes(type)){
                throw new Error(`Unexpected type: '${type}'' in Model.Machine.completelySpecify.`);
            }

            //Check that action is needed:
            if(this.isCompletelySpecified()){
                return;
            }

            if(type === "blackhole"){
                //Add a new node to be the black-hole state
                var blackholeName = "🚮"; //Try also 🗑
                var blackholeNode = this.addNode(150, 150, blackholeName, false, false);
            }

            var nodes = this.getNodeList();
            var alphabet = this.alphabet;

            //For every node, find the symbols without input
            for(var i = 0; i < nodes.length; i++){
                var node = nodes[i];
                //Test every symbol in the alphabet
                var unspecifiedInput = []; //All symbols that the node does not have a link for.
                for(var j = 0; j < alphabet.length; j++){
                    var symbol = alphabet[j];
                    var reachableNodes = node.getReachableNodes(symbol);
                    if(reachableNodes.nodeIDs.length === 0){
                        unspecifiedInput.push(symbol);
                    }
                }
                if(unspecifiedInput.length > 0){
                    var targetNode = type === "blackhole"? blackholeNode : node; //Add link to either blackhole or current node as needed
                    this.addLink(node, targetNode, unspecifiedInput, undefined, false);
                }
            }


        };

        this.isCompletelySpecified = function(){
            //Returns true if every node has at least one link for every input to every state
            var nodes = this.getNodeList();
            var alphabet = this.alphabet;
            for(var i = 0; i < nodes.length; i++){
                var node = nodes[i];
                //Test every symbol in the alphabet
                for(var j = 0; j < alphabet.length; j++){
                    var symbol = alphabet[j];
                    var reachableNodes = node.getReachableNodes(symbol);
                    if(reachableNodes.nodeIDs.length === 0){
                        return false;
                    }
                }
            }
            return true;
        };

        this.convertToDFA = function(){
            this.enforceAlphabet();
            //Obj of form {"m1-n1+m1-n2":{
                                        // nodes:[Node, Node],
                                        // reachable: {"a":[Node], "b":[Node, Node]},
                                        // name:"{a, b}"}},
                                        // isInitial:true,
                                        // isAccepting: false,
                                        // x: 210,
                                        // y: 10
            //This will be used to construct the new machine
            var nodeSets = {};
            //Track the nodeSets to be investigated. form: [{"m1-n1+m1n2":[Node, Node]}]

            var newNodeSets = [];

            var addToNewNodeSets = function(nodeSet){
                //Takes an array of nodes, and add it to the newNodeSets array
                //Sort the nodeSet, to ensure that each nodeSet has only one ID:
                nodeSet.sort(function(x,y){
                    if(x.id < y.id){
                        return -1;
                    }
                    return 1;
                });
                if(nodeSet.length > 0){
                    var id = nodeSet.map(node => node.id).reduce((x,y)=> `${x}+${y}`);
                    var obj = {id, nodes:nodeSet};
                    newNodeSets.push(obj);
                    return id;
                }

            };

            var nameNodeSet = function(nodeSet){
                //Creates a name for a nodeSet, based on the names of the consitituent nodes
                if(nodeSet.length === 1){
                    return nodeSet[0].name;
                }
                if(nodeSet.filter(node => node.name === "").length > 0){
                    //if any node is unnamed, return ""
                    return "";
                }
                return "{" + nodeSet.map(node=>node.name).reduce((x,y) => `${x}, ${y}`) + "}";
            };

            //Start with the initial nodeSet of the machine
            this.setToInitialState();
            var initialNodeSet = this.getCurrentNodeList();
            addToNewNodeSets(initialNodeSet);
            var firstNodeSet = true;

            //Populate nodeSets, adding to newNodeSets as new reachable combinations are discovered.
            while(newNodeSets.length > 0){
                var nodeSet = newNodeSets.pop();
                if(nodeSets[nodeSet.id]){
                    continue;
                }
                //First nodeSet is inital, all others are not
                if(firstNodeSet){
                    var isInitial = true;
                    firstNodeSet = false;
                } else {
                    isInitial = false;
                }

                this.setToState(nodeSet.nodes);
                var isAccepting = this.isInAcceptingState();
                var reachable = {};
                var name = nameNodeSet(nodeSet.nodes);
                var x = nodeSet.nodes.map(node => node.x).reduce((x1,x2)=> x1 + x2)/nodeSet.nodes.length; //set x to mean value of nodes in set
                var y = nodeSet.nodes.map(node => node.y).reduce((y1,y2)=> y1 + y2)/nodeSet.nodes.length; //set x to mean value of nodes in set
                for(var i = 0; i < this.alphabet.length; i++){
                    var symbol = this.alphabet[i];
                    this.setToState(nodeSet.nodes);
                    this.step(symbol);
                    var reachableNodes = this.getCurrentNodeList();
                    if(reachableNodes.length > 0){
                        var id = addToNewNodeSets(reachableNodes);
                        reachable[symbol] = id;
                    } else {
                        reachable[symbol] = "none";
                    }

                }
                var obj = {nodes:nodeSet.nodes, reachable, name, isInitial, isAccepting, x, y};
                nodeSets[nodeSet.id] = obj;
            }

            //Now, clear the current machine
            this.deleteAllNodes();
            //And recreate from nodeSets, first create nodes for each nodeSet;
            for(let nodeSetID in nodeSets){
                const nodeSet = nodeSets[nodeSetID];
                const newNode = this.addNode(nodeSet.x, nodeSet.y, nodeSet.name, nodeSet.isInitial, nodeSet.isAccepting);
                nodeSet.newNode = newNode;
            }
            //And then create links as needed
            for(let nodeSetID in nodeSets){
                const nodeSet = nodeSets[nodeSetID];
                const sourceNode = nodeSet.newNode;
                for(symbol in nodeSet.reachable){
                    const targetNodeID = nodeSet.reachable[symbol];
                    if(targetNodeID === "none"){
                        continue;
                    }
                    const targetNode = nodeSets[targetNodeID].newNode;
                    const linkExists = sourceNode.hasLinkTo(targetNode);
                    if(linkExists){
                        const link = sourceNode.getLinkTo(targetNode);
                        link.addInput([symbol], false);
                    } else {
                        this.addLink(sourceNode, targetNode, [symbol], undefined, false);
                    }

                }
            }


        };

        this.getLinksTo = function(targetNode){
            //Returns an array containing all links to targetNode
            if (targetNode instanceof Model.Node === false){
                targetNode = this.nodes[targetNode];
            }
            var links = [];
            for(var nodeID in this.nodes){
                var node = this.nodes[nodeID];
                var linkToTarget = node.getLinkTo(targetNode);
                if(linkToTarget !== null){
                    links.push(linkToTarget);
                }
            }
            return links;

        };
    },
    // Constructor for a node object
    Node: function(machine, nodeID, x, y, name, isInitial, isAccepting){
        this.name = name;
        this.machine = machine;
        this.id = nodeID;
        this.isAccepting = isAccepting;
        this.isInitial = isInitial;
        this.outgoingLinks = {};
        this.x = x;
        this.y = y;
        this.selected = false;

        this.toggleSelected = function(){
            this.selected = !this.selected;
        };

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
            //Form {nodeIDs: ["m1-n1"], linkIDS: ["m1-L1"]}
            var keys = Object.keys(this.outgoingLinks);
            var nodeIDs = [];
            var linkIDs = [];
            for(var i = 0; i < keys.length; i++){
                var linkID = keys[i];
                var link = this.outgoingLinks[linkID];
                if(link.input.indexOf(symbol) !== -1){
                    nodeIDs.push(link.target.id);
                    linkIDs.push(linkID);
                }
            }
            return {"nodeIDs": nodeIDs, "linkIDs": linkIDs};
        };
        this.hasLinkTo = function(node){
            if (node instanceof Model.Node === false){
                node = this.machine.nodes[node];
            }
            // Function that returns true iff this node has a direct link to the input node
            for (var linkID in this.outgoingLinks){
                if (this.outgoingLinks[linkID].target.id == node.id){
                    return true;
                }
            }
            return false;
        };
        this.getLinkTo = function(node){
            if (node instanceof Model.Node === false){
                node = this.machine.nodes[node];
            }
            // Function that returns a link from this node to the input node if one exists, or null otherwise
            for (var linkID in this.outgoingLinks){
                if (this.outgoingLinks[linkID].target.id == node.id){
                    return this.outgoingLinks[linkID];
                }
            }
            return null;
        };
        this.getOutgoingLinks = function(){
            //Returns an array of all links starting from this node
            return Object.keys(this.outgoingLinks).map(id => this.outgoingLinks[id]);
        };

    },
    // Constructor for a link object
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

        this.addInput = function(inputList, hasEpsilon){
            //Adds to the existing allowed input
            inputList = inputList.concat(this.input);
            hasEpsilon = this.hasEpsilon || hasEpsilon;
            this.setInput(inputList, hasEpsilon);
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

        this.enforceAlphabet = function(){
            //Remove any inputs prohibited by the machine alphabet.
            var alphabet = this.machine.alphabet;
            var allowEpsilon = this.machine.allowEpsilon;
            this.input = this.input.filter(x => alphabet.indexOf(x) !== -1);
            this.hasEpsilon = this.hasEpsilon && allowEpsilon;
        };

        this.inputIndexOf = function(symbol){
            //Given an input symbol, return the index of that symbol in this.input
            var index = this.input.indexOf(symbol);
            if(index < 0){
                throw new Error(`Symbol:'${symbol}' not found in link ${this.id}`);
            } else {
                return index;
            }
        };

        this.isReflexive = function(){
            return this.source.id === this.target.id;
        };
    },
    //Holds the question logic and the variables that govern the current question.
    question: {
        type: "none",
        splitSymbol:"",
        allowEditing: true,
        setUpQuestion: function(questionObj){
            // Assign properties from the question object to this object
            for(var property in questionObj){
                this[property] = questionObj[property];
            }
            if(["give-list", "select-states", "does-accept", "give-input", "dfa-convert"].indexOf(Model.question.type) == -1){
                this.allowEditing = true;
            } else {
                this.allowEditing = false;
            }
            if(Model.question.type === "give-input"){
                Model.question.currentInput = [];
            }

        },
        checkAnswer: function(input){
            //Input other than the machine only recquired for some question types (but always passed along anyway for simplicity)
            var checkFunctions = {
                "does-accept": this.checkDoesAccept,
                "give-equivalent": this.checkGiveEquivalent,
                "give-input": this.checkGiveInput,
                "give-list": this.checkGiveList,
                "satisfy-definition": this.checkSatisfyDefintion,
                "satisfy-list": this.checkSatisfyList,
                "select-states": this.checkSelectStates
            };
            if(!checkFunctions[this.type]){
                throw new Error(`No check function for type '${this.type}'`);
            }else{
                return checkFunctions[this.type](input);
            }
        },
        checkSatisfyDefintion: function(){
            const machine = Model.machines[0];
            const spec = Model.question.definition;
            const feedbackObj = {allCorrectFlag: false, message: ""};

            //Test number of states.
            const nNodes = machine.getNodeCount();
            if(nNodes !== spec.states.length){
                feedbackObj.message = `Incorrect – the machine should have ${spec.states.length} states but it has ${nNodes} states.`;
                return feedbackObj;
            }

            //Test that each state name is present.
            const nodes = machine.getNodeList();
            const nodeNames = nodes.map(node => node.name);
            const missingNodeNames = spec.states.filter(name => !nodeNames.includes(name));
            if(missingNodeNames.length > 0){
                feedbackObj.message = `Incorrect – the machine should have a state named ‘${missingNodeNames[0]}’.`;
                return feedbackObj;
            }

            //Test that there are the correct number of accepting states;
            const acceptingStates = nodes.filter(node => node.isAccepting).map(node => node.name);
            if(acceptingStates.length !== spec.acceptingStates.length){
                feedbackObj.message = `Incorrect – the machine should have ${spec.acceptingStates.length} accepting states but it has ${acceptingStates.length} accepting states.`;
                return feedbackObj;
            }

            //Test that the accepting states are correct;
            const missingAcceptingNodeNames = spec.acceptingStates.filter(name => !acceptingStates.includes(name));
            if(missingAcceptingNodeNames.length > 0){
                feedbackObj.message = `Incorrect – state ‘${missingAcceptingNodeNames[0]}’ should be an accepting state.`;
                return feedbackObj;
            }

            //Test that there are the correct number of initial states;
            const initialStates = nodes.filter(node => node.isInitial).map(node => node.name);
            if(initialStates.length !== spec.initialStates.length){
                feedbackObj.message = `Incorrect – the machine should have ${spec.initialStates.length} initial states but it has ${initialStates.length} initial states.`;
                return feedbackObj;
            }

            //Test that the initial states are correct;
            const missingInitialStateNames = spec.initialStates.filter(name => !initialStates.includes(name));
            if(missingInitialStateNames.length > 0){
                feedbackObj.message = `Incorrect – state ‘${missingInitialStateNames[0]}’ should be an initial state.`;
                return feedbackObj;
            }

            //Create a dictionary mapping names to nodes
            const nodeDict = {};
            nodes.forEach(function(node){
                nodeDict[node.name] = node;
            });

            //Test that all links that should be there are present
            for(let i = 0; i < spec.links.length; i++){
                const link = spec.links[i];
                const sourceNode = nodeDict[link.from];
                const targetNode = nodeDict[link.to];
                const reachableNodes = sourceNode.getReachableNodes(link.symbol).nodeIDs.map(nodeID => machine.nodes[nodeID]);
                if(!reachableNodes.includes(targetNode)){
                    feedbackObj.message = `Incorrect – there should be a link from state ‘${link.from}’ to ‘${link.to}’ for ‘${link.symbol}’.`;
                    return feedbackObj;
                }
            }

            const links = spec.links;
            //Test that all links that are present should be there
            for(const linkID in machine.links){
                const link = machine.links[linkID];
                const from = link.source.name;
                const to = link.target.name;
                for(let i = 0; i < link.input.length; i++){
                    const symbol = link.input[i];
                    let found = false;
                    for(let j = 0; j < links.length && !found; j++){
                        const specLink = links[j];
                        if(to === specLink.to && from === specLink.from && symbol == specLink.symbol){
                            found = true;
                        }
                    }
                    if(!found){
                        feedbackObj.message = `Incorrect – there should not be a link from state ‘${from}’ to ‘${to}’ for ‘${symbol}’.`;
                        return feedbackObj;
                    }
                }
            }

            feedbackObj.allCorrectFlag = true;
            return feedbackObj;



        },
        checkDoesAccept: function(input){
            var machine = Model.machines[0];
            var sequences = Model.question.sequences.map(str => Model.parseInput(str));
            var feedbackObj = {allCorrectFlag: true, isCorrectList: Array(sequences.length).fill(true)};
            for(var i = 0; i< sequences.length; i++){
                var answer = input[i];
                var doesAccept = machine.accepts(sequences[i]);
                if(answer !== doesAccept){
                    feedbackObj.allCorrectFlag = false;
                    feedbackObj.isCorrectList[i] = false;
                }
            }
            return feedbackObj;
        },
        checkGiveEquivalent: function(){
            //setup target machine if it does not exist already
            if(!Model.question.targetMachine){
                Model.question.targetMachine = new Model.Machine("tgt");
                Model.question.targetMachine.build(Model.question.targetMachineSpec);
            }
            const targetMachine = Model.question.targetMachine;
            const inputMachine = Model.machines[0];
            const feedbackObj = {allCorrectFlag: false, message:"", incorrectSequence:undefined, shouldAcceptIncorrect: undefined};
            //Catch invalid machines here
            if(inputMachine.getAcceptingNodeCount() === 0){
                feedbackObj.message = "Machine must have an accepting state.";
                return feedbackObj;
            }
            if(inputMachine.getInitialNodeCount() === 0){
                feedbackObj.message = "Machine must have an initial state.";
                return feedbackObj;
            }
            if(Model.machines[0].isEquivalentTo(targetMachine)){
                feedbackObj.allCorrectFlag = true;
                return feedbackObj;
            }
            //We now know the machine is incorrect, we now must construct an error message

            const inputComplement = new Model.Machine("m1c");
            inputComplement.build(inputMachine.getSpec());
            inputComplement.complement();

            //This machine accepts sequences that the input machine rejects but the target machine accepts:
            const unionInputComplementWithTarget = inputComplement.getUnionWith(targetMachine);

            let incorrectSequence = unionInputComplementWithTarget.getAcceptedSequence();
            if(incorrectSequence !== null){
                let printableSequence = incorrectSequence.reduce((x,y) => x + Model.question.splitSymbol + y, "");
                if(incorrectSequence.length > 0){
                    feedbackObj.message = `Incorrect – the machine should accept ‘${printableSequence}’`;
                } else {
                    feedbackObj.message = `Incorrect – the machine should accept the empty string`;
                }
                feedbackObj.incorrectSequence = incorrectSequence;
                feedbackObj.shouldAcceptIncorrect = true;
                return feedbackObj;
            }

            const targetComplement = new Model.Machine("t1c");
            targetComplement.build(targetMachine.getSpec());
            targetComplement.complement();

            //This machine accepts sequences that the input machine accepts but the target machine rejects:
            const unionInputWithTargetComplement = inputMachine.getUnionWith(targetComplement);

            incorrectSequence = unionInputWithTargetComplement.getAcceptedSequence();
            if(incorrectSequence !== null){
                let printableSequence = incorrectSequence.reduce((x,y) => x + Model.question.splitSymbol + y, "");
                if(incorrectSequence.length > 0){
                    feedbackObj.message = `Incorrect – the machine should reject ‘${printableSequence}’`;
                } else {
                    feedbackObj.message = `Incorrect – the machine should reject the empty string`;
                }
                feedbackObj.incorrectSequence = incorrectSequence;
                feedbackObj.shouldAcceptIncorrect = false;
            }

            return feedbackObj;
        },
        checkGiveInput: function(){
            var feedbackObj = {allCorrectFlag: false};
            if (Model.question.target === "none"){
                return feedbackObj;
            }
            if (Model.question.target === "accept"){
                feedbackObj.allCorrectFlag = Model.machines.filter(m => m.isInAcceptingState()).length === Model.machines.length; //All machines should be in an accepting state.
                return feedbackObj;
            }
        },
        checkGiveList: function(input){
            // Input received as list of strings.
            var machine = Model.machines[0];

            var allCorrectFlag = true;
            var messages = new Array(Model.question.lengths.length).fill(""); // feedback messages to show the user for each question
            var isCorrectList = new Array(Model.question.lengths.length).fill(true); // Tracks whether each answer is correct
            var seen = []; //Use to catch duplicates. Not an efficient algorithm but the dataset is tiny.

            input.forEach(function(string, index){
                var sequence = Model.parseInput(string);
                var thisLength = sequence.length;
                var expectedLength = Model.question.lengths[index];
                if (thisLength !== expectedLength){
                    allCorrectFlag = false;
                    isCorrectList[index] = false;
                    messages[index] = `Incorrect length – expected ${expectedLength} but got ${thisLength}.`;
                    return;
                }
                // Correct length – check if duplicate
                if(seen.indexOf(string)!== -1){
                    allCorrectFlag = false;
                    isCorrectList[index] = false;
                    messages[index] = `Incorrect – duplicate entry.`;
                    return;
                }
                seen.push(string);

                //Not duplicate – check if all symbols are in the machine's alphabet
                var nonAlphabetSymbols = sequence.filter(x => machine.alphabet.indexOf(x) === -1);
                if(nonAlphabetSymbols.length > 0){
                    allCorrectFlag = false;
                    isCorrectList[index] = false;
                    messages[index] = `Incorrect – '${nonAlphabetSymbols[0]}' is not in the machine's alphabet.`;
                    return;
                }

                //Sequence is within alphabet – check if the machine accepts it
                if (!machine.accepts(sequence)){
                    allCorrectFlag = false;
                    isCorrectList[index] = false;
                    messages[index] = "Incorrect – not accepted by machine.";
                    return;
                }
            });

            return {input, messages, allCorrectFlag, isCorrectList};
        },
        checkSatisfyList: function(){
            const machine = Model.machines[0];
            const feedbackObj = {allCorrectFlag: true, acceptList:[], rejectList:[]};
            const splitSymbol = Model.question.splitSymbol;
            const acceptList = Model.question.shouldAccept;
            const rejectList = Model.question.shouldReject;

            //Check the acceptList
            for(let i = 0; i < acceptList.length; i++){
                //Split the input into individual tokens based on the split symbol.
                const input = acceptList[i].split(splitSymbol).map(y => y.replace(/ /g,"")).filter(z => z.length > 0);
                if(machine.accepts(input)){
                    feedbackObj.acceptList[i] = true;
                } else {
                    feedbackObj.acceptList[i] = false;
                    feedbackObj.allCorrectFlag = false;
                }
            }

            for(let i = 0; i < rejectList.length; i++){
                const input = rejectList[i].split(splitSymbol).map(y => y.replace(/ /g,"")).filter(z => z.length > 0);
                if(!machine.accepts(input)){
                    feedbackObj.rejectList[i] = true;
                } else {
                    feedbackObj.rejectList[i] = false;
                    feedbackObj.allCorrectFlag = false;
                }
            }

            return feedbackObj;
        },
        checkSelectStates: function(){
            var machine = Model.machines[0];
            var selectedNodes = machine.getNodeList().filter(node => node.selected);

            //Determine the nodes that should be collected.
            var initialInput = Model.question.initialSequence;
            var subsequentInput = Model.question.targetSequence;

            var completeSequence = initialInput.concat(subsequentInput);
            machine.setToInitialState();
            machine.accepts(completeSequence);
            var targetNodes = machine.getCurrentNodeList();

            var feedbackObj = {allCorrectFlag: false, initialInput, subsequentInput};

            //Determine if target nodes are the same as selected nodes
            if(targetNodes.length !== selectedNodes.length){
                return feedbackObj;
            }
            if(targetNodes.filter(node => selectedNodes.includes(node)).length !== targetNodes.length){
                return feedbackObj;
            }

            feedbackObj.allCorrectFlag = true;
            return feedbackObj;

        }
    }
};


// For use by node during testing - set Model as the export if module is defined.
if (typeof module !== "undefined"){
    module.exports = Model;
}

/*global module*/
