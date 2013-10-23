/*********************************************************************
 * Constraints, methods, and stay constraints
 */
m4_module
m4_import(utility.noop,
          model.MockRuntime)
m4_export(Constraint,
          Method,
          StayConstraint)

/*====================================================================
 * A constraint consists of variables and methods.
 */

var count= 1;
var defaultPrefix= "_cns#";

function Constraint( variables ) {
  this.id= defaultPrefix + (count++);
  this.variables= variables.slice( 0 );
  this.methods= [];
  this.selectedMethod= null;
}

Constraint.WeakestStrength= Number.MIN_VALUE;
Constraint.RequiredStrength= Number.MAX_VALUE;
Constraint.prototype.runtime= MockRuntime;


// Each constraint has a unique id, returned by toString.  Thus they
// can be used as property names in an object.
m4_method(Constraint, toString)
function toString() {
  return this.id;
}


m4_method(Constraint, addMethod)
function addMethod( mm ) {
  this.methods.push( mm );
  this.runtime.addMethod( this, mm );
  return this;
}


m4_method(Constraint, getStrength)
function getStrength() {
  return Constraint.RequiredStrength;
}

/*====================================================================
 * A method is a set of output variables, a function, and a context
 * (object on which the function is invoked).
 */

function Method( outputs, fn, context ) {
  this.outputs= outputs.slice( 0 );
  this.fn= fn;
  this.context= context;
}


m4_method(Method, invoke)
function invoke() {
  var result;
  try {
    result= this.fn.call( this.context );
    if (result !== undefined) {
      if (this.outputs.length == 1) {
        this.outputs[0].set( result );
      }
      else {
        var length= this.outputs.length;
        for (var i= 0; i < length; ++i) {
          this.outputs[i].set( result[i] );
        }
      }
    }
  }
  catch (e) {
    ERROR( e );
  }
}

/*====================================================================
 * Specialized subtype of constraint.
 */

function StayConstraint( vv ) {
  this.id= vv.id + "#stay";
  this.variables= [vv];
  this.methods= [new Method( this.variables, noop )];
  this.selectedMethod= this.methods[0];
}

StayConstraint.prototype= new Constraint( [] );


m4_method(StayConstraint, addMethod)
function addMethod() {
  ERROR( "Cannot add methods to a stay constraint" );
}


m4_method(StayConstraint, getStrength)
function getStrength() {
  return this.variables[0].priority;
}