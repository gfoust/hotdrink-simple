/*********************************************************************
 * Solving the constraint graph follows the QuickPlan algorithm,
 * which can be found in this paper:
 *
 * An incremental algorithm for satisfying hierarchies of multiway
 *   dataflow constraints
 * Brad Vander Zanden
 * ACM Transactions on Programming Languages and Systems (TOPLAS)
 * Volume 18 Issue 1, Jan. 1996, Pages 30-72
 */
m4_module
m4_import(utility.setDiff,
          model.Constraint)
m4_export(Solver)


// Some simple helper functions...

function methodWithFewestOutputs( mms ) {
  var mm= mms[0];
  for (var i= 1; i < mms.length; ++i) {
    if (mms[i].outputs.length < mm.outputs.length) {
      mm= mms[i];
    }
  }

  return mm;
}


function extractWeakest( ccs ) {
  var cci= 0;
  var cc= ccs[0];
  for (var j= 1; j < ccs.length; ++j) {
    if (ccs[j].getStrength() < cc.getStrength()) {
      cci= j;
      cc= ccs[j];
    }
  }
  ccs.splice( cci, 1 );
  return cc;
}


function extractStrongest( ccs ) {
  var cci= 0;
  var cc= ccs[0];
  for (var j= 1; j < ccs.length; ++j) {
    if (ccs[j].getStrength() > cc.getStrength()) {
      cci= j;
      cc= ccs[j];
    }
  }
  ccs.splice( cci, 1 );
  return cc;
}

/*====================================================================
 * This encapsulates the part of the algorithm which focuses on
 * enforcing a single new constraint by removing weaker constraints.
 */

function SingleCcSolver( cc ) {
  this.ccToEnforce= cc;
  this.marked= {};
  this.numConstraints= {};
  this.retractableConstraints= [];
  this.strongestRetracted= Constraint.WeakestStrength;
  this.potentiallyFree= [];
  this.potentiallyUndetermined= [];
  this.undoStack= [];
}

/*--------------------------------------------------------------------
 * Mark all upstream constraints--they're the ones under
 * consideration.
 *
 * Count how many constraints each variable is used in.
 *
 * Note which constraints could be retracted later if necessary.
 */
m4_member(SingleCcSolver, collectUpstreamConstraints)
function collectUpstreamConstraints( cc ) {
  this.marked[cc]= true;

  // Collect weaker constraints which we could retract later
  if (cc.getStrength() < this.ccToEnforce.getStrength()) {
    this.retractableConstraints.push( cc );
  }

  cc.variables.forEach( function( vv ) {
    // Increment number of constraints for variable
    if (this.numConstraints[vv]) {
      this.numConstraints[vv]++;
    }
    else {
      this.numConstraints[vv]= 1;
    }

    var dd= vv.determinedBy;
    if (dd && !this.marked[dd]) {
      // Recurse upstream
      this.collectUpstreamConstraints( dd );
    }
    else if (this.numConstraints[vv] == 1) {
      // No upstream--perhaps this is a free variable?
      this.potentiallyFree[vv]= true;
    }
  }, this );
}

/*--------------------------------------------------------------------
 * Is this a free variable w.r.t. marked constraints?
 */
m4_member(SingleCcSolver, variableIsFree)
function variableIsFree( vv ) {
  return this.numConstraints[vv] == 1;
}

/*--------------------------------------------------------------------
 * Find the one constraint of a free variable that is under
 * consideration.
 *
 * We're assuming the variable is free and therefore there is exactly
 * one such constraint.
 */
m4_member(SingleCcSolver, findMarkedConstraint)
function findMarkedConstraint( vv ) {
  return vv.constraints.filter( function( cc ) {
    return this.marked[cc];
  }, this )[0];
}

/*--------------------------------------------------------------------
 * Remove a constraint from consideration--either because it was
 * satisfied, or because it was retracted
 */
m4_member(SingleCcSolver, eliminateConstraint)
function eliminateConstraint( cc ) {
  // Reduce constraint count for variables involved
  cc.variables.forEach( function( vv ) {
    this.numConstraints[vv]--;
    if (this.numConstraints[vv] == 1) {
      this.potentiallyFree.push( vv );
    }
  }, this );

  // Dismiss the constraint
  this.marked[cc]= false;
}

