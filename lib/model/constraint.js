/*********************************************************************
 * Constraints, methods, and stay constraints
 */
m4_module
m4_import(utility.Node,
          utility.noop,
          utility.setInsert,
          utility.isType,
          model.Variable)
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
  this.variables.forEach( function( vv ) {
    vv.addConstraint( this );
  } );

  // All methods in the constraint
  this.methods= [];

  // Debug information - human readable name
  this.name= name ? name : (ccName( this.variables ));
}

m4_subtype(Constraint, Node)

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
  if (this.variables.indexOf( vv ) == -1) {
    this.variables.push( vv );
    vv.addConstraint( this );
  }
  return this;
}


m4_member(Constraint, addMethod)
function addMethod( mm ) {
  this.methods.push( mm );
  mm.setConstraint( this );
  mm.inputVars.forEach( this.addVariable, this );
  mm.outputVars.forEach( this.addVariable, this );
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

function Method( name, fn, context, inputs, outputs, async ) {
  // In order to be used as a node we need a unique id
  var id= (name ? name : '') + '#' + mthtag + (++mthcount);
  Node.call( this, id );

  // Method values
  this.inputs= inputs;
  this.inputVars= inputs.map( lookupIn, context ).filter( isType, Variable );
  this.outputs= outputs;
  this.outputVars= outputs.map( lookupIn, context ).filter( isType, Variable );
  this.fn= fn;
  this.context= context;
  this.async= (async != false);

  // Debug information - human readable name
  this.name = name ? name : (fn.name ? fn.name : mmName( inputs, outputs ));
}

m4_subtype(Method, Node)

function mmName( inputs, outputs ) {
  return inputs.join( ', ' ) + ' -> ' + outputs.join( ', ' );
}

function lookupIn( name ) {
  return this[name];
}

/*--------------------------------------------------------------------
 */
m4_member(Method, setConstraint)
function setConstraint( cc ) {
  this.constraint= cc;
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
  var method= new Method( 'noop', noop, {vv: vv}, [], ['vv'], false );
  this.methods= [method];
  method.setConstraint( this );

  // Debug information - human readable name
  this.name= vv.name + '-stay';
}

m4_subtype(StayConstraint, Constraint)

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
