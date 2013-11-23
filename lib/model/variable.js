/*********************************************************************
 * Variables
 */
m4_module
m4_import(utility.noop,
          utility.Node,
          utility.ObservableValue)
m4_export(Variable)

// tag used to create unique variable ids
var tag= 'var';

// counter used to create unique variable ids
var count= 1;

// highest priority assigned to any variable so far
var highestPriority= 0;

// lowest priority assigned to any variable so far
var lowestPriority= 0;

/*====================================================================
 * Variable objects store all information related to a variable such
 * as current value, staged value, and states such as invalid, error,
 * source.  They also maintain a list of all the constraints they
 * are used in.  They may be used as graph nodes.
 */

function Variable( name, init ) {
  // In order to be used as a node we need a unique id
  var id= (name ? name : '') + '#' + tag + (++count);
  Node.call( this, id );

  // Some basic observable variable properties
  var priority= (init === undefined) ? --lowestPriority : ++highestPriority;
  this.priority= new ObservableValue( this, 'priority', priority );
  this.value= new ObservableValue( this, 'value', init );
  this.source= new ObservableValue( this, 'source', false );
  this.pending= new ObservableValue( this, 'pending', false );

  // All constraints which use this variable
  this.constraints= [];

DEBUG_BEGIN
  this.name= name;
DEBUG_END
}

m4_extend(Variable, Node)

/*--------------------------------------------------------------------
 * Link constraint to this variable
 */
m4_member(Variable, addConstraint)
function addConstraint( cc ) {
  this.constraints.push( cc );
  return this;
}

/*--------------------------------------------------------------------
  * Set/get value for the variable
  */

m4_member(Variable, set)
function set( value, source ) {
  this.value.set( value, source );  // TODO: should actually be staged
  return this;
}

m4_member(Variable, get)
function get() {
  return this.value.get();
}

/*--------------------------------------------------------------------
 * Modify variable priority
 */

m4_member(Variable, promote)
function promote( source ) {
  if (this.priority.get() != highestPriority) {
    this.priority.set( ++highestPriority, source );
  }
  return this;
}

m4_member(Variable, demote)
function demote( source ) {
  if (this.priority.get() != lowestPriority) {
    this.priority.set( --lowestPriority, source );
  }
  return this;
}

/*--------------------------------------------------------------------
 * Observable
 * Shortcut: observe a variable == observe its value
 */
m4_member(Variable, subscribe)
function subscribe( obsver ) {
  return this.value.subscribe( obsver );
}

/*--------------------------------------------------------------------
 * Observer
 * When a variable is bound to a widget it observes a stream of values
 * from the widget.
 */

// This would be called if the widget's value was changed
m4_member(Variable, onNext)
function onNext( value, source ) {
  if (value != this.value.get()) {
    this.promote( source );
    this.set( value, source );
  }
  return this;
}

// This would be called if a widget reports an error
m4_member(Variable, onError)
function onError( error ) {
  // TODO
  return this;
}

// This is unused
m4_member(Variable, onCompleted) noop;
