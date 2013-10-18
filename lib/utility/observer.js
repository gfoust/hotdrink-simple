/********************************************************************
 * Various classes and functions enabling the observer pattern.
 */
m4_module
m4_import(utility.noop)
m4_export(ObservableValue,
          makeObservable)

/*====================================================================
 * Make an object observable by giving it a subscribe method, along
 * with helper functions for sending messages to subscribers.
 *
 * Can be applied to a prototype as well as an object.
 *
 * This mixin seemed preferable to a base class.
 */

function makeObservable( obj ) {
  Object.defineProperties( obj, {
    subscribe: {value: subscribe},
    sendNext: {value: sendNext},
    sendError: {value: sendError},
    sendCompleted: {value: sendCompleted}
  } );
}

function subscribe( obs ) {
  if (this.subscribers) {
    this.subscribers.push( obs );
  }
  else {
    this.subscribers= [obs];
  }
}

function sendNext1( obs ) {
  var value= this.value;
  setTimeout( function() { obs.onNext( value ); }, 0 );
}

function sendNext( value ) {
  if (this.subscribers) {
    var context= {value: value};
    this.subscribers.forEach( sendNext1, context );
  }
}

function sendError1( obs ) {
  var error= this.error;
  setTimeout( function() { obs.onError( error ); }, 0 );
}

function sendError( error ) {
  if (this.subscribers) {
    var context= {error: error};
    this.subscribers.forEach( sendError1, context );
  }
}

function sendCompleted1( objs ) {
  setTimeout( function() { obs.onCompleted(); }, 0 );
}

function sendCompleted( obs ) {
  if (this.subscribers) {
    this.subscribers.forEach( sendCompleted1 );
  }
}

/*====================================================================
 * A value to which sends events every time it changes.
 */

function ObservableValue( value ) {
  this.value= value;
}


// Note that subscribing automatically triggers a "next" event
m4_method(ObservableValue, subscribe)
function subscribe( observer ) {
  if (this.subscribers) {
    this.subscribers.push( observer );
  }
  else {
    this.subscribers= [observer];
  }
  observer.onNext( this.value );
}


m4_method(ObservableValue, get)
function get() {
  return this.value;
}


m4_method(ObservableValue, set)
function set( value ) {
  this.value= value;
  if (this.subscribers) {
    var context= {value: value};
    this.subscribers.forEach( sendNext1, context );
  }
}

