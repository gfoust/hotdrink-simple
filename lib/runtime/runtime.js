/*********************************************************************
 * The runtime is responsible for managing the graph by keeping
 * track of changes and scheduling updates.
 */
m4_module
m4_import(utility.setInsert,
          model.Model,
          runtime.solve,
          runtime.Evaluator)
m4_export(Runtime,
          Global,
          makeGlobalModel);

var max_priority= 1;

function Runtime() {
  this.updateTask= null;
  this.evaluator= new Evaluator();
  this.changedVariables= [];
  this.unenforcedConstraints= [];
}


// The evaluator needs to know which variables have changed
// so that it can execute downstream constraints
m4_member(Runtime, varChanged)
function varChanged( vv ) {
  // Remember for next evaluation
  setInsert( this.changedVariables, vv );
  this.scheduleUpdate();
}


// If a variable is touched we should tell the solver to
// try to enforce its stay constraint
m4_member(Runtime, varTouched)
function varTouched( vv ) {
  if (vv.determinedBy !== vv.stayCc) {
    setInsert( this.unenforcedConstraints, vv.stayCc );
    this.scheduleUpdate();
  }
}


/*--------------------------------------------------------------------
 * These methods all involve adding new model objects to the runtime.
 */

m4_member(Runtime, addVariable)
function addVariable( vv ) {
  if (vv.runtime === this) {
    return;
  }
  vv.runtime= this;
  this.varChanged( vv );
}


m4_member(Runtime, addConstraint)
function addConstraint( cc ) {
  if (cc.runtime === this) {
    return;
  }
  cc.runtime= this;
  cc.variables.forEach( this.addVariable, this );
  if (cc.methods.length > 0) {
    this.unenforcedConstraints.push( cc );
    this.scheduleUpdate();
  }
}


m4_member(Runtime, addMethod)
function addMethod( cc, mm ) {
  this.addConstraint( cc );
  setInsert( this.unenforcedConstraints, cc );
  this.scheduleUpdate();
}

/*--------------------------------------------------------------------
 * Performing an update involves solving and evaluating
 */

m4_member(Runtime, scheduleUpdate)
function scheduleUpdate() {
  if (this.updateTask === null) {
    this.updateTask= setTimeout( this.update.bind( this ), 0 );
  }
}


m4_member(Runtime, update)
function update() {
  if (this.updateTask) {
    clearTimeout( this.updateTask );
  }
  this.updateTask= 1; // we shouldn't initiate a new updateTask
                      // while this is running

  var changedConstraints= solve( this.unenforcedConstraints );

  this.evaluator.evaluate( this.changedVariables, changedConstraints );

  // Reset for next time
  this.updateTask= null;
  this.changedVariables= [];
  this.unenforcedConstraints= [];
}

/*====================================================================
 * There is one global runtime.
 */

var Global= new Runtime();

function makeGlobalModel( vardefs ) {
  var md= new Model( vardefs );
  return md;
}