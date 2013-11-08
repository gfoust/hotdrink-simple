/*********************************************************************
 * Variables are the most complex model object.  They keep track of
 * current value, staged value, states such as invalid, error, source,
 * and also the edges of the evaluation graph.
 */
m4_module
m4_import(utility.ObservableValue,
          utility.noop,
          model.MockRuntime,
          model.StayConstraint)
m4_export(Variable)

var count= 1;
var highestPriority= 0;
var defaultPrefix= '_var';

function Variable( name, init ) {
  this.id= (name ? name : defaultPrefix) + '#' + count;
  this.priority= (init === undefined) ? -count : ++highestPriority;
  this.value= new ObservableValue( init );
  this.source= new ObservableValue( true );
  this.stuck= new ObservableValue( false );
  this.invalid= new ObservableValue( false );
  this.error= new ObservableValue( null );
  this.pending= new ObservableValue( false );
  this.stayCc= new StayConstraint( this );
  this.determinedBy= this.stayCc;
  this.usedBy= [];
  this.constraints= [this.stayCc];
  ++count;
}

Variable.prototype.runtime= MockRuntime;

// Each variable has a unique id, returned by toString.  Thus they can
// be used as property names in an object.
m4_member(Variable, toString)
function toString() {
  return this.id;
}


m4_member(Variable, addConstraint)
function addConstraint( constraint ) {
  this.constraints.push( constraint );
}

m4_member(Variable, set)
function set( value ) {
  this.stuck.set( false );
  if (value != this.value.get()) {
    this.value.set( value );  // TODO: should actually be staged
    this.runtime.varChanged( this );
  }
}


m4_member(Variable, internalSet)
function internalSet( value ) {
  this.stuck.set( false );
  if (value != this.value.get()) {
    this.value.set( value );
  }
}


m4_member(Variable, get)
function get() {
  return this.value.get();
}


// This would be called if a variable was set by a widget
m4_member(Variable, onNext)
function onNext( value ) {
  this.set( value );
  if (this.priority != highestPriority) {
    this.priority= ++highestPriority;
  }
  this.runtime.varTouched( this );
}


// This would be called if a widget reports an error
m4_member(Variable, onError)
function onError( error ) {
  this.stuck.set( true );
  this.error.set( error );
}


m4_member(Variable, onCompleted) noop;


m4_member(Variable, subscribe)
function subscribe( observer ) {
  return this.value.subscribe( observer );
}

function isOutputOf( cc ) {
  return cc.selectedMethod
    && cc.selectedMethod.outputs.indexOf( this ) !== -1;
}

function isInputOf( cc ) {
  return cc.selectedMethod
    && cc.selectedMethod.outputs.indexOf( this ) === -1;
}

Object.defineProperty( Variable.prototype, 'inputs',
                       {enumerable: true,
                        get: function() {
                          return this.constraints.filter( isOutputOf, this );
                        }}
                     );

Object.defineProperty( Variable.prototype, 'outputs',
                       {enumerable: true,
                        get: function() {
                          return this.constraints.filter( isInputOf, this );
                        }}
                     );
