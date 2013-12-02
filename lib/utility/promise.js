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

function PromiseLadder( system, vv ) {
  this.system= system;
  this.vv= vv;
  this.promises= [];
}

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
  LOG(PROMISE, this.vv.id + ' listening to ' +
      promise.keeper.mm.name + ' [' + promise.keeper.generation + ']')
  this.promises.push( promise );
  promise.addSubscriber( this );
  if (! this.vv.pending.get()) {
    this.vv.pending.set( true, this.system );
  }
}

/*--------------------------------------------------------------------
 */
m4_member(PromiseLadder, clear)
function clear() {
  this.promises.forEach( function( promise ) {
    LOG(PROMISE, this.vv.id + ' no longer listening to ' +
        promise.keeper.mm.name + ' [' + promise.keeper.generation + ']')
    promise.removeSubscriber( this );
  }, this );
  this.promises= [];
}

/*--------------------------------------------------------------------
 * Accept intermediate value for a promise.
 */
m4_member(PromiseLadder, onNext)
function onNext( value, promise ) {
  LOG(PROMISE, 'Updating ' + this.vv.id + ' [' +
      promise.keeper.generation + '] => ' + JSON.stringify(value))
  // Make sure we're still interested in this one
  var i= this.promises.indexOf( promise );
  if (i >= 0) {
    // Remove any older promises
    if (i > 0) {
      for (var j= 0; j < i; ++j) {
        var promise= this.promises[j];
        LOG(PROMISE, this.vv.id + ' no longer listening to ' +
            promise.keeper.mm.name + ' [' + promise.keeper.generation + ']')
        promise.removeSubscriber( this );
      }
      this.promises.splice( 0, i );
    }
    this.vv.set( value, this.system );
  }
}


/*--------------------------------------------------------------------
 * Accept final value for a promise.
 */
m4_member(PromiseLadder, onCompleted)
function onCompleted( value, promise ) {
  // Process value
  this.onNext( value, promise );
  LOG(PROMISE, this.vv.id + ' [' +
      promise.keeper.generation + '] fulfilled')

  // Promise has been fulfilled; get rid of it
  if (this.promises[0] === promise) {
    var promise=
      this.promises.shift();
    LOG(PROMISE, this.vv + ' has finished ' +
        promise.keeper.mm.name + ' [' + promise.keeper.generation + ']')
    if (this.promises.length == 0 && this.vv.pending.get()) {
      this.vv.pending.set( false, this.system );
    }
  }
}
