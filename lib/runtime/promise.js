m4_module
m4_import(utility.noop,
          utility.makeObservable,
          utility.sendNext,
          utility.sendError,
          utility.sendCompleted)
m4_export(PromiseManager,
          Promise,
          PromiseListener)

/*====================================================================
 * Keeps track of promises made to a particular variable.
 */

function PromiseManager( system, vv ) {
  this.system= system;
  this.vv= vv;
  this.promises= [];
}

/*--------------------------------------------------------------------
 * Return the most recent promise made for this variable.
 */
m4_member(PromiseManager, currentPromise)
function currentPromise() {
  var length= this.promises.length;
  return length > 0 ? this.promises[length - 1] : undefined;
}

/*--------------------------------------------------------------------
 * Add a new promise to this variable.
 */
m4_member(PromiseManager, add)
function add( promise ) {
  LOG(PROMISE, this.vv + ' listening to ' +
      promise.keeper.mm.name + ' [' + promise.keeper.generation + ']')
  this.promises.push( promise );
  promise.subscribe( this );
  if (! this.vv.pending.get()) {
    this.vv.pending.set( true, this.system );
  }
}

/*--------------------------------------------------------------------
 */
m4_member(PromiseManager, clear)
function clear() {
  this.promises.forEach( function( promise ) {
    LOG(PROMISE, this.vv + ' no longer listening to ' +
        promise.keeper.mm.name + ' [' + promise.keeper.generation + ']')
    promise.unsubscribe( this );
  }, this );
  this.promises= [];
}

/*--------------------------------------------------------------------
 * Accept intermediate value for a promise.
 */
m4_member(PromiseManager, onNext)
function onNext( value, promise ) {
  // Make sure we're still interested in this one
  var i= this.promises.indexOf( promise );
  if (i >= 0) {
    // Remove any older promises
    if (i > 0) {
      for (var j= 0; j < i; ++j) {
        var promise= this.promises[j];
        LOG(PROMISE, this.vv + ' no longer listening to ' +
            promise.keeper.mm.name + ' [' + promise.keeper.generation + ']')
        promise.unsubscribe( this );
      }
      this.promises.splice( 0, i );
    }
    this.vv.set( value, this.system );
  }
}


/*--------------------------------------------------------------------
 * Accept final value for a promise.
 */
m4_member(PromiseManager, onCompleted)
function onCompleted( value, promise ) {
  // Process value
  this.onNext( value, promise );

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

/*====================================================================
 * Promise made to supply a value to a variable.
 *
 * Just an Observable, except it also provides an unsubscribe
 * for when someone decides they don't need the value anymore.
 *
 * If last subscriber unsubscribes then it notifies it's
 * keeper that it has become irrelevant.
 */

function Promise( keeper ) {
  this.keeper= keeper;
}

makeObservable( Promise.prototype );

/*--------------------------------------------------------------------
 * Unsubscribe observer
 */
m4_member(Promise, unsubscribe)
function unsubscribe( obsver ) {
  if (this.subscribers) {
    var i= this.subscribers.indexOf( obsver );
    if (i >= 0) {
      this.subscribers.splice( i, 1 );
      if (this.subscribers.length == 0) {
        this.keeper.promiseIrrelevant( this );
      }
    }
  }
}

m4_member(Promise, update)
function update( value, source ) {
  sendNext( this, value, source );
}

m4_member(Promise, fulfill)
function fulfill( value, source ) {
  sendCompleted( this, value, source );
  delete this.subscribers;
}

/*====================================================================
 */

function PromiseListener( owner, name ) {
  this.owner= owner;
  this.name= name;
}

m4_member(PromiseListener, listen)
function listen( promise ) {
  this.promise= promise;
  promise.subscribe( this );
}

m4_member(PromiseListener, stop)
function stop() {
  this.promise.unsubscribe( this );
  this.promise= null;
}

m4_member(PromiseListener, onNext)
function onNext( value, promise ) {
  this.owner.varNext( this.name, value, promise );
}

m4_member(PromiseListener, onCompleted)
function onCompleted( value, promise ) {
  this.owner.varCompleted( this.name, value, promise );
}

m4_member(PromiseListener, onError) noop;