/*--------------------------------------------------------------------
 * Undo all changes made by this solution (presumably because solving
 * was unsuccessful).
 */
m4_member(SingleCcSolver, undo)
function undo() {
  while (this.undoStack.length > 0) {
    var change= this.undoStack.pop();
    change.cc.selectedMethod.outputs.forEach( function( vv ) {
      vv.determinedBy= null;
    } );
    change.mm.outputs.forEach( function( vv ) {
      vv.determinedBy= change.cc;
    } );
    change.cc.selectedMethod= change.mm;
  }
}

/*--------------------------------------------------------------------
 * Changes the selected method of specified constraint.
 *
 * Changes determinedBy of relevant variables.
 *
 * Adds appropriate variables to potentiallyUndetermined.
 */
m4_member(SingleCcSolver, changeSelectedMethod)
function changeSelectedMethod( cc, mm ) {
  if (cc.selectedMethod === mm) return;

  var newOutputs= mm ? mm.outputs : [];
  var oldOutputs= cc.selectedMethod ? cc.selectedMethod.outputs : [];
  if (mm) {
    oldOutputs= setDiff( oldOutputs, newOutputs );
  }

  // Remove any "usedBy" for the old method
  cc.variables.forEach( function( vv ) {
    var i= vv.usedBy.indexOf( cc.selectedMethod );
    if (i != -1) {
      vv.usedBy.splice( i, 1 );
    }
  } );

  // Remove "determinedBy" for old outputs
  //   (that aren't also new outputs)
  oldOutputs.forEach( function( vv ) {
    vv.determinedBy= null;
    this.potentiallyUndetermined.push( vv );
    // In the paper, variables which are about to be added to the free
    // set are not added to the undetermined set. This is an
    // optimization-- it avoids adding variables which are likely to
    // be determined in the next few iterations.
    //
    // But the cost is that those variables have to be marked, and
    // then to figure out which variables are actually undetermined
    // you have to include variables in the free set which are marked
    // in addition to the undetermined set.  Rather than deal with
    // that, I'm just adding all the variables to the undetermined
    // set.
  }, this );

  // Add "determinedBy" for new outputs
  newOutputs.forEach( function( vv ) {
    vv.determinedBy= cc;
  } );

  // Select new method
  this.undoStack.push( {cc: cc, mm: cc.selectedMethod} );
  cc.selectedMethod= mm;
}

/*--------------------------------------------------------------------
 * Attempt to enforce a constraint by finding (marked) constraints
 * which can output to only free variables.
 *
 * (This is multi_output_planner in the paper.)
 */
m4_member(SingleCcSolver, selectFreeConstraints)
function selectFreeConstraints() {
  while (this.ccToEnforce.selectedMethod === null &&
         this.potentiallyFree.length > 0)
  {
    // Find a free variable and its one constraint
    var vv= this.potentiallyFree.pop();
    if (this.variableIsFree( vv )) {
      var cc= this.findMarkedConstraint( vv );

      // See if there's a method which outputs to only free variables
      var mms= cc.methods.filter( function( mm ) {
        return mm.outputs.every( this.variableIsFree, this );
      }, this );
      if (mms.length > 0) {
        var mm= methodWithFewestOutputs( mms );
        this.changeSelectedMethod( cc, mm );
        this.eliminateConstraint( cc );
      }
    }
  }
}

/*--------------------------------------------------------------------
 * Attempt to enforce a constraint by repeatedly enforcing free
 * constraints, then retracting the weakest to make more free
 * variables.
 *
 * (This is constraint_hierarchy_planner in the paper.)
 */
m4_member(SingleCcSolver, solve)
function solve() {
  this.selectFreeConstraints();

  while (this.ccToEnforce.selectedMethod === null &&
         this.retractableConstraints.length > 0)
  {
    var cc= extractWeakest( this.retractableConstraints );
    if (cc.getStrength() > this.strongestRetracted) {
      this.strongestRetracted= cc.getStrength();
    }
    this.changeSelectedMethod( cc, null );
    this.eliminateConstraint( cc );

    this.selectFreeConstraints();
  }
}

