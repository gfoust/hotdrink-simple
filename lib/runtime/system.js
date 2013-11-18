/*********************************************************************
 * Constraint System
 */
m4_module
m4_import(utility.isNotType,
          utility.Observer,
          utility.Digraph,
          model.StayConstraint,
          model.stayId,
          model.DATA,
          runtime.Solver,
          runtime.MethodRun)
m4_export(ConstraintSystem)

/*====================================================================
 * A constraint system contains the "runtime" logic for a constraint
 * system:  it monitors variables for changes, then solves the
 * constraints and schedules methods to be executed.
 */

function ConstraintSystem() {
  // Collection of all variables/constraints/methods in the system
  this.baseNodes= {};

  // Extended with any nodes added just for this system (e.g. stay constraints)
  this.extendedNodes= Object.create( this.baseNodes );

  // Solution graph
  this.sgraph= new Digraph( this.extendedNodes );
  this.sgraph.selected= {};

  // Evaluation graph
  this.egraph= this.sgraph.shadow();

  // Constraints which should try to be enforced in next solving
  this.unenforcedConstraints= {};

  // Variables whose value has changed since last evaluation
  this.changedVariables= {};

  // Variable observers
  this.valueWatcher= new Observer( this.onNextValue.bind( this ) );
  this.priorityWatcher= new Observer( this.onNextPriority.bind( this ) );

  // For scheduling an update
  this.updateTask= null;

  // For tracking evaluation
  this.generation= 0;
}

/*--------------------------------------------------------------------
 * Add variable to constraint system.  Creates a stay constraint for
 * it, and subscribes to value/priority changes.
 */
m4_member(ConstraintSystem, addVariable)
function addVariable( vv ) {
  if (vv.id in this.baseNodes) { return; }
  this.baseNodes[vv.id]= vv;

  var scc= new StayConstraint( vv );
  var smm= scc.methods[0];

  this.extendedNodes[scc]= scc;
  this.extendedNodes[smm]= smm;

  // We need the variable in the sgraph, but not the method
  // (Method will get added when it solves)
  this.sgraph.addNode( vv );
  this.sgraph.selected[scc]= null;

  vv.value.subscribe( this.valueWatcher );
  vv.priority.subscribe( this.priorityWatcher );
  return this;
}

/*--------------------------------------------------------------------
 * Add constraint to constraint system.  Adds all its variables and
 * methods.  Also schedules it to be enforced.
 */
m4_member(ConstraintSystem, addConstraint)
function addConstraint( cc ) {
  if (cc.id in this.baseNodes) { return; }
  this.baseNodes[cc.id]= cc;

  cc.variables.forEach( this.addVariable, this );

  cc.methods.forEach( function( mm ) {
    this.baseNodes[mm.id]= mm;
  }, this );

  this.sgraph.selected[cc.id]= null;
  this.unenforcedConstraints[cc.id]= true;
  this.scheduleUpdate();
  return this;
}

/*--------------------------------------------------------------------
 * Add a model to constraint system.  Simply recursively adds all of
 * its variables, constraints, and sub-models.
 */
m4_member(ConstraintSystem, addModel)
function addModel( model ) {
  model[DATA].variables.forEach( this.addVariable, this );
  model[DATA].constraints.forEach( this.addConstraint, this );
  model[DATA].models.forEach( this.addModel, this );
}

/*--------------------------------------------------------------------
 * Lookup the node for an id
 */
m4_member(ConstraintSystem, lookupNode)
function lookupNode( id ) {
  return this.extendedNodes[id];
}

/*--------------------------------------------------------------------
 * Observer - watches for variable changes
 */

// value changed
m4_member(ConstraintSystem, onNextValue)
function onNextValue( value, vv ) {
  this.changedVariables[vv]= true;
  if (this.egraph.outs( vv ).length > 0) {
    this.scheduleUpdate();
  }
}

// priority changed
m4_member(ConstraintSystem, onNextPriority)
function onNextPriority( priority, vv ) {
  var sid= stayId( vv );
  this.extendedNodes[sid].strength= priority;
  if (this.sgraph.selected[sid] === null) {
    this.unenforcedConstraints[sid]= true;
    this.scheduleUpdate();
  }
}

/*--------------------------------------------------------------------
 * Update
 */

// Allows multiple changes to result in only a single update
m4_member(ConstraintSystem, scheduleUpdate)
function scheduleUpdate() {
  if (this.updateTask === null) {
    this.updateTask= setTimeout( this.update.bind( this ), 0 );
  }
}

// Perform actual update
m4_member(ConstraintSystem, update)
function update() {
  if (this.updateTask) {
    clearTimeout( this.updateTask );
    this.updateTask= null;
  }

  ++this.generation;

  // Dump the sets into arrays
  var unenforcedConstraints=
    Object.keys( this.unenforcedConstraints ).map( this.lookupNode, this );
  this.unenforcedConstraints= {};

  var changedVariables=
    Object.keys( this.changedVariables ).map( this.lookupNode, this );
  this.changedVariables= {};

  // Solve
  var changedMethods= (unenforcedConstraints.length > 0)
    ? this.solve( unenforcedConstraints ) : [];

  // Plan
  this.plan( changedMethods, changedVariables );
}

/*--------------------------------------------------------------------
 * Use solver to solve constraint system
 */
m4_member(ConstraintSystem, solve)
function solve( unenforcedConstraints ) {
  var solver= new Solver( this.sgraph );
  solver.solve( unenforcedConstraints );

  var changedMethods= [];
  for (var key in solver.changes) {
    var cc= solver.changes[key].cc;
    var oldmm= solver.changes[key].mm;
    var newmm= this.sgraph.selected[cc];

    if (oldmm) {
      this.egraph.resetNode( oldmm );
    }
    if (newmm) {
      changedMethods.push( newmm );
    }
  }
  return changedMethods.filter( function( mm ) {
    return ! (mm.constraint instanceof StayConstraint);
  } );
}

/*--------------------------------------------------------------------
 * Create and kick-off runs for each method that needs to be udpated
 */
m4_member(ConstraintSystem, plan)
function plan( changedMethods, changedVariables ) {
  var scheduledMethods= this.sgraph.walker()
    .nodesDownstreamSameType( changedMethods )
    .nodesDownstreamOtherType( changedVariables )
    .result();

  var runs= scheduledMethods.map( function( mm ) {
    return new MethodRun( this, mm );
  }, this );

  runs.forEach( function (r) { r.prepareOutputs(); } );
  runs.forEach( function (r) { r.prepareInputs();  } );
  runs.forEach( function (r) { r.start();          } );
}
