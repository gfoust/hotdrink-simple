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
  this.stayCc= new StayConstraint( this );
  this.determinedBy= this.stayCc;
  this.usedBy= [];
  this.constraints= [this.stayCc];
  ++count;
}

Variable.prototype.runtime= MockRuntime;

// Each variable has a unique id, returned by toString.  Thus they can
// be used as property names in an object.
m4_method(Variable, toString)
function toString() {
  return this.id;
}


m4_method(Variable, addConstraint)
function addConstraint( constraint ) {
  this.constraints.push( constraint );
}

// This would be called if a variable was set in a method
m4_method(Variable, set)
function set( value ) {
  this.stuck.set( false );
  if (value != this.value.get()) {
    this.value.set( value );  // TODO: should actually be staged
    this.runtime.varChanged( this );
  }
}


m4_method(Variable, get)
function get() {
  this.runtime.varAccessed( this );
  return this.value.get();
}


// This would be called if a variable was set by a widget
m4_method(Variable, onNext)
function onNext( value ) {
  this.set( value );
  if (this.priority != highestPriority) {
    this.priority= ++highestPriority;
  }
  this.runtime.varTouched( this );
}


// This would be called if a widget reports an error
m4_method(Variable, error)
function onError( error ) {
  this.stuck.set( true );
  this.error.set( error );
}


m4_method(Variable, onCompleted) noop;


m4_method(Variable, subscribe)
function subscribe( observer ) {
  return this.value.subscribe( observer );
}