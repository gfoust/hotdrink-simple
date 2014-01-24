/*====================================================================
 * The purpose of the ModelBuilder is to make it easy for programmers
 * to construct models.
 *
 * The various factory methods spend a lot of time validating
 * parameters and massaging them to fit the parameters of the actual
 * object constructors.  (The object constructors themselves assume
 * all parameters have been validated and are in the expected format.)
 */
m4_module
m4_import(utility.isType,
          model.Model,
          model.DATA,
          model.Variable,
          model.Constraint,
          model.Method)
m4_export(ModelBuilder)


// Helper - is name in object?
function nameIsIn( name ) {
  return name in this;
}

function toValueIn( name ) {
  return this[name];
}

/*====================================================================
 * Note that a model builder can expand upon an existing model, or it
 * can create a brand new model from scratch.
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
 * Get resulting model.
 *
 * This is often unnecessary, as the model builder registers the
 * model with the constraint system as it is constructed.
 */
m4_member(ModelBuilder, result)
function result() {
  return this._model;
}

/*--------------------------------------------------------------------
 * A note on factory methods.
 *
 * All methods take an optional first parameter which is the name for
 * the object.  If specified, the value is stored as a property of the
 * model using the name.  If not specified the value is remembered but
 * not stored as a property of the model.
 */

m4_member(ModelBuilder, model)
function model(/* name?, ctor?, vardefs? */) {
  // Interpret arguments
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
 * If init is a variable, it is simply added to the model.  If not,
 * then a new variable is created and initialized.
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

/*--------------------------------------------------------------------
 * Helper - build all variables defined by object (name/value pairs)
 */
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
function constraint(/* name?, [vars]? */) {

  // Interpret arguments
  var name, variables;
  if (arguments.length >= 2) {
    name= arguments[0];
    variables= arguments[1];
  }
  else {
    variables= arguments[0];
  }

  if (variables) {
    // Validate variables
    if (! Array.isArray( variables )) {
      window.console.error( 'Factory method "constraint" requires variables parameter to be an array' );
      return this;
    }
    if (! variables.every( nameIsIn, this._model )) {
      window.console.error( 'Factory method "constraint" requires variables to be names in the model' );
      return this;
    }
    variables= variables.map( toValueIn, this._model );
    if (! variables.every( isType, Variable )) {
      window.console.error( 'Factory method "constraint" requires variables parameter to contain only variables' );
      return this;
    }

    variables= variables.slice( 0 );
  }
  else {
    variables= [];
  }

  // Create constraint
  var cc= new Constraint( name, variables );

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
 * The context for the method is assumed to be the model being built.
 */
m4_member(ModelBuilder, method)
function method(/* name?, signature | (inputs, outputs), fn */) {

  // Interpret arguments
  var name, signature, inputs, outputs, fn;
  if (arguments.length >= 4) {
    name= arguments[0];
    inputs= arguments[1];
    outputs= arguments[2];
    fn= arguments[3];
  }
  else if (arguments.length >= 3) {
    if (typeof arguments[1] === 'string') {
      name= arguments[0];
      signature= arguments[1];
      fn= arguments[2];
    }
    else {
      inputs= arguments[0];
      outputs= arguments[1];
      fn= arguments[2];
    }
  }
  else {
    signature= arguments[0];
    fn= arguments[1];
  }

  // Validate implicit cc
  var cc= this.last;
  if (! (cc instanceof Constraint)) {
    window.console.error( 'Factory method "method" may only be used immediately following either "constraint" or "method".' );
    return this;
  }

  if (inputs || outputs) {
    // Validate input/output arrays
    if (! Array.isArray( inputs ) || ! Array.isArray( outputs)) {
      window.console.error( 'Factory method "method" requires input/output parameters to be arrays' );
      return this;
    }
    inputs= inputs.slice( 0 );
    outputs= outputs.slice( 0 );
  }
  else {
    // Parse signature
    var parsedSignature= this.parseSignature( signature );
    if (! parsedSignature) {
      window.console.error( 'Invalid signature for factory method "method": '
                            + signature );
      return this;
    }
    inputs= parsedSignature.inputs;
    outputs= parsedSignature.outputs;
  }

  // Validate inputs/outputs
  if (! inputs.every( nameIsIn, this._model )) {
    window.console.error( 'Factory method "method" requires inputs to be names in the model' );
    return this;
  }
  if (! outputs.every( nameIsIn, this._model )) {
    window.console.error( 'Factory method "method" requires outputs to be names in the model' );
    return this;
  }
  if (! outputs.map( toValueIn, this._model ).every( isType, Variable )) {
    window.console.error( 'Factory method "method" requires outputs to be variables only' );
    return this;
  }

  // Create method
  var mm= new Method( name,
                      fn,
                      this._model,
                      inputs,
                      outputs
                    );
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
  return this.variable( name, undefined )
             .constraint()
             .method( inputs, [name], fn );
}


/*--------------------------------------------------------------------
 * Internal method - parse method signature into inputs/outputs
 */
m4_member(ModelBuilder, parseSignature)
function parseSignature( signature ) {
  var leftRight= signature.split( /\s*->\s*/ );
  if (leftRight.length != 2) {
    return undefined;
  }

  var inputs= leftRight[0] == '' ? [] : leftRight[0].split( /\s*,\s*/ );
  var outputs= leftRight[1] == '' ? [] : leftRight[1].split( /\s*,\s*/ );

  if (   inputs.every( nameIsIn, this._model )
      && outputs.every( nameIsIn, this._model ))
  {
    return {inputs: inputs, outputs: outputs};
  }
  else {
    return undefined;
  }
}
