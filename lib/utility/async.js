m4_module

m4_import(utility.WorkerPool,
          utility.Promise,
          utility.shallowCopy)
m4_export(setPoolSize,
          async,
          delay)

var globalPool= new WorkerPool();

function setPoolSize( n ) {
  globalPool.max= n;
}

function async( fn, numOutputs ) {
  return function() { return globalPool.schedule( fn, this, numOutputs ) };
}

function delay( timeout_ms, fn, numOutputs ) {
  if (! numOutputs) {
    numOutputs= 1;
  }

  return function() {
    var outputs= [];
    for (var i= 0; i < numOutputs; ++i) {
      outputs[i]= new Promise( this, i );
    }

    var context= shallowCopy( this );

    setTimeout( function() {
      var results= fn.call( context );
      if (numOutputs == 1) {
        results= [results];
      }
      for (var i= 0; i < numOutputs; ++i) {
        outputs[i].fulfill( results[i] );
      }
    }, timeout_ms );

    return numOutputs == 1 ? outputs[0] : outputs;
  }
}