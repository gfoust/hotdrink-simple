m4_module
m4_import(utility.noop,
          utility.Observable)
m4_export(Promise,
          PromiseLadder)

/*====================================================================
 * Promise made to supply a value to a variable.
 *
 * Just an Observable, except that when the last subscriber is removed
 * then it notifies it's keeper that it has become irrelevant.
 */

function Promise( keeper, target ) {
  this.keeper= keeper;
  this.target= target;
}

m4_subtype(Promise, Observable)

/*--------------------------------------------------------------------
 * Unsubscribe observer
 */
m4_member(Promise, removeSubscriber)
function removeSubscriber( obsver ) {
  Observable.prototype.removeSubscriber.call( this, obsver );
  if (this.subscriptions.length == 0) {
    this.keeper.promiseIrrelevant( this );
  }
}

/*--------------------------------------------------------------------
 * Update promise with next value.
 */

m4_member(Promise, update)
function update( value, source ) {
  this.sendNext( value, source );
}

/*--------------------------------------------------------------------
 * Fulfill promise with final value.
 */

m4_member(Promise, fulfill)
function fulfill( value, source ) {
  this.sendCompleted( value, source );
  delete this.subscriptions;
}


/*====================================================================
 * Keeps track of promises made to a particular variable.
 */

function PromiseLadder( keeper, target ) {
  this.keeper= keeper;
  this.target= target;
  this.promises= [];
}

m4_subtype(PromiseLadder, Observable)

/*--------------------------------------------------------------------
 * Return the most recent promise made for this variable.
 */
m4_member(PromiseLadder, currentPromise)
function currentPromise() {
  var length= this.promises.length;
  return length > 0 ? this.promises[length - 1] : undefined;
}

/*--------------------------------------------------------------------
 * Add a new promise to this variable.
 */
m4_member(PromiseLadder, add)
function add( promise ) {
  LOG(PROMISE, this.target + ' promised by ' + promise.keeper);
  this.promises.push( promise );
  promise.addSubscriber( this );
}

/*--------------------------------------------------------------------
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
 * Accept intermediate value for a promise.
 */
m4_member(PromiseLadder, onNext)
function onNext( value, promise ) {

  // Make sure we're still interested in this one
  var i= this.promises.indexOf( promise );
  if (i >= 0) {
    LOG(PROMISE, 'Updating ' + this.target + ' => ' + JSON.stringify(value))
    // Remove any older promises
    if (i > 0) {
      for (var j= 0; j < i; ++j) {
        var promise= this.promises[j];
        LOG(PROMISE, this.target + ' dropping promise by ' + promise.keeper)
        promise.removeSubscriber( this );
      }
      this.promises.splice( 0, i );
    }
    this.sendNext( value );
  }
}


/*--------------------------------------------------------------------
 * Accept final value for a promise.
 */
m4_member(PromiseLadder, onCompleted)
function onCompleted( value, promise ) {

  // Make sure we're still interested in this one
  var i= this.promises.indexOf( promise );
  if (i >= 0) {
    LOG(PROMISE, 'Updating ' + this.target + ' => ' + JSON.stringify(value))
    LOG(PROMISE, promise.keeper + ' promise fulfilled')
    // Remove any older promises
    for (var j= 0; j < i; ++j) {
      var promise= this.promises[j];
      LOG(PROMISE, this.target + ' dropping promise by ' + promise.keeper)
      promise.removeSubscriber( this );
    }
    this.promises.splice( 0, i + 1 );
    this.sendNext( value );
  }
}
