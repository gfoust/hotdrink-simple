m4_module

m4_import(utility.isNotType,
          model.Model,
          model.DATA,
          model.Variable,
          model.Constraint,
          model.Method)
m4_export(ModelBuilder,
          async)


function AsyncFlag( value ) {
  this.value= value;
}

var async= new AsyncFlag( true );

/*====================================================================
 */

function ModelBuilder( system, model ) {
  if (system) {
    this.system= system;
  }
  if (model) {
    this._model= model;
  }
  else {
    this._model= new Model();
  }
}

/*--------------------------------------------------------------------
 */
m4_member(ModelBuilder, result)
function result() {
  return this._model;
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
 */

m4_member(ModelBuilder, model)
function model(/* name?, ctor?, vardefs? */) {
  var name, ctor, vardefs;
  if (arguments.length >= 3) {
    name= arguments[0];
    ctor= arguments[1];
    vardefs= arguments[2];
  }
  if (arguments.length >= 2) {
    if (typeof arguments[0] === 'function') {
      ctor= arguments[0];
      vardefs= arguments[1];
    }
    else if (typeof arguments[1] === 'function') {
      name= arguments[0];
      ctor= arguments[1];
    }
    else {
      name= arguments[0];
      vardefs= arguments[1];
    }
  }
  else if (typeof arguments[0] === 'function') {
    ctor= arguments[0];
  }
  else if (typeof arguments[0] === 'object') {
    vardefs= arguments[0];
  }
  else {
    name= arguments[0];
  }

  var model;
  if (ctor) {
    model= new ctor();
  }
  else {
    model= new Model();
  }

  var builder= new ModelBuilder( this.system, model );
  if (vardefs) {
    builder.variables( vardefs );
  }

  this._model[DATA].models.push( model );
  if (name)        { this._model[name]= model;       }
  if (this.system) { this.system.addModel( model ); }
  this.last= model;

  return builder;
}

/*--------------------------------------------------------------------
 * If init is a variable, it is simply added to the variable.  If
 * not, then a new variable is created and initialized.
 */
m4_member(ModelBuilder, variable)
function variable(/* name?, init */) {
  // Interpret arguments
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
    // Reuse existing variable
    vv= init;
  }
  else {
    // Create new variable
    vv= new Variable( name, init );
  }

  // Record variable
  this._model[DATA].variables.push( vv );
  if (name)        { this._model[name]= vv;         }
  if (this.system) { this.system.addVariable( vv ); }
  this.last= vv;

  return this;
}

m4_member(ModelBuilder, variables)
function variables( vardefs ) {
  for (var name in vardefs) {
    this.variable( name, vardefs[name] );
  }
  return this;
}

/*--------------------------------------------------------------------
 * Create a new constraint with specified variables.  Variables
 * can be actual variable objects or the names of variables in the
 * model.
 */
m4_member(ModelBuilder, constraint)
function constraint(/* name?, [vars] */) {

  // Interpret arguments
  var name, variables;
  if (arguments.length >= 2) {
    name= arguments[0];
    variables= arguments[1];
  }
  else {
    variables= arguments[0];
  }

  // Validate variables
  if (! Array.isArray( variables )) {
    window.console.error( 'Factory method "constraint" requires variables parameter to be an array' );
    return this;
  }
  variables= variables.map( this.mapToVariable, this );
  if (variables.some( isNotType, Variable )) {
    window.console.error( 'Factory method "constraint" requires variables parameter to contain only variables' );
    return this;
  }

  // Create constraint
  var cc= new Constraint( name, variables );
  variables.forEach( function( vv ) {
    vv.addConstraint( cc );
  } );

  // Record constraint
  this._model[DATA].constraints.push( cc );
  if (name)        { this._model[name]= cc;           }
  if (this.system) { this.system.addConstraint( cc ); }
  this.last= cc;

  return this;
}


/*--------------------------------------------------------------------
 * Add a method to a constraint.  Variables can be actual variable
 * objects or the names of variables in the model.
 *
 * The context for the method is automatically augmented with any
 * named variables in the model which are in the constraint.
 */
m4_member(ModelBuilder, method)
function method(/* name?, [outputs], fn, context?, async? */) {

  // Interpret arguments
  var name, outputs, fn, context, async;
  if (arguments.length >= 5) {
    name= arguments[0];
    outputs= arguments[1];
    fn= arguments[2];
    context= arguments[3];
    async= arguments[4];
  }
  else if (arguments.length >= 4) {
    if (typeof arguments[1] === 'function') {
      outputs= arguments[0];
      fn= arguments[1];
      context= arguments[2];
      async= arguments[3];
    }
    else {
      name= arguments[0];
      outputs= arguments[1];
      fn= arguments[2];
      if (arguments[3] instanceof AsyncFlag) {
        async= arguments[3];
      }
      else {
        context= arguments[3];
      }
    }
  }
  else if (arguments.length >= 3) {
    if (typeof arguments[1] === 'function') {
      outputs= arguments[0];
      fn= arguments[1];
      if (arguments[2] instanceof AsyncFlag) {
        async= arguments[2];
      }
      else {
        context= arguments[2];
      }
    }
    else {
      name= arguments[0];
      outputs= arguments[1];
      fn= arguments[2];
    }
  }
  else {
    outputs= arguments[0];
    fn= arguments[1];
  }

  // Validate cc
  var cc= this.last;
  if (! (cc instanceof Constraint)) {
    window.console.error( 'Factory method "method" may only be used immediately following either "constraint" or "method".' );
    return this;
  }

  // Validate outputs
  if (!Array.isArray( outputs )) {
    outputs= [outputs];
  }
  outputs= outputs.map( this.mapToVariable, this );
  if (outputs.some( isNotType, Variable )) {
    window.console.error( 'Factory method "method" requires outputs parameter to contain only variables' );
    return this;
  }

  // Construct context
  if (! context) {
    context= {};
  }
  for (var key in this._model) {
    if (cc.variables.indexOf( this._model[key] ) != -1 && ! (key in context)) {
      context[key]= this._model[key];
    }
  }

  // Validate async
  if (typeof async === 'undefined') {
    async= false;
  }
  else if (typeof async !== 'boolean') {
    if (! (async instanceof AsyncFlag) ) {
      window.console.error( 'Factory method "method" requires async parameter to be hd.async or empty' );
      // just default to false
      async= false;
    }
    else {
      async= async.value;
    }
  }

  // Create method
  var mm= new Method( name, cc, outputs, fn, context, async );
  cc.addMethod( mm );

  // Record method
  if (name)        { this._model[name]= mm;       }
  if (this.system) { this.system.addMethod( mm ); }

  return this;
}

/*--------------------------------------------------------------------
 * Create a new variable and a new one-way constraint which outputs
 * to it.
 */
m4_member(ModelBuilder, computed)
function computed( name, inputs, fn ) {
  this.variable( name, undefined );
  var vars= inputs.slice( 0 );
  vars.push( name );
  this.constraint( vars );
  this.method( [name], fn );
  return this;
}

/*--------------------------------------------------------------------
 * Internal method - if "obj" is not already a variable then treats
 * it as the name of a variable and looks it up in the model.
 */
m4_member(ModelBuilder, mapToVariable)
function mapToVariable( obj ) {
  if (obj instanceof Variable) {
    return obj;
  }
  else {
    return this._model[obj];
  }
}
