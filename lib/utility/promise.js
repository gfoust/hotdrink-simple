m4_module
m4_import(utility.noop,
          utility.Observable)
m4_export(Promise,
          PromiseLadder)

/*====================================================================
 * Promise made to supply a value to a variable.
 *
 * A Promise is just an Observable, with the following additions:
 *
 * 1.  It has fields for the keeper of the promise and the target
 *     of the promise.
 * 2.  If the "removeSubscriber" method is used to remove the last
 *     subscriber then it notifies its keeper that it has become
 *     irrelevant.
 * 3.  After an error or completed event is triggered it removes
 *     all subscribers.  This means (a.) no further events can occur
 *     for that promise, and (b.) the promise cannot become
 *     irrelevant (since there is not a last subscriber to remove).
 */

function Promise( keeper, target ) {
  this.keeper= keeper;
  this.target= target;
}

m4_subtype(Promise, Observable)

/*--------------------------------------------------------------------
 * Notify keeper this promise has become irrelevant
 */
m4_member(Promise, makeIrrelevant)
function makeIrrelevant() {
  if (this.keeper && typeof this.keeper.promiseIrrelevant == 'function') {
    this.keeper.promiseIrrelevant( this );
  }
}

/*--------------------------------------------------------------------
 * Override - notify promise keeper when last subscriber is removed
 */
m4_member(Promise, removeSubscriber)
function removeSubscriber( obsver ) {
  // If this is the last one, then notify keeper
  if (Observable.prototype.removeSubscriber.call( this, obsver )
      && this.subscriptions.length == 0)
  {
    this.makeIrrelevant();
  }
}

/*--------------------------------------------------------------------
 * Override - remove all subscribers
 */
m4_member(Promise, sendCompleted)
function sendCompleted( value, prevSource ) {
  Observable.prototype.sendCompleted.call( this, value, prevSource );
  delete this.subscriptions;
}

/*--------------------------------------------------------------------
 * Override - remove all subscribers
 */
m4_member(Promise, sendCompleted)
function sendError( value, prevSource ) {
  Observable.prototype.sendCompleted.call( this, value, prevSource );
  delete this.subscriptions;
}

/*--------------------------------------------------------------------
 * Subscribing a promise to another observable simply passes on any
 * values received.
 */

m4_member(Promise, onNext)
function onNext( value, source ) {
  this.sendNext( value, source );
}

m4_member(Promise, onCompleted)
function onCompleted( value, source ) {
  this.sendCompleted( value, source );
}

/*--------------------------------------------------------------------
 * More intuitive names for programmers.
 */

m4_member(Promise, update)  m4_member_ref(Promise, onNext)

m4_member(Promise, fulfill) m4_member_ref(Promise, onCompleted)

/*====================================================================
 * A PromiseLadder is a sort of stream combinator -- making an event
 * stream by combining other event streams (promises).  The events it
 * generates are the events which are produced by the promise which
 * (1.) was most recently added to the ladder, and (2.) has produced
 * at least one event so far.
 *
 * Thus, when a promise produces an event, all promises which had been
 * added prior to that promise become irrelevant (at least, as far as
 * the ladder is concerned).  Thus, at this point the ladder
 * unsubscribes from them and drops them.
 */

function PromiseLadder( keeper, target ) {
  Promise.call( this, keeper, target );
  this.complete= false;
  this.promises= [];
}

m4_subtype(PromiseLadder, Promise)

/*--------------------------------------------------------------------
 * Return the most recent active promise added to this ladder.
 * (Active meaning it hasn't been completed yet.)
 */
m4_member(PromiseLadder, currentPromise)
function currentPromise() {
  var length= this.promises.length;
  return length > 0 ? this.promises[length - 1] : undefined;
}

/*--------------------------------------------------------------------
 * Add a new promise to this ladder.
 */
m4_member(PromiseLadder, add)
function add( promise ) {
  LOG(PROMISE, this.target + ' promised by ' + promise.keeper);
  this.promises.push( promise );
  promise.addSubscriber( this );
}

/*--------------------------------------------------------------------
 * Indicates that no further promises will ever be added to this
 * ladder.  This means that once all the existing promises are
 * fulfilled the ladder can send a completed message.
 */
m4_member(PromiseLadder, finalize)
function finalize() {
  this.complete= true;
}

/*--------------------------------------------------------------------
 * This is basically a destructor - it forces the ladder to
 * unsubscribe from and drop all promises.
 *
 * Used when the ladder becomes irrelevant and is being disposed of.
 */
m4_member(PromiseLadder, clear)
function clear() {
  this.promises.forEach( function( promise ) {
    LOG(PROMISE, this.target + ' dropping promise by ' + promise.keeper)
    promise.removeSubscriber( this );
  }, this );
  this.promises= [];
}


/*--------------------------------------------------------------------
 * Unsubscribe an observer
 */
m4_member(PromiseLadder, removeSubscriber)
function removeSubscriber( obsver ) {
  Promise.prototype.removeSubscriber.call( this, obsver );
  this.clear();
}

/*--------------------------------------------------------------------
 * Accept intermediate value for a promise.
 *
 * As a convenience, calling onNext with undefined as the promise is
 * the same as adding a new promise and then updating the promise
 * immediately.  (Avoids creating useless promises.)
 */
m4_member(PromiseLadder, onNext)
function onNext( value, promise ) {

  // Make sure we're still interested in this one
  var i= promise ? this.promises.indexOf( promise ) : this.promises.length;
  if (i >= 0) {
    LOG(PROMISE, 'Updating ' + this.target + ' => ' + JSON.stringify(value))
    // Remove any older promises
    if (i > 0) {
      for (var j= 0; j < i; ++j) {
        var oldPromise= this.promises[j];
        LOG(PROMISE, this.target + ' dropping promise by ' + oldPromise.keeper)
        oldPromise.removeSubscriber( this );
      }
      this.promises.splice( 0, i );
    }
    this.sendNext( value, promise );
  }
}

/*--------------------------------------------------------------------
 * Accept final value for a promise.
 *
 * As a convenience, calling onCompleted with undefined as the promise
 * is the same as adding a new promise and then completing the promise
 * immediately.  (Avoids creating useless promises.)
 */
m4_member(PromiseLadder, onCompleted)
function onCompleted( value, promise ) {

  // Make sure we're still interested in this one
  var i= promise ? this.promises.indexOf( promise ) : this.promises.length;
  if (i >= 0) {
    LOG(PROMISE, 'Updating ' + this.target + ' => ' + JSON.stringify(value))
    LOG(PROMISE, (promise ? promise.keeper : 'Immediate') + ' promise fulfilled')
    // Remove any older promises
    for (var j= 0; j < i; ++j) {
      var oldPromise= this.promises[j];
      LOG(PROMISE, this.target + ' dropping promise by ' + oldPromise.keeper)
      oldPromise.removeSubscriber( this );
    }
    this.promises.splice( 0, i + 1 );

    // Only send complete when we're sure no further promises will ever arrive
    if (this.complete && this.promises.length == 0) {
      this.sendCompleted( value, promise );
    }
    else {
      this.sendNext( value, promise );
    }
  }
}
