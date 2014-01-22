/*********************************************************************
 * Method streams
 */
m4_module
m4_import(utility.noop,
          utility.shallowCopy,
          utility.setDiff,
          utility.setIntersect,
          utility.makeObservable,
          utility.Promise,
          utility.PromiseLadder,
          model.Variable)
m4_export(MethodStream)

/*====================================================================
 * A MethodStream represents a single edge in the evaluation graph.
 * It is an event stream for two reasons:
 *
 * One is that, if any of its inputs are promises, it will subscribe
 * to them and execute the method once for every value produced by the
 * inputs (beginning as soon as every promise has produced at least
 * one value).
 *
 * The other is that, when the method actually executes, it may return
 * a promise instead of a value, in which case the promise may
 * produce multiple results.
 *
 * This means that a single stream can have multiple method
 * executions, each of which returns multiple values.  The resulting
 * values are combined into a single stream (per output variable) by
 * means of a PromiseLadder.
 */

var count= 0;

function MethodStream( system, mm ) {
  // The ConstraintSystem that created this stream
  this.system= system;

  // The method to be run
  this.mm= mm;

  // Promises made corresponding to mm.outputVars
  this.outputPromises= [];

  // Any promises subscribed to for inputs
  this.inputPromises= [];

  // Map variables to names in context (map<var_id, context_name>)
  this.inputNames= {};

  // Any input variables for which we have yet to receive any value (set<var_id>)
  this.missingInputs= {};

  // The number of inputs for which we have yet to receive any value
  // (corresponds to number of keys in this.missingInputs)
  this.missingInputCount= 0;

  // Number of inputs for which we have yet to receive the final value
  this.pendingInputCount= 0;

  // Number of output promises which still have at least one subscriber
  this.relevantOutputCount= 0;

  // True = we have received at least one new input value since last execution
  this.inputsHaveChanged= false;

  // Copy of the context for the method, with all variables replaced by their values
  this.contextCopy= {};

  // Debug information - a generation number so we can tell streams apart
  this.generation= system.generation

  // Debug information - a version number so we can tell executions apart
  this.version= 0;
}

/*--------------------------------------------------------------------
 * Debug information - a readable name for a stream
 */
m4_member(MethodStream, toString)
function toString() {
  return this.mm.name + ' [' + this.generation + ']';
}

/*--------------------------------------------------------------------
 * Grab a single input parameter for the stream.
 *
 * If there's currently a promise for the input, then subscribe to it.
 * If not, then copy its value into the context copy.
 */
m4_member(MethodStream, gatherInput)
function gatherInput( name ) {
  var value= this.mm.context[name];
  if (value instanceof Variable) {
    var promise;
    if (promise= this.system.getPromise( value ))
    {
      ++this.missingInputCount;
      this.missingInputs[value]= true;
      this.inputNames[value]= name;
      this.inputPromises.push( promise );
      promise.addSubscriber( this, this.onNextInput, noop, this.onCompletedInput );
    }
    else {
      this.contextCopy[name]= value.get();
    }
  }
  else {
    this.contextCopy[name]= value;
  }
}

/*--------------------------------------------------------------------
 * Prepare outputs for the methods by making promises for each
 * output and registering the promise with the constraint system.
 *
 * If any outputs are used also used as inputs (self-loop) then we
 * must gather them /before/ we create a new promise for them.
 */
m4_member(MethodStream, prepareOutputs)
function prepareOutputs() {
  setIntersect( this.mm.inputs, this.mm.outputs )
    .forEach( this.gatherInput, this );

  this.mm.outputVars.forEach( function( vv ) {

    var promise= new PromiseLadder( this, vv );
    this.system.addPromise( vv, promise );
    this.outputPromises.push( promise );
    ++this.relevantOutputCount;

  }, this );
}

/*--------------------------------------------------------------------
 * Prepare inputs by gathering their values.
 *
 * Any inputs which are also outputs have been gathered already
 * by prepareOutputs.
 */
m4_member(MethodStream, prepareInputs)
function prepareInputs() {
  setDiff( this.mm.inputs, this.mm.outputs )
    .forEach( this.gatherInput, this );

  this.pendingInputCount= this.missingInputCount;
  this.inputsHaveChanged= true;
}

/*--------------------------------------------------------------------
 * Called by a promise made by this method when it becomes irrelevant
 * (no longer has any subscribers).
 */
m4_member(MethodStream, promiseIrrelevant)
function promiseIrrelevant( promise ) {
  if (--this.relevantOutputCount == 0) {
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
m4_member(MethodStream, onNextInput)
function onNextInput( value, promise ) {
  var vv= promise.target;
  var name= this.inputNames[vv];
  this.contextCopy[name]= value;
  if (this.missingInputs[vv]) {
    --this.missingInputCount;
    delete this.missingInputs[vv];
  }
  this.inputsHaveChanged= true;
  this.run();
}

/*--------------------------------------------------------------------
 * Called when a promise for an input variable we were waiting on
 * has been completely fulfilled.
 */
m4_member(MethodStream, onCompletedInput)
function onCompletedInput( value, promise ) {
  --this.pendingInputCount;
  this.onNextInput( value, promise );
}

/*--------------------------------------------------------------------
 * Kicks off a new execution if appropriate.
 *
 * "Appropriate" means we've received at least one value from every
 * input promise, and at least one new value since the last execution.
 */
m4_member(MethodStream, run)
function run() {
  if (this.missingInputCount > 0 || ! this.inputsHaveChanged) { return; }
  this.inputsHaveChanged= false;
  this.version++;

  LOG(STREAM, this.mm.name + ' [' + this.generation + '-' + this.version + '] running')
  hd.run= {generation: this.generation,
           version: this.version,
           inputsComplete: this.pendingInputCount == 0};
  var data= execute( this.mm.fn, this.contextCopy );
  delete hd.run;

  if (data.error) {
    // TODO: figure out how to handle this
  }
  else {
    var numOutputs= this.outputPromises.length;
    if (numOutputs == 1) {
      data.result= [data.result];
    }
    for (var i= 0; i < numOutputs; ++i) {
      if (this.pendingInputCount == 0) {
        this.outputPromises[i].finalize();
      }
      if (data.result[i] instanceof Promise) {
        this.outputPromises[i].add( data.result[i] );
      }
      else {
        this.outputPromises[i].onCompleted( data.result[i] );
        // this has the same effect as:
        //     var promise= new Promise( this );
        //     this.outputPromises[i].add( promise );
        //     promise.onCompleted( data.result[i] );
      }
    }
  }
}

/*====================================================================
 */

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

function getter( context, used, key ) {
  return function() {
    used[key]= true;
    return context[key];
  };
}
