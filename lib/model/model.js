/*********************************************************************
 * A model may be thought of as a subgraph of the entire constraint
 * graph, i.e. a set of variables and constraints between those
 * variables.
 *
 * Models are factories used to construct the constraint graph in a
 * modular fashion.  However, when solving and evaluating the
 * constraint graph models are ignored and we treat all variables and
 * constraints as belonging to one big graph.
 */
m4_module
m4_import(model.MockRuntime,
          model.Variable,
          model.Constraint,
          model.Method)
m4_export(Model,
          ModelPrototype)

/*====================================================================
 * The idea for a model is that its properties are variables and
 * nested models.  But there is some additional data we need to keep
 * track of just for housekeeping, so we stick all that data in its
 * own object and store it in an obscure property of the model.
 */

var DATA= '_hd_data_'

function ModelData() {
  this.runtime= MockRuntime;
  this.variables= [];
  this.constraints= [];
  this.proxy= {};
}


/*====================================================================
 * This is intended as a "base class" for any model classes.  The idea
 * is to make it easy for uses to create their own reusable components
 * as model classes.
 *
 * This still needs quite a bit of work.  We need a way to specify
 * variables and constraints that should be created automatically.
 */

function ModelPrototype() {
}


// Rather than require every model class to initialize data in the
// constructor we give it a property that creates it the first time it
// is accessed.
Object.defineProperty( ModelPrototype.prototype, DATA, {
  get: function makeData() {
    var data= new ModelData();
    Object.defineProperty( this, DATA, {value: data} );
    return data;
  }
} );


m4_method(ModelPrototype, construct)
function construct( vardefs ) {
  for (name in vardefs) {
    this.variable( name, vardefs[name] );
  }
}


m4_method(ModelPrototype, variable)
function variable( name, init ) {
  var vv;
  if (init instanceof Variable) {
    vv= init;
  }
  else {
    vv= new Variable( name, init );
    this[DATA].runtime.addVariable( vv );
  }
  this[DATA].variables.push( vv );
  this[name]= vv;
  Object.defineProperty( this[DATA].proxy, name, {
    get: vv.get.bind( vv ),
    set: vv.get.bind( vv ),
    enumerable: true
  } );

  return vv;
}


m4_method(ModelPrototype, constraint)
function constraint() {
  var variables;
  if (arguments.length == 1 && Array.isArray( arguments[0] )) {
    variables= arguments[0];
  }
  else {
    variables= Array.prototype.slice.call( arguments, 0 );
  }
  variables= variables.map( this.mapToVariable, this );
  var cc= new Constraint( variables );
  this[DATA].runtime.addConstraint( cc );
  this[DATA].constraints.push( cc );
  variables.forEach( function( vv ) {
    vv.addConstraint( cc );
  } );

  return new ConstraintFactory( this, cc );
}


m4_method(ModelPrototype, setRuntime)
function setRuntime( runtime ) {
  this[DATA].runtime= runtime;
  this[DATA].variables.forEach( runtime.addVariable, runtime );
  this[DATA].constraints.forEach( runtime.addConstraint, runtime );
}

m4_method(ModelPrototype, mapToVariable)
function mapToVariable( obj ) {
  if (obj instanceof Variable) {
    return obj;
  }
  else {
    return this[obj];
  }
}


/*====================================================================
 * Returned by a model to allow the programmer to add methods onto an
 * existing constraint.
 *
 * Methods added in this way will automatically use the model's proxy
 * as their context.
 */

function ConstraintFactory( model, cc ) {
  this.model= model;
  this.cc= cc;
}


m4_method(ConstraintFactory, method)
function method( outputs, fn ) {
  // A convenience, since many methods output to a single variable
  if (!Array.isArray( outputs )) {
    outputs= [outputs];
  }
  outputs= outputs.map( this.model.mapToVariable, this.model );
  var mm= new Method( outputs, fn, this.model[DATA].proxy );
  this.cc.addMethod( mm );
  return this;
}


/*====================================================================
 * A generic model class.  The model is constructed using the pattern
 * passed in to the constructor
 */

function Model( vardefs ) {
  this.construct( vardefs );
}

Model.prototype= new ModelPrototype();
