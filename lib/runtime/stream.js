/*********************************************************************
 * Method streams
 */
m4_module
m4_import(utility.noop,
          utility.shallowCopy,
          utility.makeObservable,
          model.Variable,
          runtime.Promise)
m4_export(forceAsync,
          forceSync,
          MethodStream)

/*--------------------------------------------------------------------
 * A way to force all methods to run a/synchronously
 */

var runOverride;

function forceSync() {
  runOverride= 'runSync';
}

function forceAsync() {
  runOverride= 'runAsync';
}

/*====================================================================
 * A MethodStream represents a single (possibly asynchronous) execution
 * of a method.
 */

var count= 0;

function MethodStream( system, mm ) {
  // The ConstraintSystem that created this
  this.system= system;

  // The method to be run
  this.mm= mm;

  // Promises made corresponding to mm.outputs
  this.outputPromises= [];

  // Any promises subscribed to for inputs
  this.inputPromises= [];

  // Map variables to names in context
  this.inputNames= {};

  // Any input variables for which we have yet to receive any value
  this.missingInputs= {};

  // The number of inputs for which we have yet to receive any value
  this.missingInputCount= 0;

  // Number of inputs for which we have yet to receive the final value
  this.pendingInputCount= 0;

  // Number of output promises which are still have at least one subscriber
  this.relevantOutputCount= 0;

  // True = we have received at least one new input value since last execution
  this.inputsHaveChanged= false;

  // Copy of the context for the method, with all variables replaced by their values
  this.context= {};

  this.version= 1;

  this.latestVersion= 0;

  this.finalVersion= undefined;

DEBUG_BEGIN
  // Debug information - a generation number so we can tell them apart
  this.generation= system.generation
DEBUG_END
}

/*--------------------------------------------------------------------
 */
m4_member(MethodStream, nextVersion)
function nextVersion() {
  return this.version++;
}

/*--------------------------------------------------------------------
 * Prepare outputs for the methods by making promises for each
 * output and registering the promise with the constraint system.
 */
m4_member(MethodStream, prepareOutputs)
function prepareOutputs() {
  this.mm.outputs.forEach( function( vv ) {

    var promise= new Promise( this, vv );
    this.system.addPromise( vv, promise );
    this.outputPromises.push( promise );
    ++this.relevantOutputCount;

  }, this );
}

/*--------------------------------------------------------------------
 * Prepare inputs by copying their current value into the context,
 * or, if there is currently a promise for that variable, subscribing
 * to the promise.
 */
m4_member(MethodStream, prepareInputs)
function prepareInputs() {
  for (var name in this.mm.context) {
    var value= this.mm.context[name];
    if (value instanceof Variable) {
      var promise;
      if (this.mm.outputs.indexOf( value ) == -1 &&
          (promise= this.system.getPromise( value )))
      {
        ++this.missingInputCount;
        this.missingInputs[value]= true;
        this.inputNames[value]= name;
        this.inputPromises.push( promise );
        promise.addSubscriber( this, this.onInputNext, noop, this.onInputCompleted );
      }
      else {
        this.context[name]= value.get();
      }
    }
    else {
      this.context[name]= value;
    }
  }
  this.pendingInputCount= this.missingInputCount;
  this.inputsHaveChanged= true;
}

/*--------------------------------------------------------------------
 * Kicks off a new execution if appropriate.
 * "Appropriate" means there is no current execution underway
 * and we are ready for a new execution.
 */
m4_member(MethodStream, start)
function start() {
  if (this.missingInputCount > 0 || ! this.inputsHaveChanged) { return; }
  this.inputsHaveChanged= false;
  if (this.pendingInputCount == 0) {
    this.finalVersion= this.version;
  }

  if (runOverride) {
    this[runOverride]();
  }
  else if (this.mm.async) {
    this.runAsync();
  }
  else {
    this.runSync();
  }
}

/*--------------------------------------------------------------------
 * Called by a promise made by this method when it becomes irrelevant
 * (no longer has any subscribers).
 */
m4_member(MethodStream, promiseIrrelevant)
function promiseIrrelevant( promise ) {
  if (--this.relevantOutputCount == 0) {
    this.system.pool.cancelBefore( this, this.version );
    this.inputPromises.forEach( function( p ) {
      p.removeSubscriber( this )
    }, this );
    this.inputPromises= [];
  }
}

