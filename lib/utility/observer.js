/********************************************************************
 * Various classes and functions enabling the observer pattern.
 */
m4_module
m4_import(utility.noop)
m4_export(Observer,
          Observable,
          ObservableValue,
          makeObservable,
          sendNext,
          sendError,
          sendCompleted)

function Observer( onNext, onError, onCompleted ) {
  if (onNext)      { this.onNext= onNext;           }
  if (onError)     { this.onError= onError;         }
  if (onCompleted) { this.onCompleted= onCompleted; }
}

m4_member(Observer, onNext) noop;
m4_member(Observer, onError) noop;
m4_member(Observer, onCompleted) noop;

/*====================================================================
 * Make an object observable by giving it a subscribe method, along
 * with helper functions for sending messages to subscribers.
 *
 * Can be applied to a prototype as well as an object.
 *
 * This mixin seemed preferable to a base class.
 */

function makeObservable( obj ) {
  Object.defineProperty( obj, 'subscribe', {value: subscribe} );
}

function subscribe( obs ) {
  if (this.subscribers) {
    this.subscribers.push( obs );
  }
  else {
    Object.defineProperty( this, 'subscribers', {value: [obs]} );
  }
}

function Observable() {
}

m4_member(Observable, subscribe) subscribe;

function sendNext( obsvable, value, skip ) {
  if (obsvable.subscribers) {
    obsvable.subscribers.forEach( function( obsver ) {
      if (obsver !== skip) {
        setTimeout( function() { obsver.onNext( value, obsvable ); }, 0 );
      }
    } );
  }
}

function sendError( obsvable, error, skip ) {
  if (obsvable.subscribers) {
    obsvable.subscribers.forEach( function( obsver ) {
      if (obsver !== skip) {
        setTimeout( function() { obsver.onError( error, obsvable ); }, 0 );
      }
    } );
  }
}

function sendCompleted( obsvable, value, skip ) {
  if (obsvable.subscribers) {
    obsvable.subscribers.forEach( function( obsver ) {
      if (obsver !== skip) {
        setTimeout( function() { obsver.onCompleted( value, obsvable ); }, 0 );
      }
    } );
  }
}

/*====================================================================
 * A value to which sends events every time it changes.
 */

function ObservableValue() {
  if (arguments.length >= 2) {
    this.owner= arguments[0];
    this.value= arguments[1];
  }
  else {
    this.owner= this;
    this.value= arguments[0];
  }
}

// Note that subscribing automatically triggers a "next" event
m4_member(ObservableValue, subscribe)
function subscribe( observer ) {
  if (this.subscribers) {
    this.subscribers.push( observer );
  }
  else {
    this.subscribers= [observer];
  }
  observer.onNext( this.value, this.owner );
}

m4_member(ObservableValue, get)
function get() {
  return this.value;
}

m4_member(ObservableValue, set)
function set( value, by ) {
  var owner= this.owner;
  this.value= value;
  if (this.subscribers) {
    this.subscribers.forEach( function( obsver ) {
      if (obsver !== by) {
        setTimeout( function() { obsver.onNext( value, owner ); }, 0 );
      }
    } );
  }
}

