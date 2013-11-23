m4_module
m4_import(utility.noop)
m4_export(WorkerPool)

var source= 'worker.js';

function Task( stream, fn, context, version, inputsComplete ) {
  this.stream= stream;
  this.fn= fn;
  this.context= context;
  this.version= version;
  this.inputsComplete= inputsComplete;
}

/*====================================================================
 */
function WorkerPool( max ) {
  if (max === undefined) {
    max= 20;
  }
  this.max= max;
  this.available= [];
  this.running= [];
  this.queued= [];
}

/*--------------------------------------------------------------------
 */
m4_member(WorkerPool, schedule)
function schedule( stream, fn, context, version, inputsComplete ) {
  task= new Task( stream, fn, context, version, inputsComplete );
  if (this.available.length > 0) {
    this.execute( this.available.shift(), task );
  }
  else if (this.running.length < this.max) {
    this.execute( new Worker( source ), task );
  }
  else {
    this.queued.push( task );
  }
}

/*--------------------------------------------------------------------
 */
m4_member(WorkerPool, execute)
function execute( worker, task ) {
  task.worker= worker;
  this.running.push( task );

  worker.onmessage= this.onMessage.bind( this, task );
  worker.onerror= this.onError.bind( this, task );
  worker.postMessage( {
    fn: task.fn.toString(),
    context: task.context,
    version: task.version,
    inputsComplete: task.inputsComplete
  } );
}

/*--------------------------------------------------------------------
 */
m4_member(WorkerPool, onMessage)
function onMessage( task, event ) {
  event.data.version= task.version;
  if (event.data.error) {
    LOG(STREAM, task.stream.mm.name + ' [' + task.stream.generation + '-' +
        task.version + '] failed ' + JSON.stringify( event.data.error ))
    task.stream.onError( event.data, this );
    this.returnWorker( task.worker );
  }
  else if (event.data.complete) {
    LOG(STREAM, task.stream.mm.name + ' [' + task.stream.generation + '-' +
        task.version + '] returned ' + JSON.stringify( event.data.result ))
    task.stream.onCompleted( event.data, this );
    this.returnWorker( task.worker );
  }
  else {
    LOG(STREAM, task.stream.mm.name + ' [' + task.stream.generation + '-' +
        task.version + '] yielded ' + JSON.stringify( event.data.result ))
    task.stream.onNext( event.data, this );
  }
}

/*--------------------------------------------------------------------
 */
m4_member(WorkerPool, onError)
function onError( task, event ) {
  LOG(STREAM, task.stream.mm.name + ' [' + task.stream.generation + '-' +
      task.version + '] failed ' + JSON.stringify( event.data ))
  event.data.version= task.version;
  task.stream.onError( {error: event.data} );
  this.killWorker( task.worker );
}

/*--------------------------------------------------------------------
 */
m4_member(WorkerPool, cancelBefore)
function cancelBefore( stream, version ) {
  var newRunning= [];
  this.running.forEach( function( task ) {
    if (task.stream === stream && task.version < version) {
      LOG(STREAM, task.stream.mm.name + ' [' + task.stream.generation + '-' +
          task.version + '] canceled')
      task.worker.terminate();
    }
    else {
      newRunning.push( task );
    }
  } );
  this.running= newRunning;
}

/*--------------------------------------------------------------------
 */
m4_member(WorkerPool, returnWorker)
function returnWorker( worker ) {
  if (this.queued.length > 0) {
    var task= this.queued.shift();
    this.execute( worker, task );
  }
  else {
    var i= this.indexOf( worker );
    if (i >= 0) {
      this.running.splice( i, 1 );
      worker.onmessage= noop;
      worker.onerror= noop;
      this.available.push( worker );
    }
  }
}

/*--------------------------------------------------------------------
 */
m4_member(WorkerPool, killWorker)
function killWorker( worker ) {
  var i= this.indexOf( worker );
  if (i >= 0) {
    this.running.splice( i, 1 );
  }
  worker.terminate();
}

/*--------------------------------------------------------------------
 */
m4_member(WorkerPool, indexOf)
function indexOf( worker ) {
  var length= this.running.length;
  for (var i= 0; i < length; ++i) {
    if (this.running[i].worker === worker) {
      return i;
    }
  }
  return -1;
}