/*--------------------------------------------------------------------
 * Called when a promise for an input variable we were waiting on
 * produces an intermediate value.
 */
m4_member(MethodStream, onInputNext)
function onInputNext( value, promise ) {
  var vv= promise.target;
  var name= this.inputNames[vv];
  this.context[name]= value;
  if (this.missingInputs[vv]) {
    --this.missingInputCount;
    delete this.missingInputs[vv];
  }
  this.inputsHaveChanged= true;
  this.start();
}

/*--------------------------------------------------------------------
 * Called when a promise for an input variable we were waiting on
 * has been completely fulfilled.
 */
m4_member(MethodStream, onInputCompleted)
function onInputCompleted( value, promise ) {
  --this.pendingInputCount;
  this.onInputNext( value, promise );
}

/*--------------------------------------------------------------------
 * Called when any execution notifies, or when an execution based
 * on a notification completes
 */
m4_member(MethodStream, onNext)
function onNext( data ) {
  if (data.version < this.latestVersion) {
    LOG(STREAM, '***Ignoring***')
    return;
  }

  if (data.version > this.latestVersion) {
    this.latestVersion= data.version;
    this.system.pool.cancelBefore( this, this.latestVersion );
  }

  var numOutputs= this.outputPromises.length;
  if (numOutputs == 1) {
    this.outputPromises[0].update( data.result );
  }
  else {
    for (var i= 0; i < numOutputs; ++i) {
      this.outputPromises[i].update( data.result[i] );
    }
  }
  this.start();
}

/*--------------------------------------------------------------------
 * Only called when the final execution finally completes
 */
m4_member(MethodStream, onCompleted)
function onCompleted( data ) {
  if (this.finalVersion === undefined || data.version < this.finalVersion) {
    this.onNext( data );
    return;
  }

  if (data.version > this.latestVersion) {
    this.latestVersion= data.version;
    this.system.pool.cancelBefore( this, this.latestVersion );
  }

  var numOutputs= this.outputPromises.length;
  if (numOutputs == 1) {
    this.outputPromises[0].fulfill( data.result );
  }
  else {
    for (var i= 0; i < numOutputs; ++i) {
      this.outputPromises[i].fulfill( data.result[i] );
    }
  }
}

m4_member(MethodStream, onError)
function onError( data ) {
}

/*--------------------------------------------------------------------
 * Runs the method asynchronously
 */
m4_member(MethodStream, runAsync)
function runAsync() {
  LOG(STREAM, this.mm.name + ' [' + this.generation + '-' + this.version + '] scheduled')
  this.system.pool.schedule( this,
                             this.mm.fn,
                             shallowCopy( this.context ),
                             this.nextVersion(),
                             this.pendingInputCount == 0
                           )
}

/*--------------------------------------------------------------------
 * Runs the method synchronously using setTimeout.
 */
m4_member(MethodStream, runSync)
function runSync() {
  LOG(STREAM, this.mm.name + ' [' + this.generation + '-' + this.version + '] running')
  var version= this.nextVersion();
  var inputsComplete= this.inputsComplete;

  var stream= this;
  var fn= this.mm.fn;
  var context= this.context;

  setTimeout( function() {
    hd.version= version;
    hd.inputsComplete= inputsComplete;
    var result= execute( fn, context );
    delete hd.version;
    delete hd.inputsComplete;
    if (result.error) {
      stream.onError( result, stream );
    }
    else {
      stream.onCompleted( result, stream );
    }
  }, 0 );
}

/*====================================================================
 */

function getter( context, used, key ) {
  return function() {
    used[key]= true;
    return context[key];
  };
}

function execute( fn, context ) {
  var used= {};
  var proxy= {};

  for (var key in context) {
    Object.defineProperty( proxy, key,
                           {enumerable: true,
                            get: getter( context, used, key )} );
  }

  try {
    var result= fn.call( proxy );
    return {used: used, result: result, version: hd.version, complete: true};
  }
  catch (e) {
    return {used: used, error: error, version: hd.version, complete: true};
  }
}
