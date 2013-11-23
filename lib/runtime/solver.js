/*********************************************************************
 * Solver (QuickPlan)
 */
m4_module
m4_import(utility.setDiff,
          model.Constraint,
          model.stayId)
m4_export(Solver)

// Some simple helper functions...

/*====================================================================
 */
function SingleCcSolver( sgraph, ccToEnforce ) {
  // The solution graph we're working on
  this.sgraph= sgraph;

  // The constraint we want to enforce
  this.ccToEnforce= ccToEnforce;

  // The strongest constraint we've retracted so far
  this.strongestRetracted= Constraint.WeakestStrength;

  // Any variables we have made undetermined
  this.undeterminedVars= {};

  // Any changes we have made to the sgraph
  this.changeStack= [];

  // We're only considering upstream constraints
  var upstreamMethods=
    sgraph.nodesUpstreamOtherType( ccToEnforce.variables );

  var upstreamConstraints= upstreamMethods
    .map( function( mm ) { return mm.constraint; } );

  // List of constraints eligible for retraction
  this.retractableConstraints= upstreamConstraints
    .reduce( collectWeakerThan.bind( null, ccToEnforce.strength ), [] );

  upstreamConstraints.push( ccToEnforce );

  // Make a constraint graph for the constraints
  this.cgraph= upstreamConstraints
    .reduce( copyIntoCGraph, sgraph.newGraph() );

  // Count of how many constraints each variable has in the graph
  this.numConstraints= upstreamConstraints
    .reduce( countPerVar, {} );

  // List of free variables
  this.freeVars= Object.keys( this.numConstraints )
    .filter( hasValueOfOne, this.numConstraints )
    .map( sgraph.lookupNode, sgraph );
}

// Copy constraint and all its variables into cgraph
function copyIntoCGraph( cgraph, cc ) {
  cgraph.addNode( cc );
  cc.variables.forEach( function( vv ) {
    cgraph.addNode( vv );
    cgraph.addEdge( cc, vv );
  } );
  return cgraph;
}

// Insert constraint into list only if it's weaker than ccToEnforce
function collectWeakerThan( maxStrength, ccs, cc ) {
  if (cc.strength < maxStrength) {
    ccs.push( cc );
  }
  return ccs;
}

// Increment counter for all variables in the constraint
function countPerVar( numConstraints, cc ) {
  cc.variables.forEach( function( vv ) {
    if (numConstraints[vv]) {
      ++numConstraints[vv];
    }
    else {
      numConstraints[vv]= 1;
    }
  } );
  return numConstraints;
}

// Has value of one
function hasValueOfOne( key ) {
  return this[key] == 1;
}

/*--------------------------------------------------------------------
 * Test whether we have satisfied the single constraint assigned
 *   to this solver.
 */
m4_member(SingleCcSolver, notDoneYet)
function notDoneYet() {
  return this.sgraph.selected[this.ccToEnforce] === null;
}

/*--------------------------------------------------------------------
 * Record current state of constraint in case we have to undo.
 */
m4_member(SingleCcSolver, recordUndo)
function recordUndo( cc ) {
  this.changeStack.push( {cc: cc, mm: this.sgraph.selected[cc]} );
}

/*--------------------------------------------------------------------
 * Mark variable as being un/determined.
 */
m4_member(SingleCcSolver, markUndetermined)
function markUndetermined( isUndetermined, vv ) {
  if (isUndetermined) {
    this.undeterminedVars[vv]= true;
  }
  else {
    delete this.undeterminedVars[vv];
  }
}

/*--------------------------------------------------------------------
 * Change which method fulfills constraint cc in sgraph.
 */
m4_member(SingleCcSolver, changeSelectedMethod)
function changeSelectedMethod( cc, mm ) {
  var oldmm= this.sgraph.selected[cc];

  if (oldmm) {
    oldmm.outputs.forEach( this.markUndetermined.bind( this, true ) );
    this.sgraph.removeNode( oldmm );
  }

  if (mm) {
    this.sgraph.addNode( mm );
    mm.outputs.forEach( function( vvout ) {
      this.markUndetermined( false, vvout );
      this.sgraph.addEdge( mm, vvout );
    }, this );
    setDiff( cc.variables, mm.outputs ).forEach( function( vvin ) {
      this.sgraph.addEdge( vvin, mm );
    }, this );
  }
  this.sgraph.selected[cc]= mm;
}

/*--------------------------------------------------------------------
 * Remove a constraint from consideration--either because it was
 * satisfied, or because it was retracted
 */
m4_member(SingleCcSolver, eliminateConstraint)
function eliminateConstraint( cc ) {
  // Reduce counters for variables involved
  cc.variables.forEach( function( vv ) {
    this.numConstraints[vv]--;
    if (this.numConstraints[vv] == 1) {
      this.freeVars.push( vv );
    }
  }, this );

  // Remove the constraint
  this.cgraph.removeNode( cc );
}

/*--------------------------------------------------------------------
 * Pick methods for sgraph that write to only free variables
 *   in cgraph.
 */
