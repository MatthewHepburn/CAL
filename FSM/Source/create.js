const create = {
    setup: function() {
        // Setup the creation environment.
        create.registerTraceButtonListener();
        create.registerAlphabetButtonListener();
        create.registerDFAbuttonListener();
        create.registerReverseButtonListener();
        create.registerMinimalDFAButtonListener();
    },
    registerTraceButtonListener:function(){
        d3.select("#traceform-button")
            .on("click", function(){
                const machine = Model.machines[0];
                //Try to guess a split symbol
                let splitSymbol = "";
                if(machine.alphabet.filter(x => x.length > 1).length > 0){ //True if the alphabet contains a symbol longer than 1 char.
                    splitSymbol = " ";
                }
                const input = Model.parseInput(document.querySelector("#traceform").value, splitSymbol);

                Controller.startTrace(machine, input);
            });
    },
    registerAlphabetButtonListener:function(){
        d3.select("#setalphabet-button")
            .on("click", function(){
                this.blur();
                const alphabet = document.querySelector("#setalphabet").value;
                create.setalphabet(alphabet);
            });
    },
    registerDFAbuttonListener: function(){
        d3.select("#dfa-button").on("click", function(){
            this.blur();
            const machine = Model.machines[0];
            Controller.convertToDFA(machine);
        });
    },
    registerReverseButtonListener: function(){
        d3.select("#reverse-button").on("click", function(){
            this.blur();
            const machine = Model.machines[0];
            Controller.reverseMachine(machine);
        });
    },
    registerMinimalDFAButtonListener: function(){
        d3.select("#minimal-dfa-button").on("click", function(){
            this.blur();
            const machine = Model.machines[0];
            Controller.minimize(machine);
        });
    },
    setalphabet: function(string){
        try{
            const alphabet = JSON.parse(string);
            document.querySelector("#alphabeterror").innerHTML = "";
            if(alphabet.constructor !== Array){
                throw new Error("alphabet must be an array.");
            }
            Controller.setAlphabet(Model.machines[0], alphabet);
        }
        catch(e){
            document.querySelector("#alphabeterror").innerHTML = 'Parse error - enter alphabet in form ["a", "b"]';
        }

    }
};

// Start create mode here
create.setup();

//Declare global variables for ESlint
/*global d3*/
/*global Model*/
/*global Controller*/