/*********************************************************************
 * Constraint System
 */
m4_module
m4_import(utility.noop,
          utility.isNotType,
          utility.Observer,
          utility.Digraph,
          utility.PromiseLadder,
          model.StayConstraint,
          model.stayId,
          model.DATA,
          runtime.Solver,
          runtime.MethodStream)
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

  // Constraints which should try to be enforced in next solving
  this.unenforcedConstraints= {};

  // Variables whose value has changed since last evaluation
  this.changedVariables= {};

  // For scheduling an update
  this.updateTask= null;

  this.promiseLadders= {};

DEBUG_BEGIN
  // For debug purposes - count generations so we can tell them apart
  this.generation= 0;
DEBUG_END
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
 * Add variable to constraint system.  Creates a stay constraint for
 * it, and subscribes to value/priority changes.
 */
m4_member(ConstraintSystem, addVariable)
function addVariable( vv ) {
  if (vv in this.baseNodes) { return; }
  this.baseNodes[vv]= vv;

  var scc= new StayConstraint( vv );
  var smm= scc.methods[0];

  this.extendedNodes[scc]= scc;
  this.extendedNodes[smm]= smm;

  // We need the variable in the sgraph, but not the method
  // (Method will get added when it solves)
  this.sgraph.addNode( vv );
  this.sgraph.selected[scc]= null;

  vv.value.addSubscriber( this, this.onValueNext, noop, noop );
  vv.priority.addSubscriber( this, this.onPriorityNext, noop, noop );
  return this;
}

/*--------------------------------------------------------------------
 * Add constraint to constraint system.  Adds all its variables and
 * methods.  Also schedules it to be enforced.
 */
m4_member(ConstraintSystem, addConstraint)
function addConstraint( cc ) {
  if (cc in this.baseNodes) { return; }
  this.baseNodes[cc]= cc;

  cc.variables.forEach( this.addVariable, this );
  cc.methods.forEach( this.addMethod, this );

  this.sgraph.selected[cc]= null;
  this.unenforcedConstraints[cc]= true;
  LOG(SYS, 'scheduling update because of new constraint')
  this.scheduleUpdate();
  return this;
}

/*--------------------------------------------------------------------
 */
m4_member(ConstraintSystem, addMethod)
function addMethod( mm ) {
  if (mm in this.baseNodes) { return; }
  this.baseNodes[mm]= mm;

  return this;
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
m4_member(ConstraintSystem, onValueNext)
function onNext( value, vv ) {
  this.changedVariables[vv]= true;
  if (this.sgraph.outs( vv ).length > 0) {
    LOG(SYS, 'scheduling update because of new value')
    this.scheduleUpdate();
  }
}

// priority changed
m4_member(ConstraintSystem, onPriorityNext)
function onPriorityNext( priority, vv ) {
  var sid= stayId( vv );
  this.extendedNodes[sid].strength= priority;
  if (this.sgraph.selected[sid] === null) {
    this.unenforcedConstraints[sid]= true;
    LOG(SYS, 'scheduling update because of new priority')
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
  LOG(SYS, 'update')
  if (this.updateTask) {
    clearTimeout( this.updateTask );
    this.updateTask= null;
  }

DEBUG_BEGIN
  ++this.generation;
DEBUG_END

  // Dump the sets into arrays
  var unenforcedConstraints=
    Object.keys( this.unenforcedConstraints ).map( this.lookupNode, this );
  this.unenforcedConstraints= {};

  var changedVariables=
    Object.keys( this.changedVariables ).map( this.lookupNode, this );
  this.changedVariables= {};

  this.makeSource( changedVariables );

  // Solve
  var changedMethods= (unenforcedConstraints.length > 0)
    ? this.solve( unenforcedConstraints ) : [];

  // Evaluate
  this.evaluate( changedMethods, changedVariables );
}

/*--------------------------------------------------------------------
 */
m4_member(ConstraintSystem, makeSource)
function makeSource( changedVariables ) {
  changedVariables.forEach( function( vv ) {
    vv.pending.set( false, this );
    var ladder= this.promiseLadders[vv];
    if (ladder) {
      ladder.clear();
    }
  }, this );
}

/*--------------------------------------------------------------------
 * Use solver to solve constraint system
 */
m4_member(ConstraintSystem, solve)
function solve( unenforcedConstraints ) {
  LOG(SYS, 'solve')
  var solver= new Solver( this.sgraph );
  solver.solve( unenforcedConstraints );

  var changedMethods= [];
  for (var key in solver.changes) {
    var cc= solver.changes[key].cc;
    var oldmm= solver.changes[key].mm;
    var newmm= this.sgraph.selected[cc];

    if (cc instanceof StayConstraint) {
      cc.variables[0].source.set( this.sgraph.selected[cc] !== null, this );
    }
    else if (newmm) {
      changedMethods.push( newmm );
    }
  }
  return changedMethods;
}

/*--------------------------------------------------------------------
 * Create and kick-off runs for each method that needs to be udpated
 */
m4_member(ConstraintSystem, evaluate)
function evaluate( changedMethods, changedVariables ) {
  LOG(SYS, 'evaluate')
  var evaluateMethods= this.sgraph.walker()
    .nodesDownstreamSameType( changedMethods )
    .nodesDownstreamOtherType( changedVariables )
    .result();

  var streams= evaluateMethods.map( function( mm ) {
    return new MethodStream( this, mm );
  }, this );

  streams.forEach( prepareOutputs );
  streams.forEach( prepareInputs );
  streams.forEach( run );
}

function prepareOutputs( s ) { s.prepareOutputs(); }
function prepareInputs( s )  { s.prepareInputs();  }
function run( s )            { s.run();            }

/*--------------------------------------------------------------------
 */
m4_member(ConstraintSystem, addPromise)
function addPromise( vv, promise ) {
  var ladder= this.promiseLadders[vv];
  if (! ladder) {
    this.promiseLadders[vv]= ladder= new PromiseLadder( this, vv );
    ladder.addSubscriber( this, this.onLadderNext, noop, noop );
  }
  ladder.add( promise );
  if (! vv.pending.get()) {
    vv.pending.set( true, this );
  }
}

/*--------------------------------------------------------------------
 */
m4_member(ConstraintSystem, onLadderNext)
function onLadderNext( value, ladder ) {
  var vv= ladder.target;
  vv.set( value, this );
  if (ladder.currentPromise() === undefined) {
    vv.pending.set( false, this );
  }
}

/*--------------------------------------------------------------------
 */
m4_member(ConstraintSystem, getPromise)
function getPromise( vv ) {
  var ladder= this.promiseLadders[vv];
  if (ladder) {
    return ladder.currentPromise();
  }
  else {
    return undefined;
  }
}