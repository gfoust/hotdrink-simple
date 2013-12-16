/********************************************************************
 * Various classes and functions enabling the observer pattern.
 */
m4_module
m4_import(utility.noop)
m4_export(Observer,
          Observable,
          ObservableValue,
          makeObservable)

/*====================================================================
 * In order to allow a single object to subscribe to multiple
 * observers, we allow subscribers to specify alternate methods to
 * use for callbacks.
 *
 * The subscription object simply stores the observer along with
 * any alternate callbacks.
 */
function Subscription( obsver, onNext, onError, onCompleted ) {
  this.obsver= obsver;
  if (onNext)      { this.onNext= onNext;           }
  if (onError)     { this.onError= onError;         }
  if (onCompleted) { this.onCompleted= onCompleted; }
}

/*--------------------------------------------------------------------
 * These invoke the callbacks, using the alternate if specified
 * or the default otherwise.
 */

m4_member(Subscription, sendNext)
function sendNext( value, source ) {
  var fn= this.onNext || this.obsver.onNext;
  fn.call( this.obsver, value, source );
}

m4_member(Subscription, sendError)
function sendError( value, source ) {
  var fn= this.onError || this.obsver.onError;
  fn.call( this.obsver, value, source );
}

m4_member(Subscription, sendCompleted)
function sendCompleted( value, source ) {
  var fn= this.onCompleted || this.obsver.onCompleted;
  fn.call( this.obsver, value, source );
}

/*====================================================================
 * Since JavaScript does not support multiple inheritance, it
 * seemed preferable to provide "observable" functionality as a
 * mixin rather than a base class.
 *
 */

function makeObservable( obj ) {
  Object.defineProperties( obj, {addSubscriber:    {value: addSubscriber},
                                 removeSubscriber: {value: removeSubscriber},
                                 sendNext:         {value: sendNext},
                                 sendError:        {value: sendError},
                                 sendCompleted:    {value: sendCompleted}
                                }
                         );

  // In order to support "observable" prototypes (and to avoid
  // performance penalty for "observable" objects which are never
  // observered), the "subscriptions" member is not created until it is
  // actually needed.
}

/*--------------------------------------------------------------------
 * Create new subscription for observer with optional alternate
 * callback methods.
 */
function addSubscriber( obsver, onNext, onError, onCompleted ) {
  var subscription= new Subscription( obsver, onNext, onError, onCompleted );
  if (this.subscriptions) {
    this.subscriptions.push( subscription );
  }
  else {
    Object.defineProperty( this, 'subscriptions', {value: [subscription]} );
  }
  return subscription;
}

/*--------------------------------------------------------------------
 * Remove any subscriptions for observer
 */
function removeSubscriber( obsver ) {
  if (this.subscriptions) {
    var numSubscriptions= this.subscriptions.length;
    var i= 0;
    while (i < numSubscriptions) {
      var subscription= this.subscriptions[i];
      if (subscription.obsver === obsver) {
        this.subscriptions.splice( i, 1 );
        --numSubscriptions;
      }
      else {
        ++i;
      }
    }
  }
}

/*--------------------------------------------------------------------
 * Send notifications to all observers -- except the one who
 * initiated this event.
 *
 * Note that these make a copy of the subscriptions array to iterate
 * over.  That's because it's possible that an observer may decide
 * to unsubscribe in response to this message; that would mess
 * the iteration if using the actual array.
 */

function sendNext( value, source ) {
  if (this.subscriptions) {
    this.subscriptions.slice( 0 ).forEach( function( subscription ) {
      if (subscription.obsver !== source) {
        subscription.sendNext( value, this );
      }
    }, this );
  }
}

function sendError( value, source ) {
  if (this.subscriptions) {
    this.subscriptions.slice( 0 ).forEach( function( subscription ) {
      if (subscription.obsver !== source) {
        subscription.sendError( value, this );
      }
    }, this );
  }
}

function sendCompleted( value, source ) {
  if (this.subscriptions) {
    this.subscriptions.slice( 0 ).forEach( function( subscription ) {
      if (subscription.obsver !== source) {
        subscription.sendCompleted( value, this );
      }
    }, this );
  }
}

/*====================================================================
 * Although there is no need for an actual Observable or Observer
 * type, I'd make them in case I ever wanted an object with no
 * functionality other than this.
 */

function Observable() {
}

makeObservable( Observable.prototype );

function Observer( onNext, onError, onCompleted ) {
  if (onNext)      { this.onNext= onNext;           }
  if (onError)     { this.onError= onError;         }
  if (onCompleted) { this.onCompleted= onCompleted; }
}

m4_member(Observer, onNext) noop;
m4_member(Observer, onError) noop;
m4_member(Observer, onCompleted) noop;

/*====================================================================
 * A value which sends events every time it changes.
 */

function ObservableValue( owner, name, init ) {
  this.owner= owner;
  this.name= name;
  this.value= init;
}
m4_subtype(ObservableValue, Observable)

/*--------------------------------------------------------------------
 * Override so that subscribing automatically triggers a "next" event
 */
m4_member(ObservableValue, addSubscriber)
function addSubscriber( obsver, onNext, onError, onCompleted ) {
  Observable.prototype.addSubscriber
    .call( this, obsver, onNext, onError, onCompleted )
    .sendNext( this.value, this.owner);
}

/*--------------------------------------------------------------------
 * Getter & Setter
 */

m4_member(ObservableValue, get)
function get() {
  return this.value;
}

m4_member(ObservableValue, set)
function set( value, source ) {
  LOG(VAR, this.owner + '.' + this.name +
      ' set by ' + (source ? source.constructor.name : '???'))
  this.value= value;
  if (this.subscriptions) {
    this.subscriptions.forEach( function( subscription ) {
      if (subscription.obsver !== source) {
        subscription.sendNext( value, this.owner );
      }
    }, this );
  }
}

