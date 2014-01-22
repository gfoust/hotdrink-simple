m4_module
m4_import(utility.noop,
          utility.shallowCopy,
          utility.Promise)
m4_export(WorkerPool)

var source= 'worker.js';

/*====================================================================
 */
function Task( pool, fn, context, numOutputs ) {
  this.fn= fn;
  this.context= shallowCopy( context );
  this.outputPromises= [];
  for (var i= 0; i < numOutputs; ++i) {
    this.outputPromises[i]= new Promise( pool, this );
  }
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
function schedule( fn, context, numOutputs ) {
  if (numOutputs === undefined) { numOutputs= 1; }

  task= new Task( this, fn, context, numOutputs );
  this.queued.push( task );
  this.checkQueue();

  return numOutputs == 1 ? task.outputPromises[0] : task.outputPromises;
}


/*--------------------------------------------------------------------
 */
m4_member(WorkerPool, checkQueue)
function checkQueue() {
  while (this.queued.length > 0 && this.available.length > 0) {
    this.execute( this.available.shift(), this.queued.shift() );
  }

  while (this.queued.length > 0 && this.running.length < this.max) {
    this.execute( new Worker( source ), this.queued.shift() );
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
    context: task.context
  } );
}

/*--------------------------------------------------------------------
 */
m4_member(WorkerPool, promiseIrrelevant)
function promiseIrrelevant( promise ) {
  var task= promise.target;
  if (! task.outputPromises.any( isRelevant )) {
    if (task.worker) {
      this.killWorker( task.worker );
    }
    else {
      this.dequeue( task );
    }
  }
}

function isRelevant() {
  return this.subscriptions && this.subscriptions.length != 0;
}

/*--------------------------------------------------------------------
 */
m4_member(WorkerPool, onMessage)
function onMessage( task, event ) {
  if (event.data.error) {
    LOG(POOL, 'Task failed: ' + JSON.stringify( event.data.error ))
    this.returnWorker( task.worker );
  }
  else if (event.data.complete) {
    LOG(POOL, 'Task completed: ' + JSON.stringify( event.data.result ))
    var result= event.data.result;
    if (task.outputPromises.length == 1) {
      task.outputPromises[0].onCompleted( result );
    }
    else {
      for (var i= 0; i < task.outputPromises.length; ++i) {
        task.outputPromises[i].onCompleted( result[i] );
      }
    }
    this.returnWorker( task.worker );
  }
  else {
     LOG(POOL, 'Task yielded: ' + JSON.stringify( event.data.result ))
    var result= event.data.result;
    if (task.outputPromises.length == 1) {
      task.outputPromises[0].onNext( result );
    }
    else {
      for (var i= 0; i < task.outputPromises.length; ++i) {
        task.outputPromises[i].onNext( result[i] );
      }
    }
  }
}


/*--------------------------------------------------------------------
 */
m4_member(WorkerPool, onError)
function onError( task, event ) {
  LOG(POOL, 'Task failed: ' + JSON.stringify( event.data ))
  this.killWorker( task.worker );
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
m4_member(WorkerPool, dequeue)
function dequeue( task ) {
  var i= this.queued.indexOf( task );
  if (i >= 0) {
    this.queued.splice( i, 1 );
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
  this.checkQueue();
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
