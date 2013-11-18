/*********************************************************************
 * Models
 */
m4_module
m4_import(model.Variable,
          model.Constraint,
          model.Method)
m4_export(Model,
          DATA)

/*====================================================================
 * The idea for a model is that its properties are variables,
 * constraints, and nested models.  But there is some additional data
 * that we need to keep track of just for housekeeping, so we stick
 * all that data in its own object and store it in an obscure property
 * of the model.
 */

var DATA= '_hd_data_'

function ModelData() {
  this.variables= [];
  this.constraints= [];
  this.models= [];
}


/*====================================================================
 * A model is a factory for building variables, constraints, and
 * methods.  Conceptually, however, a model may be thought of as a
 * subgraph of the entire constraint graph.
 *
 * The goal is that a model would serve as the component building
 * block for composing large models in a modular fashion.  Note,
 * however, that when solving and evaluating the constraint graph
 * models are ignored and we treat all variables and constraints as
 * belonging to one big graph.
 */

function Model( vardefs ) {
  if (vardefs) {
    this.construct( vardefs );
  }
}

/*--------------------------------------------------------------------
 * Rather than require every model class to initialize data in the
 * constructor we give it a getter that creates it the first time it
 * is accessed.
 */
Object.defineProperty( Model.prototype, DATA, {
  get: function makeData() {
    var data= new ModelData;
    Object.defineProperty( this, DATA, {value: data} );
    return data;
  }
} );

/*--------------------------------------------------------------------
 * This is basic the logic of the constructor, offloaded into a method
 * so that it's easy for subclasses to use.  Right now it's just a
 * shortcut for constructing a bunch of variables at once.  Vardefs
 * should be an object where the keys are variable names and values
 * are variable values.
 *
 * Example:
 *   model.construct( {left: 25, right: 135, width: undefined} );
 */
m4_member(Model, construct)
function construct( vardefs ) {
  for (name in vardefs) {
    this.variable( name, vardefs[name] );
  }
}

/*--------------------------------------------------------------------
 * A note on factory methods.
 *
 * All methods take an optional first parameter which is the name
 * for the object.  If specified, the value is stored in the model
 * using the name.  If not specified the value is remembered but
 * not stored directly in the model.
 *
 * Most of the logic in the factory method is simply massaging the
 * parameters in order to be extremely flexible, allowing the
 * programmer to specify parameters in the manner most convenient.
 *-------------------------------------------------------------------/

/*--------------------------------------------------------------------
 * If init is a variable, it is simply added to the variable.  If
 * not, then a new variable is created and initialized.
 */
m4_member(Model, variable)
function variable(/* name?, init */) {
  var name, init;
  if (arguments.length >= 2) {
    name= arguments[0];
    init= arguments[1];
  }
  else {
    init= arguments[0];
  }
  var vv;
  if (init instanceof Variable) {
    vv= init;
  }
  else {
    vv= new Variable( name, init );
  }
  this[DATA].variables.push( vv );
  if (name) {
    this[name]= vv;
  }

  return vv;
}

/*--------------------------------------------------------------------
 * Create a new constraint with specified variables.  Variables
 * can be actual variable objects or the names of variables in the
 * model.
 */
m4_member(Model, constraint)
function constraint(/* name?, [vars] */) {
  var name, variables;
  if (arguments.length >= 2) {
    name= arguments[0];
    variables= arguments[1];
  }
  else if (arguments.length == 1) {
    if (Array.isArray( arguments[0] )) {
      variables= arguments[0];
    }
    else {
      name= arguments[0];
    }
  }
  variables= variables.map( this.mapToVariable, this );
  var cc= new Constraint( name );
  this[DATA].constraints.push( cc );
  if (name) { this.name= cc; }
  variables.forEach( function( vv ) {
    cc.addVariable( vv );
    vv.addConstraint( cc );
  } );

  return cc;
}

/*--------------------------------------------------------------------
 * Add a method to a constraint.  Variables can be actual variable
 * objects or the names of variables in the model.
 *
 * The context for the method is automatically augmented with any
 * named variables in the model which are in the constraint.
 */
m4_member(Model, method)
function method(/* name?, cc, [outputs], fn, context? */) {
  var name, cc, outputs, fn, context
  if (arguments.length >= 5) {
    name= arguments[0];
    cc= arguments[1];
    outputs= arguments[2];
    fn= arguments[3];
    context= arguments[4];
  }
  else if (arguments.length >= 4) {
    if (typeof arguments[2] == 'function') {
      outputs= arguments[0];
      cc= arguments[1];
      fn= arguments[2];
      context= arguments[3];
    }
    else {
      name= arguments[0];
      cc= arguments[1];
      outputs= arguments[2];
      fn= arguments[3];
    }
  }
  else {
    cc= arguments[0];
    outputs= arguments[1];
    fn= arguments[2];
  }
  if (! (cc instanceof Constraint)) {
    cc= this[cc];
  }
  if (!Array.isArray( outputs )) {
    outputs= [outputs];
  }
  outputs= outputs.map( this.mapToVariable, this );
  if (! context) {
    context= {};
  }
  // augment context
  for (var key in this) {
    if (cc.variables.indexOf( this[key] ) != -1 && ! (key in context)) {
      context[key]= this[key];
    }
  }

  var mm= new Method( name, outputs, fn, context );
  cc.addMethod( mm );
  if (name) { this[name]= mm; }
  return mm;
}

/*--------------------------------------------------------------------
 * Create a new variable and a new one-way constraint which outputs
 * to it.
 */
m4_member(Model, computed)
function computed( name, inputs, fn ) {
  var vv= this.variable( name, undefined );
  inputs.push( vv );
  this.constraint( inputs ).addMethod(
    this.method( [vv], fn )
  );
  return vv;
}

/*--------------------------------------------------------------------
 * Internal method - if "obj" is not already a variable then treats
 * it as the name of a variable and looks it up in the model.
 */
m4_member(Model, mapToVariable)
function mapToVariable( obj ) {
  if (obj instanceof Variable) {
    return obj;
  }
  else {
    return this[obj];
  }
}


