/*********************************************************************
 * The Evaluator evalutates the solution graph--but it does so
 * incrementally, only executing methods whose inputs have changed.
 *
 * Evaluation begins with the variables and constraints which we know
 * have changed and proceeds both upstream and downstream.  Upstream
 * evaluation is performed synchronously by calling either updateVar
 * or updateCon.  Evaluation dowstream is performed asynchronous by
 * adding a constraint to the scheduledCons worklist.
 */
m4_module
m4_import(utility.noop,
          utility.setDiff,
          utility.setInsert,
          model.StayConstraint)
m4_export(Evaluator)

function Evaluator() {
  this.changed= {};
  this.visited= {};
  this.scheduledCons= [];
  this.executingConstraint= null;
}


m4_method(Evaluator, varChanged)
function varChanged( vv ) {
  this.changed[vv]= true;
}


m4_method(Evaluator, conChanged)
function conChanged( cc ) {
  this.changed[cc]= true;
}


m4_method(Evaluator, varAccessed)
function varAccessed( vv ) {
  if (this.executingConstraint !== null) {
    setInsert( vv.usedBy, this.executingConstraint );
  }
}


m4_method(Evaluator, evaluate)
function evaluate( changedVars, changedCons ) {
  changedVars.forEach( this.varChanged, this );
  changedCons.forEach( this.conChanged, this );

  // Initialize the worklist
  Array.prototype.push.apply( this.scheduledCons, changedCons );

  changedVars.forEach( this.updateVar, this );

  while (this.scheduledCons.length > 0) {
    var cc= this.scheduledCons.pop()
    this.updateCon( cc );
  }
}


m4_method(Evaluator, updateVar)
function updateVar( vv ) {
  if (this.visited[vv]) return;
  this.visited[vv]= true;

  this.updateCon( vv.determinedBy );

  if (this.changed[vv]) {
    vv.usedBy.forEach( function( cc ) {
      if (!this.visited[cc]) {
        this.scheduledCons.push( cc );
      }
    }, this );
  }
}


m4_method(Evaluator, updateCon)
function updateCon( cc ) {
  if (this.visited[cc]) return;
  this.visited[cc]= true;

  if (cc instanceof StayConstraint || cc.selectedMethod === null) return;

  // Update all input variables
  var outputs= cc.selectedMethod.outputs;
  cc.variables.forEach( function( vv ) {
    if (outputs.indexOf( vv ) == -1) {
      this.updateVar( vv );
    }
  }, this );

  // Check for changes
  var needsExecution= false;
  if (this.changed[cc]) {
    needsExecution= true;
  }
  else {
    var indexes= [];
    var numvars= cc.variables.length;
    // See if any variables used by this method have changed
    for (var i= 0; i < numvars; ++i) {
      var vv= cc.variables[i];
      indexes[i]= vv.usedBy.indexOf( cc );
      if (indexes[i] != -1 && this.changed[vv]) {
        needsExecution= true;
      }
    }
    if (needsExecution) {
      // Remove the "usedBy" references--they'll be reset by execution
      for (var i= 0; i < numvars; ++i) {
        if (indexes[i] != -1) {
          cc.variables[i].usedBy.splice( indexes[i], 1 );
        }
      }
    }
  }

  // Execute method
  if (needsExecution) {
    this.executingConstraint= cc;
    cc.selectedMethod.invoke();
    this.executingConstraint= null;

    // Update all output variables
    outputs.forEach( function( vv ) {
      if (this.changed[vv] ) {
        this.updateVar( vv );
      }
    }, this );
  }
}