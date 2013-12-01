m4_module
m4_import(utility.makeObservable)
m4_export(Stabilizer)

function Stabilizer( time_ms ) {
  this.task= null;
  this.time= time_ms ? time_ms : 400;
}

makeObservable( Stabilizer.prototype );

m4_member(Stabilizer, onNext)
function onNext( value, source ) {
  if (this.task) {
    clearTimeout( this.task );
  }
  var This= this;
  this.task= setTimeout( function() {
    This.task= null;
    This.sendNext( value, source );
  }, this.time );
}

m4_member(Stabilizer, onCompleted)
function onCompleted( value, source ) {
  if (this.task) {
    clearTimeout( this.task );
    this.task= null;
  }
  this.sendCompleted( value, source );
}

m4_member(Stabilizer, onError)
function onError( value, source ) {
  if (this.task) {
    clearTimeout( this.task );
    this.task= null;
  }
  this.sendError( value, source );
}
