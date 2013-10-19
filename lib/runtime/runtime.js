/*********************************************************************
 * The runtime is responsible for managing the graph by keeping
 * track of changes and scheduling updates.
 */
m4_module
m4_import(utility.setInsert,
          model.Model,
          runtime.Solver,
          runtime.Evaluator)
m4_export(Runtime,
          Global,
          makeGlobalModel);

var max_priority= 1;

function Runtime() {
  this.updateTask= null;
  this.solver= null;
  this.evaluator= null;
  this.changedVariables= [];
  this.unenforcedConstraints= [];
}


// The evaluator needs to know which variables have changed
// so that it can execute downstream constraints
m4_method(Runtime, varChanged)
function varChanged( vv ) {
  if (this.evaluator) {
    // An evaluation is in process
    this.evaluator.varChanged( vv );
  }
  else {
    // Remember for next evaluation
    setInsert( this.changedVariables, vv );
  }
  this.scheduleUpdate();
}


// If a variable is touched we should tell the solver to
// try to enforce its stay constraint
m4_method(Runtime, varTouched)
function varTouched( vv ) {
  if (vv.determinedBy !== vv.stayCc) {
    setInsert( this.unenforcedConstraints, vv.stayCc );
    this.scheduleUpdate();
  }
}


// If a variable is accessed during evaluation the evaluator
// needs to know so that it can add a link to the evaluation graph
m4_method(Runtime, varAccessed)
function varAccessed( vv ) {
  if (this.evaluator) {
    this.evaluator.varAccessed( vv );
  }
}

/*--------------------------------------------------------------------
 * These methods all involve adding new model objects to the runtime.
 */

m4_method(Runtime, addVariable)
function addVariable( vv ) {
  if (vv.runtime === this) {
    return;
  }
  vv.runtime= this;
  this.varChanged( vv );
}


m4_method(Runtime, addConstraint)
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


m4_method(Runtime, addMethod)
function addMethod( cc, mm ) {
  this.addConstraint( cc );
  setInsert( this.unenforcedConstraints, cc );
  this.scheduleUpdate();
}

/*--------------------------------------------------------------------
 * Performing an update involves solving and evaluating
 */

m4_method(Runtime, scheduleUpdate)
function scheduleUpdate() {
  if (this.updateTask === null) {
    this.updateTask= setTimeout( this.update.bind( this ), 0 );
  }
}


m4_method(Runtime, update)
function update() {
  if (this.updateTask) {
    clearTimeout( this.updateTask );
  }
  this.updateTask= 1; // we shouldn't initiate a new updateTask
                      // while this is running

  this.solver= new Solver();
  this.solver.solve( this.unenforcedConstraints );

  this.evaluator= new Evaluator();
  this.evaluator.evaluate( this.changedVariables,
                           this.solver.changedConstraints() );

  // Reset for next time
  this.solver= null;
  this.evaluator= null;
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
  md.setRuntime( Global );
  return md;
}