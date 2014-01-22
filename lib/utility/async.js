m4_module

m4_import(utility.WorkerPool)
m4_export(setPoolSize,
          async)

var globalPool= new WorkerPool();

function setPoolSize( n ) {
  globalPool.max= n;
}

function async( fn, numOutputs ) {
  return function() { return globalPool.schedule( fn, this, numOutputs ) };
}
