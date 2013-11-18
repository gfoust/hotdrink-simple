/*********************************************************************
 * Method runs
 */
m4_module
m4_import(utility.noop,
          utility.makeObservable,
          utility.sendCompleted,
          model.Variable)
m4_export(forceAsync,
          forceSync,
          MethodRun)

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
 */

function VarPromise( system, vv ) {
  this.system= system;
  this.vv= vv;
  this.generation= system.generation;
}

makeObservable( VarPromise.prototype );

m4_member(VarPromise, fulfill)
function fulfill( value ) {
  if (this.vv.generation <= this.generation) {
    this.vv.set( value, this.system );
    this.vv.generation= this.generation;
  }
  if (this.vv.promise === this) {
    this.vv.promise= null;
    this.vv.pending.set( false );
  }
  sendCompleted( this, value );
}

/*====================================================================
 */

function MethodRun( system, mm ) {
  this.system= system;
  this.mm= mm;
  this.completed= false;
  this.promises= [];
}

m4_member(MethodRun, prepareOutputs)
function prepareOutputs() {
  this.mm.outputs.forEach( function( vv ) {
    var promise= new VarPromise( this.system, vv );
    vv.promise= promise;
    if (! vv.pending.get()) {
      vv.pending.set( true );
    }
    this.promises.push( promise );
  }, this );
}

m4_member(MethodRun, prepareInputs)
function prepareInputs() {
  this.pendingInputs= 0;
  this.context= {};
  for (var name in this.mm.context) {
    var value= this.mm.context[name];
    if (value instanceof Variable) {
      if (this.mm.outputs.indexOf( value ) == -1 && value.promise) {
        ++this.pendingInputs;
        value.promise.subscribe( {onNext: noop,
                                  onError: noop,
                                  onCompleted: this.varReady.bind( this, name )
                                 }
                               );
      }
      else {
        this.context[name]= value.get();
      }
    }
    else {
      this.context[name]= value;
    }
  }
}

m4_member(MethodRun, varReady)
function varReady( name, value ) {
  this.context[name]= value;
  --this.pendingInputs;
  this.start()
}

m4_member(MethodRun, start)
function start() {
  if (this.completed || this.pendingInputs != 0) { return; }

  if (runOverride) {
    this[runOverride]();
  }
  else if (this.async) {
    this.runAsync();
  }
  else {
    this.runSync();
  }
}

m4_member(MethodRun, runSync)
function runSync() {
  var run= this;
  var fn= this.mm.fn;
  var context= this.context;

  setTimeout( function() {
    var result= execute( fn, context );
    if ('error' in result) {
      run.onError( result, run );
    }
    else {
      run.onCompleted( result, run );
    }
  }, 0 );
}

m4_member(MethodRun, runAsync)
function runAsync() {
  var run= this;
  var worker= getWorker();

  worker.onmessage= function( event ) {
    run.onCompleted( event.data, run );
    returnWorker( worker );
  };

  worker.onerror= function( event ) {
    LOG( "Web Worker error: " + event.message );
    run.onError( event.data, run );
    returnWorker( worker );
  };

  worker.postMessage( {
    fn: this.mm.fn.toString(),
    context: this.context
  } );
}

m4_member(MethodRun, onNext) noop;

m4_member(MethodRun, onError) noop;

m4_member(MethodRun, onCompleted)
function onCompleted( data ) {
  if (data !== undefined) {
    var numOutputs= this.promises.length;
    if (numOutputs == 1) {
      this.promises[0].fulfill( data.result );
    }
    else {
      for (var i= 0; i < numOutputs; ++i) {
        this.promises[i].fulfill( data.result[i] );
      }
    }
  }
}

/*--------------------------------------------------------------------
 */

var availableWorkers= [];

function getWorker() {
  if (availableWorkers.length > 0) {
    return availableWorkers.pop();
  }
  else {
    return new Worker("worker.js");
  }
}

function returnWorker( worker ) {
  availableWorkers.push( worker );
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
    return {used: used, result: result};
  }
  catch (e) {
    return {used: used, error: error};
  }
}