/*====================================================================
 * This encapsulates the part of the algorithm which walks the graph
 * looking for unenforced constraints which are weaker than the one
 * just enforced.
 */

function UnenforcedCcCollector( strongest ) {
  //this.unenforcedConstraints= [];  // in theory--but never used
  this.strongest= strongest;
  this.marked= {};
}

/*--------------------------------------------------------------------
 * Recursively collect unenforced constraints which are downstream of
 * the specified variable.
 *
 * (This is collect_downstream_unenforced_constraints in the paper.)
 */
m4_member(UnenforcedCcCollector, collectDownstream)
function collectDownstream( vv ) {
  this.marked[vv]= true;

  vv.constraints.forEach( function( cc ) {
    if (cc.selectedMethod === null) {
      // Constraint unenforced--but only collect it if it's weaker
      if (cc.getStrength() < this.strongest) {
        this.unenforcedConstraints.push( cc );
      }
    }
    else {
      // Constraint enforced--follow it downstream
      if (! this.marked[cc]) {
        this.marked[cc]= true;
        cc.selectedMethod.outputs.forEach( function( vv ) {
          if (! this.marked[vv]) {
            this.collectDownstream( vv )
          }
        }, this );
      }
    }
  }, this );
}

/*====================================================================
 * This encapsulates the root of the algorithm.  It tries to enforce a
 * list of constraints.  After enforcing a constraint (using
 * SingleCcSolver, which may remove weaker constraints) it checks to
 * see if the constraints it removed opened up new constraints which
 * should be considered.
 */

function Solver() {
}

/*--------------------------------------------------------------------
 * We're keeping a list of everything we've changed.  This copies
 * changes made by SingleCcSolver into our global list.
 *
 * The changes contain two fields: the constraint that was changed and
 * which method was previously selected.  (The method currently
 * selected can be retrieved from the constraint itself.)
 */
m4_member(Solver, copyChanges)
function copyChanges( changeStack ) {
  changeStack.forEach( function( change ) {
    var cc= change.cc;
    if (cc in this.changes) {
      // This is a subsequent change--check if we're changing it back
      if (cc.selectedMethod == this.changes[cc].mm) {
        delete this.changes[cc];
      }
    }
    else {
      // This is a new change
      this.changes[cc]= change;
    }
  }, this );
}

/*--------------------------------------------------------------------
 * This returns the final list of everything changed.
 */
m4_member(Solver, changedConstraints)
function changedConstraints() {
  var ccs= [];
  for (var ccid in this.changes) {
    ccs.push( this.changes[ccid].cc );
  }
  return ccs;
}

/*--------------------------------------------------------------------
 * Entry point:  solve the constraint system by trying to enforce the
 * specified constraints.
 *
 * (This is constraint_hierarchy_solver in the paper.)
 */
m4_member(Solver, solve)
function solve( unenforcedConstraints ) {
  this.changes= [];
  while (unenforcedConstraints.length > 0) {

    // Solve constraints one at a time
    var cc= extractStrongest( unenforcedConstraints );
    var solve1= new SingleCcSolver( cc );
    solve1.collectUpstreamConstraints( cc );
    solve1.solve();

    if (cc.selectedMethod === null) {
      // Solve failed
      solve1.undo();
    }
    else {
      // Solve worked
      this.copyChanges( solve1.undoStack );

      // If we had to retract constraints then check to see if that enabled
      //   other constraints to be enforced.
      // Note that we are inlining collect_unenforced_constraints (from the paper)
      //   since we're not actually using walkbounds.

      if (solve1.strongestRetracted > Constraint.WeakestStrength) {
        var collector= new UnenforcedCcCollector( solve1.strongestRetracted );

        // We want to add constraints to our existing list,
        //   rather than building a brand new list
        collector.unenforcedConstraints= unenforcedConstraints;

        // Collect unenforced constraints starting from constraint outputs
        // and newly undetermined variables
        cc.selectedMethod.outputs.forEach( function( vv ) {
          collector.collectDownstream( vv );
        } );
        solve1.potentiallyUndetermined.forEach( function( vv ) {
          if (vv.determinedBy === null) {
            collector.collectDownstream( vv );
          }
        } );
        // We add all potentially undetermined variables to this set, so we
        // don't need to check free variables
      }
    }
  }
}