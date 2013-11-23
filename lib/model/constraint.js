/*********************************************************************
 * Constraints, methods, and stay constraints
 */
m4_module
m4_import(utility.Node,
          utility.noop,
          utility.setDiff)
m4_export(Constraint,
          Method,
          StayConstraint,
          stayId)

// tag used to create unique constraint ids
var cnstag= "cns";

// counter used to create unique constriaint ids
var cnscount= 1;

/*====================================================================
 * A constraint consists of variables and methods.
 *
 * A constraint may be used as a node in a graph.
 */

function Constraint( name, variables ) {
  // In order to be used as a node we need a unique id
  var id= (name ? name : '') + '#' + cnstag + (++cnscount);
  Node.call( this, id );

  // All variables used in this constraint
  this.variables= variables ? variables.slice( 0 ) : [];

  // All methods in the constraint
  this.methods= [];

DEBUG_BEGIN
  this.name= name ? name : (ccName( this.variables ));
DEBUG_END
}

m4_extend(Constraint, Node)

function ccName( variables ) {
  var varName= function( vv ) { return vv.name; };
  return '(' + variables.map( varName ).join( ', ' ) + ')';
}

/*--------------------------------------------------------------------
 * Static constants
 */

Constraint.WeakestStrength= Number.MIN_VALUE;

Constraint.RequiredStrength= Number.MAX_VALUE;

/*--------------------------------------------------------------------
 * Add variables/methods
 */

m4_member(Constraint, addVariable)
function addVariable( vv ) {
  this.variables.push( vv );
  return this;
}


m4_member(Constraint, addMethod)
function addMethod( mm ) {
  this.methods.push( mm );
  return this;
}

/*--------------------------------------------------------------------
 * Constraint strength - defaults to required
 */
Constraint.prototype.strength= Constraint.RequiredStrength;

/*====================================================================
 * A method is a set of output variables, a function, and a context
 * (object on which the function is invoked).
 *
 * Note that method functions should /not/ take parameters; rather
 * they should take their parameters from the context.
 *
 * A method can be used as a node in a graph.
 */

// tag used to create unique method ids
var mthtag= 'mth'

// counter used to create unique method ids
var mthcount= 1;

function Method( name, cc, outputs, fn, context, async ) {
  // In order to be used as a node we need a unique id
  var id= (name ? name : '') + '#' + mthtag + (++mthcount);
  Node.call( this, id );

  // Method values
  this.constraint= cc;
  this.outputs= outputs.slice( 0 );
  this.fn= fn;
  this.context= context;
  this.async= (async != false);

DEBUG_BEGIN
  this.name = name ? name : (fn.name ? fn.name : mmName( cc.variables, outputs ));
DEBUG_END
}

m4_extend(Method, Node)

function mmName( variables, outputs ) {
  var varName= function( vv ) { return vv.name; };
  var ins= setDiff( variables, outputs ).map( varName );
  var outs= outputs.map( varName );
  return '(' + ins.join( ', ' ) + ') -> (' + outs.join( ', ' ) + ')';
}

/*====================================================================
 * Specialized subtype of constraint.
 */

// This is meant to uniquely map a variable id to the id of its stay constraint
function stayId( vv ) {
  return vv.id + '#stay';
}

function StayConstraint( vv ) {
  // In order to be used as a node we need a unique id
  Node.call( this, stayId( vv ) );

  // We can go ahead and initialize this constraint with the correct members
  this.variables= [vv];
  this.methods= [];
  var method= new Method( 'noop', this, this.variables, noop );
  Constraint.prototype.addMethod.call( this, method ); // must call base class method

DEBUG_BEGIN
  this.name= vv.name + '-stay';
DEBUG_END
}

m4_extend(StayConstraint, Constraint)

/*--------------------------------------------------------------------
 * Disable editing as a precaution
 */

m4_member(StayConstraint, addVariable)
function addVariable() {
  ERROR( "Cannot add variables to a stay constraint" );
}

m4_member(StayConstraint, addMethod)
function addMethod() {
  ERROR( "Cannot add methods to a stay constraint" );
}
