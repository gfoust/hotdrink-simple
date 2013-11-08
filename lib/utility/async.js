m4_module
m4_export(Task)

function Task( fn, context ) {
  this.fn= fn;
  this.context= context;
}

m4_member(Task, runSync)
function runSync( onCompleted, onError ) {
  try {
    onCompleted( this.fn.call( this.context ) );
  }
  catch (e) {
    onError( e );
  }
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