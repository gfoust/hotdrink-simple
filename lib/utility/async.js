m4_module
m4_export(Task)

function Task( fn, context ) {
  this.fn= fn;
  this.context= context;
}

function getter( context, used, key ) {
  return function() {
    used[key]= true;
    return context[key];
  };
}

m4_member(Task, runSync)
function runSync( onCompleted, onError ) {
  var fn= this.fn;
  var used= {};
  var proxy= {};
  for (var key in this.context) {
    Object.defineProperty( proxy, key,
                           {enumerable: true,
                            get: getter( this.context, used, key )} );
  }

  setTimeout( function() {
    try {
      var result= fn.call( proxy );
      onCompleted( {used: used, result: result} );
    }
    catch (e) {
      if (onError) {
        onError( e );
      }
    }
  }, 0 );
}

m4_member(Task, runAsync)
function runAsync( onCompleted, onError ) {
  var worker= getWorker();

  worker.onmessage= function( event ) {
    onCompleted( event.data );
    returnWorker( worker );
  };

  worker.onerror= function( event ) {
    LOG( "Web Worker error: " + event.message );
    if (onError) {
      onError();
    }
  };

  worker.postMessage( {
    fn: this.fn.toString(),
    context: this.context
  } );
}

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