m4_member(SingleCcSolver, enforceAnyFreeConstraints)
function enforceAnyFreeConstraints() {
  while (this.notDoneYet() && this.freeVars.length > 0) {
    var vv= this.freeVars.pop();
    var cc= this.cgraph.edges( vv )[0];

    // Get any methods that write to only free variables
    var mms= cc.methods.filter( function( mm ) {
      return mm.outputs.every( isFreeVar, this );
    }, this );

    if (mms.length > 0) {
      // Take the one with the fewest outputs
      var mm= mms.reduce( methodWithFewestOutputs );
      if (this.sgraph.selected[cc] !== mm) {
        this.recordUndo( cc );
        this.changeSelectedMethod( cc, mm );
      }
      this.eliminateConstraint( cc );
    }
  }
}

// Is variable vv free?
function isFreeVar( vv ) {
  return this.numConstraints[vv] == 1;
}

// Return the method with fewer outputs
function methodWithFewestOutputs( mm1, mm2 ) {
  return (! mm1 || mm1.outputs.length > mm2.outputs.length)
    ? mm2 : mm1;
}

/*--------------------------------------------------------------------
 * Revert all constraints to their previous methods in sgraph.
 * Called when we were unable to fulfill requested constraint.
 */
m4_member(SingleCcSolver, undo)
function undo() {
  while (this.changeStack.length > 0) {
    var change= this.changeStack.pop();
    this.changeSelectedMethod( change.cc, change.mm );
  }
}

/*--------------------------------------------------------------------
 * Enforce a single constraint in sgraph by throwing out weaker
 * constraints until it is free.
 */
m4_member(SingleCcSolver, solve)
function solve( ccToEnforce ) {
  this.enforceAnyFreeConstraints();
  while (this.notDoneYet() && this.retractableConstraints.length > 0) {

    var weakest= extractWeakest( this.retractableConstraints );
    this.recordUndo( weakest );
    this.changeSelectedMethod( weakest, null, true );
    this.eliminateConstraint( weakest );

    this.enforceAnyFreeConstraints( this.cgraph, this.sgraph, this.changeStack );
  }

  if (this.notDoneYet()) {
    this.undo( this.sgraph, this.changeStack );
    return false;
  }
  else {
    return true;
  }
}

// Remove weakest constraint from list
function extractWeakest( ccs ) {
  var i= 0;
  var cc= ccs[0];
  for (var j= 1; j < ccs.length; ++j) {
    if (ccs[j].strength < cc.strength) {
      i= j;
      cc= ccs[j];
    }
  }
  ccs.splice( i, 1 );
  return cc;
}

/*====================================================================
 * This encapsulates the root of the algorithm.  It tries to enforce a
 * list of constraints.  After enforcing a constraint (using
 * SingleCcSolver, which may remove weaker constraints) it checks to
 * see if the constraints it removed opened up new constraints which
 * should be considered.
 */

function Solver( sgraph ) {
  this.sgraph= sgraph;
  this.changes= {};
}

/*--------------------------------------------------------------------
 * Throughout the process of solving we may make several changes to
 * a constraint.  We only need to remember which constraints changed.
 *
 * As an optimization, we remember what the original value so that
 * if it is changed back we can simply forget it was ever changed.
 */
m4_member(Solver, recordChange)
function recordChange( newChange ) {
  var cc= newChange.cc;
  if (cc in this.changes) {
    // This is a subsequent change--check if we're changing it back
    if (this.sgraph.selected[cc] === this.changes[cc].mm) {
      delete this.changes[cc];
    }
  }
  else {
    // This is the initial change--remember its original value
    this.changes[cc]= newChange;
  }
}


/*--------------------------------------------------------------------
 */
m4_member(Solver, solve)
function solve( unenforcedConstraints ) {
  var ccset= unenforcedConstraints.reduce( listToSet, {} );
  var cc;
  while (cc= extractStrongest( ccset )) {

    if (this.sgraph.selected[cc] !== null) { continue; }

    var solve1= new SingleCcSolver( this.sgraph, cc );
    if (solve1.solve()) {
      solve1.changeStack.forEach( this.recordChange, this );

      // Could potentially add back in any unenforced constraints which
      // are downstream of enforced method outputs or undetermined variables
      var startingVars= this.sgraph.selected[cc].outputs
        .concat( Object.keys( solve1.undeterminedVars ) );

      var downstreamVariables=
        this.sgraph.nodesDownstreamSameType( startingVars );

      ccset= downstreamVariables
        .reduce( addUnenforcedConstraints.bind( this ), ccset );
    }
  }
}

function listToSet( set, obj ) {
  set[obj]= obj;
  return set;
}

// Remove strongest constraint from set
function extractStrongest( ccset ) {
  var strongest;
  for (var id in ccset) {
    var cc= ccset[id];
    if (!strongest || cc.strength > strongest.strength) {
      strongest= cc;
    }
  }
  if (strongest) {
    delete ccset[strongest];
  }
  return strongest;
}

// Add a unenforced constraints which use vv to ccset
function addUnenforcedConstraints( ccset, vv ) {
  // check stay constraint explicitly, since vv doesn't know about it
  var sid= stayId( vv );
  if (this.sgraph.selected[sid] === null) {
    ccset[sid]= this.sgraph.lookupNode( sid );
  }
  // other constraints
  vv.constraints.forEach( function( cc ) {
    if (this.sgraph.selected[cc] === null) {
      ccset[cc]= cc;
    }
  }, this );
  return ccset;
}
